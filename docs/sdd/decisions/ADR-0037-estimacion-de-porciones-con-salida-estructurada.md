# ADR-0037: Estimación de porciones con Anthropic, salida estructurada por herramienta forzada y cliente perezoso

- **Estado:** Propuesta · 2026-10-30 (plan de la feature `030-diary-portion-chat`)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate de review (Art. P5.2).

## Contexto
La spec 030 pide `POST /api/meals/portion-estimate`: una pregunta en texto («5 huevos») y una estimación estructurada
de su peso en gramos (`status`, `grams`, `unit`, `note`, `message`), sin RAG, con un modelo pequeño propio (familia
Haiku) distinto del coach, como mucho 150 tokens de salida y temperatura 0 (NFR-001), instrucciones fijas (NFR-002) y
validación en el servidor de todo lo que devuelva el modelo (REQ-001 a REQ-004).

Restricciones del código vigente:
- `LLMClient` (`backend/utils/llm_client.py`) solo devuelve texto libre, sin temperatura ni herramientas, y crea el
  cliente de Anthropic en el constructor. El coach lo construye en cada petición dentro de `_build_coach_service()`,
  por eso sus rutas no se pueden probar hasta el 200 sin red (los tests de la ruta del coach solo cubren los 400).
- El análisis de foto (ADR-0032) ya resuelve la salida estructurada con *tool use* forzado en Bedrock y deja el
  cliente como singleton de `extensions.py` con `init_app`, que los tests sustituyen sin `monkeypatch`.

Opciones consideradas para la salida:
1. **Pedir JSON en texto libre** y parsearlo. Frágil: el modelo puede añadir texto o comillas; más reglas de saneado.
2. **Herramienta forzada** (`tools` + `tool_choice={"type": "tool", "name": …}`): la API devuelve un bloque
   `tool_use` con un objeto ya decodificado. Mismo enfoque que ADR-0032.

Opciones para el cliente:
1. Construir `LLMClient` en `_build_*_service()` como el coach: impide los tests de integración del 200.
2. **Singleton perezoso** en `extensions.py` que lee el modelo en `init_app` y crea el `LLMClient` en la primera
   llamada.

## Decisión
1. **Salida estructurada con herramienta forzada.** `LLMClient.generate_structured(system_prompt, messages, tool,
   max_tokens, temperature)` llama a `messages.create` con `tools=[tool]` y `tool_choice` forzado, y devuelve
   `StructuredGenerationResult(data, stop_reason, input_tokens, output_tokens)`: `data` es el `input` del bloque
   `tool_use` de esa herramienta si es un objeto, y `None` si hay rechazo (`refusal`), corte por longitud
   (`max_tokens`) o falta el bloque. El servidor valida siempre `data` (reglas puras en
   `services/portion_estimate_rules.py`); el esquema de la herramienta solo orienta al modelo.
2. **Modelo propio.** Variable opcional `PORTION_ESTIMATE_MODEL`; si falta o está vacía, `claude-haiku-4-5`
   (`DEFAULT_PORTION_ESTIMATE_MODEL` en `config.py`). Nunca se usa `ANTHROPIC_MODEL`. Misma `ANTHROPIC_API_KEY` que
   el coach.
3. **Cliente perezoso.** `LazyLLMClient` (en `utils/llm_client.py`) es el singleton `portion_llm` de `extensions.py`:
   `init_app` resuelve el modelo y descarta el cliente anterior; `generate_structured` crea el `LLMClient` en la
   primera llamada (con `timeout=15` s y `max_retries=1`) y delega. Así un fallo al crearlo ocurre dentro del `try`
   del servicio (503) y los tests sustituyen `portion_llm.llm_client` por un doble.
4. **`LLMClient` compatible.** El constructor acepta `timeout` y `max_retries` opcionales (solo se pasan al SDK si
   tienen valor); `generate` y `generate_with_usage` no cambian, ni el análisis de progreso.
5. **Coach con el mismo patrón** (plan, iteración 2). El coach usa un segundo singleton, `coach_llm =
   LazyLLMClient("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)`, sin `timeout` ni `max_retries` propios (se conservan los
   del SDK, como hoy). `LazyLLMClient` gana `generate_with_usage`, que delega igual que `generate_structured`.
   `CoachService` y el contrato de `/api/coach/ask` no cambian. Única diferencia: sin `ANTHROPIC_API_KEY`, el coach
   responde 503 en lugar de 500.
6. **Contador no disponible: falla cerrado, solo en este endpoint.** Si `RateLimiter.check_and_increment` lanza (Redis
   caído), la estimación responde 503 con el mensaje fijo, sin llamar al modelo ni abrir traza. El coach y el análisis
   de foto no cambian.
7. **Tope de cuerpo por petición.** La ruta fija `request.max_content_length = 4096` antes de leer el cuerpo (mismo
   mecanismo que `analyze_photo`) y traduce `RequestEntityTooLarge` a 400 «La petición no es válida». No hay
   `MAX_CONTENT_LENGTH` global: los demás endpoints no cambian.

## Consecuencias
- (+) Una sola llamada barata por pregunta, con salida ya estructurada y validada en el servidor.
- (+) La ruta se prueba de punta a punta (400, 401, 429, 200 y 503) sin red ni `monkeypatch`.
- (+) Sin dependencias nuevas ni migraciones; reutiliza `LLMClient`, `RateLimiter` y `Tracer` (Art. P2.5).
- (−) Con 150 tokens, una respuesta que se corte (`max_tokens`) se trata como «sin estimación» (`unknown`); las
  instrucciones y el esquema piden textos cortos para evitarlo.
- (−) Si Anthropic retira el alias `claude-haiku-4-5`, todas las preguntas darán 503 hasta fijar
  `PORTION_ESTIMATE_MODEL` en el `backend/.env` de EC2.
- (+) El coach se prueba por HTTP hasta el 200 sustituyendo `coach_llm.llm_client`.
- (−) El análisis de progreso (`body_metric_routes`) sigue construyendo `LLMClient` por petición; unificarlo queda en
  el backlog.
- (−) El comportamiento ante Redis caído difiere entre endpoints (503 aquí; el coach y la foto, como estaban).
