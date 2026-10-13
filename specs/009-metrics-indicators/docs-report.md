# Informe de documentación: 009-metrics-indicators

## Archivos actualizados

| Archivo | Motivo |
|---|---|
| `README.md` | "What it offers": la línea de Body metrics menciona los indicadores de progreso (cambio en 30 días, ritmo frente a la meta, tendencia de 7 días, composición corporal, racha). Sigue en ASCII con CRLF. |
| `CLAUDE.md` (solo `## Proyecto`) | Fila de Métricas corporales: indicadores calculados en el frontend (spec 009) y regla "Sin registros recientes" a los 28 días. Sigue en UTF-8 con CRLF. |

## Sin tocar

- `.env.example` (todos): la feature no añade variables de entorno.
- `frontend/README.md` y "Running it locally": no cambia cómo correr, testear ni desplegar.
- `docs/`: no hay documentación técnica sobre estos indicadores.
- Backend y despliegue: la feature es solo de frontend, sin endpoints ni migraciones.
