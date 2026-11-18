// Sincroniza la documentación MkDocs de un repo con un espacio de Docmost.
//
//   node --env-file=../.env sincronizar.mjs --repo <carpeta> \
//        [--titulo "Nombre"] [--fuente https://github.com/DevHRL/x/blob/main]
//
// Lee `mkdocs.yml` (site_name, docs_dir y nav) y deja en Docmost una página raíz
// por repo con las páginas del nav debajo, en el mismo orden. Es en un solo
// sentido: lo que se edite en Docmost dentro de estas páginas se pisa en la
// siguiente sincronización. Las páginas que ya no están en el repo van a la
// papelera de Docmost (se pueden restaurar).
//
// Variables: DOCMOST_URL, DOCMOST_EMAIL, DOCMOST_PASSWORD, DOCMOST_SPACE.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';
import { generateNJitteredKeysBetween } from 'fractional-indexing-jittered';
import { Docmost, requerir } from './cliente.mjs';

// ---------------------------------------------------------------------------
// Entrada

const { values: args } = parseArgs({
  options: {
    repo: { type: 'string', default: '.' },
    titulo: { type: 'string' },
    fuente: { type: 'string' },
  },
});
const env = requerir(['DOCMOST_URL', 'DOCMOST_EMAIL', 'DOCMOST_PASSWORD', 'DOCMOST_SPACE']);

const repoDir = path.resolve(args.repo);
const mkdocsPath = path.join(repoDir, 'mkdocs.yml');
const mkdocs = existsSync(mkdocsPath)
  ? parseYaml(await readFile(mkdocsPath, 'utf8'), { logLevel: 'silent' }) ?? {}
  : {};
const docsDir = path.join(repoDir, mkdocs.docs_dir ?? 'docs');
if (!existsSync(docsDir)) {
  console.error(`No existe la carpeta de documentación: ${docsDir}`);
  process.exit(1);
}
const tituloRaiz = args.titulo ?? mkdocs.site_name ?? path.basename(repoDir);
const fuente = args.fuente?.replace(/\/+$/, '');
const espacioSlug = env.DOCMOST_SPACE;

// Cambiar si cambia la conversión, para forzar que se reescriban todas las páginas.
const VERSION_FORMATO = '3';

const avisos = [];
const avisar = (msg) => {
  avisos.push(msg);
  console.warn(`  ⚠ ${msg}`);
};

// ---------------------------------------------------------------------------
// 1. Árbol deseado a partir del nav (o de las carpetas si no hay nav)

/** @typedef {{titulo: string|null, archivo: string|null, hijos: Nodo[], pagina?: any}} Nodo */

function nodosDesdeNav(items) {
  const nodos = [];
  for (const item of items ?? []) {
    if (typeof item === 'string') {
      nodos.push({ titulo: null, archivo: item, hijos: [] });
      continue;
    }
    for (const [titulo, valor] of Object.entries(item)) {
      if (Array.isArray(valor)) {
        // Un index.md sin título dentro de la sección es su portada (como
        // navigation.indexes de MkDocs): va en la página de la sección, no debajo.
        const hijos = nodosDesdeNav(valor);
        const i = hijos.findIndex(
          (h) => h.titulo === null && !h.hijos.length && /(^|\/)(index|readme)\.md$/i.test(h.archivo),
        );
        const portada = i >= 0 ? hijos.splice(i, 1)[0].archivo : null;
        nodos.push({ titulo, archivo: portada, hijos });
      } else if (/^[a-z]+:\/\//i.test(valor)) {
        avisar(`Enlace externo del nav omitido: ${titulo} → ${valor}`);
      } else {
        nodos.push({ titulo, archivo: valor, hijos: [] });
      }
    }
  }
  return nodos;
}

async function nodosDesdeCarpeta(dir) {
  const entradas = (await readdir(dir, { withFileTypes: true }))
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const nodos = [];
  for (const e of entradas) {
    const rel = path.relative(docsDir, path.join(dir, e.name)).split(path.sep).join('/');
    if (e.isDirectory()) {
      const hijos = await nodosDesdeCarpeta(path.join(dir, e.name));
      if (!hijos.length) continue;
      const i = hijos.findIndex((h) => /^(index|readme)\.md$/i.test(path.basename(h.archivo ?? '')));
      const portada = i >= 0 ? hijos.splice(i, 1)[0] : null;
      nodos.push({ titulo: portada ? null : e.name, archivo: portada?.archivo ?? null, hijos });
    } else if (e.name.toLowerCase().endsWith('.md')) {
      nodos.push({ titulo: null, archivo: rel, hijos: [] });
    }
  }
  return nodos;
}

