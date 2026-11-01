# Reporte de documentación 032 — Macros por 100 g en el chat de porciones y botón «Añadir alimento» precargado

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `README.md` | En la entrada «Portion estimate»: `name` y `per_100g` en la respuesta, límite de 250 tokens, línea «Por 100 g», botón y diálogo «Añadir alimento»; se quita la frase de que el chat no añade nada y de que es solo frontend | REQ-001, REQ-002, REQ-005 a REQ-009, NFR-001; la 032 sustituye la decisión Q7 de la 031 |
| `CLAUDE.md` (sección Proyecto) | Añadida la spec 032 a la fila de Diario de comidas, tras la 031 | Nueva capacidad, cambio de contrato y componentes nuevos (`PortionAddFoodDialog`) |
| `docs/deploy-runbook.md` | Nuevo «Caso A: 032» con el despliegue sin migración y las comprobaciones manuales | Cambio de comportamiento visible; sin migración ni variables (diff de `meal_routes.py`, `portion_estimate_rules.py`) |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `.env.example` (raíz, `backend/`, `frontend/`) | Sin variables nuevas; `PORTION_ESTIMATE_MODEL` no cambia |
| `frontend/README.md` | No describe el diario ni el chat de porciones |
| `docs/backlog.md` | Backlog del proyecto; lo gestiona el cierre de la feature, no el doc-keeper |
| `docs/sdd/decisions/ADR-0037-estimacion-de-porciones-con-salida-estructurada.md` | Las ADR no son del doc-keeper (Art. P5.2). Pendiente de la sesión principal: su contexto cita 150 tokens de salida y ahora son 250 (NFR-001) |

## 3. Conclusión
README, sección Proyecto de `CLAUDE.md` y runbook actualizados; codificación UTF-8 (README ASCII/UTF-8) verificada tras editar. La ADR-0037 queda desactualizada en el límite de tokens (150 frente a 250) y debe corregirla la sesión principal con aprobación del usuario.
