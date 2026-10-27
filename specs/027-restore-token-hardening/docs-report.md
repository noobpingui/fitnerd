# Reporte de documentación 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `docs/deploy-runbook.md` | Paso 2: viñetas de `SECRET_KEY` obligatoria (con comando para comprobarla en EC2 sin imprimirla) y de los comandos locales con `FLASK_ENV=production`. Caso A de la 026: ya no dice que `ProductionConfig` no exige otra clave. Nuevo caso A de la 027. Sección 7: fila de `/api/health` con el error de `SECRET_KEY`. | REQ-001, REQ-002; `backend/config.py` y `backend/app.py` del diff; backlog P4 y Q1 de la spec |
| `backend/.env.example` | El comentario de `SECRET_KEY` avisa de que `change-me` y `DEFAULT SECRET` no valen en producción (tampoco en comandos locales) y de que también firma el `restore_token`. | REQ-001; backlog del plan |
| `CLAUDE.md` (sección Proyecto) | Fila del Diario (validación estricta del `restore_token`, 404 en lugar de 500); entrada de despliegue de la 026 (remite a la nueva); nueva entrada «SECRET_KEY obligatoria, spec 027»; punto delicado de `backend/.env.example`. | REQ-001, REQ-004 a REQ-006; backlog P4 |
| `README.md` | Frase añadida en la entrada «Diary days and editing» (inglés): el backend de producción no arranca sin una `SECRET_KEY` propia y un token anómalo da el 404 habitual. Sigue en ASCII. | REQ-001, REQ-004 a REQ-006 |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `frontend/README.md` | La feature no toca el frontend. |
| Resto de `docs/**` | Sin referencias a `SECRET_KEY` ni al `restore_token` que cambien con el diff; ADRs y artefactos SDD no son del doc-keeper. |
| `.env.example` de la raíz y de `frontend/` | La 027 no añade variables ni toca esas. |
| Tabla de historial del runbook (sección 8) | La fila del despliegue de la 027 se añade al desplegar, con datos reales (PR, merge). |

## 3. Conclusión
Documentado el nuevo requisito de producción (`SECRET_KEY` propia, comprobación previa al merge en EC2 sin imprimirla y comandos locales con `FLASK_ENV=production`) y la validación estricta del `restore_token`. La confirmación de EC2 se toma de la nota de aprobación de la review del usuario; no se inventó ningún otro dato.

## Comentarios del usuario
