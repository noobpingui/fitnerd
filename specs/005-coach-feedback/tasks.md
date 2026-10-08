# Tareas 005 — Valoración 👍/👎 de las respuestas del coach como puntuación en Langfuse

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-08)

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-000 [REQ-005] (scaffold) Crear la clase `FeedbackTokenSigner` con `sign` y `verify` que lancen "not implemented" — `backend/utils/feedback_token.py`
- [x] T-001 [REQ-002] (scaffold) Crear la clase `CoachFeedbackService` con `submit` que lance "not implemented" — `backend/services/coach_feedback_service.py`
- [x] T-002 [REQ-001] (scaffold) Añadir el dataclass `CoachAnswer`, el método `CoachService.ask_with_feedback` (lanza "not implemented") y el parámetro opcional `feedback_signer` — `backend/services/coach_service.py`
- [x] T-003 [REQ-002] (scaffold) Añadir `Tracer.score_trace` (lanza "not implemented") — `backend/utils/tracing.py`
- [x] T-004 [REQ-010] (scaffold) Crear el componente `CoachFeedbackButtons` que lance "not implemented" — `frontend/src/features/coach/components/CoachFeedbackButtons.tsx`
- [x] T-005 [REQ-010] (scaffold) Exportar `sendCoachFeedback` que lance "not implemented" y el tipo `CoachFeedbackPayload` — `frontend/src/features/coach/api.ts`, `frontend/src/features/coach/types.ts`

## Fase A — Tests (test-author)
### Fakes
- [x] T-010 [NFR-003, REQ-007] (test) Añadir `FakeRedisClient` (`incr` y `expire`) para inyectarlo en un `RateLimiter` real — `backend/tests/fakes.py`
- [x] T-011 [NFR-003, REQ-001, REQ-002, REQ-003] (test) Añadir `trace_id` (con valor por defecto en `RecordedTrace`), `score_trace`, `trace_scores`, `scores_by_id` y `delay_seconds` a `FakeTraceBackend`; `trace_id` a `FakeLangfuseObservation`; `create_score` a `FakeLangfuseClient` — `backend/tests/fakes_observability.py`

### Backend: utilidades y servicios
- [x] T-012 [REQ-005, AC-005.1, AC-005.2, AC-005.3] (test) Firma y verificación del `feedback_id`: otro usuario, textos inventados, vacío, `None`, muy largo y carácter alterado devuelven `None` — `backend/tests/test_services/test_feedback_token.py`
- [x] T-013 [NFR-001, AC-N001.1] (test) El token firmado no contiene email ni nombre del usuario — `backend/tests/test_services/test_feedback_token.py`
- [x] T-014 [REQ-001, AC-001.1, AC-001.2, AC-001.3] (test) `ask_with_feedback` devuelve `feedback_id` firmado en respuesta generada, "sin información" y rechazo — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-015 [REQ-001, AC-001.4, AC-001.5] (test) `feedback_id` es `None` con observabilidad inactiva y con fallo al abrir la traza — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-016 [REQ-001, AC-001.6, AC-001.7] (test) Ids distintos por pregunta y `ServiceUnavailableError` sin `CoachAnswer` si falla un proveedor — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-017 [REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) `submit` envía `user_feedback` BOOLEAN con valor 1/0 sobre la traza correcta — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-018 [REQ-003, AC-003.1, AC-003.2] (test) Cambiar el voto reutiliza el mismo `score_id` y deja una sola puntuación con el último valor — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-019 [REQ-004, AC-004.1, AC-004.2, AC-004.3] (test) Validación de `feedback_id` y `rating` con mensaje exacto y sin envíos — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-020 [REQ-005, AC-005.1, AC-005.2, AC-005.3] (test) `submit` lanza `ResourceNotFoundError` para ids de otro usuario, inventados o alterados, sin envíos — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-021 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4] (test) Límite de 60 votos por hora y por usuario con `RateLimiter` real y `FakeRedisClient`; los 404 no cuentan — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-022 [REQ-008, AC-008.1, AC-008.2, AC-008.3] (test) El voto no falla si Langfuse falla o está inactivo; el aviso no incluye credenciales — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-023 [NFR-001, AC-N001.1] (test) Ningún dato enviado por el voto contiene email, nombre ni JWT — `backend/tests/test_services/test_coach_feedback.py`
- [x] T-024 [REQ-001, REQ-002, REQ-003] (test) El adaptador expone `trace_id` de la raíz y `score_trace` llama a `create_score` con `name`, `value`, `trace_id`, `score_id` y `data_type="BOOLEAN"` — `backend/tests/test_services/test_langfuse_backend.py`
- [x] T-025 [NFR-002, AC-N002.1] (test) Con un flush de 3 s, `submit` termina en menos de 0,5 s y no llama a `flush` — `backend/tests/test_services/test_langfuse_backend.py`
- [x] T-026 [NFR-001, AC-N001.1] (test) Las llamadas serializadas al SDK no contienen JWT, email ni claves — `backend/tests/test_services/test_langfuse_backend.py`
- [x] T-027 [REQ-008, AC-008.2, AC-001.5] (test) `Tracer.score_trace` es no-op sin backend, avisa solo con el nombre del tipo si falla, y `start_trace` devuelve `NullTraceRecorder` si falla leer `trace_id` — `backend/tests/test_services/test_tracer.py`

