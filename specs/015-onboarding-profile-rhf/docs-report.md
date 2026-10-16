# Reporte de documentación 015 — Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `CLAUDE.md` (sección Proyecto) | En la fila de Perfil y onboarding se anota que los dos formularios usan react-hook-form con un único esquema zod (`onboarding/schemas.ts`) y que pies y pulgadas solo admiten enteros. | REQ-003 y AC-003.5 (único cambio visible); el diff añade `onboarding/schemas.ts` y elimina `validation.ts`. |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `README.md` | Describe onboarding y perfil a nivel de producto, que no cambia; no menciona los detalles de validación. |
| `docs/sdd/00-discovery.md` | Es una foto de septiembre de 2026; no se reescribe. |
| `docs/deploy-runbook.md` | Sin cambios de despliegue, migraciones ni variables. |
| `.env.example` | Sin variables de entorno nuevas. |

## 3. Conclusión
Refactor solo de frontend sin cambios de contrato ni de despliegue. Se actualizó la sección Proyecto de `CLAUDE.md` con el esquema compartido y la exigencia de enteros en ft/in.

## Comentarios del usuario

