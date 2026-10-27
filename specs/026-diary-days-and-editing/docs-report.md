# Reporte de documentación 026 — Diario: navegar entre días, editar días pasados y pulir la edición

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `docs/deploy-runbook.md` | Caso nuevo «Caso A (sin migraciones) con backend y frontend: 026»: endpoints nuevos, orden de despliegue, `SECRET_KEY` propia en EC2, comprobaciones manuales en navegador y marcha atrás | REQ-007 y ADR-0035 (`POST /api/meals/restore`, `?undo=1`); AC manuales del verify-report y de la review (AC-009.1/3/4, AC-008.1..3, AC-002.6, AC-005.2, AC-007.6); hallazgo F2 de la review |
| `README.md` | Entrada nueva «Diary days and editing» en la lista de funcionalidades (en inglés, ASCII) | REQ-001 a REQ-009 y ADR-0035 |
| `CLAUDE.md` (sección Proyecto) | Fila de Diario ampliada con la 026; paso previo al despliegue de la 026 | Diff de `meal_routes`, `meal_service`, `diary`; `SECRET_KEY` firma el token |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `backend/.env.example` | No hay variables nuevas; `SECRET_KEY=change-me` ya figura. |
| `frontend/README.md` | No cambia cómo se ejecuta ni se prueba. |
| `docs/sdd/decisions/ADR-0035-…md` | Las ADRs no son del doc-keeper; la línea «Decidido por» la corrige la sesión principal (F7). |
| `docs/backlog.md` | Fuera de alcance del doc-keeper; los pendientes de la feature están en `specs/026-…/backlog.md`. |
| Fila de la 026 en el historial de despliegues del runbook | Se añade en el despliegue real (la 025 tampoco tiene fila hasta entonces). |

## 3. Conclusión
Se documentó el caso de despliegue de la 026 (sin migración ni variables, con endpoint nuevo, orden frontend/backend, `SECRET_KEY` propia y comprobaciones manuales), la funcionalidad en el README y la sección Proyecto de `CLAUDE.md`. Codificaciones sin cambios (README ASCII; runbook y CLAUDE.md UTF-8).

## Comentarios del usuario
