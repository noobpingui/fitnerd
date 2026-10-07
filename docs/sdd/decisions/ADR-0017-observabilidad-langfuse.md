# ADR-0017: observabilidad del coach con el SDK oficial de Langfuse detrás de un puerto `Tracer`

- **Estado:** Aceptada · 2026-10-07 (aprobada por el usuario con el plan de la feature `004-coach-observability`; reescrita en la iteración 2 del plan y revisada en la iteración 3 con las firmas reales del SDK 4.17)
- **Decidido por:** el usuario eligió el SDK oficial en el gate de plan de la feature `004-coach-observability`. El planner propone el diseño de integración.

## Contexto
La spec 004 pide una traza en Langfuse Cloud por cada pregunta al coach, con estos contenidos:
- tres pasos (embedding, recuperación y generación);
- dos puntuaciones;
- la duración real de cada fase;
- el usuario;
- la etiqueta de entorno.

Además exige:
- que un fallo o una lentitud de Langfuse no cambie la respuesta ni la alargue de forma apreciable (NFR-002, REQ-008);
- que todo se pueda probar sin red y con un destino sustituible (NFR-003); la constitución (Art. 5.4) desaconseja `unittest.mock` y `monkeypatch`;
- que en los tests la observabilidad esté siempre inactiva (REQ-009).

La primera versión de este ADR proponía enviar las trazas con `POST /api/public/ingestion` mediante `urllib`. Esa API está obsoleta y **se apaga en Langfuse Cloud el 2026-11-16** para la ingesta de trazas. La vía soportada es el endpoint OpenTelemetry, que el SDK de Python usa por defecto desde la v4.7.0. El usuario eligió el SDK oficial.

Hechos del SDK 4.17.0, verificados en su código fuente:
- Es OpenTelemetry por dentro. `start_observation` no admite una hora de inicio explícita: la toma al abrirse.
- `update_trace` no existe. Los atributos de traza (`user_id`, `trace_name`) se fijan con el gestor de contexto `propagate_attributes`, que solo afecta a las observaciones **creadas** mientras está activo.
- `set_trace_io` existe, pero está *deprecated*.
- El constructor recibe `base_url`; `host` está *deprecated*.
- `score_trace` encola la puntuación sin bloquear, y un hilo del SDK la envía como evento `score-create` a `/api/public/ingestion`.

## Decisión
1. **Puerto propio.** `CoachService` solo conoce `utils/tracing.py`:
   - el singleton `tracer` (`Tracer`, en `extensions.py`, con `init_app`) abre una traza con `start_trace()`;
   - la traza ofrece `start_step` (`end` y `fail`), `add_score` y `finish`;
   - lo que recibe el servicio es un `SafeTraceRecorder`, que captura cualquier excepción del backend, avisa una vez por traza (solo con el nombre del tipo, nunca el mensaje) y queda inerte. Si el tracer está inactivo, recibe un `NullTraceRecorder`.
2. **Adaptador.** `LangfuseTraceBackend` (`utils/langfuse_backend.py`) es el único archivo que conoce el SDK:
   - traduce cada llamada a la API pública del SDK (`start_observation`, `update`, `score_trace` y `end`) **en el momento en que ocurre la fase**, así que las duraciones son las reales sin necesidad de horas explícitas;
   - la entrada y la salida de la traza son las de la observación raíz `coach-ask`. No se usa `set_trace_io`;
   - el cliente se crea de forma perezosa en el primer uso de cada proceso, mediante una `client_factory` inyectable que importa `langfuse` dentro de la función. `propagate_attributes` también se inyecta y se importa de forma perezosa.
3. **Aislamiento del contexto OTel.**
   - Raíz y pasos se crean con `start_observation`, nunca como observación actual del hilo.
   - Cada creación de una observación se envuelve en su propio `with propagate_attributes(user_id=…, trace_name="coach-ask")`, que se abre y se cierra dentro de la misma llamada del adaptador. Así todas las observaciones llevan el usuario y el nombre de traza, y el contexto nunca queda adjunto a un hilo de gunicorn entre llamadas ni entre peticiones, aunque haya excepciones.
   - Se descarta un único `with` desde `start_trace` hasta `finish`, porque dejaría el contexto adjunto al hilo y podría filtrarse a la petición siguiente.
   - No se usa `as_baggage`, así que el `user_id` no viaja en cabeceras HTTP salientes.
