# Reporte de documentación 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `CLAUDE.md` (sección Proyecto, fila Autenticación) | Se retira la validación de la fecha de nacimiento en el registro (spec 018) y se anota que desde la 033 el registro la ignora y se pide en el onboarding | REQ-001 |
| `CLAUDE.md` (sección Proyecto, fila Perfil y onboarding) | Se añade `first_name` en `GET`/`PUT /api/profile` (opcional en el `PUT`), la sección «Datos personales» con el campo «Nombre», la regla compartida y el saludo de `/home`; sin migración ni variables | REQ-004 a REQ-009 |
| `README.md` | La viñeta «Onboarding and profile» menciona el registro sin fecha, el nombre editable y el saludo | REQ-001, REQ-007, REQ-009 |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `frontend/README.md` | Plantilla genérica de Vite, no describe funcionalidad |
| `docs/deploy-runbook.md` | La feature no tiene migración, variables ni pasos de despliegue |
| `docs/backlog.md` | Es del proyecto, no de documentación de la feature |
| `**/.env.example` | No hay variables de entorno nuevas |

## 3. Conclusión
Se actualizaron la sección Proyecto de `CLAUDE.md` y el `README.md` para reflejar el registro sin fecha, `first_name` en el perfil y el saludo en `/home`. Codificación de `README.md` y `CLAUDE.md` verificada tras editar (UTF-8, sin BOM de UTF-16).
