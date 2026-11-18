// Prepara en Docmost el espacio de un proyecto para recibir la documentación de su repo.
// Se puede ejecutar varias veces: solo agrega lo que falta.
//
//   node --env-file=../.env conectar-proyecto.mjs --espacio estadistica \
//        --nombre "Reporte Estadístico" [--descripcion "…"] \
//        [--responsable correo@dominio] [--repo DevHRL/Estadistica_hrl]
//
// 1. Crea el espacio si no existe.
// 2. Agrega al bot como escritor: es quien publica lo que llega del repo.
// 3. Da lectura a todos los miembros del workspace (grupo por defecto).
// 4. Con --responsable, lo nombra administrador del espacio: decide quién escribe
//    en la wiki del proyecto (actas, procedimientos, incidentes).
// 5. Muestra lo que falta en GitHub: los secretos del repo y su workflow.
//
// Usa la cuenta de administrador (ADMIN_EMAIL, ADMIN_PASSWORD) y DOCMOST_EMAIL
// para ubicar al bot. En el servidor se ejecuta como configurar.mjs, desde la
// terminal del contenedor (la puerta de GitHub no deja pasar estas rutas).

import { parseArgs } from 'node:util';
import { Docmost, requerir } from './cliente.mjs';

const { values: args } = parseArgs({
  options: {
    espacio: { type: 'string' },
    nombre: { type: 'string' },
    descripcion: { type: 'string' },
    responsable: { type: 'string' },
    repo: { type: 'string' },
  },
});
if (!args.espacio || !args.nombre) {
  console.error('Uso: conectar-proyecto.mjs --espacio <slug> --nombre "<Nombre del proyecto>" [--responsable <correo>] [--repo DevHRL/<repo>]');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(args.espacio)) {
  console.error('El espacio (slug) va en minúsculas, con números y guiones: por ejemplo «estadistica» u «oncologia».');
  process.exit(1);
}

const env = requerir(['DOCMOST_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DOCMOST_EMAIL']);
const admin = await new Docmost(env.DOCMOST_URL).login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);

const miembrosWs = await admin.todos('workspace/members');
const bot = miembrosWs.find((m) => m.email === env.DOCMOST_EMAIL);
if (!bot) {
  console.error(`No existe el bot ${env.DOCMOST_EMAIL}. Ejecuta antes configurar.mjs.`);
  process.exit(1);
}

const descripcion = args.descripcion ??
  `Documentación de ${args.nombre}.` +
  (args.repo ? ` El Documento del sistema se publica desde ${args.repo} (se edita en el repo);` : '') +
  ' lo demás (actas, procedimientos, incidentes) se escribe aquí.';

// 1. Espacio
let espacio = (await admin.todos('spaces')).find((s) => s.slug === args.espacio);
if (!espacio) {
  espacio = await admin.post('spaces/create', { name: args.nombre, slug: args.espacio, description: descripcion });
  console.log(`✓ Espacio «${args.nombre}» (${args.espacio}) creado`);
} else {
  console.log(`✓ Espacio «${espacio.name}» (${args.espacio}) ya existe`);
}

// 2-4. Miembros
const miembros = await admin.todos('spaces/members', { spaceId: espacio.id });
const rolDe = (id) => miembros.find((m) => m.id === id)?.role;
async function agregar(rol, { userIds = [], groupIds = [] }, etiqueta) {
  await admin.post('spaces/members/add', { spaceId: espacio.id, role: rol, userIds, groupIds });
  console.log(`  ✓ ${etiqueta} como ${rol === 'admin' ? 'administrador' : rol === 'writer' ? 'escritor' : 'lector'}`);
}
if (!rolDe(bot.id)) await agregar('writer', { userIds: [bot.id] }, 'bot');

const todos = (await admin.todos('groups')).find((g) => g.isDefault);
if (todos && !rolDe(todos.id)) await agregar('reader', { groupIds: [todos.id] }, `grupo «${todos.name}»`);

if (args.responsable) {
  const r = miembrosWs.find((m) => m.email?.toLowerCase() === args.responsable.toLowerCase());
  if (!r) {
    console.warn(`  ⚠ ${args.responsable} todavía no tiene cuenta (entra una vez con GitHub y vuelve a ejecutar esto).`);
  } else if (!rolDe(r.id)) {
    await agregar('admin', { userIds: [r.id] }, r.name);
  } else if (rolDe(r.id) !== 'admin') {
    await admin.post('spaces/members/change-role', { spaceId: espacio.id, userId: r.id, role: 'admin' });
    console.log(`  ✓ ${r.name} pasa a administrador`);
  }
}

// 5. Lo que falta en GitHub
const repo = args.repo ?? 'DevHRL/<repo>';
console.log(`
Listo en Docmost: ${env.DOCMOST_URL}/s/${args.espacio}

Falta en GitHub (una vez por repo, quien sea administrador de ${repo.split('/')[0]}):
  gh secret set DOCMOST_URL      --repo ${repo}
  gh secret set DOCMOST_EMAIL    --repo ${repo}
  gh secret set DOCMOST_PASSWORD --repo ${repo}
(cada comando pide el valor; son los del bot. En el plan Free de GitHub los secretos
de la organización no llegan a los repos privados: van en cada repo.)

Y en el repo, la documentación con el espacio «${args.espacio}»:
  node crear-docs.mjs --repo <carpeta del repo> --nombre "${args.nombre}" --espacio ${args.espacio}`);
