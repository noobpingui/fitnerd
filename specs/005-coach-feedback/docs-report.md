# Informe de documentación - 005-coach-feedback

## Archivos actualizados

| Archivo | Motivo |
|---|---|
| `README.md` | "What it offers": valoración 👍/👎 en el AI Coach. Paso 6 de "The AI Coach": `feedback_id` firmado (ADR-0018), `POST /api/coach/feedback`, score booleano `user_feedback`, límite de 60 votos/hora y envío en segundo plano. Sigue ASCII/CRLF. |
| `backend/.env.example` | Añadida `SECRET_KEY=change-me` (ahora firma el `feedback_id`), con comentario. |
| `CLAUDE.md` (solo `## Proyecto`) | Fila del coach con la valoración y ADR-0018; punto delicado de `.env.example` corregido (`SECRET_KEY` ya está) con la advertencia de que cambiarla invalida los `feedback_id` emitidos. |

## No se tocó

- `frontend/README.md`, `frontend/.env.example`, `.env.example` raíz: sin variables ni comandos nuevos.
- `docs/**`: ADR-0018 ya lo escribió el planner (y `docs/sdd/decisions/` queda fuera de mi alcance); no hay otra doc técnica sobre el coach.
- Despliegue en CLAUDE.md: `SECRET_KEY` ya está configurada en EC2 (nota de aprobación del plan) y no hay migraciones.
- Política de privacidad y términos: son código de UI de la feature, no documentación.
