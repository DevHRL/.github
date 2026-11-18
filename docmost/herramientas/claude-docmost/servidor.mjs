#!/usr/bin/env node
// Servidor MCP de Docmost para Claude (HRL).
//
// Conecta Claude con nuestro Docmost usando el token personal de cada persona
// (Docmost → Ajustes → Tokens personales). Lo que Claude escribe queda a nombre
// de esa persona y con sus permisos por espacio.
//
// Habla MCP por stdio (JSON-RPC, un mensaje por línea) y no tiene dependencias:
// solo necesita Node 20 o más nuevo. Usa la API /api/hrl/mcp de Docmost
// (apps/server/src/hrl/mcp).
//
// Configuración (variables de entorno o ~/.docmost-hrl.json con { url, token }):
//   DOCMOST_TOKEN  token personal (obligatorio)
//   DOCMOST_URL    por defecto https://docmost.nuiti.org
//
// Probar la conexión:  node servidor.mjs --probar

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const VERSION = '0.2.0';
const URL_POR_DEFECTO = 'https://docmost.nuiti.org';
const VERSIONES_MCP = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

// --- configuración -----------------------------------------------------------------

function leerConfiguracion() {
  let archivo = {};
  try {
    archivo = JSON.parse(readFileSync(join(homedir(), '.docmost-hrl.json'), 'utf8'));
  } catch {
    /* no hay archivo */
  }
  // Si Claude Code no expandió ${...} en .mcp.json, llega el texto literal: se ignora.
  const valor = (v) => (typeof v === 'string' && v.trim() && !v.includes('${') ? v.trim() : '');
  const url = (valor(process.env.DOCMOST_URL) || valor(archivo.url) || URL_POR_DEFECTO).replace(/\/+$/, '');
  const token = valor(process.env.DOCMOST_TOKEN) || valor(archivo.token);
  return { url, token };
}

const config = leerConfiguracion();

class ErrorDocmost extends Error {}

function sinToken() {
  return new ErrorDocmost(
    'Falta el token personal de Docmost. Genéralo en ' +
      `${config.url}/settings/account/tokens y guárdalo en la variable de entorno ` +
      'DOCMOST_TOKEN (en Windows: setx DOCMOST_TOKEN "<token>"); después reinicia Claude Code.',
  );
}

// --- cliente de la API ---------------------------------------------------------------