### Backend: rutas
- [x] T-028 [REQ-002, AC-002.1] (test) `POST /api/coach/feedback` válido devuelve 204 sin cuerpo y registra la puntuación — `backend/tests/test_routes/test_coach_feedback_routes.py`
- [x] T-029 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4] (test) Respuestas 400 con cuerpo exacto; cuerpo vacío o no JSON da 400 y no 415 ni 500 — `backend/tests/test_routes/test_coach_feedback_routes.py`
- [x] T-030 [REQ-005, AC-005.1, AC-005.2] (test) 404 con mensaje exacto para token de otro usuario e id inventado — `backend/tests/test_routes/test_coach_feedback_routes.py`
- [x] T-031 [REQ-006, AC-006.1] (test) Sin cabecera de autorización, 401 y nada enviado — `backend/tests/test_routes/test_coach_feedback_routes.py`
- [x] T-032 [REQ-007, AC-007.1] (test) El voto 61 devuelve 429 con el mensaje exacto — `backend/tests/test_routes/test_coach_feedback_routes.py`
- [x] T-033 [REQ-008, AC-008.1, AC-008.3] (test) 204 con backend que falla y con `tracer.backend = None` — `backend/tests/test_routes/test_coach_feedback_routes.py`
- [x] T-034 [NFR-001, AC-N001.1] (test) El JWT de la petición no aparece en `trace_scores` — `backend/tests/test_routes/test_coach_feedback_routes.py`

### Frontend
- [x] T-035 [REQ-009, NFR-004, AC-009.1, AC-N004.1] (test) Dos botones `button` con nombre accesible y `aria-pressed="false"` — `frontend/src/features/coach/components/CoachFeedbackButtons.test.tsx`
- [x] T-036 [REQ-010, AC-010.1, AC-010.2] (test) Votar envía el payload exacto y cambia la selección al completarse — `frontend/src/features/coach/components/CoachFeedbackButtons.test.tsx`
- [x] T-037 [REQ-010, AC-010.3, AC-010.4] (test) Botones desactivados mientras se envía y sin petición al pulsar el ya seleccionado — `frontend/src/features/coach/components/CoachFeedbackButtons.test.tsx`
- [x] T-038 [REQ-011, AC-011.1, AC-011.2, AC-011.3, AC-011.4] (test) Errores 500 y 429 mantienen la selección, reactivan los botones, muestran el mensaje y se limpia al acertar — `frontend/src/features/coach/components/CoachFeedbackButtons.test.tsx`
- [x] T-039 [REQ-009, AC-009.2, AC-009.3, AC-009.4] (test) Sin botones con `feedback_id` nulo, un solo par por respuesta y estado independiente entre respuestas — `frontend/src/features/coach/pages/CoachPage.test.tsx`
- [x] T-040 [REQ-010, AC-010.5] (test) El historial de la siguiente pregunta solo contiene `role` y `content` — `frontend/src/features/coach/pages/CoachPage.test.tsx`
- [x] T-041 [REQ-012, AC-012.1, AC-012.2, AC-012.3, AC-012.4] (test) La política de privacidad menciona Langfuse, Voyage AI, derechos y una "Última actualización" nueva con formato "D de mes de AAAA" — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`
- [x] T-042 [REQ-013, AC-013.1] (test) La política de privacidad no contiene formas de voseo — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`

