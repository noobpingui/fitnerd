# Tareas 010 — Análisis de progreso con IA con contexto del perfil y sugerencia de calorías

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-13)

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-001 [REQ-004, REQ-005, REQ-006] (scaffold) Crear `CalorieSuggestion`, `round_adjustment` y `suggest_calories` con su firma, que lancen "not implemented" — `backend/services/calorie_suggestion.py`
- [x] T-002 [REQ-001, REQ-002, REQ-003, REQ-008, NFR-001] (scaffold) Crear `parse_analysis_request`, `build_user_message` e `INVALID_ANALYSIS_REQUEST_MESSAGE` con su firma, que lancen "not implemented" — `backend/services/progress_analysis_context.py`
- [x] T-003 [REQ-002] (scaffold) Crear `buildInsights` y `formatInsights` exportadas, que lancen "not implemented" — `frontend/src/features/body-metrics/insightsView.ts`
- [x] T-004 [REQ-002, REQ-003] (scaffold) Crear `buildAnalysisRequest` exportada, que lance "not implemented" — `frontend/src/features/body-metrics/analysisRequest.ts`
- [x] T-005 [REQ-007] (scaffold) Crear el componente `CalorieSuggestionBlock` exportado, que lance "not implemented" — `frontend/src/features/body-metrics/components/CalorieSuggestionBlock.tsx`

## Fase A — Tests (test-author)
- [x] T-010 [REQ-009, NFR-001, NFR-002] (test) Añadir el fake `FakeUserRepository` con `get_by_id` (SimpleNamespace con id, nombre, correo y date_of_birth) — `backend/tests/fakes.py`
- [x] T-011 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4] (test) `suggest_calories` calcula el ajuste y las calorías sugeridas (-450/1750, +450/2620, -350/2423, tope +500/3783) — `backend/tests/test_services/test_calorie_suggestion.py`
- [x] T-012 [REQ-004, AC-004.5, AC-004.6] (test) `round_adjustment` redondea a 50 con empates al menor valor absoluto (-325 a -300, -330 a -350) y un ajuste de +20 se trata como `on_track` — `backend/tests/test_services/test_calorie_suggestion.py`
- [x] T-013 [REQ-005, AC-005.1, AC-005.2, AC-005.3] (test) Suelo calórico: `floor_limited` (1500/-203), `at_floor` (mujer, 1200) y suelo sin efecto con ajuste positivo — `backend/tests/test_services/test_calorie_suggestion.py`
- [x] T-014 [REQ-006, AC-006.1, AC-006.2, AC-006.3] (test) `on_track` mantiene 2189 kcal y `insufficient`/`stale` devuelven `None` — `backend/tests/test_services/test_calorie_suggestion.py`
- [x] T-015 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (test) El mensaje al modelo lleva sexo, edad (también 29 años), altura, actividad y meta con los nombres de la app, y pesos y altura en la unidad del perfil — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-016 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7] (test) El mensaje lleva los indicadores recibidos con su estado de ritmo, "no disponible" para los nulos, la racha y los registros — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-017 [REQ-003, AC-003.1, AC-003.2] (test) El mensaje lleva el mantenimiento y el objetivo diario en kcal — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-018 [REQ-004, REQ-005, REQ-006, AC-004.7, AC-005.2, AC-006.1, AC-006.2, AC-008.4] (test) El mensaje y `AnalysisResult.calorie_suggestion` reflejan ajuste, mínimo recomendado, mantener objetivo y falta de datos recientes — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-019 [REQ-008, AC-008.1, AC-008.2, AC-008.3] (test) El system prompt contiene las frases fijas del plan y ninguna forma de voseo — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-020 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.5] (test) Sin perfil: `ConflictError` con el mensaje exacto con mediciones, sin mediciones y con cuota agotada, sin llamada ni fila; tras crear el perfil se genera el análisis — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-021 [REQ-010, AC-010.1, AC-010.2, AC-010.3] (test) Se conservan el 429, el texto corregido de falta de datos (sin llamada ni fila) y el 503 que cuenta contra el límite; se adaptan los cuatro tests y `make_service` existentes a la nueva firma — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-022 [NFR-001, NFR-002, AC-N001.1, AC-N002.1] (test) El system prompt y el mensaje no contienen nombre, correo, fecha de nacimiento ni id, y no se filtran datos de otro usuario — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-023 [REQ-002, REQ-004, NFR-001] (test) Validación del cuerpo (Art. 7.3): cuerpo `None`, `today` a más de un día, salto de línea, `pace_status` desconocido y kcal no enteras lanzan `ValidationError` sin llamada ni fila — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-024 [REQ-009, REQ-010, AC-009.1, AC-009.2, AC-009.3, AC-010.4] (test) Ruta: 401 sin token y 409 sin perfil (con mediciones, sin mediciones y con dos análisis sembrados), sin filas nuevas — `backend/tests/test_routes/test_progress_analysis_routes.py`
- [x] T-025 [REQ-010, AC-010.1, AC-010.2] (test) Ruta: con perfil, 200 con el texto corregido y `calorie_suggestion` nulo sin mediciones; 429 con cuota agotada; 400 con cuerpo inválido y sin fila nueva — `backend/tests/test_routes/test_progress_analysis_routes.py`
- [x] T-026 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7] (test) `buildInsights` y `formatInsights` producen los textos de las tarjetas, con `null` donde se pinta "—" y los códigos de estado — `frontend/src/features/body-metrics/insightsView.test.ts`
- [x] T-027 [REQ-002, REQ-003, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7, AC-003.1, AC-003.2, AC-007.8] (test) `buildAnalysisRequest` arma textos, ritmo en bruto, contadores y calorías de Macros (también con perfil en lb) y pasa `analysisRequestSchema` — `frontend/src/features/body-metrics/analysisRequest.test.ts`
- [x] T-028 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-007.8] (test) `CalorieSuggestionBlock` muestra título, cifras con signo, suelo, mínimo recomendado, mantener y texto de estimación según `kind` — `frontend/src/features/body-metrics/components/CalorieSuggestionBlock.test.tsx`
- [x] T-029 [REQ-007, REQ-009, AC-007.6, AC-007.7, AC-009.4] (test) `ProgressAnalysis` muestra el bloque solo si hay sugerencia, lo quita en un fallo posterior, muestra 409/429/503 sin bloque y llama a `mutate` con la prop `request` — `frontend/src/features/body-metrics/components/ProgressAnalysis.test.tsx`
- [x] T-030 [REQ-002, REQ-003, REQ-009, AC-002.1, AC-003.1, AC-009.4] (test) La página envía a `analyzeBodyMetrics` el cuerpo con "79,4 kg", "too_slow" y `target_kcal` 2200, o `null` sin perfil — `frontend/src/pages/BodyMetricsPage.analysis.test.tsx`

