# Reporte de documentación 028 — Biblioteca de alimentos del diario

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `docs/deploy-runbook.md` | Nueva sección «Caso B (aditiva) con relleno de datos: 028» antes del caso C: volcado verificado, migración `e6a8c0d2f4b7` antes del merge con `FLASK_ENV`, comprobación de solo lectura (revisión, tablas, columna, filas rellenadas), comprobación manual y marcha atrás (el downgrade borra favoritos y biblioteca; los alimentos propios se regeneran con otro upgrade; las comidas conservan su copia). | Art. P4: la migración trae un relleno de datos y no se aplica sola; diff `backend/migrations/versions/e6a8c0d2f4b7_create_food_library.py`, ADR-0036 decisión 6. |
| `CLAUDE.md` (sección Proyecto) | Fila de «Diario de comidas» con la 028 (biblioteca, `/api/food-library/*`, `custom_food_id`, búsqueda conjunta con erratas y «-ces», `FoodSearchPanel`, crear desde la propuesta, confirmación en línea, `cf` en el token); fila de USDA: `FoodsPage` retirada; nuevo paso previo al despliegue de la 028. | Resumen del diff y ADR-0036. |
| `README.md` (en inglés, ASCII) | Nueva entrada «Food library» con la decisión y su porqué (recientes sin estado, copia con `SET NULL`, búsqueda en memoria sin proveedor externo, confirmación en línea por accesibilidad, migración manual). | ADR-0036; el README explica el «por qué» de cada decisión. |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `frontend/README.md` | Plantilla genérica de Vite, no menciona el diario ni los alimentos. |
| `**/.env.example` | La 028 no añade variables de entorno. |
| `docs/deploy-runbook.md`, filas de «Historial de despliegues» y del caso 021 (`/foods`) | El historial se rellena al desplegar, no antes; la mención de `/foods` del caso 021 es histórica. |
| Política de privacidad | Ya cambió en el código (REQ-021); ningún doc la cita. |
| `docs/sdd/decisions/ADR-0036-*.md` y `README.md` de decisiones | No son de doc-keeper; la ADR ya refleja la confirmación en línea (cierra F8 de `backlog.md`). |
| `specs/028-diary-food-library/state.json` | Artefacto SDD; la nota «112 AC» (la spec tiene 107 AC con marcador) debe corregirla quien gestione el estado, no la documentación. |

## 3. Conclusión
Se documentó el paso previo de despliegue de la migración `e6a8c0d2f4b7` (runbook y CLAUDE.md) y la funcionalidad de la 028 (CLAUDE.md y README). Codificación comprobada tras editar: `README.md` sigue en ASCII y `CLAUDE.md` y el runbook en UTF-8, sin CRLF.

Notas para el backlog: T-134 de `tasks.md` escribe `useEscapeCapture(active, onEscape)` con la firma al revés; la real es `(onEscape, active)` (no se toca, es un artefacto SDD). La comprobación con lector de pantalla (AC-N002.2) queda como prueba manual en el runbook.

## Comentarios del usuario