async function api(ruta, cuerpo = {}) {
  if (!config.token) throw sinToken();
  let res;
  try {
    res = await fetch(`${config.url}/api/hrl/mcp/${ruta}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        // Va como cookie: oauth2-proxy reemplaza la cabecera Authorization.
        cookie: `authToken=${config.token}`,
        'user-agent': `docmost-hrl-mcp/${VERSION}`,
      },
      body: JSON.stringify(cuerpo),
    });
  } catch (err) {
    throw new ErrorDocmost(`No se pudo conectar con ${config.url}: ${err.cause?.message ?? err.message}`);
  }

  const texto = await res.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    /* no es JSON */
  }

  if (res.ok && json) return json && 'data' in json ? json.data : json;

  if (res.status >= 300 && res.status < 400) {
    throw new ErrorDocmost(
      `${config.url} redirigió al inicio de sesión de GitHub: la ruta /api/hrl/mcp/ no está liberada en oauth2-proxy (ver docker-compose.yml).`,
    );
  }
  if (res.status === 401) {
    throw new ErrorDocmost(
      'Docmost rechazó el token (vencido, revocado o de otro servidor). Genera uno nuevo en ' +
        `${config.url}/settings/account/tokens y actualiza DOCMOST_TOKEN.`,
    );
  }
  const mensaje = json?.message
    ? Array.isArray(json.message)
      ? json.message.join('; ')
      : typeof json.message === 'object'
        ? JSON.stringify(json.message)
        : json.message
    : texto.slice(0, 300) || res.statusText;
  if (res.status === 403) throw new ErrorDocmost(`Sin permiso: ${mensaje}`);
  if (res.status === 404) throw new ErrorDocmost(`No encontrado: ${mensaje}`);
  if (res.status === 409) throw new ErrorDocmost(`Conflicto: ${mensaje}`);
  if (res.status === 413) throw new ErrorDocmost('El contenido es demasiado grande (más de 1 MB). Divídelo en varias páginas o llamadas.');
  throw new ErrorDocmost(`Docmost respondió ${res.status}: ${mensaje}`);
}

// --- formato de las respuestas ---------------------------------------------------------

function arbolEnTexto(paginas, nivel = 0) {
  return paginas
    .map((p) => `${'  '.repeat(nivel)}- ${p.titulo}  [${p.id}]\n${arbolEnTexto(p.hijos ?? [], nivel + 1)}`)
    .join('');
}

function personas(lista) {
  return lista.map((p) => (p.tu ? `${p.nombre} (tú)` : p.nombre)).join(', ');
}

function avisoAbierta(abiertaPor) {
  if (!abiertaPor?.length) return 'Nadie más la tiene abierta.';
  const otros = abiertaPor.filter((p) => !p.tu);
  if (!otros.length) return 'Solo tú la tienes abierta en el navegador.';
  return `ABIERTA AHORA por ${personas(abiertaPor)}. No la reemplaces mientras tanto; solo «agregar» o «anteponer», o espera.`;
}

// --- herramientas ------------------------------------------------------------------------

const PAGINA = {
  type: 'string',
  description: 'Página: su id, su slugId o su URL de Docmost.',
};
const ESPACIO = {
  type: 'string',
  description: 'Espacio: su slug (por ejemplo «sistemas»), su nombre o su id.',
};

const MODELO_DIAGRAMA = {
  type: 'object',
  description:
    'Diagrama por carriles (el mismo de las plantillas AS-IS / TO-BE). ' +
    'carriles: nombres de los actores, de arriba abajo. ' +
    'nodos: { id, carril (índice en carriles), columna (0, 1, 2…, de izquierda a derecha), ' +
    'tipo: inicio | tarea | decision | fin | nota | sistema | actor, texto }. ' +
    'flechas: [idDesde, idHasta, etiqueta opcional]. columnas: total opcional.',
  properties: {
    carriles: { type: 'array', items: { type: 'string' } },
    nodos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          carril: { type: 'integer' },
          columna: { type: 'integer' },
          tipo: { type: 'string', enum: ['inicio', 'tarea', 'decision', 'fin', 'nota', 'sistema', 'actor'] },
          texto: { type: 'string' },
        },
        required: ['id', 'carril', 'columna', 'tipo', 'texto'],
      },
    },
    flechas: { type: 'array', items: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 } },
    columnas: { type: 'integer' },
  },
  required: ['carriles', 'nodos'],
};

const HERRAMIENTAS = [
  {
    name: 'docmost_conexion',
    description: 'Comprueba la conexión con Docmost y dice a nombre de quién trabaja Claude.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    async ejecutar() {
      const yo = await api('yo');
      return `Conectado a ${yo.url} (${yo.workspace.nombre}) como ${yo.usuario.nombre} <${yo.usuario.email}>.`;
    },
  },
  {
    name: 'docmost_espacios',
    description: 'Lista los espacios de Docmost a los que la persona tiene acceso y si puede editar en cada uno.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    async ejecutar() {
      const espacios = await api('espacios');
      if (!espacios.length) return 'No tienes acceso a ningún espacio.';
      return espacios
        .map(
          (e) =>
            `- ${e.nombre} (slug: ${e.slug}) — ${e.puedeEditar ? 'puedes editar' : 'solo lectura'}` +
            (e.descripcion ? `\n  ${e.descripcion}` : ''),
        )
        .join('\n');
    },
  },
  {
    name: 'docmost_buscar',
    description: 'Busca páginas por texto en todos los espacios de la persona o en uno.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Palabras a buscar.' },
        espacio: { ...ESPACIO, description: 'Opcional: limitar a este espacio.' },
        limite: { type: 'integer', minimum: 1, maximum: 50, description: 'Máximo de resultados (15 por defecto).' },
      },
      required: ['texto'],
    },
    async ejecutar(a) {
      const r = await api('buscar', { texto: a.texto, espacio: a.espacio, limite: a.limite });
      if (!r.length) return `Sin resultados para «${a.texto}».`;
      return r
        .map(
          (p) =>
            `- ${p.titulo}  [${p.id}]` +
            (p.espacio ? ` — espacio ${p.espacio.slug}` : '') +
            (p.url ? `\n  ${p.url}` : '') +
            (p.extracto ? `\n  «${p.extracto.slice(0, 200)}»` : ''),
        )
        .join('\n');
    },
  },
  {
    name: 'docmost_arbol',
    description:
      'Muestra el árbol de páginas de un espacio, o de una página y sus subpáginas, con el id de cada una.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        espacio: ESPACIO,
        desde: { ...PAGINA, description: 'Opcional: solo la rama que empieza en esta página.' },
      },
      required: ['espacio'],
    },
    async ejecutar(a) {
      const r = await api('arbol', { espacio: a.espacio, desde: a.desde });
      const cuerpo = arbolEnTexto(r.paginas);
      return `Espacio ${r.espacio.nombre} (slug: ${r.espacio.slug})\n${cuerpo || '(sin páginas)'}`;
    },
  },
  {
    name: 'docmost_leer',
    description:
      'Lee una página en Markdown, con su ubicación, sus subpáginas, sus comentarios abiertos y quién la tiene abierta. ' +
      'Los bloques que Markdown no expresa (diagramas, imágenes, adjuntos, columnas…) aparecen como marcadores ' +
      '{{tipo:id}} en su propia línea: al reescribir la página, consérvalos donde deban quedar.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: { pagina: PAGINA }, required: ['pagina'] },
    async ejecutar(a) {
      const p = await api('pagina', { pagina: a.pagina });
      const lineas = [
        `# ${p.titulo}`,
        `id: ${p.id} · ${p.url ?? ''}`,
        `Espacio: ${p.espacio?.nombre ?? '?'} (${p.espacio?.slug ?? '?'})`,
        `Ruta: ${[...p.ruta.map((r) => r.titulo), p.titulo].join(' › ')}`,
        `Puedes editar: ${p.puedeEditar ? 'sí' : 'no'} · Actualizada ${p.actualizada}${p.actualizadaPor ? ` por ${p.actualizadaPor}` : ''}`,
        `Comentarios abiertos: ${p.comentariosAbiertos}`,
        avisoAbierta(p.abiertaPor),
      ];
      if (p.sincronizadaDesdeGithub) {
        lineas.push(
          'PUBLICADA DESDE GITHUB: se edita en el repo (docs/), no aquí. Docmost rechaza cambios en ella y subpáginas nuevas debajo.',
        );
      }
      if (p.hijos.length) {
        lineas.push('Subpáginas:', ...p.hijos.map((h) => `  - ${h.titulo}  [${h.id}]`));
      }
      if (p.bloques.length) {
        lineas.push(
          'Bloques conservados:',
          ...p.bloques.map((b) => `  - ${b.marcador}  ${b.tipo}${b.titulo ? `: ${b.titulo}` : ''}`),
        );
      }
      lineas.push('', '--- contenido (Markdown) ---', p.markdown || '(vacía)');
      return lineas.join('\n');
    },
  },
  {
    name: 'docmost_quien_tiene_abierta',
    description:
      'Dice quién tiene una página abierta ahora en el navegador. Úsalo justo antes de reemplazar una página.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: { pagina: PAGINA }, required: ['pagina'] },
    async ejecutar(a) {
      const r = await api('abierta', { pagina: a.pagina });
      return avisoAbierta(r.abiertaPor);
    },
  },
  {
    name: 'docmost_crear_pagina',
    description:
      'Crea una página nueva (en la raíz del espacio o debajo de otra) con contenido en Markdown. ' +
      'Admite tablas, listas de tareas, bloques de código, Mermaid (```mermaid) y avisos (:::info, :::warning, :::success, :::danger).',
    inputSchema: {
      type: 'object',
      properties: {
        espacio: ESPACIO,
        padre: { ...PAGINA, description: 'Opcional: página bajo la que se crea.' },
        titulo: { type: 'string' },
        markdown: { type: 'string', description: 'Contenido inicial (opcional).' },
      },
      required: ['espacio', 'titulo'],
    },
    async ejecutar(a) {
      const p = await api('crear', a);
      return `Creada «${p.titulo}»  [${p.id}]\n${p.url}`;
    },
  },
  {
    name: 'docmost_actualizar_pagina',
    description:
      'Cambia el título o el contenido (Markdown) de una página. operacion: «reemplazar» (por defecto, reescribe toda la página), ' +
      '«agregar» (al final) o «anteponer» (al principio). Docmost se niega a reemplazar si otra persona tiene la página abierta; ' +
      'usa «forzar» solo si la persona lo pidió expresamente. Al reemplazar, conserva los marcadores {{tipo:id}} que devolvió docmost_leer.',
    annotations: { destructiveHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        pagina: PAGINA,
        titulo: { type: 'string', description: 'Título nuevo (opcional).' },
        markdown: { type: 'string', description: 'Contenido (opcional si solo cambia el título).' },
        operacion: { type: 'string', enum: ['reemplazar', 'agregar', 'anteponer'] },
        forzar: {
          type: 'boolean',
          description: 'Reemplazar aunque otros la tengan abierta. Solo si la persona lo pidió.',
        },
      },
      required: ['pagina'],
    },
    async ejecutar(a) {
      const r = await api('actualizar', a);
      return [`Actualizada «${r.titulo}»  [${r.id}]`, r.url, ...(r.avisos ?? []).map((x) => `Aviso: ${x}`)].join('\n');
    },
  },
  {
    name: 'docmost_plantillas',
    description:
      'Lista las plantillas disponibles (por ejemplo «Documento del sistema», con sus subpáginas).',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        espacio: { ...ESPACIO, description: 'Opcional: solo las que sirven en este espacio.' },
        texto: { type: 'string', description: 'Opcional: filtrar por nombre.' },
      },
    },
    async ejecutar(a) {
      const r = await api('plantillas', a);
      if (!r.length) return 'No hay plantillas.';
      return r
        .map(
          (t) =>
            `- ${t.titulo}  [${t.id}] (${t.alcance === 'workspace' ? 'todo el workspace' : 'de un espacio'})` +
            (t.descripcion ? `\n  ${t.descripcion}` : '') +
            (t.subpaginas.length ? `\n  Subpáginas: ${t.subpaginas.join(' · ')}` : ''),
        )
        .join('\n');
    },
  },
  {
    name: 'docmost_preparar_espacio',
    description:
      'Deja listo el espacio de un proyecto para que su repo publique ahí el Documento del sistema: lo crea si no existe (quien lo pide queda de administrador), agrega al bot de publicación como escritor y a todos los miembros como lectores. Se puede repetir; solo cambia lo que falta. Úsala al conectar un repo a Docmost, antes de abrir el PR.',
    inputSchema: {
      type: 'object',
      properties: {
        espacio: { type: 'string', description: 'Slug del espacio: minúsculas, números y guiones (por ejemplo «estadistica»). Es el mismo que va en «espacio:» del workflow.' },
        nombre: { type: 'string', description: 'Nombre visible del espacio. Obligatorio si todavía no existe.' },
        descripcion: { type: 'string', description: 'Opcional.' },
      },
      required: ['espacio'],
    },
    async ejecutar(a) {
      const r = await api('preparar-espacio', a);
      return (
        `Espacio «${r.espacio.nombre}» (slug: ${r.espacio.slug}) ${r.creado ? 'creado' : 'ya existía'} y listo para publicar.
` +
        `${r.espacio.url}
Bot de publicación: ${r.bot} (escritor).
Cambios: ${r.cambios.join('; ')}.`
      );
    },
  },
  {
    name: 'docmost_usar_plantilla',
    description:
      'Crea una página nueva desde una plantilla, con todas sus subpáginas, diagramas y adjuntos, y devuelve el árbol creado con los ids.',
    inputSchema: {
      type: 'object',
      properties: {
        plantilla: { type: 'string', description: 'id o nombre exacto de la plantilla.' },
        espacio: ESPACIO,
        padre: { ...PAGINA, description: 'Opcional: página bajo la que se crea.' },
        titulo: { type: 'string', description: 'Título de la página raíz (por ejemplo, el nombre del sistema).' },
      },
      required: ['plantilla', 'espacio'],
    },
    async ejecutar(a) {
      const r = await api('usar-plantilla', a);
      return `Creada «${r.raiz.titulo}»  [${r.raiz.id}]\n${r.raiz.url}\nSubpáginas:\n${arbolEnTexto(r.paginas, 1) || '  (ninguna)'}`;
    },
  },
  {
    name: 'docmost_subir_diagrama',
    description:
      'Sube un diagrama editable de draw.io a una página. Fuente, una de: «modelo» (diagrama por carriles), ' +
      '«xml» (XML de draw.io, mxfile o mxGraphModel, escrito por ti) o «archivo» (ruta local a un .drawio, .drawio.svg o .xml). ' +
      'Con «reemplazar» (el id de un marcador {{drawio:id}} de la página) cambia solo ese diagrama, sin tocar el resto: es seguro aunque alguien tenga la página abierta. ' +
      'Si no, lo agrega al final (insertar: «final») o solo lo sube (insertar: «no») y devuelve el marcador para ubicarlo con docmost_actualizar_pagina.',
    inputSchema: {
      type: 'object',
      properties: {
        pagina: PAGINA,
        titulo: { type: 'string', description: 'Título del diagrama (también nombre del archivo).' },
        modelo: MODELO_DIAGRAMA,
        xml: { type: 'string', description: 'XML de draw.io (mxfile o mxGraphModel).' },
        archivo: { type: 'string', description: 'Ruta local a .drawio, .drawio.svg o .xml.' },
        reemplazar: { type: 'string', description: 'id del diagrama a reemplazar (el de su marcador {{drawio:id}}).' },
        insertar: { type: 'string', enum: ['final', 'no'], description: 'Si es nuevo: al final (por defecto) o no insertarlo.' },
      },
      required: ['pagina', 'titulo'],
    },
    async ejecutar(a) {
      const cuerpo = {
        pagina: a.pagina,
        titulo: a.titulo,
        reemplazar: a.reemplazar,
        insertar: a.insertar,
      };
      const fuentes = ['modelo', 'xml', 'archivo'].filter((k) => a[k] !== undefined && a[k] !== '');
      if (fuentes.length !== 1) {
        throw new ErrorDocmost('Indica exactamente una fuente: modelo, xml o archivo.');
      }
      if (a.modelo) cuerpo.modelo = a.modelo;
      if (a.xml) cuerpo.xml = a.xml;
      if (a.archivo) {
        const ruta = resolve(a.archivo);
        let contenido;
        try {
          contenido = readFileSync(ruta, 'utf8');
        } catch (err) {
          throw new ErrorDocmost(`No se pudo leer ${ruta}: ${err.message}`);
        }
        const nombre = basename(ruta).toLowerCase();
        if (nombre.endsWith('.svg')) cuerpo.svg = contenido;
        else if (['.drawio', '.xml', '.dio'].includes(extname(nombre))) cuerpo.xml = contenido;
        else throw new ErrorDocmost('El archivo debe ser .drawio, .drawio.svg o .xml.');
      }
      const r = await api('diagrama', cuerpo);
      if (r.reemplazado) return `Diagrama reemplazado. Marcador nuevo: ${r.marcador}`;
      if (r.insertado === 'final') return `Diagrama agregado al final de la página. Marcador: ${r.marcador}`;
      return `Diagrama subido sin insertar. Ponlo en la página con este marcador en su propia línea: ${r.marcador}`;
    },
  },
];

