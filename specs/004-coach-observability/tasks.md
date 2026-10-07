# Tareas 004 — Observabilidad del coach de IA con Langfuse Cloud

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-07)

## Fase A0 — Andamiaje (implementer, modo scaffold)
Solo los símbolos nuevos que importarán los tests. Los métodos nuevos de clases que ya existen (`EmbeddingClient`, `LLMClient`, `RetrievalService`, `CoachService`) no necesitan andamiaje: un `AttributeError` ya es rojo legítimo. `GenerationResult` es solo una dataclass de datos, y se crea completa porque `FakeLLMClient` la importa.
- [x] T-001 [REQ-009] (scaffold) Crear `resolve_langfuse_base_url(value)` y `observability_enabled(config)` que lancen "not implemented" — `backend/config.py`
- [x] T-002 [REQ-007, REQ-008, REQ-009] (scaffold) Crear `format_error`, `SafeTraceRecorder`, `SafeStepHandle`, `NullTraceRecorder`, `NullStepHandle` y `Tracer` (su `__init__` solo guarda `backend=None`, `logger`, `client_factory` y `propagate_attributes`; `enabled`, `init_app` y `start_trace` lanzan "not implemented") — `backend/utils/tracing.py`
- [x] T-003 [REQ-001] (scaffold) Crear `LangfuseTraceBackend` con su firma y métodos del puerto que lancen "not implemented" — `backend/utils/langfuse_backend.py`
- [x] T-004 [REQ-004] (scaffold) Crear la dataclass `GenerationResult(text, input_tokens, output_tokens)` y la firma de `generate_with_usage` que lance "not implemented" — `backend/utils/llm_client.py`
- [x] T-005 [REQ-009] (scaffold) Añadir el singleton `tracer = Tracer()` para que la fixture `autouse` de `conftest.py` no rompa toda la suite (sin llamar aún a `init_app` en `app.py`) — `backend/extensions.py`

