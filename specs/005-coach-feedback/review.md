# Review 005 — Valoración 👍/👎 de las respuestas del coach como puntuación en Langfuse

- **Iteración:** 1 de 3
- **Commit / diff revisado:** `git diff main...feat/005-coach-feedback` @ `e27f259` (más los cambios sin commitear de `state.json` y `verify-report.md`, que son del orquestador y del verifier)
- **Veredicto:** APPROVED

## 1. Resumen
El cambio añade un `feedback_id` firmado con HMAC (ADR-0018) a la respuesta `200` de `POST /api/coach/ask`, un endpoint `POST /api/coach/feedback` que valida, verifica la firma contra el `user_id` del token, aplica un límite de 60 votos por hora y envía la puntuación `user_feedback` (`BOOLEAN`, `score_id` determinista) a través del puerto `Tracer`. En el frontend, cada respuesta con `feedback_id` muestra los botones 👍/👎, y la política de privacidad pasa a tuteo e incluye Langfuse y Voyage AI. La implementación sigue el plan casi al pie de la letra, es pequeña y está bien protegida. No encuentro hallazgos bloqueantes ni mayores. He vuelto a ejecutar las suites: 314 tests de backend y 71 de frontend pasan, y `ruff-new` no da violaciones nuevas.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 a AC-001.3 | Sí | `backend/services/coach_service.py:187-190` firma el `trace_id` al final de `ask_with_feedback`, que cubre las tres salidas `200`; `backend/routes/coach_routes.py:84` serializa `feedback_id` (comprobado a mano, como pide el plan §5) |
| AC-001.4 | Sí | `utils/tracing.py` `NullTraceRecorder.trace_id = None` y `start_trace` devuelve `NullTraceRecorder` si `backend is None` |
| AC-001.5 | Sí | `utils/tracing.py` `start_trace` lee `backend_trace.trace_id` dentro del `try` |
| AC-001.6 | Sí | El `trace_id` es distinto por traza; `test_ask_with_feedback_returns_a_different_id_for_each_question` |
| AC-001.7 | Sí | El cálculo del `feedback_id` va después del `try` de proveedores; un fallo lanza `ServiceUnavailableError` antes de llegar |
| AC-002.1 a AC-002.3 | Sí | `backend/services/coach_feedback_service.py:47-53`; `backend/utils/langfuse_backend.py` `score_trace` → `create_score(..., data_type="BOOLEAN")` |
| AC-003.1 y AC-003.2 | Sí | `score_id` = `f"{trace_id}-user_feedback"` (`coach_feedback_service.py:52`); el *upsert* real de Langfuse queda pendiente de la prueba manual tras desplegar (riesgo del plan §6) |
| AC-004.1 a AC-004.3 | Sí | `coach_feedback_service.py:28-32`, con los mensajes exactos de la spec |
| AC-004.4 | Sí | `coach_routes.py:91` usa `get_json(silent=True)` y fuerza `{}` si no es `dict` |
| AC-005.1 a AC-005.3 | Sí | `backend/utils/feedback_token.py` `verify`: forma con regex, HMAC ligado a `user_id` y `compare_digest`; `coach_feedback_service.py:34-36` lanza `ResourceNotFoundError` |
| AC-006.1 | Sí | `coach_routes.py:88` usa `@require_auth`; `user_id` solo sale de `g.decoded_token` |
| AC-007.1 a AC-007.4 | Sí | `coach_feedback_service.py:38-44`; el límite se aplica después de validar y verificar, así que los `400` y `404` no cuentan |
| AC-008.1 a AC-008.3 | Sí | `Tracer.score_trace` no hace nada con `backend is None`, captura cualquier excepción y registra solo `type(exc).__name__` |
| AC-009.1 a AC-009.4 | Sí | `ChatMessageBubble.tsx:23-24` (solo `assistant` con `feedbackId` de tipo `string`); estado local por instancia en `CoachFeedbackButtons.tsx` |
| AC-010.1 a AC-010.4 | Sí | `CoachFeedbackButtons.tsx:23` (no-op si ya está seleccionado), `:55-56` y `:66-67` (`aria-pressed` y `disabled` mientras `isPending`) |
| AC-010.5 | Sí | `CoachPage.tsx:36` limpia el historial y deja solo `role` y `content` |
| AC-011.1 a AC-011.4 | Sí | `CoachFeedbackButtons.tsx:28-43`: la selección solo cambia en `onSuccess`, el mensaje del `429` sale de `err.message` y el éxito limpia el error |
| AC-012.1 a AC-012.4 | Sí | `PrivacyPolicyPage.tsx:5` (8 de octubre de 2026), `:39`, `:74-82` y `:119-120` |
| AC-013.1 | Sí | Sin formas de voseo en `PrivacyPolicyPage.tsx` (grep manual además del test) |
| AC-N001.1 | Sí | El token solo lleva el `trace_id` y la firma; `score_trace` solo envía `trace_id`, nombre, valor, tipo y `score_id` |
| AC-N002.1 | Sí (ver F1) | `create_score` del SDK encola; no se llama a `flush` en la petición |
| AC-N003.1 | Sí | Las suites pasan sin red; `test_no_test_in_the_suite_imports_the_langfuse_package` |
| AC-N004.1 | Sí | `Button` de shadcn (`<button>`) con `aria-label` y `aria-pressed` |