const nodos = mkdocs.nav ? nodosDesdeNav(mkdocs.nav) : await nodosDesdeCarpeta(docsDir);

// La portada (index.md) es el contenido de la página raíz del repo.
const iPortada = nodos.findIndex((n) => n.archivo && /^(index|readme)\.md$/i.test(n.archivo));
/** @type {Nodo} */
const raiz = {
  titulo: tituloRaiz,
  archivo: iPortada >= 0 ? nodos.splice(iPortada, 1)[0].archivo : null,
  hijos: nodos,
};

// Lee cada archivo una vez; el título sale del nav, del front matter o del primer #.
const fuentes = new Map(); // archivo -> { texto, titulo }
async function cargar(nodo) {
  if (nodo.archivo) {
    const abs = path.join(docsDir, nodo.archivo);
    if (!existsSync(abs)) {
      avisar(`El nav apunta a un archivo que no existe: ${nodo.archivo}`);
      nodo.archivo = null;
    } else {
      const { cuerpo, titulo } = separarTitulo(await readFile(abs, 'utf8'));
      fuentes.set(nodo.archivo, { texto: cuerpo });
      nodo.titulo ??= titulo ?? path.basename(nodo.archivo, '.md');
    }
  }
  for (const h of nodo.hijos) await cargar(h);
}
await cargar(raiz);

/** Quita el front matter y el primer encabezado H1 (Docmost ya muestra el título). */
function separarTitulo(texto) {
  let titulo = null;
  let cuerpo = texto.replace(/^﻿/, '');
  const fm = cuerpo.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fm) {
    try {
      titulo = parseYaml(fm[1])?.title ?? null;
    } catch { /* front matter inválido: se ignora */ }
    cuerpo = cuerpo.slice(fm[0].length);
  }
  const h1 = cuerpo.match(/^\s*#\s+(.+?)\s*#*\s*(\r?\n|$)/);
  if (h1) {
    titulo ??= h1[1];
    cuerpo = cuerpo.slice(h1[0].length);
  }
  return { cuerpo, titulo };
}

// ---------------------------------------------------------------------------
// 2. Crear, ordenar y limpiar la estructura de páginas en Docmost

const dm = await new Docmost(env.DOCMOST_URL).login(env.DOCMOST_EMAIL, env.DOCMOST_PASSWORD);
const espaciosDelBot = await dm.todos('spaces');
const espacio = espaciosDelBot.find((s) => s.slug === espacioSlug);
if (!espacio) {
  console.error(
    `No existe el espacio «${espacioSlug}» o el bot no es su miembro. El bot publica, así que tiene que ` +
    'ser escritor del espacio: conectar-proyecto.mjs lo agrega (o, desde Docmost, Configuración del ' +
    'espacio → Miembros → bot como Escritor).',
  );
  console.error(`  El bot ve: ${espaciosDelBot.map((s) => `${s.name} (${s.slug})`).join(', ') || 'ningún espacio'}`);
  process.exit(1);
}

const stats = { creadas: 0, actualizadas: 0, restauradas: 0, sinCambios: 0, borradas: 0, movidas: 0, archivos: 0 };
// Id del bot, del token de sesión (JWT, campo sub). No se pregunta a /api/users/me:
// la puerta de GitHub no deja pasar esa ruta sin sesión de GitHub.
const botId = JSON.parse(Buffer.from(dm.token.split('.')[1], 'base64url').toString('utf8')).sub;

const hijosDe = (padre) =>
  padre ? dm.todos('pages/sidebar-pages', { pageId: padre.id }) : dm.todos('pages/sidebar-pages', { spaceId: espacio.id });

async function crearPagina(titulo, padre) {
  stats.creadas++;
  console.log(`  + ${titulo}`);
  return dm.post('pages/create', {
    spaceId: espacio.id,
    parentPageId: padre?.id,
    title: titulo,
  });
}

// Raíz del repo: una página en la raíz del espacio, identificada por su título.
const enRaiz = await hijosDe(null);
raiz.pagina = enRaiz.find((p) => p.title === raiz.titulo) ?? (await crearPagina(raiz.titulo, null));

