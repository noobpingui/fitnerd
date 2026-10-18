# Reporte de documentación 018 — Endurecer /register y /login: 400 ante entradas inválidas, validación del registro y mensajes en español

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `CLAUDE.md` (sección Proyecto, fila Autenticación) | Se añade que `/register` y `/login` devuelven 400 «La petición no es válida» ante un cuerpo que no es un objeto JSON, que el registro valida nombre y apellido (1 a 100 caracteres, recortados) y la fecha de nacimiento (14 a 100 años) y que los errores salen en español. | REQ-001 a REQ-008; diff de `auth_routes.py`, `auth_service.py` y `auth_input_rules.py`. |
| `docs/backlog.md` | Se marcan como hechos cuatro puntos de la 014 que resuelve la 018: traducción de los mensajes, validación del registro, cuerpo no JSON y un único instante en `_ensure_link_is_usable`. | REQ-001 a REQ-009 de la spec 018. |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `README.md` | No describe los mensajes de error ni las reglas de validación del registro; sin funcionalidad nueva visible. |
| `frontend/README.md` | Sin cambios en el frontend. |
| `docs/deploy-runbook.md` | Sin migración ni pasos de despliegue nuevos. |
| `**/.env.example` | Sin variables de entorno nuevas. |
| `docs/sdd/decisions/**` | Las ADRs no son del doc-keeper; la spec no introduce ninguna decisión nueva. |

## 3. Conclusión
Se actualizó la sección Proyecto de `CLAUDE.md` con el nuevo comportamiento de autenticación y se marcaron en `docs/backlog.md` los puntos de la 014 resueltos. No hay cambios de despliegue ni de variables.
