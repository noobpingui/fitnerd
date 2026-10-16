# Reporte de documentación 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `docs/deploy-runbook.md` | Nuevo caso B' (migración de datos no reversible) en la tabla de tipos, subsección con el procedimiento (backup, búsqueda de conflictos, migración antes del merge, comprobación) y fila pendiente en el historial | REQ-005 y migración `a7d3f9c1e5b2`; la review pidió documentar el paso manual (Art. P4) |
| `README.md` | Auth: correo sin distinguir mayúsculas y regla única de contraseña; recuperación: enlace de un solo uso también ante peticiones simultáneas | REQ-001 a REQ-006 y REQ-010 |
| `CLAUDE.md` (solo sección Proyecto) | Fila de Autenticación con las reglas nuevas y paso previo al despliegue de la migración de correos | REQ-005, ADR-0025, `a7d3f9c1e5b2` |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `**/.env.example` | La feature no añade variables de entorno |
| `frontend/README.md` | No describe el comportamiento de auth cambiado |
| `docs/sdd/decisions/**` (ADR-0025) | Las ADRs no son del doc-keeper |

## 3. Conclusión
Se documentó el paso manual de la migración `a7d3f9c1e5b2` en el runbook y se reflejaron las reglas nuevas de autenticación en README y en la sección Proyecto de `CLAUDE.md`. La codificación de los tres archivos no cambió (README ASCII, los otros UTF-8, CRLF).
