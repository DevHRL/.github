# Llenar las páginas del Documento del sistema

Cada archivo de `docs/` sale de la plantilla con sus secciones (`##`), tablas de
ejemplo entre corchetes y una nota `!!! info "Qué va aquí"` que explica qué poner.

## Estudiar el repo

Lee lo necesario, sin adivinar:

| Para | Mira |
|---|---|
| Qué hace y para quién | README, `docs/`, nombres de módulos, pantallas, textos de la interfaz |
| Stack y versiones | `package.json`, `pom.xml`, `requirements.txt`, `go.mod`, lockfiles, Dockerfile |
| Arquitectura | estructura de carpetas, servicios en `docker-compose`, puntos de entrada, clientes HTTP |
| Datos | migraciones, modelos/entidades, esquemas, seeds |
| API | rutas/controladores, OpenAPI |
| Seguridad | autenticación, roles, guards/middlewares, manejo de datos sensibles |
| Pruebas | carpetas de tests, configuración, CI |
| Despliegue | Dockerfile, compose, workflows, `.env.example` (nombres, nunca valores) |
| Historia | `git log`, tags, CHANGELOG |

## Llenar cada página

Para cada archivo de `docs/` (la ficha `index.md` y las 14 páginas):

1. **Conserva la estructura**: el título, todas las secciones `##` y las tablas de la
   plantilla, con datos reales en lugar de los ejemplos entre corchetes. Si una sección
   no aplica, déjala y explica por qué en una línea.
2. Quita la nota `!!! info "Qué va aquí"` de las páginas que llenaste.
3. Lo que no sale del código no se inventa: `[Por completar: qué falta y quién lo sabe]`.
4. Toda variable de un `.env.example` va en la tabla «Configuración» de
   `despliegue-y-operacion.md`.
5. Página nueva = archivo + entrada en el `nav`. Las 15 obligatorias no se renombran ni
   se reordenan.

Qué suele salir del código y qué no:

| Página | Del repo | De las personas |
|---|---|---|
| Inicio (ficha) | nombre, repositorio, versión, URLs si están en el repo | estado, área usuaria, patrocinador, equipo, fechas |
| Contexto y problemática | poco: README | casi todo |
| Proceso actual (AS-IS) | nada | todo; deja el diagrama de ejemplo |
| Objetivos y alcance | alcance funcional (módulos existentes) | objetivos medibles |
| Métricas y evaluación | indicadores que el sistema ya calcula | línea base, metas |
| Proceso propuesto (TO-BE) | flujo según el código (estados, pantallas, roles) | validación |
| Requisitos | funcionalidades implementadas como RF, con criterio verificable | prioridad, faltantes |
| Solución propuesta | arquitectura, módulos, modelo de datos, integraciones, API, seguridad | decisiones y motivos |
| Stack tecnológico | todo, con versiones | motivo de elección |
| Calidad y pruebas | tipos de prueba, comandos, CI, cobertura si hay | pruebas con usuarios |
| Despliegue y operación | entornos, despliegue, variables (sin valores), respaldos si están scripteados | contactos, horarios |
| Riesgos | técnicos visibles (dependencias viejas, sin pruebas, puntos únicos de falla) | de negocio |
| Plan, estado y versiones | tags, CHANGELOG, últimos commits | plan |
| Usuarios y soporte | roles de la aplicación | capacitación, soporte |
| Anexos | glosario del dominio, enlaces | actas, decisiones |

## Diagramas

- Los diagramas de la plantilla son `docs/img/*.drawio.svg`: se editan con draw.io
  (aplicación o extensión de VS Code) y se guardan con el mismo nombre.
- Modelo de datos: un bloque `mermaid` con `erDiagram`.
- Contexto y TO-BE: si el código muestra el flujo, reemplázalos; el AS-IS no se inventa.

## Decisiones técnicas

Una decisión importante que se ve en el código (por qué esta base, este patrón, esta
integración) va en `docs/decisiones/NNNN-tema.md`, copiando
`H/plantilla-repo/extras/decision-tecnica.md` (H: ver el paso 4 de la skill). Agrégala al `nav`
(sección «Decisiones técnicas» después de Anexos) y enlázala desde «Solución propuesta»
y «Anexos».
