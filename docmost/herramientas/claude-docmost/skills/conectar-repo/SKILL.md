---
name: conectar-repo
description: Conecta un repo de DevHRL a Docmost de punta a punta y comprueba que la documentación se publica sola. Úsala cuando pidan «conecta este repo a Docmost», «documenta este proyecto en Docmost», «agrega el Documento del sistema» o «publica la documentación de este repo», y también al preparar cualquier PR en un repo que ya tiene docs/ + mkdocs.yml + .github/workflows/documentacion.yml.
---

# Conectar un repo a Docmost

Resultado esperado: el **Documento del sistema** (15 páginas) vive en `docs/` del
repo, cada PR lo valida y cada merge a la rama principal lo publica solo en el
**espacio del proyecto** en docmost.nuiti.org. Terminas cuando lo comprobaste en
Docmost, no cuando abriste el PR.

```
docmost_preparar_espacio ─► crear-docs.mjs ─► llenar docs/ ─► validar.mjs ─► PR ─► check verde
   ─► merge ─► «Publicar en Docmost» (bot, con los secretos del repo) ─► comprobar con docmost_arbol
```

Reglas que no se rompen:

- **Nunca pidas, escribas ni muestres** la contraseña del bot ni ningún token. Los
  secretos del repo los carga una persona con `gh secret set`, que pide el valor por
  teclado; tú solo compruebas que existen (por su nombre).
- **El Documento del sistema se escribe en el repo**, nunca con `docmost_actualizar_pagina`:
  Docmost lo rechaza y la publicación lo pisaría.
- **Fusiona solo si la persona lo pidió** (en el pedido o al preguntarle).
- Lo que no sale del código no se inventa: `[Por completar: qué falta y quién lo sabe]`.

## 0. Antes de empezar

Comprueba, y si algo falla explica cómo resolverlo y detente:

| Qué | Cómo | Si falla |
|---|---|---|
| Conexión a Docmost | `docmost_conexion` | Token personal: Docmost → *Ajustes → Tokens personales*, guardarlo en la variable de entorno `DOCMOST_TOKEN` y reiniciar el agente (ver skill `docmost`) |
| GitHub CLI | `gh auth status` | `gh auth login` |
| Node 22 o más nuevo y git | `node --version`, `git --version` | Instalarlos |
| El repo | `gh repo view --json nameWithOwner,defaultBranchRef,visibility` desde su carpeta | La persona debe abrir el agente en la carpeta del repo |

Anota `REPO` (`DevHRL/x`) y `RAMA` (la rama por defecto, normalmente `main`).

**Pull requests y merges con la API REST** (`gh api`), no con `gh pr create` ni
`gh pr merge`: en DevHRL las operaciones de PR por GraphQL pueden ser rechazadas.

## 1. Datos del proyecto

Necesitas el **nombre del sistema** y el **espacio** (slug: minúsculas, números y
guiones). Si la persona no los dio, propón el nombre desde el README y el slug desde
el nombre del repo, y confírmalos con ella. Un proyecto = un espacio.

## 2. El espacio en Docmost

```
docmost_preparar_espacio(espacio: "<slug>", nombre: "<Nombre del sistema>")
```

Lo crea si no existe, agrega al **bot de publicación como escritor** (el workflow
publica con esa cuenta y solo puede escribir donde es escritor) y da lectura a todos.
Si responde que no tienes permiso, dile a la persona qué pedir al administrador del
espacio y detente: sin esto no se publica. Si responde «Cannot POST
/api/hrl/mcp/preparar-espacio», el servidor de Docmost todavía no tiene esta versión:
pide a un administrador desplegar `DevHRL/hrl-docmost` y detente.

## 3. Los secretos del repo

```sh
gh secret list --repo <REPO>
```

Deben aparecer `DOCMOST_URL`, `DOCMOST_EMAIL` y `DOCMOST_PASSWORD`. Si faltan, o si
`gh` no te deja listarlos, dile a la persona que un administrador de DevHRL los cargue
(los valores son los del bot, los mismos de los otros repos):

```
gh secret set DOCMOST_URL --repo <REPO>
gh secret set DOCMOST_EMAIL --repo <REPO>
gh secret set DOCMOST_PASSWORD --repo <REPO>
```

Puedes seguir con el PR mientras tanto; sin secretos el check valida igual, pero la
publicación se omite con un aviso.

## 4. Las herramientas

Están en `DevHRL/.github` (público) y se guardan fuera del repo, en
`$HOME/.docmost-hrl/devhrl`. Los comandos sirven igual en bash y en PowerShell.

Si la carpeta no existe:

```sh
git clone --quiet --depth 1 https://github.com/DevHRL/.github "$HOME/.docmost-hrl/devhrl"
```

Si ya existe, actualízala (el check del PR usa siempre la última versión):

```sh
git -C "$HOME/.docmost-hrl/devhrl" pull --quiet --ff-only
```

Y en los dos casos:

```sh
npm ci --omit=dev --silent --prefix "$HOME/.docmost-hrl/devhrl/docmost/herramientas"
node "$HOME/.docmost-hrl/devhrl/docmost/herramientas/agentes/instalar.mjs" --actualizar
```

(El último comando vuelve a copiar estas skills donde se instalaron, si se instalaron
con `instalar.mjs`; si no, no hace nada.)

En adelante, **H** = `$HOME/.docmost-hrl/devhrl/docmost/herramientas`: tiene
`crear-docs.mjs`, `validar.mjs` y la plantilla (`plantilla-repo/`).

