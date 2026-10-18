# Reporte de documentación 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `CLAUDE.md` (sección Proyecto, fila Perfil y onboarding) | Añade el aviso «Entre 0 y 11 in» en el perfil con pies válidos y pulgadas no válidas | REQ-001; `PhysicalDataForm.tsx` y `onboarding/schemas.ts` |
| `CLAUDE.md` (sección Proyecto, Arquitectura > Frontend) | Añade la carga de pantallas bajo demanda por ruta (`lazyNamed`, `RouteSuspense`, «Cargando…», «Recargar», chunk de entrada ≤ 500 kB, ADR-0026) y `inRange` compartido en `src/lib/inRange.ts` | REQ-002, REQ-003, NFR-001, NFR-005; `router.tsx`, `RouteSuspense.tsx`, `lazyNamed.ts`, `inRange.ts` |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `README.md` | Describe el producto y el porqué de las decisiones; la feature no añade funcionalidad visible nueva ni cambia ejecución, pruebas o despliegue |
| `frontend/README.md` | Genérico, sin contenido afectado |
| `docs/deploy-runbook.md` | Sin cambios de despliegue, migraciones ni variables de entorno |
| `docs/backlog.md` | Backlog del proyecto, gestionado por el flujo y fuera de la documentación técnica de esta feature |
| `.env.example` | Sin variables de entorno nuevas |

## 3. Conclusión
Solo se actualizó la sección Proyecto de `CLAUDE.md` (codificación UTF-8 con CRLF, sin cambios). El resto de la documentación no se ve afectada: feature solo de frontend, sin cambios de API, datos ni despliegue.