## 3. Cumplimiento del plan
- **Desviación menor y justificada:** `CoachFeedbackButtons` añade un estado `isLimitError` para elegir la clase del mensaje (`text-muted-foreground` con `429`, `text-destructive` en el resto). Implementa lo que el plan §3.4 describe, con otro mecanismo.
- `CoachService.__init__` recibe `feedback_signer=None` sin anotación de tipo; el plan no la exige (ver F3).
- El arreglo de voseo del `429` del coach, del análisis de progreso y de `TermsOfServicePage` está en un commit aparte (`e27f259`), como fijaron `state.json` y la spec §3 (Art. 1.2), y el usuario lo aprobó.
- No hay cambios de modelo ni variables de entorno nuevas, como dice el plan §3.1. `SECRET_KEY` sigue teniendo el valor por defecto `"DEFAULT SECRET"` en `config.py:31` (preexistente). El plan §6 lo asume como riesgo bajo y el usuario ya la configuró en EC2. El doc-keeper debe dejarlo anotado, como indica el plan.
- ADR-0018 sigue en estado "Propuesta" (`docs/sdd/decisions/ADR-0018-feedback-id-firmado.md:3` y en el índice). Se aprobó con el plan; le toca al doc-keeper pasarlo a "Aceptada" en la etapa docs.

