# Docmost HRL para agentes de IA (Claude Code y Codex)

Skills y servidor MCP para que tu agente de IA documente los proyectos de DevHRL en
[Docmost](https://docmost.nuiti.org): conecta un repo, escribe su **Documento del
sistema** en `docs/`, abre el PR y comprueba que se publicó solo.

| Incluye | Qué hace |
|---|---|
| Skill **`conectar-repo`** | Conecta un repo de punta a punta: espacio en Docmost, `docs/` con las 15 páginas, regla en `AGENTS.md`, validación, PR, merge y comprobación en Docmost |
| Skill **`docmost`** | Leer y buscar en Docmost, y escribir la wiki del proyecto (actas, procedimientos, incidentes) |
| Servidor MCP **`docmost`** | Las herramientas `docmost_*` que usan las skills, con **tu** token personal |

## Antes de instalar (una vez)

1. **Node 22** o más nuevo, **git** y **GitHub CLI** con sesión (`gh auth login`).
2. **Tu token personal de Docmost**, en una variable de entorno de tu PC (no en el repo
   ni en el chat):
   - En https://docmost.nuiti.org: tu foto → *Ajustes → Tokens personales → Crear token*.
   - Windows: `setx DOCMOST_TOKEN "el-token"` y abre una terminal nueva.
   - macOS / Linux: `export DOCMOST_TOKEN="el-token"` en `~/.zshrc` o `~/.bashrc`.

## Instalar

Los comandos sirven en PowerShell y en bash.

```sh
git clone --depth 1 https://github.com/DevHRL/.github "$HOME/.docmost-hrl/devhrl"
node "$HOME/.docmost-hrl/devhrl/docmost/herramientas/agentes/instalar.mjs" --agente claude
node "$HOME/.docmost-hrl/devhrl/docmost/herramientas/agentes/instalar.mjs" --agente codex
```

Usa la línea de tu agente (o las dos). Si la carpeta ya existe, en lugar del `git clone`:
`git -C "$HOME/.docmost-hrl/devhrl" pull --ff-only`.

| Agente | Dónde quedan las skills | Dónde queda el MCP |
|---|---|---|
| Claude Code | `~/.claude/skills/` | `claude mcp add --scope user docmost …` |
| Codex | `~/.agents/skills/` | `~/.codex/config.toml`, tabla `[mcp_servers.docmost]` con `env_vars = ["DOCMOST_TOKEN"]` |

Después **reinicia el agente** y pregúntale: «¿Con qué usuario estás conectado a
Docmost?». Debe responder con tu nombre.

En Claude Code también se puede instalar como plugin (`/plugin marketplace add
DevHRL/hrl-docmost` y `/plugin install docmost@hrl`). Usa una de las dos formas, no
las dos.

## Usar

Desde la carpeta del repo del proyecto:

> Conecta este repo a Docmost. Espacio: `<slug>`. Nombre del sistema: <Nombre>.
> Cuando el check del PR esté en verde, fusiónalo y comprueba que se publicó.

Requisito del repo: los secretos `DOCMOST_URL`, `DOCMOST_EMAIL` y `DOCMOST_PASSWORD`
del bot, que carga un administrador en *Settings → Secrets and variables → Actions*.
El agente nunca recibe esa contraseña.

## Para el agente que lee esto

Si la persona te pidió instalar esta skill:

1. Comprueba Node 22+, git y `gh auth status`. Si falta algo, díselo y detente.
2. Ejecuta el `git clone` (o el `git pull`) y **solo** la línea de `instalar.mjs` del
   agente que eres: `--agente claude` si eres Claude Code, `--agente codex` si eres Codex.
3. Muéstrale la salida. Si dice que falta el token, explícale cómo crearlo y guardarlo
   (sección «Antes de instalar»). **Nunca le pidas que pegue el token en el chat.**
4. Dile que reinicie el agente para que se carguen las skills y el MCP.
