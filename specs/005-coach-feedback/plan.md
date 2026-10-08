# Plan 005: valoración 👍/👎 de las respuestas del coach como puntuación en Langfuse

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-08)

## 1. Resumen de la solución
`CoachService` obtiene el `trace_id` de la traza `coach-ask` a través del puerto `Tracer` (ADR-0017) y lo convierte en un `feedback_id` firmado con HMAC y ligado al usuario (ADR-0018, sin estado: sin tabla ni Redis). `POST /api/coach/ask` añade ese campo a su respuesta `200`.

El endpoint nuevo `POST /api/coach/feedback` (`CoachFeedbackService`) hace estos pasos:
1. Valida el cuerpo.
2. Verifica la firma con el `user_id` del token de sesión.
3. Aplica un límite de 60 votos por hora con el `RateLimiter` de Redis que ya existe.
4. Envía la puntuación `user_feedback` (`BOOLEAN`) con un `score_id` determinista (`<trace_id>-user_feedback`), de forma que Langfuse sustituye el voto anterior en lugar de duplicarlo.

El envío pasa por un método nuevo y autoprotegido del puerto, `Tracer.score_trace`. El adaptador lo traduce a `Langfuse.create_score`, que encola la puntuación sin bloquear.

En el frontend, cada respuesta del coach con `feedback_id` muestra un componente `CoachFeedbackButtons` con su propia mutación. La política de privacidad se reescribe en tuteo con Langfuse y Voyage AI. No hay migración.

## 2. Impacto en la arquitectura
| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | Sin cambios de modelo (ADR-0018) |
| backend · repositories | — | — | No hay persistencia |
| backend · utils | `backend/utils/feedback_token.py` (`FeedbackTokenSigner`) | `backend/utils/tracing.py` (`trace_id` en los recorders, `Tracer.score_trace`); `backend/utils/langfuse_backend.py` (`_LangfuseTrace.trace_id`, `LangfuseTraceBackend.score_trace`) | Firma del `feedback_id`; puerto y adaptador para puntuar una traza ya cerrada |
| backend · services | `backend/services/coach_feedback_service.py` (`CoachFeedbackService`) | `backend/services/coach_service.py` (`CoachAnswer`, `ask_with_feedback`; `ask` delega y sigue devolviendo `str`; parámetro opcional `feedback_signer`) | Emitir el `feedback_id` y registrar votos |
| backend · routes | — | `backend/routes/coach_routes.py` (`/ask` devuelve `feedback_id`; ruta nueva `/feedback`; `_build_coach_feedback_service()`) | Contrato de API |
| backend · tests (fakes) | — | `backend/tests/fakes.py` (`FakeRedisClient`); `backend/tests/fakes_observability.py` (`trace_id` y `score_trace` en `FakeTraceBackend`, `trace_id` en `FakeLangfuseObservation`, `create_score` en `FakeLangfuseClient`) | Lo hace el test-author (ver §5) |
| frontend · features/coach | `frontend/src/features/coach/components/CoachFeedbackButtons.tsx`; `frontend/src/features/coach/schemas.ts` | `types.ts`, `api.ts`, `hooks.ts`, `components/ChatMessageBubble.tsx`, `pages/CoachPage.tsx` | Botones, envío del voto e historial sin `feedback_id` |
| frontend · features/legal | — | `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx` | REQ-012 y REQ-013 |

## 3. Diseño
### 3.1 Modelo de datos y migraciones
No aplica. El `feedback_id` no tiene estado (ADR-0018) y los votos no se guardan en la base de datos de fitnerd (fuera de alcance en la spec). No hay variables de entorno nuevas: se reutilizan `SECRET_KEY`, `REDIS_URL` y las de Langfuse.

### 3.2 Contratos de API
| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| POST | `/api/coach/ask` (cambio) | `@require_auth` | Sin cambios: `{question, history}` | `200 {"answer": str, "feedback_id": str \| null}` | Sin cambios: `400`, `401`, `429` y `503` con `{"error": …}`, sin `feedback_id` |
| POST | `/api/coach/feedback` (nuevo) | `@require_auth` | `{"feedback_id": str, "rating": "up" \| "down"}` | `204` sin cuerpo | `400 {"error": "Falta el identificador de la respuesta"}` · `400 {"error": "La valoración debe ser 'up' o 'down'"}` · `401` (el de `require_auth`) · `404 {"error": "No se encontró la respuesta que quieres valorar"}` · `429 {"error": "Alcanzaste el límite de 60 valoraciones por hora. Vuelve a intentarlo en un rato."}` |

