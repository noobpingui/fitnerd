# Reporte de documentación 019 — Integridad de los correos guardados

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `docs/deploy-runbook.md` | Nuevo caso B' de la 019 (volcado verificado, comprobación de solo lectura, `flask db upgrade` antes del merge, comprobación en `pg_constraint`, marcha atrás); la 019 en la tabla de casos; la plantilla del paso 4 usa `exec_driver_sql` y una nota sobre `[[:space:]]`; fila «pendiente» en el historial. | Art. P4; plan 3.1.4; hallazgo F1 de `review.md` (`text()` toma `:space` como parámetro enlazado). Migración `e5b7d9f1a3c6`. |
| `CLAUDE.md` (sección Proyecto) | Autenticación: restricción CHECK en la base (spec 019, ADR-0027); nuevo paso previo al despliegue de la migración `e5b7d9f1a3c6`. | Art. P4; REQ-004 y diff de la migración y de los modelos. |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `README.md` | La feature no cambia funcionalidad visible, ejecución ni variables de entorno. |
| `.env.example` (todos) | Sin variables nuevas (Art. B6.5). |
| `docs/sdd/decisions/*` | Las ADRs no son del doc-keeper (ADR-0027 sigue en «Propuesta», F2). |

## 3. Conclusión
El runbook y la sección Proyecto de `CLAUDE.md` recogen el paso manual de producción de la migración `e5b7d9f1a3c6`, con las consultas de comprobación ejecutadas con `exec_driver_sql` (F1). La fila del historial queda como «pendiente» hasta el despliegue.

## Comentarios del usuario