async function asegurarHijos(nodo) {
  const actuales = await hijosDe(nodo.pagina);
  const libres = new Map(actuales.map((p) => [p.id, p]));

  for (const hijo of nodo.hijos) {
    const existente = [...libres.values()].find((p) => p.title === hijo.titulo);
    if (existente) {
      libres.delete(existente.id);
      hijo.pagina = existente;
    } else {
      hijo.pagina = await crearPagina(hijo.titulo, nodo.pagina);
    }
  }

  // Lo que ya no está en el repo va a la papelera.
  for (const p of libres.values()) {
    console.log(`  − ${p.title}`);
    await dm.post('pages/delete', { pageId: p.id });
    stats.borradas++;
  }

  // Mismo orden que el nav.
  const deseado = nodo.hijos.map((h) => h.pagina.id);
  const actual = (await hijosDe(nodo.pagina))
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
    .map((p) => p.id);
  if (deseado.join() !== actual.join()) {
    const claves = generateNJitteredKeysBetween(null, null, deseado.length);
    for (const [i, pageId] of deseado.entries()) {
      await dm.post('pages/move', { pageId, parentPageId: nodo.pagina.id, position: claves[i] });
    }
    stats.movidas += deseado.length;
  }

  for (const hijo of nodo.hijos) await asegurarHijos(hijo);
}
await asegurarHijos(raiz);

// archivo .md -> página, para reescribir los enlaces entre páginas
const paginaDeArchivo = new Map();
(function indexar(n) {
  if (n.archivo) paginaDeArchivo.set(path.posix.normalize(n.archivo), n.pagina);
  n.hijos.forEach(indexar);
})(raiz);

// ---------------------------------------------------------------------------
// 3. Contenido de cada página

const TIPOS_IMAGEN = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp',
};
const TIPO_AVISO = {
  note: 'info', info: 'info', abstract: 'info', summary: 'info', tldr: 'info', tip: 'info',
  hint: 'info', important: 'info', question: 'info', help: 'info', faq: 'info', example: 'info',
  quote: 'info', cite: 'info', todo: 'info', success: 'success', check: 'success', done: 'success',
  warning: 'warning', caution: 'warning', attention: 'warning',
  danger: 'danger', error: 'danger', failure: 'danger', fail: 'danger', missing: 'danger', bug: 'danger',
};

// Ruta de la aplicación (no la de lectura pública /docs): los espacios de proyecto no se
// publican, y todo miembro de DevHRL tiene cuenta al entrar con GitHub.
const urlPagina = (p) => `/s/${espacioSlug}/p/${slugTitulo(p.title)}-${p.slugId}`;

function slugTitulo(titulo) {
  return (titulo || 'untitled').slice(0, 70).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

const esRelativa = (url) => !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url);
const repoRel = (abs) => path.relative(repoDir, abs).split(path.sep).join('/');
const enlaceFuente = (abs) => (fuente ? `${fuente}/${repoRel(abs)}` : null);

/**
 * Aplica `fn(texto)` solo a los tramos fuera de bloques de código ``` o ~~~,
 * para no tocar los ejemplos. Solo cuentan las vallas con menos de 4 espacios:
 * las más indentadas están dentro de un aviso y viajan con él.
 */