## Fase A — Tests (test-author)
- [x] T-006 [NFR-003, AC-N003.1] (test) Fakes nuevos: `FakeTraceBackend` (con `RecordedTrace`, `RecordedStep`, `RecordedScore` y `raise_error`), `FakeLangfuseClient`, `FakeLangfuseObservation`, `FakeLangfuseClientFactory` y `FakeApp`; ampliar `FakeLLMClient` con `generate_with_usage`, `input_tokens`, `output_tokens` y `model` sin romper sus usos actuales — `backend/tests/fakes.py`
- [x] T-007 [NFR-003, AC-N003.1] (test) Fixture `autouse` que deja `extensions.tracer.backend = None` antes y después de cada test — `backend/tests/conftest.py`
- [x] T-008 [REQ-003, AC-003.1] (test) Ampliar `FakeRetrievalService` solo con métodos (`embedding_model`, `max_distance`, `embed`, `find_candidates`, `is_relevant`), sin cambiar ninguna aserción existente (Art. 5.3) — `backend/tests/test_services/test_coach_service.py`
- [x] T-009 [REQ-001, AC-001.1] (test) Una traza `coach-ask` con entrada, salida e ID de usuario `42` — `backend/tests/test_services/test_coach_observability.py`
- [x] T-010 [REQ-001, AC-001.2] (test) Dos preguntas generan dos trazas distintas — `backend/tests/test_services/test_coach_observability.py`
- [x] T-011 [REQ-001, AC-001.4] (test) Con límite de uso alcanzado (`RateLimitError`) no hay traza — `backend/tests/test_services/test_coach_observability.py`
- [x] T-012 [REQ-001, AC-001.3] (test) Preguntas vacías, solo espacios y de 501 caracteres devuelven `400` sin traza (ruta) — `backend/tests/test_routes/test_coach_routes.py`
- [x] T-013 [REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) Paso `embedding`: entrada con y sin historial, modelo, horas y tokens — `backend/tests/test_services/test_coach_observability.py`
- [x] T-014 [REQ-003, AC-003.1, AC-003.2, AC-003.3] (test) Paso `retrieval`: `limit`, `threshold`, `candidates` con `passed_threshold` y `passed_count` — `backend/tests/test_services/test_coach_observability.py`
- [x] T-015 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4] (test) Paso `generation`: modelo, tokens, mensajes sin system prompt, ausencia sin relevantes y rechazo — `backend/tests/test_services/test_coach_observability.py`
- [x] T-016 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4] (test) Puntuación `outcome` en `answered`, `dont_know`, `refused` y `error` — `backend/tests/test_services/test_coach_observability.py`
- [x] T-017 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4] (test) Puntuación `best_chunk_distance`: mínimo, sin pasar umbral, sin candidatos y con fallo de embedding — `backend/tests/test_services/test_coach_observability.py`
- [x] T-018 [REQ-007, AC-007.1, AC-007.2, AC-007.3] (test) Fallos de proveedor: paso marcado como error, pasos posteriores ausentes, mensaje de 200 caracteres como máximo sin pila, `503` con el mismo mensaje — `backend/tests/test_services/test_coach_observability.py`
- [x] T-019 [REQ-008, AC-008.1] (test) Con el tracer inactivo la respuesta es la de hoy y no se envía nada — `backend/tests/test_services/test_coach_observability.py`
- [x] T-020 [REQ-008, AC-008.2, AC-008.3, AC-008.4] (test) Con un destino que falla en cada envío, la respuesta o el `503` no cambian — `backend/tests/test_services/test_coach_observability.py`
- [x] T-021 [REQ-008, AC-008.5] (test) El fallo del destino deja un aviso en el log sin credenciales ni el mensaje de la excepción — `backend/tests/test_services/test_coach_observability.py`
- [x] T-022 [REQ-009, AC-009.1] (test) Sin una o las dos claves, el tracer queda inactivo, no registra nada por pregunta y no crea el cliente — `backend/tests/test_services/test_coach_observability.py`
- [x] T-023 [REQ-007, REQ-008, AC-008.2, AC-008.5] (test) Puerto: `SafeTraceRecorder` no propaga errores, avisa una sola vez y queda inerte; `Tracer.start_trace` devuelve el nulo si el backend falla; `format_error` recorta; `NullTraceRecorder` sin efectos — `backend/tests/test_services/test_tracer.py`
- [x] T-024 [REQ-009, REQ-010, AC-009.1, AC-009.2, AC-010.1, AC-010.2] (test) `Tracer.init_app`: activo solo con ambas claves y `TESTING` falso, cliente perezoso con claves, `base_url` y entorno `production` o `development` — `backend/tests/test_services/test_tracer.py`
- [x] T-025 [REQ-001, AC-001.1] (test) Adaptador: raíz `coach-ask` con `user_id` y `trace_name` activos al crearse, `update(output)` y `end()` al cerrar, sin `update_trace` ni `set_trace_io` — `backend/tests/test_services/test_langfuse_backend.py`
- [x] T-026 [REQ-002, REQ-003, REQ-004, REQ-007, REQ-005, REQ-006, AC-002.1, AC-004.1, AC-007.1, AC-005.1, AC-006.1] (test) Adaptador: pasos hijos con `as_type`, `input` y `model`, `usage_details`, error con `level` y `status_message`, y puntuaciones con `score_trace` — `backend/tests/test_services/test_langfuse_backend.py`
- [x] T-027 [REQ-008, AC-008.2] (test) Adaptador: aislamiento del contexto (`active_attributes` vacío tras cada llamada, también si `start_observation` lanza), cliente creado una sola vez y seguro con dos hilos — `backend/tests/test_services/test_langfuse_backend.py`
- [x] T-028 [NFR-001, AC-N001.2] (test) Adaptador: ninguna llamada registrada contiene las claves de Langfuse, Voyage o Anthropic, y `propagate_attributes` no recibe `as_baggage=True` — `backend/tests/test_services/test_langfuse_backend.py`
- [x] T-029 [NFR-001, AC-N001.1, AC-N001.2] (test) Servicio: la traza no contiene email, nombre, JWT ni claves de proveedores, con respuesta correcta y con fallo — `backend/tests/test_services/test_coach_observability.py`
- [x] T-030 [NFR-002, AC-N002.1] (test) Con un cliente del SDK cuya exportación tarda 3 s, la respuesta llega en menos de 0,5 s y `flush_calls == 0` — `backend/tests/test_services/test_coach_observability.py`
- [x] T-031 [NFR-002, AC-N002.2] (test) Con un destino y un cliente que fallan al instante, la respuesta llega en menos de 0,5 s — `backend/tests/test_services/test_coach_observability.py`
- [x] T-032 [REQ-009, AC-009.3] (test) Configuración de tests: claves `None`, `observability_enabled` falso con `TESTING` y `extensions.tracer.enabled` falso — `backend/tests/test_services/test_observability_config.py`
- [x] T-033 [REQ-009, AC-009.4, AC-009.5] (test) `resolve_langfuse_base_url` con `None`, vacío y con `/` final — `backend/tests/test_services/test_observability_config.py`
- [x] T-034 [REQ-009, REQ-010, AC-009.1, AC-010.1, AC-010.2] (test) `observability_enabled` con una clave o ninguna, y `OBSERVABILITY_ENVIRONMENT` en `ProductionConfig` y `DevelopmentConfig` — `backend/tests/test_services/test_observability_config.py`
- [x] T-035 [NFR-003, AC-N003.1] (test) Comprobar que ningún test de la feature importa `langfuse` ni usa la red (el adaptador solo usa `FakeLangfuseClient`) — `backend/tests/test_services/test_langfuse_backend.py`

