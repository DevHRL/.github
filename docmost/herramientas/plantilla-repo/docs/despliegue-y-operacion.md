# Despliegue y operación

!!! info "Qué va aquí"
    Lo necesario para que el sistema esté en marcha y para recuperarlo si falla. Nunca escribas contraseñas ni claves aquí: indica dónde están, no su valor.

## Entornos

| Entorno | URL | Rama | Cómo se despliega | Responsable |
|---|---|---|---|---|
| Desarrollo | [URL local] | [develop] | [Manual] | [Equipo] |
| Pruebas | [URL] | [main] | [Automático] | [Nombre] |
| Producción | [URL] | [main / tag] | [Coolify, al aprobar] | [Nombre] |

## Configuración

| Variable | Para qué | Dónde se define |
|---|---|---|
| [DATABASE_URL] | [Conexión a la base] | [Coolify → Environment Variables] |

!!! danger
    No escribas valores de variables secretas en esta página.

## Monitoreo y alertas

| Qué se vigila | Cómo | Alerta a |
|---|---|---|
| [Disponibilidad] | [Health check cada 1 min] | [Responsable técnico] |
| [Errores] | [Logs del contenedor] | [Equipo] |

## Respaldos y recuperación

| Qué | Frecuencia | Dónde | Retención | Última restauración probada |
|---|---|---|---|---|
| [Base de datos] | [Diario] | [Fuera del servidor] | [30 días] | [Fecha] |

- **Pérdida máxima aceptable (RPO):** [24 h]
- **Tiempo máximo de recuperación (RTO):** [4 h]

## Procedimientos operativos

[Enlaza los procedimientos creados con la plantilla «Procedimiento operativo»: reiniciar, restaurar un respaldo, dar de alta un usuario, etc.]
