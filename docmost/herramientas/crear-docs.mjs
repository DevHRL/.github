// Prepara un repo para documentarse con el «Documento del sistema» y publicarse en
// el espacio de su proyecto en Docmost.
//
//   node crear-docs.mjs --repo <carpeta del repo> --nombre "Nombre del sistema" --espacio <slug>
//
// 1. docs/ y mkdocs.yml desde la plantilla (solo si el repo no tiene docs/: si ya la
//    tiene, hay que llevar su contenido a la plantilla; ver la skill de Docmost).
// 2. .github/workflows/documentacion.yml con el espacio del proyecto.
// 3. .github/pull_request_template.md (si el repo no tiene una).
// 4. La sección «Documentación (Docmost)» en AGENTS.md, que leen Codex y otros agentes,
//    y en CLAUDE.md la línea @AGENTS.md para que Claude Code lea lo mismo.
// Después: llenar las páginas, validar y abrir el PR.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: { repo: { type: 'string' }, nombre: { type: 'string' }, espacio: { type: 'string' } },
});
if (!args.repo || !args.nombre || !args.espacio) {
  console.error('Uso: crear-docs.mjs --repo <carpeta> --nombre "Nombre del sistema" --espacio <slug>');
  process.exit(1);
}
const plantilla = path.join(path.dirname(fileURLToPath(import.meta.url)), 'plantilla-repo');
const repo = path.resolve(args.repo);
const conEspacio = (t) => t.replaceAll('__ESPACIO__', args.espacio);
const escribir = (rel, texto) => {
  mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  writeFileSync(path.join(repo, rel), texto, 'utf8');
  console.log(`  ✓ ${rel}`);
};

// 1. docs/ + mkdocs.yml
if (existsSync(path.join(repo, 'docs')) || existsSync(path.join(repo, 'mkdocs.yml'))) {
  console.log('  ⚠ El repo ya tiene docs/ o mkdocs.yml: no se tocan. Lleva su contenido a las 15 páginas de');
  console.log(`    ${path.join(plantilla, 'docs')} (con Claude: «migra docs/ al Documento del sistema»).`);
} else {
  cpSync(path.join(plantilla, 'docs'), path.join(repo, 'docs'), { recursive: true });
  console.log('  ✓ docs/ (15 páginas y 3 diagramas de draw.io)');
  const mkdocs = readFileSync(path.join(plantilla, 'mkdocs.yml'), 'utf8')
    .replace(/^site_name: .*$/m, `site_name: ${JSON.stringify(args.nombre)}`);
  escribir('mkdocs.yml', mkdocs);
  writeFileSync(path.join(repo, 'docs/index.md'),
    readFileSync(path.join(repo, 'docs/index.md'), 'utf8').replace('# [Nombre del sistema]', `# ${args.nombre}`));
}

// 2. Workflow
escribir('.github/workflows/documentacion.yml', conEspacio(readFileSync(path.join(plantilla, 'github/documentacion.yml'), 'utf8')));

// 3. Plantilla de PR
if (existsSync(path.join(repo, '.github/pull_request_template.md'))) {
  console.log('  ⚠ .github/pull_request_template.md ya existe: agrégale la sección «Documentación» de');
  console.log(`    ${path.join(plantilla, 'github/pull_request_template.md')}`);
} else {
  escribir('.github/pull_request_template.md', readFileSync(path.join(plantilla, 'github/pull_request_template.md'), 'utf8'));
}

// 4. AGENTS.md (la regla) y CLAUDE.md (la importa)
const seccion = conEspacio(readFileSync(path.join(plantilla, 'AGENTS-documentacion.md'), 'utf8')).trim();
const bloque = /<!-- docmost:inicio[\s\S]*?<!-- docmost:fin -->\n?/;
const leer = (f) => (existsSync(path.join(repo, f)) ? readFileSync(path.join(repo, f), 'utf8') : '');
const agregar = (texto, extra) => `${texto.trimEnd()}${texto.trim() ? '\n\n' : ''}${extra}\n`;

const agentes = leer('AGENTS.md');
const habia = bloque.test(agentes);
writeFileSync(path.join(repo, 'AGENTS.md'),
  habia ? agentes.replace(bloque, `${seccion}\n`) : agregar(agentes, seccion), 'utf8');
console.log(`  ✓ AGENTS.md (sección «Documentación (Docmost)» ${habia ? 'actualizada' : 'agregada'})`);

// La sección vivía antes en CLAUDE.md: se quita de ahí y CLAUDE.md importa AGENTS.md.
let claude = leer('CLAUDE.md').replace(bloque, '');
if (!/^@AGENTS\.md\s*$/m.test(claude)) {
  claude = agregar(claude, '<!-- Reglas comunes a todos los agentes de IA, incluida la de documentación: -->\n@AGENTS.md');
}
writeFileSync(path.join(repo, 'CLAUDE.md'), `${claude.trimEnd()}\n`, 'utf8');
console.log('  ✓ CLAUDE.md (importa @AGENTS.md)');

console.log(`
Siguiente: llenar docs/ (con tu agente: «llena el Documento del sistema desde el código»),
validar y abrir el PR:
  node ${path.join(path.dirname(fileURLToPath(import.meta.url)), 'validar.mjs')} --repo ${args.repo}`);
