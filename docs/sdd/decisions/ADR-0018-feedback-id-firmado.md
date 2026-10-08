# ADR-0018: `feedback_id` del coach firmado con HMAC, sin estado en el servidor

- **Estado:** Propuesta · 2026-10-08 (planner de la feature `005-coach-feedback`)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate de plan.

## Contexto
La spec 005 pide que cada respuesta `200` del coach con traza en Langfuse lleve un `feedback_id` opaco, y que `POST /api/coach/feedback` solo acepte ese identificador si se emitió para el mismo usuario (REQ-005). Si es inventado, está alterado o es de otro usuario, la respuesta debe ser `404`. Además:
- los `feedback_id` no caducan (Q6);
- los votos no se guardan en la base de datos de fitnerd (fuera de alcance);
- el `feedback_id` no puede exponer el email ni el nombre (NFR-001).

Para votar, el backend necesita el ID de la traza de Langfuse (32 caracteres hexadecimales en el SDK 4.17, `LangfuseSpan.trace_id`). Hay tres formas de relacionar `feedback_id`, usuario y traza:
1. Una tabla `coach_answers (feedback_id, user_id, trace_id)`. Necesita modelo, migración y repositorio, y crece sin límite porque los identificadores no caducan.
2. Una clave en Redis con TTL. Contradice Q6 (no caducan) y hace que un reinicio de Redis invalide votos.
3. Un token sin estado: el ID de la traza más una firma HMAC que liga ese ID al usuario.

## Decisión
1. **Formato.** `feedback_id = "<trace_id>.<firma>"`:
   - `trace_id` son los 32 caracteres hexadecimales en minúscula de la traza;
   - `firma = base64url_sin_relleno(HMAC-SHA256(clave, "coach-feedback:v1:<user_id>:<trace_id>"))`, de 43 caracteres.
   - El prefijo `coach-feedback:v1` separa este uso de cualquier otro uso futuro de la misma clave y permite versionar el formato.
2. **Clave.** `SECRET_KEY` de la configuración de Flask (ya existe; no hay variable nueva).
3. **Verificación.** `FeedbackTokenSigner` (`backend/utils/feedback_token.py`, inyectado por constructor):
   - comprueba primero la forma con una expresión regular estricta y una longitud máxima;
   - recalcula la firma para el `user_id` del token de sesión y la compara con `hmac.compare_digest`;
   - devuelve el `trace_id` o `None`. Con `None`, el servicio lanza `ResourceNotFoundError` (404).
4. **Sin estado.** No hay tabla, migración ni clave en Redis. El token no caduca (Q6).

## Consecuencias
- (+) Sin modelo, migración ni limpieza periódica; cumple Q6 de forma natural.
- (+) Un usuario no puede votar respuestas de otro: para firmar haría falta `SECRET_KEY`.
- (+) El token solo lleva el ID de la traza, que es aleatorio y no contiene datos personales (NFR-001).
- (−) Rotar `SECRET_KEY` invalida los `feedback_id` emitidos antes. Es aceptable: la conversación vive solo en memoria del navegador.
- (−) Si `SECRET_KEY` se quedara con su valor por defecto (`"DEFAULT SECRET"`) en producción, cualquiera podría firmar tokens. Aun así, necesitaría conocer un `trace_id` ajeno, que nunca se expone. El `doc-keeper` deja constancia de que `SECRET_KEY` debe tener un valor propio en `backend/.env` de EC2.
- (−) El ID de la traza viaja al navegador. No es un secreto, porque solo sirve para votar con la firma correcta, pero queda visible para el propio usuario.