function fueraDeCodigo(texto, fn) {
  const salida = [];
  let tramo = [];
  let valla = null;
  const volcar = () => {
    if (tramo.length) salida.push(fn(tramo.join('\n')));
    tramo = [];
  };
  for (const l of texto.split(/\r?\n/)) {
    const m = l.match(/^ {0,3}(`{3,}|~{3,})/);
    if (valla) {
      salida.push(l);
      if (m && m[1][0] === valla[0] && m[1].length >= valla.length && !l.trim().slice(m[1].length)) valla = null;
    } else if (m) {
      volcar();
      valla = m[1];
      salida.push(l);
    } else {
      tramo.push(l);
    }
  }
  volcar();
  return salida.join('\n');
}

/** Aplica `fn` sin tocar el código en línea (`...`), donde los ejemplos de sintaxis no son enlaces. */
function sinCodigoEnLinea(texto, fn) {
  const guardados = [];
  const marcado = texto.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m) => `@@cod${guardados.push(m) - 1}@@`);
  return fn(marcado).replace(/@@cod(\d+)@@/g, (_, i) => guardados[Number(i)]);
}

/** `!!! warning "Título"` + bloque indentado  →  `:::warning` de Docmost. */
function convertirAvisos(texto) {
  const lineas = texto.split('\n');
  const salida = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^(\s*)(?:!!!|\?\?\?\+?)\s+([\w-]+)(?:\s+"([^"]*)")?\s*$/);
    if (!m) {
      salida.push(lineas[i]);
      continue;
    }
    const sangria = m[1].length + 4;
    const cuerpo = [];
    while (i + 1 < lineas.length) {
      const sig = lineas[i + 1];
      if (sig.trim() === '' || sig.match(/^\s*/)[0].length >= sangria) {
        cuerpo.push(sig.slice(Math.min(sangria, sig.length)));
        i++;
      } else break;
    }
    while (cuerpo.length && cuerpo.at(-1).trim() === '') cuerpo.pop();
    const tipo = TIPO_AVISO[m[2].toLowerCase()] ?? 'info';
    salida.push('', `:::${tipo}`, ...(m[3] ? [`**${m[3]}**`, ''] : []), ...cuerpo, ':::', '');
  }
  return salida.join('\n');
}

/**
 * Prepara el Markdown de una página. Las imágenes quedan como marcadores
 * (`@@img0@@`) y se suben recién al escribir, solo si la página cambió.
 * La huella resume el Markdown y el contenido de las imágenes.
 */
function prepararPagina(nodo) {
  let md;
  let dirBase;
  if (nodo.archivo) {
    md = fuentes.get(nodo.archivo).texto;
    dirBase = path.dirname(path.join(docsDir, nodo.archivo));
  } else {
    // Sección sin archivo propio: índice de sus páginas.
    md = nodo.hijos.map((h) => `- [${h.titulo}](${urlPagina(h.pagina)})`).join('\n');
    dirBase = docsDir;
  }

  const imagenes = []; // { abs, nombre, tipo, marca }
  function imagen(ruta) {
    const abs = path.resolve(dirBase, decodeURI(ruta));
    const previa = imagenes.find((i) => i.abs === abs);
    if (previa) return previa;
    const tipo = TIPOS_IMAGEN[path.extname(abs).toLowerCase()];
    if (!tipo || !existsSync(abs)) {
      avisar(`${nodo.archivo ?? nodo.titulo}: imagen no encontrada o tipo no admitido: ${ruta}`);
      return null;
    }
    const nombre = path.relative(docsDir, abs).split(path.sep).join('__').replace(/[^\w.-]/g, '_');
    const img = { abs, nombre, tipo, marca: `@@img${imagenes.length}@@` };
    imagenes.push(img);
    return img;
  }
  // Ruta relativa + data-attachment-id: así Docmost firma la URL para los
  // lectores del espacio público (con una URL absoluta da 401).
  const etiquetaImg = (img, alt, titulo) =>
    `<img src="${img.marca}src" alt="${escaparAttr(alt)}"${titulo ? ` title="${escaparAttr(titulo)}"` : ''} data-attachment-id="${img.marca}id">`;

  function enlace(destino) {
    if (!esRelativa(destino)) return destino;
    const [ruta, ancla] = destino.split('#');
    if (!ruta) return destino;
    const abs = path.resolve(dirBase, decodeURI(ruta));
    const rel = path.relative(docsDir, abs).split(path.sep).join('/');
    const dest = paginaDeArchivo.get(rel) ?? paginaDeArchivo.get(rel.replace(/\/?$/, '/index.md'));
    if (dest) return urlPagina(dest) + (ancla ? `#${ancla}` : '');
    if (existsSync(abs) && fuente) return enlaceFuente(abs) + (ancla ? `#${ancla}` : '');
    avisar(`${nodo.archivo ?? nodo.titulo}: enlace roto: ${destino}`);
    return null;
  }

  md = fueraDeCodigo(md, convertirAvisos);
  // Imágenes Markdown y <img>; luego enlaces (incluidas definiciones [x]: ruta).
  // Un enlace roto queda como texto: Docmost convertiría «x.md» en https://x.md/.
  md = fueraDeCodigo(md, (t) => sinCodigoEnLinea(t, (t) => t
    .replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g, (m, alt, src, tit) => {
      const img = esRelativa(src) && imagen(src);
      return img ? etiquetaImg(img, alt, tit) : m;
    })
    .replace(/<img\b[^>]*?\bsrc="([^"]+)"[^>]*>/gi, (m, src) => {
      if (src.startsWith('@@img')) return m;
      const img = esRelativa(src) && imagen(src);
      return img ? etiquetaImg(img, m.match(/\balt="([^"]*)"/i)?.[1] ?? '') : m;
    })
    .replace(/(?<![!\\])\[([^\]]*)\]\(\s*<?([^)\s>]+)>?((?:\s+"[^"]*")?)\s*\)/g, (m, txt, dest, tit) => {
      const url = enlace(dest);
      return url === null ? txt : `[${txt}](${url}${tit})`;
    })
    .replace(/^(\s{0,3}\[[^\]]+\]:\s*)(\S+)/gm, (m, a, dest) => a + (enlace(dest) ?? dest))));

  const h = createHash('sha256').update(VERSION_FORMATO).update(md);
  for (const img of imagenes) h.update(readFileSync(img.abs));
  const huella = h.digest('hex').slice(0, 12);

  const origen = nodo.archivo ? path.join(docsDir, nodo.archivo) : null;
  const archivoFuente = origen
    ? (fuente ? `[${repoRel(origen)}](${enlaceFuente(origen)})` : `\`${repoRel(origen)}\``)
    : 'nav de `mkdocs.yml`';
  const pie = `\n\n---\n\n*Fuente: ${archivoFuente} · rev. ${huella}. ` +
    'Esta página se actualiza desde GitHub; los cambios hechos aquí se pierden.*\n';
  return { markdown: md.trim() + pie, imagenes, huella };
}

