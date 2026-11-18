<!-- docmost:inicio (sección mantenida por DevHRL/hrl-docmost: herramientas/plantilla-repo/AGENTS-documentacion.md) -->
## Documentación (Docmost)

Regla para cualquier persona o agente de IA (Claude Code, Codex…) que cambie este repo.

La documentación del sistema vive en `docs/` y sigue el **Documento del sistema** de
`DevHRL/hrl-docmost`: 15 páginas obligatorias con sus títulos, su orden (el `nav` de
`mkdocs.yml`) y sus secciones `##`. Al fusionar en `main` se publica sola en el espacio
**__ESPACIO__** de docmost.nuiti.org. Nunca se edita en Docmost: se pierde.

1. **La documentación cambia en el mismo PR que el código que describe.**
2. Qué página tocar:

   | Si el cambio… | Actualiza |
   |---|---|
   | agrega, quita o cambia de versión una dependencia | `docs/stack-tecnologico.md` |
   | cambia Docker, compose, variables de entorno o el despliegue | `docs/despliegue-y-operacion.md`; toda variable de un `.env.example` va en su tabla «Configuración» |
   | agrega una migración, tabla, entidad, ruta o controlador | `docs/solucion-propuesta.md` (modelo de datos, API, integraciones) |
   | agrega o cambia una funcionalidad | `docs/requisitos.md` (RF con criterio de aceptación) y, si cambia el flujo, `docs/proceso-propuesto-to-be.md` |
   | cambia la configuración de pruebas o agrega un tipo de prueba | `docs/calidad-y-pruebas.md` |
   | publica una versión | `docs/plan-estado-y-versiones.md` (historial de versiones) |
   | toma una decisión de diseño | `docs/decisiones/NNNN-tema.md` con la plantilla «Decisión técnica», en el `nav` y enlazada desde «Solución propuesta» |
   | mueve o borra archivos enlazados desde `docs/` | los enlaces que apuntaban a ellos |

3. Página nueva = archivo en `docs/` + entrada en el `nav`. Las 15 obligatorias no se
   renombran, no se reordenan ni pierden secciones; si una sección no aplica, se deja y
   se explica por qué. Para darle subpáginas a una, pasa a ser carpeta con su `index.md`
   como primera entrada (sin título).
4. Lo que no sale del código (problemática, proceso actual, metas, línea base) no se
   inventa: `[Por completar: qué falta y quién lo sabe]`.
5. Sin secretos ni datos de pacientes: se indica dónde está un valor, nunca el valor.
6. En la descripción del PR, marca «Actualicé las páginas…» con la lista, o
   «No aplica, porque: …» con el motivo.
7. El check **Documentación** del PR valida todo esto (errores en rojo; los textos de
   ejemplo pendientes, como avisos). Para correrlo antes:
   `node "$HOME/.docmost-hrl/devhrl/docmost/herramientas/validar.mjs" --repo . --base origin/main`
   (las herramientas se descargan con la skill `conectar-repo`; ver `DevHRL/.github`).
<!-- docmost:fin -->
