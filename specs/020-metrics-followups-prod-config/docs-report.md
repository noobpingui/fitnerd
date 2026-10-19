# Reporte de documentación 020 — Seguimiento de métricas corporales y configuración de producción

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `docs/deploy-runbook.md` | Sección 2: paso manual para comprobar `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev` en el `backend/.env` de EC2 antes del merge. Sección 7: causa y arreglo si `/api/health` falla por esa variable. | `backend/config.py` (`resolve_frontend_base_url`, `FRONTEND_BASE_URL_REQUIRED`), ADR-0028; punto del backlog y de la review. |
| `CLAUDE.md` (sección Proyecto) | Nuevo paso previo al despliegue de la 020. Nueva viñeta «Seguimiento tras registrar (spec 020)»: aviso de relectura con «Reintentar» solo tras registrar (desde Métricas y desde «Datos físicos»; corregir y borrar quedaron en el backlog, Q1 de la spec), Historial que se despliega hasta la medición registrada, reloj de la app fijable solo con `TESTING`. | Diff de `RefreshFailedNotice.tsx`, `historyReveal.ts`, `PhysicalDataForm.tsx`, `backend/utils/clock.py`. |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `backend/.env.example` | La feature ya documenta `FRONTEND_BASE_URL` como obligatoria en producción con `https://`, con un valor de ejemplo. |
| `frontend/.env.example`, `.env.example` | La feature no añade variables. |
| `README.md` | No menciona `FRONTEND_BASE_URL` ni el reloj; los cambios no son una funcionalidad nueva de cara al proyecto. |
| `docs/sdd/decisions/` (ADR-0028 y README) | Las ADR no son del rol doc-keeper; se aceptan aparte en una rama chore. |
| `docs/backlog.md` | Backlog global: lo actualiza el orquestador en close. |

## 3. Conclusión
Se documentó el paso manual de `FRONTEND_BASE_URL` en el runbook y en `CLAUDE.md`, y los comportamientos nuevos de la feature en la sección Proyecto. La codificación de ambos archivos (UTF-8, CRLF) no cambió.