## Fase B — Implementación (implementer)
### Backend (utils → services → routes)
- [x] T-050 [REQ-005, NFR-001] (impl) Implementar `FeedbackTokenSigner.sign` y `verify` (HMAC-SHA256, forma validada, `compare_digest`) — `backend/utils/feedback_token.py`
- [x] T-051 [REQ-001, REQ-002, REQ-008] (impl) Añadir `trace_id` a los recorders, capturarlo en `Tracer.start_trace` y implementar `Tracer.score_trace` autoprotegido — `backend/utils/tracing.py`
- [x] T-052 [REQ-001, REQ-002, REQ-003, NFR-002] (impl) Añadir `_LangfuseTrace.trace_id` y `LangfuseTraceBackend.score_trace` con `create_score` — `backend/utils/langfuse_backend.py`
- [x] T-053 [REQ-001] (impl) Implementar `ask_with_feedback` y `CoachAnswer`; `ask` delega y sigue devolviendo `str` — `backend/services/coach_service.py`
- [x] T-054 [REQ-002, REQ-003, REQ-004, REQ-005, REQ-007, REQ-008, NFR-001] (impl) Implementar `CoachFeedbackService.submit` (validar, verificar, límite, puntuar) — `backend/services/coach_feedback_service.py`
- [x] T-055 [REQ-001, REQ-002, REQ-004, REQ-006] (impl) Devolver `feedback_id` en `/ask`, crear la ruta `/feedback` y `_build_coach_feedback_service()` — `backend/routes/coach_routes.py`