**Formato del `feedback_id`** (ADR-0018): `"<trace_id>.<firma>"`.
- `trace_id`: 32 caracteres hexadecimales en minúscula.
- `firma`: `base64url` sin relleno de `HMAC-SHA256(SECRET_KEY, "coach-feedback:v1:<user_id>:<trace_id>")`, 43 caracteres.
- Longitud total: 76 caracteres.

**Ruta `/feedback`** (solo parsea, Art. 6.1):
1. Lee el cuerpo con `request.get_json(silent=True)`. Si no es un `dict`, usa `{}`. Así, un cuerpo vacío o que no es JSON da el `400` del servicio, y no el `415` de Flask (AC-004.4).
2. Pasa al servicio `data.get("feedback_id")` y `data.get("rating")` sin tocarlos, junto con `g.decoded_token["id"]`.
3. Devuelve `("", 204)`.

**Ruta `/ask`:** llama a `coach_service.ask_with_feedback(...)` y devuelve `jsonify(answer=result.answer, feedback_id=result.feedback_id)`. `_build_coach_service()` pasa `FeedbackTokenSigner(current_app.config["SECRET_KEY"])` como `feedback_signer`.

### 3.3 Lógica de negocio
**`utils/feedback_token.py` · `FeedbackTokenSigner(secret_key: str)`**
- `sign(user_id, trace_id) -> str`: normaliza `user_id` con `str()` y devuelve `f"{trace_id}.{firma}"`.
- `verify(user_id, token) -> str | None`:
  - devuelve `None` si `token` no es `str`, supera los 100 caracteres o no cumple `^[0-9a-f]{32}\.[A-Za-z0-9_-]{43}$`;
  - si la forma es válida, recalcula la firma y la compara con `hmac.compare_digest`;
  - devuelve el `trace_id` si coincide y `None` si no.
- Solo usa la biblioteca estándar (`hmac`, `hashlib`, `base64`, `re`): no añade dependencias.

**`utils/tracing.py` (amplía el puerto de ADR-0017, sin romper su API)**
- `NullTraceRecorder.trace_id = None`.
- `SafeTraceRecorder(backend_trace, logger, trace_id=None)`: el tercer parámetro es opcional para no romper `test_tracer.py`, y se expone como atributo `trace_id`.
- `Tracer.start_trace` lee `backend_trace.trace_id` **dentro del mismo `try`** que abre la traza. Si la lectura falla, avisa y devuelve `NullTraceRecorder`; en ese caso la traza se trata como "no se pudo abrir" (AC-001.5).

  El `trace_id` se captura al abrir la traza. Si después falla un paso, el `feedback_id` se sigue emitiendo, porque la raíz existe en Langfuse.
- Método nuevo `Tracer.score_trace(trace_id, name, value, data_type, score_id) -> None`:
  - si `backend is None`, no hace nada (AC-008.3);
  - si no, llama a `backend.score_trace(...)` dentro de `try/except Exception`. Si falla, registra `logger.warning("No se pudo enviar la valoración del coach a Langfuse: %s", type(exc).__name__)`, solo con el nombre del tipo y nunca con el mensaje (AC-008.2, NFR-001);
  - nunca lanza excepciones.

**`utils/langfuse_backend.py`**
- `_LangfuseTrace.trace_id = root.trace_id`. En el SDK 4.17, `LangfuseSpan.trace_id` es un atributo de 32 caracteres hexadecimales (verificado en `langfuse/_client/span.py:131`).
- `LangfuseTraceBackend.score_trace(trace_id, name, value, data_type, score_id)` llama a `self._get_client().create_score(name=name, value=value, trace_id=trace_id, score_id=score_id, data_type=data_type)`.
  - En la 4.17, `create_score` acepta `score_id` y `data_type="BOOLEAN"` (verificado en `langfuse/_client/client.py:1955-2066`).
  - Encola con `add_score_task` y no bloquea (NFR-002).
  - No hace falta `propagate_attributes`: la puntuación lleva su `trace_id` y el entorno del cliente.