Tests de los clientes reales (iteración 2, sin red ni mocks: se asigna un fake al atributo `client` de `LLMClient` y `EmbeddingClient`, y los fakes de repositorio y embedding a `RetrievalService` por constructor). Los IDs T-047 a T-053 continúan la numeración y pertenecen a la Fase A.
- [x] T-047 [NFR-003, AC-N003.1] (test) Fakes nuevos escritos a mano: `FakeAnthropicClient` (respuesta con `content`, `usage` y `stop_reason`, configurables), `FakeVoyageClient` (respuesta con `embeddings` y `total_tokens`, con y sin tokens) y `FakeTranscriptChunkRepository` (candidatos con distancia) — `backend/tests/fakes.py`
- [x] T-048 [REQ-004, AC-004.1] (test) `LLMClient.generate_with_usage` devuelve el texto y los tokens de entrada y salida leídos de `response.usage` — `backend/tests/test_services/test_llm_client.py`
- [x] T-049 [REQ-004, REQ-005, AC-004.4, AC-005.3] (test) `LLMClient.generate_with_usage` marca el rechazo con `stop_reason == "refusal"`, y `generate()` mantiene su comportamiento (mismo texto, rechazo como hoy) para el coach y `ProgressAnalysisService` — `backend/tests/test_services/test_llm_client.py`
- [x] T-050 [REQ-002, AC-002.3] (test) `EmbeddingClient.embed_query_with_usage` devuelve el vector y los tokens, y devuelve tokens ausentes (`None`) si Voyage no los informa; `embed_query` no cambia — `backend/tests/test_services/test_embedding_client.py`
- [x] T-051 [REQ-003, AC-003.1, AC-003.2] (test) `RetrievalService.find_candidates` devuelve los candidatos con su distancia y respeta `limit` (`DEFAULT_TOP_K`) — `backend/tests/test_services/test_retrieval_service.py`
- [x] T-052 [REQ-003, REQ-006, AC-003.3, AC-006.2] (test) `RetrievalService.is_relevant` en el límite de 0,7: distancia 0,7 pasa, 0,71 no — `backend/tests/test_services/test_retrieval_service.py`
- [x] T-053 [REQ-003, AC-003.1] (test) `RetrievalService.search()` compuesto devuelve exactamente el mismo resultado que antes (mismos fragmentos, mismo orden, mismo filtro por umbral, lista vacía sin relevantes) — `backend/tests/test_services/test_retrieval_service.py`

