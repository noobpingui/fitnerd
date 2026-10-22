# Reporte de documentación 025 — Registro de una comida con foto desde el diario

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `README.md` | La entrada «Meal photo analysis» ya no dice «backend only» y se añade «Meal photo upload in the diary» (se mantiene en inglés y en ASCII, UTF-8 sin cambios) | REQ-001 a REQ-013 y ADR-0033: nueva funcionalidad visible |
| `CLAUDE.md` (sección Proyecto) | Fila de Diario de comidas: botón «Cargar imagen», `MealPhotoDialog`, validación y reducción de la foto en el navegador, `FormData` en `apiFetch`, guardado en una sola petición, paso a registro manual, Política de privacidad; solo frontend, sin migraciones, variables ni cambios en el backend | Nueva área funcional y punto delicado (spec 025) |
| `docs/deploy-runbook.md` | Nuevo «Caso A (sin migraciones) solo frontend: 025» con comprobaciones manuales (orientación EXIF, HEIC, ancho de pantalla, flujo completo, privacidad) y marcha atrás | AC-001.3, AC-003.3, AC-004.3 y AC-004.4 son manuales (verify-report) |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `frontend/README.md` | Es la plantilla genérica de Vite; no describe features |
| `docs/backlog.md` | El backlog global lo actualiza el orquestador en close |
| `docs/sdd/decisions/ADR-0033-preparacion-de-la-foto-en-el-navegador.md` y `docs/sdd/decisions/README.md` | El hook de rol bloquea su escritura: las ADRs no son del doc-keeper. Pendiente: pasar ADR-0033 de «Propuesta» a «Aceptada» (cabecera y fila del índice); lo hace el orquestador |
| `.env.example` | La feature no añade variables de entorno |
| Tabla de despliegues del runbook | Se rellena al desplegar, no antes |

## 3. Conclusión
Se actualizaron README.md, la sección Proyecto de CLAUDE.md y el runbook de despliegue. El cambio de estado del ADR-0033 a «Aceptada» queda pendiente del orquestador porque el hook lo impide al doc-keeper.
