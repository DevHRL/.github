// Instala las skills de Docmost HRL y su servidor MCP en Claude Code y/o Codex.
//
//   node instalar.mjs --agente claude
//   node instalar.mjs --agente codex
//   node instalar.mjs --agente claude --agente codex
//   node instalar.mjs --actualizar        (vuelve a copiar las skills donde ya se instalaron)
//
// Se ejecuta desde la copia de DevHRL/.github en $HOME/.docmost-hrl/devhrl (ver README.md).
// No pide ni guarda credenciales: el servidor MCP lee el token personal de la variable
// de entorno DOCMOST_TOKEN (o de $HOME/.docmost-hrl.json).
//
//   Claude Code: skills en ~/.claude/skills/; MCP «docmost» con `claude mcp add --scope user`.
//                Si ya tienes el plugin docmost@hrl, no hace nada: el plugin trae lo mismo.
//   Codex:       skills en ~/.agents/skills/; MCP en ~/.codex/config.toml con
//                env_vars = ["DOCMOST_TOKEN"] (Codex solo pasa las variables que se declaran).

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    agente: { type: 'string', multiple: true, default: [] },
    actualizar: { type: 'boolean', default: false },
  },
});

const HOME = os.homedir();
const aqui = path.dirname(fileURLToPath(import.meta.url));
const plugin = path.join(aqui, '..', 'claude-docmost');
const skillsOrigen = path.join(plugin, 'skills');
const servidor = path.join(plugin, 'servidor.mjs').split(path.sep).join('/');
const URL_DOCMOST = process.env.DOCMOST_URL || 'https://docmost.nuiti.org';
const registro = path.join(HOME, '.docmost-hrl', 'instalado.json');

const AGENTES = {
  claude: { nombre: 'Claude Code', skills: path.join(HOME, '.claude', 'skills') },
  codex: { nombre: 'Codex', skills: path.join(HOME, '.agents', 'skills') },
};

const leerRegistro = () => {
  try {
    return JSON.parse(readFileSync(registro, 'utf8'));
  } catch {
    return { agentes: [] };
  }
};

let agentes = args.agente.flatMap((a) => (a === 'todos' ? Object.keys(AGENTES) : [a.toLowerCase()]));
if (args.actualizar) agentes = [...new Set([...agentes, ...leerRegistro().agentes])];
const desconocidos = agentes.filter((a) => !AGENTES[a]);
if (desconocidos.length || (!agentes.length && !args.actualizar)) {
  console.error('Uso: node instalar.mjs --agente claude | --agente codex | --agente todos | --actualizar');
  process.exit(1);
}
if (!agentes.length) {
  console.log('Nada que actualizar: las skills no se instalaron con este script.');
  process.exit(0);
}

const [mayor] = process.versions.node.split('.').map(Number);
if (mayor < 22) console.warn(`⚠ Node ${process.versions.node}: las herramientas de documentación piden Node 22 o más nuevo.`);

function copiarSkills(destino) {
  mkdirSync(destino, { recursive: true });
  const nombres = readdirSync(skillsOrigen, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const n of nombres) {
    rmSync(path.join(destino, n), { recursive: true, force: true });
    cpSync(path.join(skillsOrigen, n), path.join(destino, n), { recursive: true });
  }
  return nombres;
}