**`services/coach_service.py`**
- `@dataclass CoachAnswer(answer: str, feedback_id: str | None)`.
- Constructor: `CoachService(retrieval_service, llm_client, rate_limiter, tracer=None, feedback_signer=None)`. Los parámetros nuevos son opcionales y al final, así que los tests existentes no cambian.
- `ask_with_feedback(question, user_id, history=None) -> CoachAnswer`:
  - contiene el cuerpo actual de `ask` sin cambios de comportamiento;
  - al final, calcula `feedback_id = feedback_signer.sign(user_id, trace.trace_id)` si hay `feedback_signer` y `trace.trace_id` no es `None`; si no, `None`;
  - el cálculo va fuera del `try` de proveedores, igual que las puntuaciones de 004. Una excepción de proveedor sigue lanzando `ServiceUnavailableError` sin `feedback_id` (AC-001.7).
- `ask(...) -> str` devuelve `self.ask_with_feedback(...).answer`. Así se conservan los más de 40 tests existentes que comparan `ask(...)` con un `str`.

**`services/coach_feedback_service.py` · `CoachFeedbackService(signer: FeedbackTokenSigner, rate_limiter: RateLimiter, tracer: Tracer)`**

`submit(user_id, feedback_id, rating) -> None` sigue este orden. El orden importa: los `400` y `404` no cuentan para el límite (REQ-007).
1. Si `feedback_id` no es un `str` no vacío tras `strip()`, lanza `ValidationError("Falta el identificador de la respuesta")`.
2. Si `rating` no está en `{"up", "down"}` (comparación exacta y solo con `str`), lanza `ValidationError("La valoración debe ser 'up' o 'down'")`.
3. Calcula `trace_id = signer.verify(user_id, feedback_id)`. Si es `None`, lanza `ResourceNotFoundError("No se encontró la respuesta que quieres valorar")`.
4. Llama a `rate_limiter.check_and_increment(key=f"ratelimit:coach:feedback:{user_id}", limit=60, window_seconds=3600)`. Si devuelve `False`, lanza `RateLimitError("Alcanzaste el límite de 60 valoraciones por hora. Vuelve a intentarlo en un rato.")`.
5. Llama a `tracer.score_trace(trace_id, "user_feedback", 1 if rating == "up" else 0, "BOOLEAN", f"{trace_id}-user_feedback")`. El `score_id` es determinista, así que el segundo voto sustituye al primero (REQ-003). El método nunca lanza: si Langfuse falla, la respuesta sigue siendo `204` (REQ-008).

Las constantes `MAX_FEEDBACK_PER_WINDOW = 60`, `FEEDBACK_WINDOW_SECONDS = 3600`, `SCORE_NAME = "user_feedback"` y los mensajes van en el módulo del servicio. Lo único que se envía a Langfuse es el `trace_id`, el nombre, el valor, el tipo y el `score_id`: nada de email, nombre ni JWT (NFR-001).

**`routes/coach_routes.py` · `_build_coach_feedback_service()`** devuelve `CoachFeedbackService(FeedbackTokenSigner(current_app.config["SECRET_KEY"]), rate_limiter, tracer)`, con los singletons de `extensions.py`.

### 3.4 Frontend
- **`types.ts`**
  - `AskCoachResponse` pasa a ser `{ answer: string; feedback_id: string | null }`.
  - Tipos nuevos:
    - `CoachFeedbackRating = "up" | "down"`;
    - `CoachFeedbackPayload = { feedback_id: string; rating: CoachFeedbackRating }`;
    - `ConversationMessage = ChatMessage & { feedbackId?: string | null }`.
  - `ChatMessage` se mantiene solo con `role` y `content`: es lo que viaja como historial.
