# Diagramas en Docmost

Docmost muestra dos tipos de diagrama:

- **Mermaid**, escrito en el Markdown (```` ```mermaid ````). Rápido y bueno para
  secuencias, estados, modelos de datos (`erDiagram`) y flujos simples. Se
  edita como texto.
- **draw.io**, con `docmost_subir_diagrama`. Las personas lo editan con doble
  clic en Docmost. Es el formato de las plantillas (AS-IS, TO-BE, contexto).

Usa draw.io cuando las personas vayan a mantener el diagrama a mano o cuando
reemplaces un diagrama de draw.io que ya está en la página.

## Fuentes para `docmost_subir_diagrama`

Exactamente una:

### `modelo`: diagrama por carriles

El de las plantillas. Un carril por actor, de arriba abajo; columnas de
izquierda a derecha.

```json
{
  "carriles": ["Paciente", "Admisión", "Sistema"],
  "nodos": [
    { "id": "i",  "carril": 0, "columna": 0, "tipo": "inicio",   "texto": "Llega" },
    { "id": "t1", "carril": 1, "columna": 1, "tipo": "tarea",    "texto": "Registra la cita" },
    { "id": "s1", "carril": 2, "columna": 1, "tipo": "sistema",  "texto": "Valida el SIS" },
    { "id": "d1", "carril": 1, "columna": 2, "tipo": "decision", "texto": "¿Asegurado?" },
    { "id": "f",  "carril": 0, "columna": 3, "tipo": "fin",      "texto": "Atendido" }
  ],
  "flechas": [["i", "t1"], ["t1", "s1"], ["s1", "d1"], ["d1", "f", "Sí"]]
}
```

Tipos: `inicio`, `tarea`, `decision`, `fin`, `nota` (problemas, en naranja),
`sistema` (lo que automatiza el sistema), `actor` (sistemas o personas externas).
Usa los mismos carriles en AS-IS y TO-BE para que se puedan comparar. El diagrama
de contexto también sirve con carriles: usuarios arriba, el sistema al medio,
sistemas externos abajo.

### `xml`: draw.io escrito por ti

Para arquitectura, despliegue o cualquier cosa que no sea por carriles. Escribe
un `mxGraphModel` válido de draw.io:

```xml
<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="web" value="Frontend&lt;br&gt;React" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
    <mxGeometry x="40" y="40" width="140" height="60" as="geometry"/>
  </mxCell>
  <mxCell id="api" value="API&lt;br&gt;NestJS" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="1">
    <mxGeometry x="260" y="40" width="140" height="60" as="geometry"/>
  </mxCell>
  <mxCell id="db" value="PostgreSQL" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#f5f5f5;" vertex="1" parent="1">
    <mxGeometry x="290" y="160" width="80" height="80" as="geometry"/>
  </mxCell>
  <mxCell id="e1" value="HTTPS" style="endArrow=classic;html=1;" edge="1" parent="1" source="web" target="api">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
  <mxCell id="e2" style="endArrow=classic;html=1;" edge="1" parent="1" source="api" target="db">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
</root></mxGraphModel>
```

Docmost dibuja una vista previa simple (cajas, elipses, rombos, carriles,
flechas rectas, texto); formas especiales como cilindros se ven como cajas hasta
que alguien abre y guarda el diagrama en draw.io. Coordenadas absolutas, sin
solapes, unos 40 px entre cajas. Colores de las plantillas: azul `#dae8fc` /
`#6c8ebf` (tareas, frontend), morado `#e1d5e7` / `#9673a6` (sistema, backend),
gris `#f5f5f5` / `#666666` (externos), verde `#d5e8d4` / `#82b366`, naranja
`#ffe6cc` / `#d79b00` (notas), amarillo `#fff2cc` / `#d6b656` (decisiones).

### `archivo`: un diagrama que ya está en el repo

Ruta local a un `.drawio`, `.drawio.svg` o `.xml`. Un `.svg` debe haberse
exportado de draw.io con «Incluir una copia de mi diagrama»; si no, súbelo como
`.drawio`.

## Dónde queda

- `reemplazar: "<id>"` (el id del marcador `{{drawio:<id>}}` que muestra
  `docmost_leer`): cambia solo ese diagrama. Es seguro aunque alguien tenga la
  página abierta. Así se reemplazan los diagramas de ejemplo de las plantillas.
- Sin `reemplazar`: `insertar: "final"` (por defecto) lo agrega al final de la
  página; `insertar: "no"` solo lo sube y devuelve el marcador, que luego pones
  en tu Markdown en su propia línea y escribes con `docmost_actualizar_pagina`.