const POR_NOMBRE = new Map(HERRAMIENTAS.map((h) => [h.name, h]));

const INSTRUCCIONES =
  'Docmost del Hospital Regional de Loreto. Claude actúa con el token personal de la persona: ' +
  'lo que escribe queda a su nombre y respeta sus permisos. Antes de reemplazar una página, ' +
  'compruebe que nadie más la tenga abierta. Para documentar un sistema use la plantilla ' +
  '«Documento del sistema». La skill «docmost» tiene el procedimiento completo.';

// --- protocolo MCP (JSON-RPC por stdio) -----------------------------------------------

function enviar(mensaje) {
  process.stdout.write(`${JSON.stringify(mensaje)}\n`);
}

async function atender(m) {
  const { id, method, params } = m;
  const esNotificacion = id === undefined || id === null;

  switch (method) {
    case 'initialize': {
      const pedida = params?.protocolVersion;
      return {
        protocolVersion: VERSIONES_MCP.includes(pedida) ? pedida : VERSIONES_MCP[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'docmost-hrl', title: 'Docmost HRL', version: VERSION },
        instructions: INSTRUCCIONES,
      };
    }
    case 'ping':
      return {};
    case 'tools/list':
      return {
        tools: HERRAMIENTAS.map(({ name, description, inputSchema, annotations }) => ({
          name,
          description,
          inputSchema,
          ...(annotations ? { annotations } : {}),
        })),
      };
    case 'tools/call': {
      const herramienta = POR_NOMBRE.get(params?.name);
      if (!herramienta) {
        throw Object.assign(new Error(`Herramienta desconocida: ${params?.name}`), { code: -32602 });
      }
      try {
        const texto = await herramienta.ejecutar(params?.arguments ?? {});
        return { content: [{ type: 'text', text: texto }] };
      } catch (err) {
        const texto = err instanceof ErrorDocmost ? err.message : `Error inesperado: ${err?.message ?? err}`;
        return { content: [{ type: 'text', text: texto }], isError: true };
      }
    }
    default:
      if (esNotificacion || method?.startsWith('notifications/')) return undefined;
      throw Object.assign(new Error(`Método no soportado: ${method}`), { code: -32601 });
  }
}