## Fase B — Implementación (implementer)
Orden: config → dependencia → clientes → retrieval → puerto → adaptador → app → servicio → ruta.
- [ ] T-036 [REQ-009, REQ-010] (config) `resolve_langfuse_base_url`, `observability_enabled`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` y `OBSERVABILITY_ENVIRONMENT` por clase (`TestingConfig` con claves `None`) — `backend/config.py`
- [ ] T-037 [REQ-009] (config) Añadir `langfuse>=4.17,<5` — `backend/requirements.txt`
- [ ] T-038 [REQ-009] (config) Documentar `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` y `LANGFUSE_BASE_URL` (por defecto `https://us.cloud.langfuse.com`) — `backend/.env.example`
- [ ] T-039 [REQ-002] (impl) `EmbeddingClient.embed_query_with_usage` con tokens; `embed_query` no cambia — `backend/utils/embeddings.py`
- [ ] T-040 [REQ-004] (impl) `LLMClient.generate_with_usage` con tokens y rechazo; `generate()` delega en él — `backend/utils/llm_client.py`
- [ ] T-041 [REQ-002, REQ-003, REQ-006] (impl) `DEFAULT_TOP_K`, `embedding_model`, `embed`, `find_candidates`, `is_relevant` y `search()` compuesto con idéntico resultado — `backend/services/retrieval_service.py`
- [ ] T-042 [REQ-007, REQ-008, REQ-009] (impl) `format_error`, recorders autoprotegidos y nulos, y `Tracer` con `init_app` y `start_trace` que nunca lanzan — `backend/utils/tracing.py`
- [ ] T-043 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-010, NFR-001, NFR-002] (impl) `LangfuseTraceBackend` sobre el SDK con cliente perezoso, `propagate_attributes` por creación y entorno — `backend/utils/langfuse_backend.py`
- [ ] T-044 [REQ-009] (impl) Llamar a `tracer.init_app(app)` en `create_app()` — `backend/app.py`
- [ ] T-045 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008] (impl) Instrumentar `ask` por fases con `tracer`, clasificar `outcome`, `finish` y puntuaciones finales fuera del `try` — `backend/services/coach_service.py`
- [ ] T-046 [REQ-001, REQ-008, NFR-001] (impl) Inyectar el singleton `tracer` en `_build_coach_service()` — `backend/routes/coach_routes.py`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-009, T-025 | T-043, T-045, T-046 |
| REQ-001 | AC-001.2 | T-010 | T-045 |
| REQ-001 | AC-001.3 | T-012 | T-046 |
| REQ-001 | AC-001.4 | T-011 | T-045 |
| REQ-002 | AC-002.1 | T-013, T-026 | T-039, T-041, T-043, T-045 |
| REQ-002 | AC-002.2 | T-013 | T-045 |
| REQ-002 | AC-002.3 | T-013, T-050 | T-039, T-045 |
| REQ-003 | AC-003.1 | T-008, T-014, T-051, T-053 | T-041, T-045 |
| REQ-003 | AC-003.2 | T-014, T-051 | T-041, T-045 |
| REQ-003 | AC-003.3 | T-014, T-052 | T-041, T-045 |
| REQ-004 | AC-004.1 | T-015, T-026, T-048 | T-040, T-043, T-045 |
| REQ-004 | AC-004.2 | T-015 | T-045 |
| REQ-004 | AC-004.3 | T-015 | T-045 |
| REQ-004 | AC-004.4 | T-015, T-049 | T-040, T-045 |
| REQ-005 | AC-005.1 | T-016, T-026 | T-043, T-045 |
| REQ-005 | AC-005.2 | T-016 | T-045 |
| REQ-005 | AC-005.3 | T-016, T-049 | T-040, T-045 |
| REQ-005 | AC-005.4 | T-016 | T-045 |
| REQ-006 | AC-006.1 | T-017, T-026 | T-043, T-045 |
| REQ-006 | AC-006.2 | T-017, T-052 | T-041, T-045 |
| REQ-006 | AC-006.3 | T-017 | T-045 |
| REQ-006 | AC-006.4 | T-017 | T-045 |
| REQ-007 | AC-007.1 | T-018, T-026 | T-042, T-043, T-045 |
| REQ-007 | AC-007.2 | T-018 | T-042, T-045 |
| REQ-007 | AC-007.3 | T-018, T-023 | T-042 |
| REQ-008 | AC-008.1 | T-019 | T-042, T-045 |
| REQ-008 | AC-008.2 | T-020, T-023, T-027 | T-042, T-045 |
| REQ-008 | AC-008.3 | T-020 | T-042, T-045 |
| REQ-008 | AC-008.4 | T-020 | T-042, T-045 |
| REQ-008 | AC-008.5 | T-021, T-023 | T-042 |
| REQ-009 | AC-009.1 | T-022, T-024, T-034 | T-036, T-042 |
| REQ-009 | AC-009.2 | T-024 | T-042, T-043, T-044 |
| REQ-009 | AC-009.3 | T-032 | T-036, T-037, T-044 |
| REQ-009 | AC-009.4 | T-033 | T-036, T-038 |
| REQ-009 | AC-009.5 | T-033 | T-036, T-038 |
| REQ-010 | AC-010.1 | T-024, T-034 | T-036, T-042, T-043 |
| REQ-010 | AC-010.2 | T-024, T-034 | T-036, T-042, T-043 |
| NFR-001 | AC-N001.1 | T-029 | T-043, T-046 |
| NFR-001 | AC-N001.2 | T-028, T-029 | T-043 |
| NFR-002 | AC-N002.1 | T-030 | T-043 |
| NFR-002 | AC-N002.2 | T-031 | T-042, T-043 |
| NFR-003 | AC-N003.1 | T-006, T-007, T-035, T-047 | T-042 |