- **`schemas.ts`** (nuevo): `coachFeedbackPayloadSchema = z.object({ feedback_id: z.string().min(1), rating: z.enum(["up", "down"]) })`. Valida el payload antes de enviarlo (Art. 7.3).
- **`api.ts`**: `sendCoachFeedback(payload)` aplica `coachFeedbackPayloadSchema.parse(payload)` y después llama a `apiFetch<void>("/api/coach/feedback", { method: "POST", body })`. `apiFetch` ya admite el `204` con cuerpo vacío.
- **`hooks.ts`**: `useSendCoachFeedback()` es un `useMutation({ mutationFn: sendCoachFeedback })`. No hay clave de query nueva: es una acción puntual, con el mismo criterio que `useAskCoach`, y no hay datos que cachear.
- **`components/CoachFeedbackButtons.tsx`** (`{ feedbackId: string }`):
  - Estado local: `selected: CoachFeedbackRating | null`, que empieza en `null`, y `errorMessage: string | null`. Cada instancia tiene su propia mutación, así que votar una respuesta no afecta a las demás (AC-009.4).
  - Dos `Button` de shadcn (`variant="ghost"`, `size="icon"`, `type="button"`) con los iconos `ThumbsUp` y `ThumbsDown` de lucide:
    - `aria-label` "Respuesta útil" / "Respuesta no útil";
    - `aria-pressed={selected === "up"}` (y `"down"`);
    - `disabled={mutation.isPending}`.
  - Al pulsar:
    - si `rating === selected`, no hace nada (AC-010.4);
    - si no, llama a `mutate({ feedback_id, rating })`:
      - `onSuccess`: `setSelected(rating)` y `setErrorMessage(null)`;
      - `onError`: con un `ApiError` de estado `429`, `setErrorMessage(err.message)`; en cualquier otro caso, `"No se pudo enviar tu valoración. Inténtalo de nuevo."`. La selección no cambia.
  - El error se muestra en un `<p className="text-xs text-destructive">` bajo los botones. Con `429` se usa `text-muted-foreground`, con el mismo criterio que el `429` del coach.
- **`components/ChatMessageBubble.tsx`**: recibe `message: ConversationMessage`. Si `role === "assistant"` y `feedbackId` es un texto, renderiza `<CoachFeedbackButtons feedbackId=… />` bajo la burbuja, dentro de una columna alineada a la izquierda. Los mensajes del usuario y las respuestas con `feedbackId` `null` no llevan botones (AC-009.2, AC-009.3).
- **`pages/CoachPage.tsx`**:
  - el estado pasa a `ConversationMessage[]`;
  - en `onSuccess` añade `{ role: "assistant", content: data.answer, feedbackId: data.feedback_id }`;
  - el historial que se envía se construye con `messages.map(({ role, content }) => ({ role, content }))` (AC-010.5);
  - la `key` de cada burbuja sigue siendo el índice: los mensajes solo se añaden al final, así que el estado de cada `CoachFeedbackButtons` no se mezcla.
- **`features/legal/pages/PrivacyPolicyPage.tsx`**:
  - todo el texto pasa a tuteo, sin "registrás", "iniciás", "vos mismo", "hacés", "usás", "usá " ni "Podés";
  - en "Actividad en la app" se mencionan las valoraciones de las respuestas del AI Coach;
  - en "Con quién se comparte" se añaden dos entradas:
    - **Langfuse**: las preguntas, las respuestas, el contenido de los vídeos usado y las valoraciones 👍/👎 se envían para revisar la calidad del coach, identificadas solo con un identificador interno de la cuenta y nunca con el email ni el nombre;
    - **Voyage AI**: recibe el texto de las preguntas para buscar el contenido relacionado;
  - en "Tus derechos" se indica que al eliminar la cuenta también se eliminan los datos enviados a Langfuse;
  - `updatedAt` es la fecha de implementación en formato "D de mes de AAAA" (por ejemplo, "8 de octubre de 2026"). El implementer pone la fecha real del día.

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `Tracer.start_trace` captura `trace_id`; `NullTraceRecorder.trace_id = None`; `CoachService.ask_with_feedback` firma con `FeedbackTokenSigner.sign`; `/ask` serializa `feedback_id`; `_LangfuseTrace.trace_id` |
| REQ-002 | `CoachFeedbackService.submit` (paso 5) → `Tracer.score_trace` → `LangfuseTraceBackend.score_trace` (`create_score`, `BOOLEAN`, 1/0); ruta `/feedback` devuelve `204` |
| REQ-003 | `score_id` determinista `f"{trace_id}-user_feedback"` (Langfuse hace *upsert* por id) |
| REQ-004 | `CoachFeedbackService.submit` (pasos 1-2, `ValidationError`); ruta con `get_json(silent=True)` |
| REQ-005 | `FeedbackTokenSigner.verify` (forma, HMAC ligado a `user_id`, `compare_digest`) → `ResourceNotFoundError`; sin caducidad (ADR-0018) |
| REQ-006 | `@require_auth` en `/feedback`; `user_id` solo de `g.decoded_token` |
| REQ-007 | `CoachFeedbackService.submit` (paso 4) con `RateLimiter`, clave `ratelimit:coach:feedback:<user_id>`, 60/3600, después de validar y verificar |
| REQ-008 | `Tracer.score_trace` autoprotegido (aviso sin el mensaje de la excepción) y no-op con `backend is None` |
| REQ-009 | `ChatMessageBubble` + `CoachFeedbackButtons` (solo `assistant` con `feedbackId`) |
| REQ-010 | `CoachFeedbackButtons` (`useSendCoachFeedback`, `aria-pressed`, `disabled` mientras `isPending`, no-op si ya está seleccionado); `CoachPage` limpia el historial |
| REQ-011 | `CoachFeedbackButtons.onError` (mantiene `selected`, mensaje general o `429`; se limpia al acertar) |
| REQ-012 | `PrivacyPolicyPage.tsx` (Langfuse, Voyage AI, actividad, derechos, `updatedAt`) |
| REQ-013 | `PrivacyPolicyPage.tsx` reescrita en tuteo |
| NFR-001 | El `feedback_id` solo lleva `trace_id` y la firma; `score_trace` solo envía `trace_id`, nombre, valor, tipo y `score_id`; los avisos solo llevan el nombre del tipo |
| NFR-002 | `create_score` del SDK encola sin bloquear; nunca se llama a `flush()` en la petición (ADR-0017 §4) |
| NFR-003 | Fakes: `FakeTraceBackend`, `FakeLangfuseClient`, `FakeRedisClient`; `vi.mock` de `@/features/coach/api` |
| NFR-004 | `Button` (`<button>`) con `aria-label` y `aria-pressed` |

