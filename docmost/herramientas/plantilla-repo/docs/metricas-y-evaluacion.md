# Métricas y evaluación

!!! info "Qué va aquí"
    Cómo se sabrá si el sistema funciona. La línea base sale del proceso actual (AS-IS); sin ella no hay forma de demostrar mejora.

## Indicadores

| ID | Indicador | Fórmula | Línea base | Meta | Fuente del dato | Frecuencia | Responsable |
|---|---|---|---|---|---|---|---|
| IND-01 | [Tiempo de registro] | [Suma de tiempos / n.º de registros] | [X min] | [Y min] | [Logs del sistema] | [Mensual] | [Nombre] |
| IND-02 | [Registros con errores] | [Con error / total × 100] | [X %] | [Y %] | [Auditoría] | [Trimestral] | [Nombre] |
| IND-03 | [Adopción] | [Usuarios activos / usuarios esperados × 100] | [0 %] | [Y %] | [Sistema] | [Mensual] | [Nombre] |

## Medios de evaluación

| Medio | Qué mide | Cuándo |
|---|---|---|
| [Reportes automáticos del sistema] | [IND-01, IND-03] | [Mensual] |
| [Encuesta de satisfacción] | [Percepción de usuarios] | [Al terminar el piloto] |
| [Comparación antes / después] | [IND-02] | [3 meses después de la puesta en marcha] |

## Plan de evaluación

1. **Línea base:** [cómo y cuándo se mide la situación actual].
2. **Piloto:** [servicio, duración y usuarios].
3. **Evaluación:** [quién analiza los resultados y ante quién se presentan].

## Criterios de éxito

!!! success
    El sistema se considera exitoso si: [ejemplo: IND-01 baja al menos 50 % y la adopción supera el 80 % a los tres meses].