## 5. Rama y esqueleto

```sh
git fetch --quiet origin && git switch -c docs/conectar-docmost origin/<RAMA>
node "$HOME/.docmost-hrl/devhrl/docmost/herramientas/crear-docs.mjs" --repo . --nombre "<Nombre>" --espacio <slug>
```

Agrega `docs/` (15 páginas y 3 diagramas de draw.io), `mkdocs.yml`,
`.github/workflows/documentacion.yml` (con `espacio: <slug>`),
`.github/pull_request_template.md`, la sección «Documentación (Docmost)» en
`AGENTS.md` (la leen Codex y otros agentes) y la línea `@AGENTS.md` en `CLAUDE.md`
(para que Claude Code lea la misma regla).

Si el repo ya tenía `docs/` o `mkdocs.yml`, `crear-docs.mjs` no los toca: copia la
plantilla de `H/plantilla-repo/docs/` y lleva el contenido
existente a las 15 páginas sin perder nada. Lo que no encaje va como subpágina de la
sección que corresponda (la sección pasa a ser carpeta con su `index.md` como primera
entrada del `nav`) o en Anexos. Todo `.md` de `docs/` tiene que quedar en el `nav`.

## 6. Llenar las páginas

Sigue [llenar-paginas.md](llenar-paginas.md): qué leer del repo, qué va en cada
página y qué dejar para las personas.

## 7. Validar

```sh
node "$HOME/.docmost-hrl/devhrl/docmost/herramientas/validar.mjs" --repo . --base origin/<RAMA>
```

Corrige **todos los errores** y vuelve a validar. Los avisos son lo pendiente de la
plantilla (`[Por completar: …]`): está bien que queden si el dato solo lo tienen las
personas.

## 8. Commit, push y PR

```sh
git add -A
git commit -m "docs: conectar el proyecto a Docmost" -m "Documento del sistema en docs/, mkdocs.yml, workflow de documentación (espacio <slug>), plantilla de PR y regla de documentación en AGENTS.md."
git push -u origin docs/conectar-docmost
```

Escribe la descripción en un archivo temporal, con la sección que lee el check:

```markdown
## Qué cambia

Conecta el proyecto a Docmost: Documento del sistema en `docs/`, `mkdocs.yml`, el
workflow que valida cada PR y publica en el espacio `<slug>`, la plantilla de PR y la
regla «Documentación (Docmost)» en `AGENTS.md` (importada desde `CLAUDE.md`).

## Documentación

- [x] Actualicé las páginas de `docs/` que describen este cambio: todas (alta del proyecto).
- [ ] No aplica, porque:

Pendiente de las personas: <lista de los [Por completar] y quién puede darlos>.
```

```sh
gh api repos/<REPO>/pulls -f base=<RAMA> -f head=docs/conectar-docmost -f title="docs: conectar el proyecto a Docmost" -F body=@<archivo> --jq ".number,.html_url"
```

## 9. El check del PR

```sh
gh run list --repo <REPO> --branch docs/conectar-docmost --event pull_request --limit 1 --json databaseId,status
gh run watch <id> --repo <REPO> --exit-status
```

Si la ejecución todavía no aparece, vuelve a listar. Si termina en error:
`gh run view <id> --repo <REPO> --log-failed`, corrige, valida en local, haz push y
vuelve a mirar. No sigas con el check en rojo.

## 10. Merge (solo si la persona lo pidió)

```sh
gh api -X PUT repos/<REPO>/pulls/<n>/merge -f merge_method=merge
gh api -X DELETE repos/<REPO>/git/refs/heads/docs/conectar-docmost
```

## 11. Comprobar la publicación

```sh
gh run list --repo <REPO> --branch <RAMA> --event push --limit 1 --json databaseId,status,headSha
gh run watch <id> --repo <REPO> --exit-status
gh run view <id> --repo <REPO> --log
```

En el log del job «Publicar en Docmost» busca una de estas líneas:

- `✓ Listo: N creadas…` y `Lectura: <url>`: publicado.
- `No se publica: faltan los secretos`: vuelve al paso 3; cuando estén, relanza con
  `gh workflow run documentacion.yml --repo <REPO> --ref <RAMA>`.
- `No existe el espacio … o el bot no es su miembro`: vuelve al paso 2.

Después, en Docmost: `docmost_arbol(espacio: "<slug>")`. Tiene que estar la página
raíz con el `site_name` de `mkdocs.yml` y, debajo, las páginas del `nav`.

## 12. Cerrar

Cuéntale a la persona:

- el enlace del PR y el de la página raíz en Docmost;
- lo que quedó `[Por completar]` y quién podría darlo;
- desde ahora: cada cambio de código actualiza su página de `docs/` en el mismo PR
  (regla de `AGENTS.md`); el check lo revisa y el merge lo publica. La wiki del espacio
  (actas, procedimientos, incidentes) se escribe en Docmost con la skill `docmost`.

## En los PR de un repo ya conectado

1. Sigue la sección «Documentación (Docmost)» de `AGENTS.md`: actualiza las páginas de
   `docs/` que describen el cambio.
2. Valida con `validar.mjs --base origin/<RAMA>` (herramientas del paso 4) y corrige
   los errores.
3. En la descripción del PR, la sección «Documentación»: las páginas que tocaste, o
   «No aplica, porque: …» con un motivo real.
