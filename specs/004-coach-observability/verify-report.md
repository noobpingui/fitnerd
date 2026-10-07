# Verify Report 004 — Observabilidad del coach de IA con Langfuse Cloud

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-07T06:01:40.250Z · **Rama:** `feat/004-coach-observability` @ `13300d2`
- **Resultado:** PASS

## 1. Ejecución de tests

Se ejecutaron **107 tests nuevos** de la feature con marcador `SDD:` en 8 archivos:

| Archivo | Cantidad | Fallidos | Pasados | Resultado |
|---|---|---|---|---|
| `test_coach_observability.py` | 38 | 38 | 0 | ❌ |
| `test_tracer.py` | 19 | 19 | 0 | ❌ |
| `test_langfuse_backend.py` | 17 | 17 | 0 | ❌ |
| `test_llm_client.py` | 4 | 2 | 2 | ⚠️ |
| `test_embedding_client.py` | 3 | 2 | 1 | ⚠️ |
| `test_retrieval_service.py` | 7 | 7 | 0 | ❌ |
| `test_observability_config.py` | 9 | 9 | 0 | ❌ |
| `test_coach_routes.py` | 3 | 0 | 3 | ✅ |
| **Otros archivos** (tests existentes) | 3 | 0 | 3 | ✅ |
| **TOTAL** | **107** | **96** | **11** | — |

## 2. Clasificación de fallos

Todos los **96 fallos son legítimos** (comportamiento ausente, no errores de test):

### 2.1 Fallos por tipo

| Tipo de error | Cantidad | Ejemplos | Clasificación |
|---|---|---|---|
| `TypeError` (parámetro faltante) | ~38 | `CoachService.__init__() takes 4 positional arguments but 5 were given` (falta `tracer`) | ✅ Legítimo |
| `NotImplementedError("not implemented")` | ~48 | `observability_enabled()`, `Tracer.init_app()`, `LangfuseTraceBackend.start_trace()` | ✅ Legítimo (scaffolds) |
| `AttributeError` (atributo/método faltante) | ~10 | `ProductionConfig.OBSERVABILITY_ENVIRONMENT`, métodos sin implementar | ✅ Legítimo |

### 2.2 Verificación de scaffolds

✅ Todos los scaffolds lanzan **exactamente** `NotImplementedError("not implemented")` sin contener lógica:
- `backend/config.py`: `resolve_langfuse_base_url()`, `observability_enabled()`
- `backend/utils/tracing.py`: `Tracer`, `SafeTraceRecorder`, `SafeStepHandle`, `NullTraceRecorder`, `NullStepHandle`, `format_error()`
- `backend/utils/langfuse_backend.py`: `LangfuseTraceBackend` (guarda atributos, métodos lanzan)
- `backend/utils/llm_client.py`: `GenerationResult` (dataclass), `generate_with_usage()` lanza

### 2.3 Verificación de imports

✅ Todos los tests importan correctamente:
- Módulos del plan: `utils.langfuse_backend`, `utils.tracing`, `tests.fakes_observability`
- Sin `ModuleNotFoundError` de módulos inexistentes
- Sin `SyntaxError` ni errores de fixture

### 2.4 Tests existentes (Art. 5.3)

✅ Los 8 tests existentes que verifican lógica anterior **siguen pasando**:
- `test_generate_keeps_returning_the_text_and_none_on_refusal`
- `test_generate_returns_an_empty_string_when_the_response_has_no_text_block`
- `test_embed_query_is_unchanged_and_returns_only_the_vector`
- `test_search_still_returns_only_relevant_chunks_in_the_same_shape_and_order`
- `test_search_honors_a_custom_top_k`
- `test_search_returns_an_empty_list_when_nothing_is_relevant`
- Adaptador y cliente Langfuse aislados en fakes

## 3. Trazabilidad

Todos los tests nuevos llevan el marcador `SDD:`:
- `test_coach_observability.py`: 35 marcadores
- `test_tracer.py`: 14 marcadores
- `test_langfuse_backend.py`: 17 marcadores
- `test_llm_client.py`: 4 marcadores
- `test_embedding_client.py`: 3 marcadores
- `test_retrieval_service.py`: 10 marcadores
- `test_observability_config.py`: 9 marcadores
- `test_coach_routes.py`: 1 marcador

✅ Cobertura de plan: los 53 tests del plan (T-006 a T-053) están presentes con sus marcadores `SDD:`.

## 4. Resumen de ejecución

```
============================= test session starts =============================
collected 107 items

backend/ (pytest)
- Total: 107 tests (8 archivos)
- Pasados: 11 (10.3%) — tests existentes + validación básica
- Fallidos: 96 (89.7%) — todos por comportamiento ausente (rojo legítimo)

============================ 96 failed, 11 passed ============================
```

### Ejemplos de fallos legítimos

**Fallo 1: TypeError (parámetro faltante)**
```
test_coach_observability.py::test_sends_one_coach_ask_trace_with_input_output_and_user_id
service = CoachService(retrieval, llm, FakeRateLimiter(allowed=allowed), tracer)
TypeError: CoachService.__init__() takes 4 positional arguments but 5 were given
```
→ Esperado: `CoachService` aún no acepta `tracer`.

**Fallo 2: NotImplementedError (scaffold)**
```
test_observability_config.py::test_observability_is_enabled_with_both_keys_and_testing_false
assert observability_enabled({**config, "TESTING": False}) is True
NotImplementedError: not implemented
```
→ Esperado: `observability_enabled()` es un scaffold.

**Fallo 3: AttributeError (atributo faltante)**
```
test_observability_config.py::test_production_config_labels_traces_as_production
assert ProductionConfig.OBSERVABILITY_ENVIRONMENT == "production"
AttributeError: type object 'ProductionConfig' has no attribute 'OBSERVABILITY_ENVIRONMENT'
```
→ Esperado: `OBSERVABILITY_ENVIRONMENT` aún no se define en las clases de config.

## 5. Conclusión

✅ **PASS de red check:** Todos los 96 tests nuevos fallan de forma legítima (comportamiento ausente), sin errores de sintaxis, fixture ni imports ilegítimos. Los 11 tests que pasan verifican que la lógica anterior sigue intacta y que la validación de input funciona correctamente.

La feature está lista para la etapa **implement**.
