# DevHRL/.github

**¿Buscas la skill de documentación para tu agente de IA?** → [docmost/herramientas/agentes](docmost/herramientas/agentes)

Piezas comunes de la organización. **Público a propósito**: los workflows de los repos
privados de DevHRL descargan de aquí las herramientas, y no contiene secretos.

| Ruta | Qué es |
|---|---|
| `.github/workflows/docmost.yml` | Workflow común de documentación: valida el Documento del sistema en cada PR y lo publica en el espacio del proyecto en Docmost |
| `docmost/herramientas/` | `validar.mjs`, `sincronizar.mjs`, `crear-docs.mjs`, `conectar-proyecto.mjs` y la plantilla (`plantilla-repo/`) |
| [`docmost/herramientas/agentes/`](docmost/herramientas/agentes) | **Skills y MCP de Docmost para Claude Code y Codex**: instalador y guía |
| `docmost/herramientas/claude-docmost/` | Las skills (`skills/`) y el servidor MCP (`servidor.mjs`) |

**No se edita aquí.** El original está en `DevHRL/hrl-docmost`
(`github/docmost.yml` y `herramientas/`); cuando cambia, se vuelve a copiar.
Cómo se conecta un repo: `docs/documentar-un-repo.md` de `DevHRL/hrl-docmost`.

Cada repo lo llama con su `.github/workflows/documentacion.yml`:

```yaml
jobs:
  docmost:
    uses: DevHRL/.github/.github/workflows/docmost.yml@main
    with:
      espacio: <slug del espacio del proyecto>
    secrets: inherit
```
