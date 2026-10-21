# Reporte de documentación 024 — Análisis de imagen de una comida con Amazon Bedrock

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `docs/deploy-runbook.md` | Nuevo caso A de la 024: acceso al modelo en Bedrock, permiso IAM `bedrock:InvokeModel`, límite de saltos de IMDS con Docker, variables `BEDROCK_VISION_MODEL_ID` (sin valor por defecto, 503 si falta) y `BEDROCK_REGION` (por defecto `us-east-1`), comprobación de `--timeout 90`, comprobación de que un Bedrock lento da 503 con JSON y no 502, revisión manual de Q9 y marcha atrás. Sin migración ni cambios en Caddy | Art. P4, ADR-0032, backlog de la feature |
| `CLAUDE.md` (sección Proyecto) | `POST /api/meals/analyze` en la fila del Diario y bloque «Paso previo al despliegue» de la 024 | Endpoint nuevo y pasos de despliegue |
| `README.md` | Entrada nueva «Meal photo analysis (backend only for now)» | Funcionalidad visible nueva |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `backend/.env.example` | Ya incluye `BEDROCK_VISION_MODEL_ID` (vacía) y `BEDROCK_REGION=us-east-1`, sin valores reales |
| `docs/sdd/decisions/README.md` y ADR-0032 | Siguen en «Propuesta»: las ADR pasan a «Aceptada» cuando el usuario aprueba la review, y aún no lo ha hecho |
| Historial de despliegues (`docs/deploy-runbook.md`, sección 8) | Aún no hay PR, merge ni backup; el runbook lo pide al desplegar |
| `frontend/README.md` | No describe esta funcionalidad (sin cambios de frontend) |

## 3. Conclusión
Se documentaron los pasos manuales de producción de Bedrock y la comprobación de `--timeout 90`, el endpoint nuevo y su entrada en el README. `README.md` conserva ASCII y CRLF; `docs/deploy-runbook.md` y `CLAUDE.md` conservan UTF-8 y CRLF.

## Comentarios del usuario
