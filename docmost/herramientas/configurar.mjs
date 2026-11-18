// Deja una instancia de Docmost lista para la sincronización.
// Se puede ejecutar varias veces: solo crea lo que falta.
//
//   node --env-file=.env herramientas/configurar.mjs
//
// 1. Crea el workspace y el administrador (si la instancia está vacía).
// 2. Activa los espacios públicos.
// 3. Crea el usuario bot.
// 4. Prepara los espacios que llena el bot: «Sistemas» (DOCMOST_SPACE, la
//    documentación de los repos) y «Guía de la plataforma» (DOCMOST_GUIDE_SPACE,
//    la carpeta guia/ de este repo). En cada uno: el bot escribe, todos los
//    miembros leen y el espacio queda publicado (se lee sin cuenta, detrás de la
//    puerta de GitHub).

import { Docmost, requerir } from './cliente.mjs';

const env = requerir([
  'DOCMOST_URL', 'ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'WORKSPACE_NAME',
  'DOCMOST_EMAIL', 'DOCMOST_PASSWORD', 'DOCMOST_SPACE',
]);

const ESPACIOS = [
  {
    slug: env.DOCMOST_SPACE,
    name: process.env.DOCMOST_SPACE_NAME || 'Sistemas',
    description: 'Documentación técnica sincronizada desde los repos de GitHub. Se edita en cada repo, no aquí.',
  },
  {
    slug: process.env.DOCMOST_GUIDE_SPACE || 'guia',
    name: 'Guía de la plataforma',
    description: 'Cómo funciona esta plataforma y cómo empezar a documentar. Se edita en la carpeta guia/ del repo DevHRL/hrl-docmost.',
  },
];

const admin = new Docmost(env.DOCMOST_URL);

// 1. Workspace y administrador
try {
  await admin.login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  console.log('✓ El workspace ya existe; sesión de administrador iniciada');
} catch {
  await admin.post('auth/setup', {
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    workspaceName: env.WORKSPACE_NAME,
  });
  await admin.login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  console.log(`✓ Workspace «${env.WORKSPACE_NAME}» y administrador creados`);
}

// 2. Espacios públicos
await admin.post('workspace/update', { allowPublicSpaces: true });
console.log('✓ Espacios públicos activados');

// 3. Usuario bot
let bot = (await admin.todos('workspace/members')).find((m) => m.email === env.DOCMOST_EMAIL);
if (!bot) {
  let invitaciones = await admin.todos('workspace/invites');
  let inv = invitaciones.find((i) => i.email === env.DOCMOST_EMAIL);
  if (!inv) {
    await admin.post('workspace/invites/create', {
      emails: [env.DOCMOST_EMAIL],
      role: 'member',
      groupIds: [],
    });
    invitaciones = await admin.todos('workspace/invites');
    inv = invitaciones.find((i) => i.email === env.DOCMOST_EMAIL);
  }
  const { inviteLink } = await admin.post('workspace/invites/link', { invitationId: inv.id });
  const token = new URL(inviteLink).searchParams.get('token');
  await new Docmost(env.DOCMOST_URL).post('workspace/invites/accept', {
    invitationId: inv.id,
    name: 'Bot de documentación',
    password: env.DOCMOST_PASSWORD,
    token,
  });
  bot = (await admin.todos('workspace/members')).find((m) => m.email === env.DOCMOST_EMAIL);
  console.log(`✓ Usuario bot ${env.DOCMOST_EMAIL} creado`);
} else {
  console.log(`✓ Usuario bot ${env.DOCMOST_EMAIL} ya existe`);
}

// 4. Espacios del bot
const todosLosMiembros = (await admin.todos('groups')).find((g) => g.isDefault);

for (const datos of ESPACIOS) {
  let espacio = (await admin.todos('spaces')).find((s) => s.slug === datos.slug);
  if (!espacio) {
    espacio = await admin.post('spaces/create', datos);
    console.log(`✓ Espacio «${datos.name}» creado`);
  } else {
    console.log(`✓ Espacio «${espacio.name}» ya existe`);
    // La descripción puede haber quedado vieja (por ejemplo, el nombre anterior del repo).
    if (espacio.description !== datos.description) {
      await admin.post('spaces/update', { spaceId: espacio.id, description: datos.description });
      console.log('  ✓ descripción actualizada');
    }
  }

  const miembros = await admin.todos('spaces/members', { spaceId: espacio.id });
  const esMiembro = (id) => miembros.some((m) => m.id === id);
  if (!esMiembro(bot.id)) {
    await admin.post('spaces/members/add', {
      spaceId: espacio.id, role: 'writer', userIds: [bot.id], groupIds: [],
    });
    console.log('  ✓ bot agregado como escritor');
  }
  if (todosLosMiembros && !esMiembro(todosLosMiembros.id)) {
    await admin.post('spaces/members/add', {
      spaceId: espacio.id, role: 'reader', userIds: [], groupIds: [todosLosMiembros.id],
    });
    console.log(`  ✓ grupo «${todosLosMiembros.name}» agregado como lector`);
  }

  await admin.post('public-spaces/publish', {
    spaceId: espacio.id,
    enabled: true,
    searchIndexing: false,
  });
  console.log(`  ✓ publicado en ${env.DOCMOST_URL}/docs/${datos.slug}`);
}

// 5. Comprobar que el bot entra con la contraseña dada (la que va en los
//    secretos de GitHub). Si el bot ya existía, su contraseña NO se cambia.
try {
  await new Docmost(env.DOCMOST_URL).login(env.DOCMOST_EMAIL, env.DOCMOST_PASSWORD);
  console.log(`✓ El bot inicia sesión con esa contraseña: úsala en el secreto DOCMOST_PASSWORD`);
} catch {
  console.error(
    `✗ El bot ${env.DOCMOST_EMAIL} ya existía con OTRA contraseña. Bórralo en ` +
    `Configuración → Miembros y vuelve a ejecutar este script, o usa la contraseña original.`,
  );
  process.exitCode = 1;
}
