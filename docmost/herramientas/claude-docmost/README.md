# Plugin «docmost» para Claude Code

Conecta Claude Code con el Docmost del HRL usando el token personal de cada persona.

| Archivo | Qué es |
|---|---|
| `servidor.mjs` | Servidor MCP por stdio, sin dependencias (Node 20+). Llama a `/api/hrl/mcp/*` |
| `.mcp.json` | Cómo arranca Claude Code el servidor; pasa `DOCMOST_TOKEN` y `DOCMOST_URL` |
| `skills/docmost/` | Skill: reglas para escribir en la wiki de Docmost y diagramas |
| `skills/conectar-repo/` | Skill: conectar un repo de punta a punta (espacio, `docs/`, validación, PR, merge) y comprobar que se publica |
| `.claude-plugin/plugin.json` | Manifiesto del plugin |

El marketplace está en `.claude-plugin/marketplace.json`, en la raíz del repo.
Instalar, dentro de Claude Code:

```
/plugin install docmost --marketplace DevHRL/hrl-docmost
```

Instalación y uso: guía de la plataforma, página **Claude y Docmost**
(`guia/docs/claude-y-docmost.md`). Detalles del servidor de Docmost:
`docs/copia-de-docmost.md`.

## Probar

```sh
DOCMOST_URL=http://localhost:3100 DOCMOST_TOKEN=<token> node servidor.mjs --probar
```

Cambios en las herramientas: subir `version` en `plugin.json` para que Claude Code
actualice el plugin.