## Comentarios del usuario

**Gate de tasks, iteración 1 (2026-10-07).** Respuesta literal del usuario: "Devolver al task-breaker".

Hallazgo que se le presentó al usuario: el código nuevo de los clientes reales no tiene ningún test. T-039, T-040 y T-041 cambian código que habla con los proveedores reales:
- `EmbeddingClient.embed_query_with_usage` lee `total_tokens` de la respuesta de Voyage.
- `LLMClient.generate_with_usage` lee `response.usage` y `stop_reason == "refusal"` de la respuesta de Anthropic, y `generate()` pasa a delegar en él. `ProgressAnalysisService` también usa `generate()`.
- `RetrievalService.search()` se recompone con `embed`, `find_candidates` e `is_relevant` y debe dar exactamente el mismo resultado que hoy.

Todos los tests planificados usan fakes de estas clases (`FakeLLMClient`, `FakeRetrievalService`), así que el código real nunca se ejecuta en la suite, y hoy no existen tests de estas clases en `backend/tests/`. Si `generate_with_usage` lee mal la respuesta y lanza una excepción, el coach devolvería `503` a todos los usuarios y el análisis de progreso también fallaría, sin que ningún test lo detecte.

Se puede probar sin red ni mocks: `LLMClient` guarda el cliente de Anthropic en el atributo `self.client`, así que un test puede asignar ahí un fake cuya respuesta tenga `content`, `usage` y `stop_reason` (patrón de `email_sender.transport`). Lo mismo vale para el cliente de Voyage de `EmbeddingClient` y para el repositorio de `RetrievalService`.

Indicación: añadir tareas de test para
- `generate_with_usage`: tokens, rechazo y que `generate()` mantenga su comportamiento;
- `embed_query_with_usage`: con y sin tokens;
- `RetrievalService`: `find_candidates`, `is_relevant` en el límite de 0,7, y que `search()` devuelva lo mismo que hoy.
