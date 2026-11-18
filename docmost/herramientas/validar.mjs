// Valida la documentación de un repo: que siga el «Documento del sistema» y que
// esté al día con el código.
//
//   node validar.mjs --repo <carpeta> [--base <commit>] [--plantilla <carpeta>]
//
// Errores (el check queda en rojo):
//   · Estructura: mkdocs.yml con nav; las 15 páginas de la plantilla, con sus títulos
//     y en su orden; cada una con las secciones (##) de la plantilla.
//   · Publicación: todo .md de docs/ está en el nav y todo lo del nav existe.
//   · Enlaces: ningún enlace o imagen apunta a un archivo que no existe (tampoco al
//     código del repo: si el código se borró o se movió, la documentación quedó vieja).
//   · Configuración: cada variable de los .env.example aparece en «Despliegue y operación».
//   · Con --base (pull requests): si el PR cambia algo que vigila una página
//     (dependencias, Docker, migraciones, rutas…), esa página cambia en el mismo PR.
//     Se rebaja a aviso si el PR marca «No aplica, porque: …».
// Avisos: textos de ejemplo de la plantilla ([…]) y notas «Qué va aquí» sin quitar.
//
// En GitHub Actions deja anotaciones en los archivos y un resumen del job.

import { readFileSync, readdirSync, existsSync, statSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';

const { values: args } = parseArgs({
  options: {
    repo: { type: 'string', default: '.' },
    base: { type: 'string' },
    plantilla: { type: 'string' },
  },
});
const aqui = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(args.repo);
const plantillaDir = path.resolve(args.plantilla ?? path.join(aqui, 'plantilla-repo'));
const enActions = process.env.GITHUB_ACTIONS === 'true';

/** @type {{nivel: 'error'|'aviso', grupo: string, msg: string, archivo?: string, linea?: number}[]} */
const hallazgos = [];
const error = (grupo, msg, archivo, linea) => hallazgos.push({ nivel: 'error', grupo, msg, archivo, linea });
const aviso = (grupo, msg, archivo, linea) => hallazgos.push({ nivel: 'aviso', grupo, msg, archivo, linea });
const encontradas = new Map(); // título de página obligatoria -> nodo del nav
const pendientesPorPagina = new Map(); // archivo -> n.º de pendientes
const archivosDe = (n) => [...(n.archivo ? [n.archivo] : []), ...n.hijos.flatMap(archivosDe)];

const rel = (abs) => path.relative(repoDir, abs).split(path.sep).join('/');
const leerYaml = (f) => parseYaml(readFileSync(f, 'utf8'), { logLevel: 'silent' }) ?? {};
const lineaDe = (texto, i) => texto.slice(0, i).split('\n').length;

/** Reemplaza el código (bloques e inline) por espacios: no cuenta, pero conserva las líneas. */
function sinCodigo(texto) {
  const tapar = (m) => m.replace(/[^\n]/g, ' ');
  return texto.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, tapar).replace(/`[^`\n]*`/g, tapar);
}

const titulosH2 = (texto) =>
  [...sinCodigo(texto).matchAll(/^##\s+(.+?)\s*#*\s*$/gm)].map((m) => ({ titulo: m[1], linea: lineaDe(texto, m.index) }));

// ---------------------------------------------------------------------------
// 1. La plantilla: páginas obligatorias y sus secciones

const plantilla = leerYaml(path.join(plantillaDir, 'mkdocs.yml'));
const obligatorias = plantilla.nav.map((item) => {
  const [titulo, archivo] = Object.entries(item)[0];
  const texto = readFileSync(path.join(plantillaDir, 'docs', archivo), 'utf8');
  return { titulo, archivoPlantilla: archivo, secciones: titulosH2(texto).map((h) => h.titulo) };
});
const PORTADA = obligatorias[0]; // Inicio: index.md

// ---------------------------------------------------------------------------
// 2. El repo: mkdocs.yml y nav

const mkdocsPath = path.join(repoDir, 'mkdocs.yml');
if (!existsSync(mkdocsPath)) {
  error('Estructura', 'Falta mkdocs.yml en la raíz del repo. Cópialo de la plantilla (herramientas/plantilla-repo).');
  terminar();
}
const mkdocs = leerYaml(mkdocsPath);
const docsDir = path.join(repoDir, mkdocs.docs_dir ?? 'docs');
const docsRel = rel(docsDir);
if (!Array.isArray(mkdocs.nav)) {
  error('Estructura', 'mkdocs.yml no tiene nav: sin él no se puede saber qué se publica ni en qué orden.', 'mkdocs.yml', 1);
  terminar();
}
if (!mkdocs.site_name || /^\[.*\]$/.test(mkdocs.site_name)) {
  error('Estructura', 'site_name de mkdocs.yml debe ser el nombre del sistema.', 'mkdocs.yml', 1);
}

const textoMkdocs = readFileSync(mkdocsPath, 'utf8');
const lineaEnMkdocs = (aguja) => {
  const i = textoMkdocs.indexOf(aguja);
  return i >= 0 ? lineaDe(textoMkdocs, i) : 1;
};

/** Árbol del nav: {titulo, archivo, hijos}. Una sección toma como portada su index.md sin título. */
function arbol(items) {
  const nodos = [];
  for (const item of items ?? []) {
    if (typeof item === 'string') {
      nodos.push({ titulo: null, archivo: item, hijos: [] });
      continue;
    }
    for (const [titulo, valor] of Object.entries(item)) {
      if (Array.isArray(valor)) {
        const hijos = arbol(valor);
        const i = hijos.findIndex(
          (h) => h.titulo === null && !h.hijos.length && /(^|\/)(index|readme)\.md$/i.test(h.archivo),
        );
        const portada = i >= 0 ? hijos.splice(i, 1)[0].archivo : null;
        nodos.push({ titulo, archivo: portada, hijos, seccion: true });
      } else if (/^[a-z]+:\/\//i.test(valor)) {
        // enlace externo: no es una página
      } else {
        nodos.push({ titulo, archivo: valor, hijos: [] });
      }
    }
  }
  return nodos;
}
const nav = arbol(mkdocs.nav);
const enNav = new Set(nav.flatMap(archivosDe).map((a) => path.posix.normalize(a)));

// Páginas obligatorias: presentes, con su título y en orden.
const iPortada = nav.findIndex((n) => n.archivo && /^(index|readme)\.md$/i.test(n.archivo));
if (iPortada < 0) {
  error('Estructura', `Falta la portada: «${PORTADA.titulo}: index.md» como primera entrada del nav.`, 'mkdocs.yml', lineaEnMkdocs('nav:'));
} else {
  encontradas.set(PORTADA.titulo, { ...nav[iPortada], indice: iPortada });
}
for (const req of obligatorias.slice(1)) {
  const i = nav.findIndex((n) => n.titulo === req.titulo);
  if (i < 0) {
    error('Estructura', `Falta la página obligatoria «${req.titulo}» en el nav (con ese título exacto). Plantilla: docs/${req.archivoPlantilla}.`, 'mkdocs.yml', lineaEnMkdocs('nav:'));
    continue;
  }
  const nodo = nav[i];
  if (nodo.seccion && !nodo.archivo) {
    error('Estructura', `La sección «${req.titulo}» tiene subpáginas: su primera entrada debe ser su index.md, sin título, con el contenido de la plantilla.`, 'mkdocs.yml', lineaEnMkdocs(`${req.titulo}`));
    continue;
  }
  encontradas.set(req.titulo, { ...nodo, indice: i });
}
const orden = obligatorias.map((r) => encontradas.get(r.titulo)?.indice).filter((i) => i !== undefined);
if (orden.some((v, k) => k > 0 && v < orden[k - 1])) {
  error('Estructura', `Las páginas obligatorias deben ir en el orden de la plantilla: ${obligatorias.map((r) => r.titulo).join(' → ')}.`, 'mkdocs.yml', lineaEnMkdocs('nav:'));
}

// ---------------------------------------------------------------------------
// 3. Publicación: lo del nav existe y todo .md de docs/ está en el nav

for (const archivo of enNav) {
  if (!existsSync(path.join(docsDir, archivo))) {
    error('Publicación', `El nav apunta a ${docsRel}/${archivo}, que no existe.`, 'mkdocs.yml', lineaEnMkdocs(archivo));
  }
}
function recorrer(dir, filtro, saltar = () => false) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.env.example') continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!saltar(e.name)) out.push(...recorrer(abs, filtro, saltar));
    } else if (filtro(e.name)) out.push(abs);
  }
  return out;
}
for (const abs of recorrer(docsDir, (n) => n.toLowerCase().endsWith('.md'))) {
  const r = path.relative(docsDir, abs).split(path.sep).join('/');
  if (!enNav.has(r)) {
    error('Publicación', `${rel(abs)} no está en el nav de mkdocs.yml: no se publica. Agrégalo al nav o bórralo.`, rel(abs), 1);
  }
}

// ---------------------------------------------------------------------------
// 4. Contenido de cada página obligatoria

const leer = (archivo) => {
  const abs = path.join(docsDir, archivo);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
};

for (const req of obligatorias) {
  const nodo = encontradas.get(req.titulo);
  if (!nodo?.archivo) continue;
  const texto = leer(nodo.archivo);
  if (texto === null) continue;
  const archivoRel = `${docsRel}/${nodo.archivo}`;
  const presentes = new Set(titulosH2(texto).map((h) => h.titulo));
  const faltan = req.secciones.filter((s) => !presentes.has(s));
  if (faltan.length) {
    error('Estructura', `«${req.titulo}» no tiene las secciones de la plantilla: ${faltan.map((s) => `«## ${s}»`).join(', ')}. Si una no aplica, deja la sección y explica por qué.`, archivoRel, 1);
  }
}

// Pendientes en todas las páginas publicadas (obligatorias o no).
const PLACEHOLDER = /(?<![!\\])\[(?!\s?\]|[xX]\]|\^)([^\]\n]{1,160})\](?![(\[:])/g;
for (const archivo of enNav) {
  const texto = leer(archivo);
  if (texto === null) continue;
  const limpio = sinCodigo(texto);
  const archivoRel = `${docsRel}/${archivo}`;
  let n = 0;
  for (const m of limpio.matchAll(/^!!!\s+\w+\s+"Qué va aquí"/gm)) {
    n++;
    aviso('Pendientes', 'Queda la nota «Qué va aquí»: quítala cuando la página esté completa.', archivoRel, lineaDe(texto, m.index));
  }
  const ejemplos = [...limpio.matchAll(PLACEHOLDER)];
  if (ejemplos.length) {
    n += ejemplos.length;
    const primero = ejemplos[0];
    aviso('Pendientes', `${ejemplos.length} texto(s) de ejemplo o «Por completar» entre corchetes, como «[${primero[1].slice(0, 60)}]».`, archivoRel, lineaDe(texto, primero.index));
  }
  pendientesPorPagina.set(archivo, n);
}

// ---------------------------------------------------------------------------
// 5. Enlaces e imágenes a archivos que no existen

const ENLACE = /!?\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
for (const archivo of enNav) {
  const texto = leer(archivo);
  if (texto === null) continue;
  const limpio = sinCodigo(texto);
  const base = path.dirname(path.join(docsDir, archivo));
  for (const m of limpio.matchAll(ENLACE)) {
    const destino = m[1];
    if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(destino)) continue; // http:, mailto:, ancla, absoluta
    const limpioDestino = decodeURIComponent(destino.split('#')[0].split('?')[0]);
    if (!limpioDestino) continue;
    const abs = path.resolve(base, limpioDestino);
    if (!existsSync(abs)) {
      const fuera = !abs.startsWith(docsDir + path.sep);
      error(
        'Enlaces',
        fuera
          ? `Enlaza a ${rel(abs)}, que ya no existe en el repo: actualiza la documentación al código actual.`
          : `Enlace o imagen rota: ${destino}.`,
        `${docsRel}/${archivo}`,
        lineaDe(texto, m.index),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Variables de entorno documentadas en «Despliegue y operación»

const DESPLIEGUE = 'Despliegue y operación';
const nodoDespliegue = encontradas.get(DESPLIEGUE);
if (nodoDespliegue) {
  const textoDespliegue = archivosDe(nodoDespliegue).map((a) => leer(a) ?? '').join('\n');
  const SALTAR = new Set(['node_modules', 'dist', 'build', 'vendor', '.git', '.venv', 'venv', '__pycache__']);
  for (const abs of recorrer(repoDir, (n) => n === '.env.example', (n) => SALTAR.has(n) || n === path.basename(docsDir))) {
    const texto = readFileSync(abs, 'utf8');
    for (const m of texto.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)) {
      if (!new RegExp(`\\b${m[1]}\\b`).test(textoDespliegue)) {
        error('Configuración', `La variable ${m[1]} no aparece en «${DESPLIEGUE}» (tabla Configuración).`, rel(abs), lineaDe(texto, m.index));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Pull request: lo que cambia el código se refleja en la página que lo describe

const REGLAS = [
  {
    pagina: 'Stack tecnológico',
    rutas: ['**/package.json', '**/requirements*.txt', '**/pyproject.toml', '**/composer.json', '**/go.mod',
      '**/pom.xml', '**/build.gradle*', '**/Gemfile', '**/*.csproj'],
  },
  {
    pagina: 'Despliegue y operación',
    rutas: ['**/Dockerfile*', '**/docker-compose*.y*ml', '**/compose*.y*ml', '**/.env.example', '**/nginx*.conf',
      '**/Caddyfile', '.github/workflows/**'],
  },
  {
    pagina: 'Solución propuesta',
    rutas: ['**/migrations/**', '**/migraciones/**', '**/*.sql', '**/schema.prisma', '**/entities/**',
      '**/entidades/**', '**/models/**', '**/modelos/**', '**/routes/**', '**/rutas/**', '**/routers/**',
      '**/controllers/**', '**/controladores/**', '**/*.controller.*', '**/openapi*.y*ml', '**/openapi*.json'],
  },
  {
    pagina: 'Calidad y pruebas',
    rutas: ['**/jest.config.*', '**/vitest.config.*', '**/playwright.config.*', '**/cypress.config.*',
      '**/pytest.ini', '**/phpunit.xml*', '**/.github/workflows/*test*'],
  },
  { pagina: 'Plan, estado y versiones', rutas: ['**/CHANGELOG.md'] },
];
const NUNCA = ['.github/workflows/documentacion.yml', '.github/pull_request_template.md', '**/*.lock',
  '**/package-lock.json', '**/pnpm-lock.yaml', '**/yarn.lock', '**/poetry.lock', '**/composer.lock'];

function globARegex(glob) {
  let r = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') { i++; r += '(?:.*/)?'; } else r += '.*';
      } else r += '[^/]*';
    } else if (c === '?') r += '[^/]';
    else r += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${r}$`);
}
const coincide = (globs) => {
  const rx = globs.map(globARegex);
  return (f) => rx.some((x) => x.test(f));
};