## 5. Estrategia de pruebas
Ningún test usa `unittest.mock` ni `monkeypatch`. En el backend, los fakes se inyectan por constructor o se asignan a atributos de los singletons (`tracer.backend`, `rate_limiter.client`), con el mismo patrón que `email_sender.transport` y `tracer.backend` en `conftest.py`.

**Cambios en los fakes (los hace el test-author)**
- `tests/fakes.py` · **`FakeRedisClient`** (nuevo): `incr(key)` cuenta en un `dict` y `expire(key, seconds)` registra la llamada. Se inyecta en un `RateLimiter()` real (`limiter.client = FakeRedisClient()`), así que se prueba la lógica real de la ventana sin Redis.
- `tests/fakes_observability.py`:
  - `_FakeBackendTrace.trace_id`: `uuid4().hex`, también guardado en `RecordedTrace.trace_id`. Ojo: `RecordedTrace` se serializa con `dataclasses.asdict` en los tests NFR-001 de 004, así que el campo nuevo debe tener un valor por defecto.
  - `FakeTraceBackend.score_trace(trace_id, name, value, data_type, score_id)`:
    - llama a `_maybe_raise()` y añade un `RecordedTraceScore` a `trace_scores`, una lista con todos los envíos;
    - hace *upsert* en `scores_by_id[score_id]`, para imitar a Langfuse;
    - acepta un `delay_seconds` opcional en el constructor, solo para `score_trace`.
  - `FakeLangfuseObservation.trace_id`: 32 caracteres hexadecimales distintos por raíz.
  - `FakeLangfuseClient.create_score(**kwargs)`: llama a `_check_error()` y registra la llamada en `calls`. No llama a `flush`.

  Estos cambios solo añaden atributos y métodos, así que los tests de 004 siguen pasando. Sin `trace_id` en `FakeLangfuseObservation`, el adaptador nuevo rompería los tests de 004 que usan el SDK falso (ver §6).

**Unitarios de servicio y utilidades (sin Postgres)**
- `tests/test_services/test_feedback_token.py`:
  - una firma y su verificación con el mismo usuario devuelven el `trace_id`;
  - con otro usuario devuelve `None` (AC-005.1);
  - con `"abc"`, `""`, `None` o un texto muy largo devuelve `None` (AC-005.2);
  - con un carácter cambiado en la firma o en el `trace_id` devuelve `None` (AC-005.3);
  - el token no contiene el email ni el nombre (AC-N001.1).
