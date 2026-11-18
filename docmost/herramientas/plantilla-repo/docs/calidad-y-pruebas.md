# Calidad y pruebas

!!! info "Qué va aquí"
    Cómo se asegura que el sistema funciona y sigue funcionando. Indica qué pruebas automáticas existen, dónde corren y cuánto cubren, además de las pruebas con usuarios.

## Estrategia

[Qué se prueba en cada nivel y por qué. Ejemplo: muchas pruebas unitarias de reglas de negocio, menos de integración y pocas de extremo a extremo para los flujos críticos.]

## Pruebas automáticas

| Tipo | Herramienta | Qué cubre | Dónde corre | Cobertura actual | Meta |
|---|---|---|---|---|---|
| Unitarias | [Jest / Vitest / PHPUnit] | [Reglas de negocio, utilidades] | [Cada push] | [X %] | [80 %] |
| Integración | [Herramienta] | [API con base de datos real] | [Cada pull request] | [X %] | [Meta] |
| API / contrato | [Herramienta] | [Respuestas de los endpoints] | [Cada pull request] | [—] | [Endpoints críticos] |
| Extremo a extremo | [Playwright / Cypress] | [Flujos críticos del TO-BE] | [Antes de desplegar] | [N flujos] | [Todos los críticos] |
| Rendimiento | [k6 / JMeter] | [RNF-01] | [Antes de cada versión] | [—] | [Umbral de RNF-01] |
| Seguridad | [Análisis de dependencias / SAST] | [Vulnerabilidades conocidas] | [Semanal] | [—] | [Cero críticas] |
| Accesibilidad | [axe] | [RNF-06] | [Cada pull request] | [—] | [Sin errores graves] |

## Pruebas con usuarios

| Prueba | Usuarios | Escenarios | Fecha | Resultado |
|---|---|---|---|---|
| [Aceptación del módulo X] | [2 enfermeras] | [Registrar, buscar, corregir] | [Fecha] | [Aprobado / Observaciones] |

## Defectos

[Dónde se registran (issues del repositorio), cómo se priorizan y quién los atiende.]