## 4. Checklist de la constitución
- [x] Art. 2: los SHA-256 de los 10 archivos de `tests_snapshot` coinciden con los actuales, y `git diff d55088d HEAD -- backend/tests frontend/src/**/*.test.*` está vacío. Los tests no se tocaron durante implement.
- [x] Art. 4: los marcadores `SDD:` nuevos son coherentes con los AC que prueban. Los archivos `test_langfuse_backend.py` y `test_tracer.py` mezclan marcadores de 004 con IDs que coinciden con los de 005 (por ejemplo, `REQ-005 AC-005.1` en `test_langfuse_backend.py:167` es de 004). Es una ambigüedad preexistente del formato de marcador, no de esta feature.
- [x] Art. 5: no hay tests borrados, saltados ni debilitados. Los fakes están escritos a mano e inyectados (`FakeRedisClient`, `FakeTraceBackend`, `FakeLangfuseClient`), y no se usan `unittest.mock` ni `monkeypatch`. En el frontend, `vi.mock` se aplica en la capa `api.ts`.
- [x] Art. 6: la ruta solo parsea y delega; la lógica está en `CoachFeedbackService`; las dependencias entran por constructor desde `_build_coach_feedback_service()`; los errores se lanzan con `ValidationError`, `ResourceNotFoundError` y `RateLimitError`. En el frontend se usan `apiFetch`, un `schemas.ts` con zod y la organización por feature.
- [x] Art. 6.4: no hay cambios de modelo, así que no hace falta migración (comprobado en el diff: no se toca `models/` ni `migrations/`).
- [x] Art. 7: no hay secretos en el diff; `@require_auth` y `user_id` del token; el input se valida en el servicio y con zod; el endpoint tiene rate limiting; el log solo lleva el nombre del tipo de excepción.
- [x] Art. 6.11: los textos visibles están en español correcto y sin voseo. Algunos comentarios nuevos van sin tilde (F4).

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `backend/tests/test_services/test_langfuse_backend.py:401` | El test de AC-N002.1 configura `FakeLangfuseClient(flush_delay_seconds=3)`, pero el retardo solo se aplica a `flush`, y `create_score` del fake es instantáneo. El test demuestra que no se llama a `flush`, no que la `204` llegue en menos de 0,5 s con un destino que tarda 3 s en aceptar cada envío (lo que pide la AC). La garantía real depende de que `create_score` del SDK encole, cosa que el plan verificó leyendo el código del SDK. Se puede diferir: bastaría con un retardo en `create_score` del fake o con documentar la limitación en el docstring. | test-author |
| F2 | NIT | `backend/tests/test_services/test_coach_feedback.py:489` | En el test de servicio de AC-N001.1, el JWT de prueba es una constante que nunca llega al servicio, así que comprobar que no aparece en lo enviado es tautológico. El test de ruta (`test_coach_feedback_routes.py:224`) sí cubre el JWT real de la petición. | test-author |
| F3 | NIT | `backend/services/coach_service.py:51` y `:65-66` | `feedback_signer=None` no tiene anotación de tipo (`FeedbackTokenSigner \| None`), a diferencia del resto de parámetros. Además, el comentario "user_id se usa UNICAMENTE para el rate limit" ha quedado desactualizado: `user_id` se usa también para la traza (desde 004) y ahora para firmar el `feedback_id`. | implementer |
| F4 | NIT | `frontend/src/features/coach/components/CoachFeedbackButtons.tsx:14-15,33`; `frontend/src/features/coach/types.ts:29-30` | Los comentarios nuevos van sin tildes ("mutacion", "seleccion", "demas", "conversacion", "valoracion"). CLAUDE.md pide comentarios en español correcto. | implementer |
| F5 | NIT | `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx:38-40` | La finalidad indicada para las valoraciones en "Actividad en la app" ("para poder responderte y por límites de uso") no es precisa: los votos no se guardan en fitnerd y se usan para revisar la calidad del coach (como dice la entrada de Langfuse). Una redacción más exacta sería, por ejemplo, "y las valoraciones (👍/👎) que das a sus respuestas (para mejorar el coach y por límites de uso)". | implementer |
| F6 | NIT | `specs/005-coach-feedback/verify-report.md:18-70` | Informativo, fuera de los cuatro responsables: la columna "Tests con `SDD:`" del verify-report cita nombres de test que no existen (por ejemplo, `test_submit_requires_auth` o `test_feedback_buttons_render_with_correct_aria_attributes`; los reales son `test_vote_without_authorization_header_returns_401_and_sends_nothing` y tests `it("…")` en español). La cobertura real sí es completa (comprobada con grep de los marcadores), pero el informe no es trazable tal como está escrito. Le corresponde al verifier en futuras ejecuciones. | — (verifier) |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. F1 (MENOR) se puede diferir con aprobación del usuario, y F2 a F6 son sugerencias opcionales. Antes de cerrar quedan dos pendientes que ya recoge el plan: la prueba manual del *upsert* de `user_feedback` en Langfuse tras desplegar (votar `up` y luego `down` y comprobar una sola puntuación con valor `0`) y el paso de ADR-0018 a "Aceptada" en la etapa docs.