## Fase B — Implementación (implementer)
- [x] T-040 [REQ-004, REQ-005, REQ-006] (impl) Implementar `round_adjustment` y `suggest_calories` con constantes, `at_floor`, `floor_limited`, `on_track` y `None` sin ritmo — `backend/services/calorie_suggestion.py`
- [x] T-041 [REQ-001, REQ-002, REQ-003, NFR-001] (impl) Implementar `parse_analysis_request` con la validación del plan (400, lista blanca de caracteres, rangos y `today`) — `backend/services/progress_analysis_context.py`
- [x] T-042 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-006, NFR-001] (impl) Implementar etiquetas, formateadores (`format_decimal`, `to_display_weight`, `format_height`) y `build_user_message` con los cuatro bloques e historial — `backend/services/progress_analysis_context.py`
- [x] T-043 [REQ-008, REQ-010] (impl) Reescribir `PROGRESS_ANALYSIS_SYSTEM_PROMPT` en español neutro sin voseo con las frases fijas y corregir `NO_DATA_MESSAGE` — `backend/services/progress_analysis_service.py`
- [x] T-044 [REQ-001, REQ-004, REQ-009, REQ-010, NFR-002] (impl) `ProgressAnalysisService.analyze(user_id, data)`: nuevas dependencias, orden 409, sin datos, validación, límite, sugerencia y `AnalysisResult` — `backend/services/progress_analysis_service.py`
- [x] T-045 [REQ-004, REQ-007, REQ-009] (impl) Ruta `analyze()`: inyectar `UserRepository` y `UserProfileRepository`, pasar el cuerpo y serializar `calorie_suggestion` — `backend/routes/body_metric_routes.py`
- [x] T-046 [REQ-002, REQ-004, REQ-007] (impl) Añadir tipos `PaceStatusCode`, `AnalysisRequest`, `CalorieSuggestion` y `AnalysisResponse` — `frontend/src/features/body-metrics/types.ts`
- [x] T-047 [REQ-002, REQ-004, REQ-007] (impl) Añadir `analysisRequestSchema` y `analysisResponseSchema` (zod) — `frontend/src/features/body-metrics/schemas.ts`
- [x] T-048 [REQ-002] (impl) Implementar `buildInsights` y `formatInsights` extrayendo el cálculo y el formato de la página — `frontend/src/features/body-metrics/insightsView.ts`
- [x] T-049 [REQ-002] (impl) Hacer que la página pinte las tarjetas desde `formatInsights` conservando sus textos exactos — `frontend/src/pages/BodyMetricsPage.tsx`
- [x] T-050 [REQ-002, REQ-003] (impl) Implementar `buildAnalysisRequest` con `buildInsights`, `formatInsights` y `calculateMacros` — `frontend/src/features/body-metrics/analysisRequest.ts`
- [x] T-051 [REQ-004, REQ-007, REQ-009] (impl) `analyzeBodyMetrics(request | null)` valida el cuerpo y la respuesta con zod — `frontend/src/features/body-metrics/api.ts`
- [x] T-052 [REQ-007, REQ-009] (impl) `useAnalyzeBodyMetrics` recibe `AnalysisRequest | null` en `mutate` — `frontend/src/features/body-metrics/hooks.ts`
- [x] T-053 [REQ-007] (impl) Implementar `CalorieSuggestionBlock` con los cuatro casos y el texto de estimación — `frontend/src/features/body-metrics/components/CalorieSuggestionBlock.tsx`
- [x] T-054 [REQ-007, REQ-009] (impl) `ProgressAnalysis` recibe `request`, muestra el 409 en tono neutro y pinta el bloque con la sugerencia — `frontend/src/features/body-metrics/components/ProgressAnalysis.tsx`
- [x] T-055 [REQ-002, REQ-003, REQ-009] (impl) Calcular `analysisRequest` con `useMemo` (nulo sin perfil) y pasarlo a `ProgressAnalysis` — `frontend/src/pages/BodyMetricsPage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-015 | T-041, T-042, T-044 |
| REQ-001 | AC-001.2 | T-015 | T-042, T-044 |
| REQ-001 | AC-001.3 | T-015 | T-042 |
| REQ-001 | AC-001.4 | T-015 | T-042 |
| REQ-002 | AC-002.1 | T-016, T-026, T-027, T-030 | T-041, T-042, T-048, T-050, T-055 |
| REQ-002 | AC-002.2 | T-016, T-026, T-027 | T-042, T-048, T-050 |
| REQ-002 | AC-002.3 | T-016, T-026, T-027 | T-042, T-048, T-050 |
| REQ-002 | AC-002.4 | T-016, T-026, T-027 | T-042, T-048, T-050 |
| REQ-002 | AC-002.5 | T-016, T-026, T-027 | T-042, T-048, T-050 |
| REQ-002 | AC-002.6 | T-016, T-026, T-027 | T-042, T-048, T-050 |
| REQ-002 | AC-002.7 | T-016, T-026, T-027 | T-042, T-048, T-050 |
| REQ-003 | AC-003.1 | T-017, T-027, T-030 | T-042, T-050, T-055 |
| REQ-003 | AC-003.2 | T-017, T-027 | T-042, T-050 |
| REQ-004 | AC-004.1 | T-011 | T-040 |
| REQ-004 | AC-004.2 | T-011 | T-040 |
| REQ-004 | AC-004.3 | T-011 | T-040 |
| REQ-004 | AC-004.4 | T-011 | T-040 |
| REQ-004 | AC-004.5 | T-012 | T-040 |
| REQ-004 | AC-004.6 | T-012 | T-040 |
| REQ-004 | AC-004.7 | T-018 | T-040, T-042, T-044, T-045 |
| REQ-005 | AC-005.1 | T-013 | T-040 |
| REQ-005 | AC-005.2 | T-013, T-018 | T-040, T-042, T-044 |
| REQ-005 | AC-005.3 | T-013 | T-040 |
| REQ-006 | AC-006.1 | T-014, T-018 | T-040, T-042, T-044 |
| REQ-006 | AC-006.2 | T-014, T-018 | T-040, T-042, T-044 |
| REQ-006 | AC-006.3 | T-014 | T-040 |
| REQ-007 | AC-007.1 | T-028 | T-053, T-054 |
| REQ-007 | AC-007.2 | T-028 | T-053 |
| REQ-007 | AC-007.3 | T-028 | T-053 |
| REQ-007 | AC-007.4 | T-028 | T-053 |
| REQ-007 | AC-007.5 | T-028 | T-053 |
| REQ-007 | AC-007.6 | T-029 | T-054 |
| REQ-007 | AC-007.7 | T-029 | T-054 |
| REQ-007 | AC-007.8 | T-027, T-028 | T-050, T-053 |
| REQ-008 | AC-008.1 | T-019 | T-043 |
| REQ-008 | AC-008.2 | T-019 | T-043 |
| REQ-008 | AC-008.3 | T-019 | T-043 |
| REQ-008 | AC-008.4 | T-018 | T-042 |
| REQ-009 | AC-009.1 | T-020, T-024 | T-044, T-045 |
| REQ-009 | AC-009.2 | T-020, T-024 | T-044, T-045 |
| REQ-009 | AC-009.3 | T-020, T-024 | T-044, T-045 |
| REQ-009 | AC-009.4 | T-029, T-030 | T-054, T-055 |
| REQ-009 | AC-009.5 | T-020 | T-044 |
| REQ-010 | AC-010.1 | T-021, T-025 | T-044 |
| REQ-010 | AC-010.2 | T-021, T-025 | T-043, T-044 |
| REQ-010 | AC-010.3 | T-021 | T-044 |
| REQ-010 | AC-010.4 | T-024 | T-045 |
| NFR-001 | AC-N001.1 | T-022, T-023 | T-041, T-042 |
| NFR-002 | AC-N002.1 | T-022 | T-044 |