- `tests/test_services/test_coach_feedback.py`:
  - **REQ-001** (`CoachService.ask_with_feedback` con `Tracer(backend=FakeTraceBackend())`, `FeedbackTokenSigner("test-secret")`, `FakeObservableRetrievalService`, `FakeLLMClient` y `FakeRateLimiter`):
    - AC-001.1: respuesta generada;
    - AC-001.2: sin candidatos bajo el umbral;
    - AC-001.3: `FakeLLMClient(answer=None)`;
    - AC-001.4: `Tracer()` inactivo da `feedback_id is None`;
    - AC-001.5: `FakeTraceBackend(raise_error=…)` da `None` y el `answer` de siempre;
    - AC-001.6: dos preguntas dan ids distintos;
    - AC-001.7: con un fallo del LLM se lanza `ServiceUnavailableError` y no se devuelve ningún `CoachAnswer`.
    - En los casos con traza se comprueba además que `signer.verify(user_id, feedback_id) == backend.traces[0].trace_id`.
  - **REQ-002 y REQ-003** (`CoachFeedbackService` con `FakeTraceBackend`):
    - AC-002.1 y AC-002.2: valor `1`/`0`, tipo `"BOOLEAN"`, nombre `"user_feedback"` y el `trace_id` correcto;
    - AC-002.3: dos trazas, cada una con su puntuación;
    - AC-003.1: los dos envíos usan el mismo `score_id` y el valor final en `scores_by_id` es `0`;
    - AC-003.2: `len(scores_by_id) == 1` con valor `1`.
  - **REQ-004**: AC-004.1 a AC-004.3, con mensaje exacto y `trace_scores == []`.
  - **REQ-005**: AC-005.1 a AC-005.3 con `ResourceNotFoundError`, mensaje exacto y sin envíos.
  - **REQ-007** (`RateLimiter` real con `FakeRedisClient`):
    - AC-007.1: después de 60 votos, el siguiente da `RateLimitError` con mensaje exacto y sin envío;
    - AC-007.2: el voto 60 se acepta;
    - AC-007.3: el límite es por usuario;
    - AC-007.4: 60 errores `404` seguidos de un voto válido no lanzan error. También se comprueba la clave `ratelimit:coach:feedback:<id>`.
  - **REQ-008**:
    - AC-008.1: `FakeTraceBackend(raise_error=RuntimeError("sk-lf-secret-xyz"))` y `submit` no lanza;
    - AC-008.2: el `FakeLogger` del `Tracer` contiene "valoración" y "Langfuse" y no contiene `sk-lf-secret-xyz` ni `pk-lf-…`;
    - AC-008.3: se emite el `feedback_id` con un tracer activo, después `tracer.backend = None`, y `submit` no lanza y no se envía nada.
  - **NFR-001** (AC-N001.1): usuario `42`. Ni `feedback_id` ni `json.dumps` de `trace_scores` contienen el email, el nombre ni el JWT de prueba.
- `tests/test_services/test_langfuse_backend.py` (se añaden tests; usa `FakeLangfuseClient` como en 004):
  - `start_trace(...).trace_id` es el `trace_id` de la raíz (REQ-001);
  - `score_trace` llama a `create_score` con `name`, `value`, `trace_id`, `score_id` y `data_type="BOOLEAN"` (REQ-002 y REQ-003);
  - **NFR-002** (AC-N002.1): con `FakeLangfuseClient(flush_delay_seconds=3)`, `CoachFeedbackService.submit` termina en menos de 0,5 s, `flush_calls == 0` y `create_score` queda registrado;
  - **NFR-001**: `fake.serialized_calls()` no contiene el JWT, el email ni las claves.
- `tests/test_services/test_tracer.py` (se añaden tests):
  - `Tracer.score_trace` con `backend=None` no hace nada;
  - con un backend que falla, avisa una vez con el nombre del tipo y no lanza;
  - si leer `trace_id` falla en `start_trace`, se obtiene `NullTraceRecorder` (AC-001.5).