/** Sube las imágenes (reutilizando el adjunto previo con el mismo nombre) y borra las que sobran. */
async function subirImagenes(pagina, imagenes, markdown) {
  const adjuntos = await dm.todos('pages/attachments', { pageId: pagina.id }).catch(() => []);
  const porNombre = new Map(adjuntos.map((a) => [a.fileName, a]));
  for (const img of imagenes) {
    const subido = await dm.subirArchivo({
      pageId: pagina.id, nombre: img.nombre, tipo: img.tipo,
      contenido: readFileSync(img.abs), attachmentId: porNombre.get(img.nombre)?.id,
    });
    stats.archivos++;
    markdown = markdown
      .replaceAll(`${img.marca}src`, `/api/files/${subido.id}/${encodeURIComponent(subido.fileName)}`)
      .replaceAll(`${img.marca}id`, subido.id);
  }
  const usados = new Set(imagenes.map((i) => i.nombre));
  for (const a of adjuntos) {
    if (!usados.has(a.fileName)) await dm.post('attachments/delete', { attachmentId: a.id }).catch(() => {});
  }
  return markdown;
}

function escaparAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function escribir(nodo) {
  const { markdown, imagenes, huella } = prepararPagina(nodo);
  const actual = await dm.post('pages/info', { pageId: nodo.pagina.id });
  const mismaRevision = JSON.stringify(actual?.content ?? '').includes(`rev. ${huella}`);
  // Si alguien la editó en Docmost después del bot, se vuelve a escribir: la página
  // tiene que ser igual al repo aunque el Markdown no haya cambiado.
  const editadaAMano = actual?.lastUpdatedById && actual.lastUpdatedById !== botId;
  if (mismaRevision && !editadaAMano) {
    stats.sinCambios++;
  } else {
    await dm.post('pages/update', {
      pageId: nodo.pagina.id,
      content: await subirImagenes(nodo.pagina, imagenes, markdown),
      format: 'markdown',
      operation: 'replace',
    });
    if (mismaRevision) {
      stats.restauradas++;
      console.log(`  ↺ ${nodo.titulo} (la editó en Docmost ${actual.lastUpdatedBy?.name ?? 'otra persona'}; vuelve a ser igual al repo)`);
    } else {
      stats.actualizadas++;
      console.log(`  ✎ ${nodo.titulo}`);
    }
  }
  for (const h of nodo.hijos) await escribir(h);
}

console.log(`Contenido de «${raiz.titulo}»:`);
await escribir(raiz);

console.log(
  `✓ Listo: ${stats.creadas} creadas, ${stats.actualizadas} actualizadas, ` +
  `${stats.restauradas ? `${stats.restauradas} restauradas (editadas a mano), ` : ''}${stats.sinCambios} sin cambios, ` +
  `${stats.borradas} a la papelera, ${stats.archivos} imágenes subidas` +
  `${stats.movidas ? `, orden corregido` : ''}.`,
);
console.log(`  Lectura: ${env.DOCMOST_URL}${urlPagina(raiz.pagina)}`);
if (avisos.length) console.log(`  ${avisos.length} aviso(s); revisa los ⚠ de arriba.`);
