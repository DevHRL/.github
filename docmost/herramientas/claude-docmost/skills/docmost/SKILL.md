---
name: docmost
description: Trabajar con el Docmost del Hospital Regional de Loreto (docmost.nuiti.org). Úsala cuando la persona pida buscar o leer documentación de un sistema en Docmost, escribir actas, procedimientos o incidentes con las herramientas docmost_*, documentar un repo o un sistema («documenta este repo», «agrega el Documento del sistema»: se hace en docs/ del repo, no en Docmost), o subir diagramas de draw.io a una página.
---

# Docmost del HRL

Trabajas en Docmost con el **token personal** de la persona: todo lo que
escribe queda a su nombre y solo puede ver y editar lo que ella puede. Actúa
como lo haría ella, con cuidado: otras personas leen y editan las mismas páginas.

## Herramientas

| Herramienta | Para qué |
|---|---|
| `docmost_conexion` | Comprobar la conexión y a nombre de quién se trabaja |
| `docmost_espacios` | Espacios a los que tiene acceso y si puede editar |
| `docmost_buscar` | Buscar páginas por texto |
| `docmost_arbol` | Árbol de un espacio o de una rama, con ids |
| `docmost_leer` | Página en Markdown + ubicación, subpáginas, comentarios y quién la tiene abierta |
| `docmost_quien_tiene_abierta` | Comprobar justo antes de reemplazar |
| `docmost_crear_pagina` | Página nueva con Markdown |
| `docmost_actualizar_pagina` | Título o contenido: reemplazar, agregar o anteponer |
| `docmost_plantillas` / `docmost_usar_plantilla` | Crear un árbol desde una plantilla |
| `docmost_subir_diagrama` | Diagrama editable de draw.io (nuevo o reemplazando uno) |
| `docmost_preparar_espacio` | Espacio de un proyecto listo para que su repo publique (lo crea si falta; bot escritor; todos leen) |

Las páginas se indican por id, slugId o URL; los espacios por slug, nombre o id.

Si una herramienta dice que falta el token o que fue rechazado, explica a la
persona cómo generarlo: Docmost → *Ajustes → Tokens personales* → *Crear token*,
y guardarlo en `DOCMOST_TOKEN` (en Windows `setx DOCMOST_TOKEN "<token>"`,
reabrir la terminal y el agente). Nunca le pidas que pegue el token en el chat.

## Reglas al escribir

1. **Lee antes de escribir.** `docmost_leer` antes de cambiar una página que ya
   existe; trabaja sobre su contenido actual, no sobre lo que recuerdas.
2. **No pises a nadie.** Reemplazar reescribe toda la página. Si `docmost_leer`
   o `docmost_quien_tiene_abierta` muestran a otra persona con la página
   abierta:
   - no la reemplaces; Docmost lo rechaza igualmente (conflicto 409);
   - si el cambio es solo añadir, usa `operacion: "agregar"` o `"anteponer"`,
     que se combinan sin pisar lo que esa persona escribe;
   - si no, dile quién la tiene abierta y espera, o sigue con otras páginas y
     vuelve después;
   - usa `forzar: true` solo si la persona te lo pide expresamente después de
     saber quién la tiene abierta.

   Que la tenga abierta la propia persona («tú») no bloquea: suele estar
   mirando cómo se llena. Avísale igual de que no escriba en esa página mientras tanto.
3. **Respeta lo que no es texto.** Diagramas, imágenes, adjuntos, columnas y
   otras piezas aparecen como marcadores en su propia línea, por ejemplo
   `{{drawio:0190…}}` o `{{bloque:3fa9c01b2e}}`. Al reemplazar, deja cada
   marcador donde corresponda; si lo quitas, esa pieza desaparece de la página.
   No inventes marcadores: solo los que da `docmost_leer` o `docmost_subir_diagrama`.
4. **Comentarios.** Si la página tiene comentarios abiertos, reemplazarla quita
   el resaltado del texto comentado. Prefiere cambios con «agregar», o avisa y pregunta.
5. **Páginas publicadas desde GitHub.** Las que llevan el pie «Esta página se
   actualiza desde GitHub» (el Documento del sistema de cada proyecto) se editan en
   el repo (`docs/` y `mkdocs.yml`), no en Docmost: la siguiente publicación pisaría
   el cambio. Docmost lo rechaza. Haz el cambio en el repo, siguiendo la regla de documentación de su `AGENTS.md`.
6. **Sin secretos.** Nunca escribas contraseñas, tokens, cadenas de conexión ni
   datos de pacientes. Indica *dónde* están (gestor de secretos, variables de
   Coolify), no su valor.
7. **Cuenta lo que hiciste.** Al terminar, da los enlaces de las páginas creadas o
   cambiadas y los avisos que devolvieron las herramientas.

## Markdown que entiende Docmost

- Títulos, listas, listas de tareas (`- [ ]`), tablas, citas, código.
- Diagramas Mermaid: bloque ```` ```mermaid ````.
- Avisos: `:::info`, `:::success`, `:::warning`, `:::danger` … `:::`.
- Enlaces a otras páginas de Docmost: su URL completa.
- No hay HTML libre ni notas al pie complejas; menciones a personas se pierden.

## Tareas frecuentes

- **Documentar o conectar un repo** («conecta este repo a Docmost», «documenta este
  repo», «agrega el Documento del sistema»): usa la skill **conectar-repo**. El
  Documento del sistema se escribe en `docs/` del repo, no con estas herramientas.
- **Preparar el espacio de un proyecto** (crearlo, bot como escritor, lectura para
  todos): `docmost_preparar_espacio`.
- **Actas, procedimientos, incidentes** del proyecto: en su espacio de Docmost, con
  `docmost_usar_plantilla` (Acta de reunión, Procedimiento operativo, Incidente) y
  luego `docmost_actualizar_pagina`.
- **Diagramas** (procesos AS-IS/TO-BE, contexto, arquitectura, datos): sigue
  [diagramas.md](diagramas.md).
- **Actualizar una sección**: `docmost_leer` → editar el Markdown recibido
  conservando marcadores → `docmost_actualizar_pagina` con «reemplazar» (si nadie
  más la tiene abierta) o «agregar».
- **Dónde van**: las decisiones técnicas, en el repo (`docs/decisiones/`). Actas,
  incidentes y procedimientos, en el espacio del proyecto pero **fuera** del árbol del
  Documento del sistema (en la raíz del espacio o bajo páginas como «Actas»): lo que
  cuelgue de una página publicada desde GitHub se manda a la papelera en la
  siguiente publicación.