function ejecutar(cmd, cmdArgs) {
  // En Windows, «claude» es un .cmd: hace falta la shell, con el comando ya citado.
  const citar = (x) => (/[\s"]/.test(x) ? `"${x.replace(/"/g, '\\"')}"` : x);
  const r = process.platform === 'win32'
    ? spawnSync([cmd, ...cmdArgs].map(citar).join(' '), { encoding: 'utf8', shell: true })
    : spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
  return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), error: r.error };
}

function claude() {
  const instalados = path.join(HOME, '.claude', 'plugins', 'installed_plugins.json');
  if (existsSync(instalados) && readFileSync(instalados, 'utf8').includes('"docmost@hrl"')) {
    console.log('  · Ya tienes el plugin docmost@hrl: trae estas skills y el MCP. Para actualizarlo:');
    console.log('    /plugin marketplace update hrl');
    return false;
  }
  const skills = copiarSkills(AGENTES.claude.skills);
  console.log(`  ✓ skills en ${AGENTES.claude.skills}: ${skills.join(', ')}`);
  if (args.actualizar && !args.agente.includes('claude')) return true;

  const agregar = ['mcp', 'add', '--scope', 'user', 'docmost', '-e', `DOCMOST_URL=${URL_DOCMOST}`, '--', 'node', servidor];
  ejecutar('claude', ['mcp', 'remove', '--scope', 'user', 'docmost']);
  const r = ejecutar('claude', agregar);
  if (r.ok) {
    console.log('  ✓ MCP «docmost» registrado (claude mcp add --scope user)');
  } else {
    console.log('  ⚠ No se pudo registrar el MCP con la CLI de Claude Code. Ejecútalo en una terminal:');
    console.log(`    claude ${agregar.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`);
  }
  return true;
}

function codex() {
  const skills = copiarSkills(AGENTES.codex.skills);
  console.log(`  ✓ skills en ${AGENTES.codex.skills}: ${skills.join(', ')}`);
  if (args.actualizar && !args.agente.includes('codex')) return true;

  const config = path.join(HOME, '.codex', 'config.toml');
  mkdirSync(path.dirname(config), { recursive: true });
  const actual = existsSync(config) ? readFileSync(config, 'utf8') : '';
  // Quita las tablas [mcp_servers.docmost] y [mcp_servers.docmost.*] que hubiera.
  let saltar = false;
  const resto = actual.split(/\r?\n/).filter((l) => {
    if (/^\s*\[/.test(l)) saltar = /^\s*\[mcp_servers\.docmost(\.[^\]]+)?\]\s*$/.test(l);
    return !saltar;
  }).join('\n').trimEnd();
  const bloque = [
    '# Docmost HRL (DevHRL/.github: docmost/herramientas/agentes/instalar.mjs)',
    '[mcp_servers.docmost]',
    'command = "node"',
    `args = ["${servidor}"]`,
    'env_vars = ["DOCMOST_TOKEN"]',
    'startup_timeout_sec = 20',
    '',
    '[mcp_servers.docmost.env]',
    `DOCMOST_URL = "${URL_DOCMOST}"`,
  ].join('\n');
  const limpio = resto.replace(/\n?# Docmost HRL \(DevHRL\/\.github[^\n]*$/m, '').trimEnd();
  writeFileSync(config, `${limpio}${limpio ? '\n\n' : ''}${bloque}\n`, 'utf8');
  console.log(`  ✓ MCP «docmost» en ${config}`);
  return true;
}

const hechos = new Set(leerRegistro().agentes);
for (const a of agentes) {
  console.log(`${AGENTES[a].nombre}:`);
  if ((a === 'claude' ? claude() : codex())) hechos.add(a);
}
mkdirSync(path.dirname(registro), { recursive: true });
writeFileSync(registro, `${JSON.stringify({ agentes: [...hechos] }, null, 2)}\n`, 'utf8');

if (args.actualizar && !args.agente.length) process.exit(0);

// Token personal: solo se comprueba que exista, nunca se muestra.
let token = process.env.DOCMOST_TOKEN;
if (!token) {
  try {
    token = JSON.parse(readFileSync(path.join(HOME, '.docmost-hrl.json'), 'utf8')).token;
  } catch { /* no hay archivo */ }
}
console.log(token
  ? '\n✓ Hay un token personal (DOCMOST_TOKEN).'
  : `\n⚠ Falta tu token personal. Créalo en ${URL_DOCMOST}/settings/account/tokens y guárdalo:\n` +
    '    Windows:       setx DOCMOST_TOKEN "<token>"   (y abre una terminal nueva)\n' +
    '    macOS / Linux: export DOCMOST_TOKEN="<token>" en ~/.zshrc o ~/.bashrc');
console.log('\nListo. Reinicia el agente y pregúntale: «¿Con qué usuario estás conectado a Docmost?»');
