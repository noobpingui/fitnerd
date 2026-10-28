# Reporte de documentación 029 — Editar alimentos propios en el buscador de «Añadir alimento»

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `README.md` | En la entrada «Food library» se añade la edición en el sitio de alimentos propios (`PATCH /api/food-library/custom/{id}`, 409 por nombre repetido, favorito e id conservados, historial intacto, filas de la propuesta de foto actualizadas). Sigue en ASCII. | REQ-001, REQ-003, REQ-005, REQ-011; el README describe la biblioteca de la 028 |
| `CLAUDE.md` (sección Proyecto) | En la fila del diario se añade la spec 029: endpoint, errores, botón «Editar» en las tres listas y en la propuesta de foto, formulario en línea y sin migración ni variables. | REQ-001 a REQ-011; diff de `food_library_routes.py`, `CustomFoodEditForm.tsx`, `schemas.ts` |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `docs/deploy-runbook.md` | Sin migración, variables ni pasos manuales en la 029; el caso B de la 028 sigue vigente. |
| `.env.example` (todos) | Sin variables de entorno nuevas. |
| Política de privacidad (frontend `legal`) | No cambia qué datos se guardan; ya menciona los alimentos personalizados (REQ-021 de la 028). |
| `docs/sdd/decisions/**` (ADR-0036) | Las ADRs no son del doc-keeper; el plan no introduce ADR. |
| `docs/backlog.md` | Fuera de `paths.docs` de edición para esta etapa; el backlog de la feature está en `specs/029-edit-favorite-foods/backlog.md`. |

## 3. Conclusión
Se actualizaron la entrada «Food library» del README y la fila del diario de la sección Proyecto de `CLAUDE.md`. No hay cambios en `.env.example`, runbook ni Política de privacidad.

## Comentarios del usuario