4. **Envío en segundo plano.** Lo hace el SDK:
   - el procesador por lotes de OpenTelemetry exporta las observaciones en su hilo;
   - las puntuaciones salen por la cola de puntuaciones del SDK, también en su hilo.

   fitnerd no tiene cola ni hilo propios y nunca llama a `flush()` ni a `shutdown()` durante una petición.
5. **Dependencia.** `langfuse>=4.17,<5` en `backend/requirements.txt`. El mínimo es la versión verificada. Es la primera dependencia acotada del archivo.
6. **Activación.** La observabilidad solo está activa si `LANGFUSE_PUBLIC_KEY` y `LANGFUSE_SECRET_KEY` tienen valor y la configuración no es la de tests:
   - `LANGFUSE_BASE_URL`, el mismo nombre que usa el SDK, es opcional y vale `https://us.cloud.langfuse.com` por defecto;
   - los valores se pasan de forma explícita al constructor (`base_url` y `environment`, que puede ser `production` o `development`);
   - `TestingConfig` fija las dos claves a `None` en el código, igual que `MAIL_BACKEND = "memory"` en ADR-0014.
7. **Tests.**
   - Los del servicio sustituyen el backend por un `FakeTraceBackend` de `tests/fakes.py`, inyectado en un `Tracer` o asignado al singleton en los de rutas (patrón de `email_sender.transport`).
   - Los del adaptador inyectan un `FakeLangfuseClient` por `client_factory` y su `propagate_attributes`. Ese fake solo imita la API verificada y registra qué atributos estaban activos al crear cada observación.
   - Ningún test importa el SDK ni usa red.

## Consecuencias
- (+) Las trazas y los pasos usan la vía de ingesta soportada (OpenTelemetry), sin API *deprecated* (`update_trace`, `set_trace_io` ni `host`).
- (+) `CoachService` no depende del SDK. Cambiar de proveedor, o adaptar un cambio de nombres del SDK, solo afecta al adaptador y a su fake.
- (+) Sin código propio de cola, hilos ni HTTP: lotes, reintentos y vaciado al terminar el proceso los da el SDK.
- (+) Duraciones reales sin depender de horas explícitas.
- (+) No se filtra contexto OTel entre peticiones.
- (−) Dependencia nueva con dependencias transitivas (OpenTelemetry, `pydantic`, `backoff` y `wrapt`). Se mitiga con la versión acotada y la importación perezosa: si la importación falla, el coach sigue igual (aviso y recorder nulo).
- (−) Las puntuaciones dependen de cómo las envíe el SDK. En la 4.17 van por `/api/public/ingestion`. Si Langfuse retira esa vía también para las puntuaciones, habrá que subir la versión menor del SDK (el rango `<5` lo permite) sin tocar fitnerd. Se revisa antes del 2026-11-16.
- (−) Que Langfuse tome la entrada y la salida de la traza de la raíz se confirma en la verificación manual tras desplegar. Si no fuera así, se añade `set_trace_io` (todavía disponible en la 4.x) solo en el adaptador.
- (−) Los fallos de exportación por red los registra el SDK u OpenTelemetry en su hilo, con su propio texto, y no con el aviso de fitnerd. El aviso propio cubre los fallos que el SDK lanza en el hilo de la petición.
- (−) La protección de NFR-002 depende de que las llamadas del SDK en el hilo de la petición sean solo en memoria (procesador por lotes que descarta si la cola está llena y cola de puntuaciones con `put(block=False)`). Se verifica con un test (`flush` nunca se llama en una petición) y con una prueba manual de latencia tras desplegar.
- (−) Las trazas pendientes se pierden si el proceso se reinicia de forma abrupta (aceptado por la spec, Q10).