function iniciar() {
  const lector = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let enCurso = 0;
  let cerrado = false;
  const salirSiTermino = () => cerrado && enCurso === 0 && process.exit(0);

  lector.on('line', async (linea) => {
    if (!linea.trim()) return;
    enCurso++;
    try {
      await procesar(linea);
    } finally {
      enCurso--;
      salirSiTermino();
    }
  });
  lector.on('close', () => {
    cerrado = true;
    salirSiTermino();
  });
}

async function procesar(linea) {
  let mensaje;
  try {
    mensaje = JSON.parse(linea);
  } catch {
    enviar({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } });
    return;
  }
  const esNotificacion = mensaje.id === undefined || mensaje.id === null;
  try {
    const resultado = await atender(mensaje);
    if (!esNotificacion) enviar({ jsonrpc: '2.0', id: mensaje.id, result: resultado ?? {} });
  } catch (err) {
    if (!esNotificacion) {
      enviar({
        jsonrpc: '2.0',
        id: mensaje.id,
        error: { code: err.code ?? -32603, message: err.message ?? String(err) },
      });
    }
  }
}

// --- línea de comandos --------------------------------------------------------------

if (process.argv.includes('--probar')) {
  POR_NOMBRE.get('docmost_conexion')
    .ejecutar()
    .then((t) => console.log(t))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
} else {
  iniciar();
}