### Frontend (types → schemas → api → hooks → components → pages)
- [x] T-056 [REQ-009, REQ-010] (impl) Actualizar `AskCoachResponse` y añadir `CoachFeedbackRating`, `CoachFeedbackPayload` y `ConversationMessage` — `frontend/src/features/coach/types.ts`
- [x] T-057 [REQ-010, REQ-004] (impl) Crear `coachFeedbackPayloadSchema` con zod — `frontend/src/features/coach/schemas.ts`
- [x] T-058 [REQ-010] (impl) Implementar `sendCoachFeedback` con validación zod y `apiFetch` — `frontend/src/features/coach/api.ts`
- [x] T-059 [REQ-010] (impl) Añadir `useSendCoachFeedback` — `frontend/src/features/coach/hooks.ts`
- [x] T-060 [REQ-009, REQ-010, REQ-011, NFR-004] (impl) Implementar `CoachFeedbackButtons` (aria-pressed, desactivado en envío, errores general y 429) — `frontend/src/features/coach/components/CoachFeedbackButtons.tsx`
- [x] T-061 [REQ-009] (impl) Mostrar los botones bajo las respuestas del coach con `feedbackId` — `frontend/src/features/coach/components/ChatMessageBubble.tsx`
- [x] T-062 [REQ-009, REQ-010] (impl) Guardar `feedbackId` en el estado y enviar un historial solo con `role` y `content` — `frontend/src/features/coach/pages/CoachPage.tsx`
- [x] T-063 [REQ-012, REQ-013] (impl) Reescribir la política de privacidad en tuteo con Langfuse, Voyage AI, valoraciones, derechos y nueva fecha — `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-014 | T-051, T-052, T-053, T-055 |
| REQ-001 | AC-001.2 | T-014 | T-053 |
| REQ-001 | AC-001.3 | T-014 | T-053 |
| REQ-001 | AC-001.4 | T-015 | T-051, T-053 |
| REQ-001 | AC-001.5 | T-015, T-027 | T-051 |
| REQ-001 | AC-001.6 | T-016 | T-053 |
| REQ-001 | AC-001.7 | T-016 | T-053 |
| REQ-002 | AC-002.1 | T-017, T-028 | T-054, T-055 |
| REQ-002 | AC-002.2 | T-017 | T-054 |
| REQ-002 | AC-002.3 | T-017 | T-054 |
| REQ-003 | AC-003.1 | T-018 | T-052, T-054 |
| REQ-003 | AC-003.2 | T-018 | T-052, T-054 |
| REQ-004 | AC-004.1 | T-019, T-029 | T-054, T-055 |
| REQ-004 | AC-004.2 | T-019, T-029 | T-054 |
| REQ-004 | AC-004.3 | T-019, T-029 | T-054 |
| REQ-004 | AC-004.4 | T-029 | T-055 |
| REQ-005 | AC-005.1 | T-012, T-020, T-030 | T-050, T-054 |
| REQ-005 | AC-005.2 | T-012, T-020, T-030 | T-050, T-054 |
| REQ-005 | AC-005.3 | T-012, T-020 | T-050, T-054 |
| REQ-006 | AC-006.1 | T-031 | T-055 |
| REQ-007 | AC-007.1 | T-021, T-032 | T-054 |
| REQ-007 | AC-007.2 | T-021 | T-054 |
| REQ-007 | AC-007.3 | T-021 | T-054 |
| REQ-007 | AC-007.4 | T-021 | T-054 |
| REQ-008 | AC-008.1 | T-022, T-033 | T-051, T-054 |
| REQ-008 | AC-008.2 | T-022, T-027 | T-051 |
| REQ-008 | AC-008.3 | T-022, T-033 | T-051, T-054 |
| REQ-009 | AC-009.1 | T-035 | T-060, T-061 |
| REQ-009 | AC-009.2 | T-039 | T-061, T-062 |
| REQ-009 | AC-009.3 | T-039 | T-061, T-062 |
| REQ-009 | AC-009.4 | T-039 | T-060, T-062 |
| REQ-010 | AC-010.1 | T-036 | T-056, T-057, T-058, T-059, T-060 |
| REQ-010 | AC-010.2 | T-036 | T-060 |
| REQ-010 | AC-010.3 | T-037 | T-060 |
| REQ-010 | AC-010.4 | T-037 | T-060 |
| REQ-010 | AC-010.5 | T-040 | T-062 |
| REQ-011 | AC-011.1 | T-038 | T-060 |
| REQ-011 | AC-011.2 | T-038 | T-060 |
| REQ-011 | AC-011.3 | T-038 | T-060 |
| REQ-011 | AC-011.4 | T-038 | T-060 |
| REQ-012 | AC-012.1 | T-041 | T-063 |
| REQ-012 | AC-012.2 | T-041 | T-063 |
| REQ-012 | AC-012.3 | T-041 | T-063 |
| REQ-012 | AC-012.4 | T-041 | T-063 |
| REQ-013 | AC-013.1 | T-042 | T-063 |
| NFR-001 | AC-N001.1 | T-013, T-023, T-026, T-034 | T-050, T-054 |
| NFR-002 | AC-N002.1 | T-025 | T-052 |
| NFR-003 | AC-N003.1 | T-010, T-011 (fakes; verificado con la suite completa) | T-051 |
| NFR-004 | AC-N004.1 | T-035 | T-060 |