**Integración de rutas (necesitan Postgres)** · `tests/test_routes/test_coach_feedback_routes.py`
- Fixture local *autouse*: guarda `rate_limiter.client`, pone un `FakeRedisClient()` y lo restaura al terminar.
- `tracer.backend = FakeTraceBackend()` en cada test; `conftest` ya lo devuelve a `None`.
- Los tokens se firman con `jwt_manager.generate_token({"id": 42, "user_role": "user"}, 30)` dentro de `app.app_context()`, como hace `admin_headers`.
- Los `feedback_id` válidos se firman con `FeedbackTokenSigner(app.config["SECRET_KEY"]).sign(42, "<32 hex>")`.
- Casos:
  - AC-002.1: `204`, cuerpo vacío y la puntuación en `backend.trace_scores`;
  - AC-004.1, AC-004.2 y AC-004.3: `400` con el cuerpo exacto;
  - AC-004.4: sin cuerpo y con `data="no-json"` y `content_type="text/plain"` da `400` con `{"error": …}`, nunca `415` ni `500`;
  - AC-005.1: token de otro usuario y `404`;
  - AC-005.2: `404` con el cuerpo exacto;
  - AC-006.1: sin cabecera, `401` y nada enviado;
  - AC-007.1: 61 votos y `429` con el cuerpo exacto;
  - AC-008.1: backend que falla y `204`;
  - AC-008.3: `tracer.backend = None` y `204`;
  - NFR-001: el JWT de la petición no aparece en `trace_scores`.
- **Ruta `/ask`:** no tiene test de integración para el `200`, porque construye clientes reales de Anthropic y Voyage. Es la misma limitación documentada en `test_coach_routes.py` (004). REQ-001 se cubre con el servicio. El cambio de la ruta es una línea (`jsonify(answer=…, feedback_id=…)`) y el reviewer debe comprobarlo.

**Frontend (Vitest y RTL)**
- La red se simula con `vi.mock("@/features/coach/api")`, en la capa `api.ts` (Art. 5.5). `askCoach` y `sendCoachFeedback` son `vi.fn()`. Los errores se simulan con `new ApiError(status, message)` importado de `@/lib/apiClient`. El render va dentro de `QueryClientProvider`.
- `src/features/coach/components/CoachFeedbackButtons.test.tsx`:
  - AC-009.1: dos botones con `aria-pressed="false"`;
  - AC-N004.1: `getByRole("button", { name })` y el atributo `aria-pressed`;
  - AC-010.1 y AC-010.2: payload exacto y cambio de selección;
  - AC-010.3: una promesa diferida deja los dos botones `disabled`;
  - AC-010.4: un segundo clic sobre el botón seleccionado no hace una segunda llamada;
  - AC-011.1 y AC-011.2: con `ApiError(500)` se mantiene la selección anterior, los botones vuelven a estar activos y aparece el mensaje general;
  - AC-011.3: `ApiError(429, msg)` muestra `msg`;
  - AC-011.4: después de un error y un acierto, el mensaje desaparece.
- `src/features/coach/pages/CoachPage.test.tsx` (`askCoach` resuelve `{ answer, feedback_id }`):
  - AC-009.2: con `feedback_id: null` no hay botones;
  - AC-009.3: con un mensaje del usuario y una respuesta, hay exactamente un par de botones;
  - AC-009.4: dos respuestas y votar una no cambia el `aria-pressed` de la otra;
  - AC-010.5: después de votar, la segunda llamada a `askCoach` recibe `history` con objetos que solo tienen `role` y `content`.
- `src/features/legal/pages/PrivacyPolicyPage.test.tsx` (dentro de `MemoryRouter`):
  - AC-012.1 y AC-012.2: dentro de la sección cuyo `heading` es "Con quién se comparte" (`within`);
  - AC-012.3: la sección "Tus derechos" menciona Langfuse;
  - AC-012.4: la regex `/Última actualización: \d{1,2} de (enero|…|diciembre) de \d{4}/` y la ausencia de "2 de septiembre de 2026";
  - AC-013.1: `document.body.textContent` no contiene ninguna de las formas de voseo listadas.

