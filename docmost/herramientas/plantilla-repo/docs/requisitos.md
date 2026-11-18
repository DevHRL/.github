# Requisitos

!!! info "Qué va aquí"
    Lo que el sistema debe hacer (funcionales) y cómo debe hacerlo (no funcionales). Cada requisito necesita un criterio de aceptación verificable: si no se puede probar, no es un requisito.

## Requisitos funcionales

| ID | Requisito | Actor | Prioridad | Criterio de aceptación | Estado |
|---|---|---|---|---|---|
| RF-01 | [El sistema debe permitir registrar ...] | [Enfermería] | [Imprescindible] | [Dado ..., cuando ..., entonces ...] | [Pendiente] |
| RF-02 | [Requisito] | [Actor] | [Importante] | [Criterio] | [En desarrollo] |
| RF-03 | [Requisito] | [Actor] | [Deseable] | [Criterio] | [Hecho] |

Prioridad: **Imprescindible** (sin esto no sirve), **Importante** (debe estar pronto), **Deseable** (si hay tiempo).

## Requisitos no funcionales

| ID | Categoría | Requisito | Medida verificable |
|---|---|---|---|
| RNF-01 | Rendimiento | [Las búsquedas responden rápido] | [95 % en menos de 2 s con 50 usuarios] |
| RNF-02 | Disponibilidad | [Disponible en horario de atención] | [99 % de 7:00 a 20:00] |
| RNF-03 | Seguridad | [Solo usuarios autorizados] | [Login institucional; roles por perfil] |
| RNF-04 | Privacidad | [Protección de datos de pacientes] | [Datos sensibles cifrados; acceso registrado] |
| RNF-05 | Usabilidad | [Fácil de aprender] | [Un usuario nuevo registra un caso en menos de 5 min tras 1 h de capacitación] |
| RNF-06 | Accesibilidad | [Legible y navegable con teclado] | [WCAG 2.1 nivel AA en pantallas principales] |
| RNF-07 | Compatibilidad | [Funciona en los equipos del hospital] | [Chrome y Edge actuales; resolución desde 1366 × 768] |
| RNF-08 | Mantenibilidad | [Código mantenible] | [Pruebas automáticas; cobertura mínima X %] |
| RNF-09 | Interoperabilidad | [Intercambia datos con ...] | [API REST documentada; formato X] |
| RNF-10 | Auditoría | [Trazabilidad de cambios] | [Quién, qué y cuándo en cada registro clínico] |

## Reglas de negocio

| ID | Regla | Origen |
|---|---|---|
| RN-01 | [Ejemplo: un paciente no puede tener dos citas el mismo día en el mismo servicio] | [Norma interna / jefatura] |