function justificacionDelPr() {
  try {
    const evento = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const cuerpo = evento.pull_request?.body ?? '';
    return cuerpo.match(/-[ \t]*\[[xX]\][ \t]*No aplica,?[ \t]*porque:?[ \t]*(\S[^\n]*)/i)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

if (args.base) {
  let cambiados = [];
  try {
    cambiados = execFileSync('git', ['diff', '--name-only', `${args.base}...HEAD`], { cwd: repoDir, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (e) {
    aviso('Pull request', `No se pudo comparar con ${args.base} (${String(e.message).split('\n')[0]}); se omite la revisión de cambios.`);
  }
  const extra = mkdocs.extra?.docmost ?? {};
  const reglas = [...REGLAS, ...(extra.vigilar ?? [])];
  const ignorar = coincide([...NUNCA, ...(extra.no_vigilar ?? [])]);
  const esDoc = (f) => f === 'mkdocs.yml' || f.startsWith(`${docsRel}/`);
  const docsCambiados = new Set(cambiados.filter(esDoc));
  const codigo = cambiados.filter((f) => !esDoc(f) && !ignorar(f));
  const justificacion = justificacionDelPr();

  let algunaRegla = false;
  for (const regla of reglas) {
    const tocados = codigo.filter(coincide(regla.rutas));
    if (!tocados.length) continue;
    algunaRegla = true;
    const nodo = encontradas.get(regla.pagina);
    const archivos = nodo ? archivosDe(nodo).map((a) => `${docsRel}/${a}`) : [];
    if (archivos.some((a) => docsCambiados.has(a))) continue;
    const msg = `El PR cambia ${tocados.slice(0, 3).join(', ')}${tocados.length > 3 ? ` y ${tocados.length - 3} más` : ''}, pero no actualiza «${regla.pagina}»${archivos[0] ? ` (${archivos[0]})` : ''}.`;
    if (justificacion) aviso('Pull request', `${msg} Justificado en el PR: «${justificacion}».`, tocados[0], 1);
    else error('Pull request', `${msg} Actualízala o marca en el PR «No aplica, porque: …».`, tocados[0], 1);
  }
  if (!algunaRegla && codigo.length && !docsCambiados.size && !justificacion) {
    aviso('Pull request', `El PR cambia ${codigo.length} archivo(s) de código y ninguno de la documentación. Si no aplica, márcalo en el PR.`);
  }
}

terminar();

// ---------------------------------------------------------------------------
// Salida

function terminar() {
  const errores = hallazgos.filter((h) => h.nivel === 'error');
  const avisos = hallazgos.filter((h) => h.nivel === 'aviso');

  for (const h of hallazgos) {
    const donde = h.archivo ? `${h.archivo}${h.linea ? `:${h.linea}` : ''}: ` : '';
    console.log(`${h.nivel === 'error' ? '✗' : '⚠'} [${h.grupo}] ${donde}${h.msg}`);
    if (enActions) {
      const props = h.archivo ? ` file=${h.archivo}${h.linea ? `,line=${h.linea}` : ''},title=Documentación · ${h.grupo}` : ` title=Documentación · ${h.grupo}`;
      console.log(`::${h.nivel === 'error' ? 'error' : 'warning'}${props}::${h.msg.replace(/\n/g, ' ')}`);
    }
  }
  const resumen = errores.length
    ? `✗ ${errores.length} error(es) y ${avisos.length} aviso(s) en la documentación.`
    : `✓ La documentación cumple la plantilla y está al día con el código (${avisos.length} aviso(s)).`;
  console.log(`\n${resumen}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const filas = (lista) => lista.map((h) => `| ${h.grupo} | ${h.archivo ? `\`${h.archivo}${h.linea ? `:${h.linea}` : ''}\`` : '—'} | ${h.msg.replace(/\|/g, '\\|')} |`).join('\n');
    const completitud = obligatorias.map((r) => {
      const nodo = encontradas.get(r.titulo);
      if (!nodo) return `| ${r.titulo} | Falta |`;
      const n = archivosDe(nodo).reduce((s, a) => s + (pendientesPorPagina.get(a) ?? 0), 0);
      return `| ${r.titulo} | ${n ? `${n} pendiente(s)` : 'Completa'} |`;
    }).join('\n');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '## Documentación', '', resumen, '',
      ...(errores.length ? ['### Errores', '', '| Tipo | Dónde | Qué |', '|---|---|---|', filas(errores), ''] : []),
      '### Páginas del Documento del sistema', '', '| Página | Estado |', '|---|---|', completitud, '',
      ...(avisos.length ? ['<details><summary>Avisos</summary>', '', '| Tipo | Dónde | Qué |', '|---|---|---|', filas(avisos), '', '</details>', ''] : []),
    ].join('\n'));
  }
  process.exit(errores.length ? 1 : 0);
}