**NFR-003 (AC-N003.1):** se cumple por construcción, porque todos los tests anteriores usan fakes o `vi.mock`. El verifier lo comprueba con la suite completa (`pytest -q` y `npm test`).

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Langfuse no hace *upsert* de la puntuación con el mismo `score_id` y el cambio de voto la duplica (REQ-003) | Baja | Medio | El `score_id` determinista es el mecanismo documentado de idempotencia de las puntuaciones. Se prueba el contrato del puerto con fakes y, tras desplegar, se hace una prueba manual: votar `up` y luego `down` y comprobar que la traza tiene una sola `user_feedback` con valor `0`. Si fallara, solo cambia el adaptador. |
| Leer `root.trace_id` en el adaptador rompe los tests de 004 que usan `FakeLangfuseObservation` (sin ese atributo, `start_trace` caería en `NullTraceRecorder`) | Alta si no se actualiza el fake | Alto | El test-author añade `trace_id` a `FakeLangfuseObservation` en la etapa de tests (§5). El verifier ejecuta la suite completa. |
| Cambiar la firma de `CoachService.ask` rompe más de 40 tests existentes | Media | Alto | `ask` mantiene su firma y su tipo de retorno (`str`), y la ruta usa el método nuevo `ask_with_feedback` (§3.3). |
| `SECRET_KEY` con el valor por defecto en producción permite firmar tokens | Baja | Bajo | Para votar una traza ajena hace falta su `trace_id`, que nunca se expone. El doc-keeper anota en el resumen del despliegue que `SECRET_KEY` debe tener un valor propio (ADR-0018). |
| La deprecación de la API de ingesta de Langfuse el 2026-11-16 afecta a `score-create` | Media | Medio | Ya está recogido en ADR-0017: subir la versión menor del SDK sin tocar fitnerd. La puntuación usa la misma vía que las de 004. |
| Redis caído al votar produce un `500` | Baja | Bajo | Mismo comportamiento que `/ask` hoy. Queda fuera del alcance de esta spec. |

## 7. Cumplimiento de la constitución
- **Art. 4 (trazabilidad):** cada REQ, NFR y AC tiene destino en §4 y un test en §5.
- **Art. 5.4:** los fakes se escriben a mano y se inyectan por constructor o se asignan a atributos de singletons, con el patrón de `conftest.py`. No se usan `unittest.mock` ni `monkeypatch`, y no se llama a Redis, Langfuse, Anthropic ni Voyage.
- **Art. 5.5:** la red se simula en `api.ts` con `vi.mock`, y los tests van junto a sus archivos.
- **Art. 6.1-6.3:** las rutas solo parsean y delegan; las validaciones y los errores se expresan con `ValidationError`, `ResourceNotFoundError` y `RateLimitError`; las dependencias se inyectan por constructor desde `_build_*_service()`. No hay repositorios ni UnitOfWork porque no hay persistencia.
- **Art. 6.4:** no hay cambios de modelo ni migración. El reviewer debe confirmarlo.
- **Art. 6.5 y 6.10:** ruff y `npm run lint`/`tsc -b` sin errores nuevos.
- **Art. 6.6-6.8:** se mantiene la organización por feature; se añade `schemas.ts` con el schema zod del voto. No hay formularios, así que react-hook-form no aplica. No hay claves de query nuevas: el voto es una mutación puntual, igual que `useAskCoach`.
- **Art. 6.11:** los textos nuevos llevan tildes y no tienen voseo; la página de privacidad pasa entera a tuteo. El voseo del `429` de `/ask` queda fuera, en un commit de copy aparte según `state.json`.
- **Art. 7.1:** no hay secretos nuevos ni variables nuevas.
- **Art. 7.2:** `/feedback` usa `@require_auth`, y `user_id` sale solo de `g.decoded_token`. La firma liga el `feedback_id` a ese usuario.
- **Art. 7.3:** se valida en el servicio (`ValidationError`) y con zod en el frontend.
- **Art. 7.4:** `/feedback` no llama a un proveedor de IA, pero sí consume la cuota de Langfuse, así que tiene rate limiting (60/hora). Sus fallos no se traducen a `503`, por diseño de la spec (REQ-008).

No hay ningún "DEBERÍA" incumplido.

## 8. ADRs
- [ADR-0018](../../docs/sdd/decisions/ADR-0018-feedback-id-firmado.md) (Propuesta): `feedback_id` sin estado, firmado con HMAC-SHA256 sobre `SECRET_KEY`, ligado al usuario y sin caducidad.
- Ampliación compatible de [ADR-0017](../../docs/sdd/decisions/ADR-0017-observabilidad-langfuse.md), sin ADR nuevo: el puerto gana `trace_id` y `Tracer.score_trace`, con la misma autoprotección y el mismo envío en segundo plano del SDK (`create_score` encola sin bloquear).
