# Reporte de documentación 016 — Registrar mediciones corporales con fecha pasada

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `README.md` | En la línea de "Body metrics tracking": se puede rellenar un día olvidado desde Métricas (hasta un año atrás) y el peso del perfil sigue a la medición de fecha más reciente. | Funcionalidad visible nueva (REQ-001, REQ-005, REQ-006). |
| `CLAUDE.md` (sección Proyecto) | Viñeta nueva "Mediciones con fecha pasada (spec 016)" en Métricas corporales: diálogo, límites 365/366 días, sincronización por fecha, relectura de perfil, aviso REQ-009. | Área funcional cambiada y punto delicado (REQ-005, REQ-006, REQ-008, REQ-009). |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `frontend/README.md` | No describe las funcionalidades de Métricas. |
| `docs/deploy-runbook.md` | Sin migración, variables ni pasos de despliegue nuevos. |
| `docs/backlog.md` | Backlog del proyecto, no documentación de la feature; la línea 32 (mediciones con fecha pasada desde el perfil) queda resuelta solo en parte desde Métricas, decisión del usuario. |
| `.env.example` | Sin variables de entorno nuevas. |

## 3. Conclusión
Se actualizaron el README y la sección Proyecto de `CLAUDE.md` con la funcionalidad nueva. Codificación de ambos sin cambios (ASCII/UTF-8, CRLF).

## Comentarios del usuario
