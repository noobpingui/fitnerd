# Review 010 — Análisis de progreso con IA con contexto del perfil y sugerencia de calorías

- **Iteración:** 1 de 3
- **Commit / diff revisado:** `git diff chore/frontend-redesign...feat/010-progress-analysis-context` @ `59ccae7` (base según `state.json.base_branch`; sin cambios sin commitear salvo `state.json`)
- **Veredicto:** APPROVED

## 1. Resumen

`POST /api/body-metrics/analysis` recibe ahora el contexto que ya calcula la pantalla (indicadores formateados por la misma función que pinta Métricas, código del estado del ritmo, ritmo bruto y calorías de Macros). El servidor rechaza con 409 a quien no tiene perfil, lee perfil y edad de la base por el `user_id` del token, valida el cuerpo con lista blanca, calcula la sugerencia de calorías con una regla pura y la devuelve junto al análisis. El frontend la pinta en el bloque "Ajuste de calorías sugerido". La implementación sigue el plan con fidelidad, las capas están bien y los tests no se tocaron durante implement. Solo hay hallazgos menores y de estilo.

## 2. Cumplimiento de la spec

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `backend/services/progress_analysis_context.py:262-269` (bloque Perfil, `GENDER_LABELS`, `ACTIVITY_LABELS`, `GOAL_LABELS`); `test_message_includes_the_profile_with_the_names_the_app_uses` |
| AC-001.2 | Sí | `backend/services/progress_analysis_service.py:111-116` (`age_on` con `request.today`); `test_age_is_in_completed_years_on_the_request_date` |
| AC-001.3 | Sí | `progress_analysis_context.py:189-192` (`format_height`), `:182-186` y `:230` (historial en lb); `test_height_and_weights_use_the_profile_units` |
| AC-001.4 | Sí | `progress_analysis_context.py:34-47`; `test_goal_and_activity_names_for_gain_slow_and_athlete` |
| AC-002.1 | Sí | `frontend/src/features/body-metrics/insightsView.ts:80-124` + `analysisRequest.ts:9-46`; `progress_analysis_context.py:252-256`; `insightsView.test.ts`, `analysisRequest.test.ts`, `BodyMetricsPage.analysis.test.tsx` |
| AC-002.2 | Sí | `insightsView.ts:114-120`; tests de servicio y de `insightsView`/`analysisRequest` |
| AC-002.3 | Sí | `insightsView.ts:52-55`, `analysisRequest.ts:19,39-40`; `progress_analysis_context.py:252-256` |
| AC-002.4 | Sí | ídem con `stale`; `test_stale_records_are_reported_as_unavailable` |
| AC-002.5 | Sí | `progress_analysis_context.py:195-196` (`no disponible`) ; `test_indicators_the_screen_shows_as_dash_are_sent_as_unavailable` |
| AC-002.6 | Sí | `progress_analysis_context.py:280-284` (singular/plural) |
| AC-002.7 | Sí | `insightsView.ts:83-86,110-113` (conversión a lb en el cliente) |
| AC-003.1 / AC-003.2 | Sí | `analysisRequest.ts:16,41-44` (`calculateMacros`, misma función que Macros); `progress_analysis_context.py:286-290` |
| AC-004.1 a AC-004.7 | Sí | `backend/services/calorie_suggestion.py:30-70` (`round_adjustment` con tolerancia 1e-9, tope 500, `on_track` si 0); `test_calorie_suggestion.py`; AC-004.7 en `test_message_and_result_carry_the_calorie_adjustment` |
| AC-005.1 a AC-005.3 | Sí | `calorie_suggestion.py:66-69` (`at_floor` antes que `floor_limited`, suelo por `profile.gender` leído de la base) |
| AC-006.1 a AC-006.3 | Sí | `calorie_suggestion.py:49-58`; `progress_analysis_context.py:203-210` |
| AC-007.1 a AC-007.8 | Sí | `frontend/src/features/body-metrics/components/CalorieSuggestionBlock.tsx:14-53`; `ProgressAnalysis.tsx:64-66` (solo con `data.calorie_suggestion`; una nueva mutación reinicia `data`) |
| AC-008.1 a AC-008.4 | Sí | `progress_analysis_service.py:43-67` (frases literales del plan, sin voseo); `progress_analysis_context.py:205` |
| AC-009.1 a AC-009.3, AC-009.5 | Sí | `progress_analysis_service.py:92-96` (409 antes de datos, validación y límite; sin fila ni llamada); tests de servicio y de rutas |
| AC-009.4 | Sí | `ProgressAnalysis.tsx:37-43` (409 en tono neutro, sin bloque) |
| AC-010.1 a AC-010.4 | Sí | `progress_analysis_service.py:98-107,128-149`; `NO_DATA_MESSAGE` corregido (`:30-33`); `@require_auth` conservado en la ruta |
| AC-N001.1 | Sí | `build_user_message` solo usa columnas de perfil, edad y el historial; `test_no_personal_identifiers_are_sent_to_the_model` |
| AC-N002.1 | Sí | perfil, usuario e historial leídos con `g.decoded_token["id"]` (`backend/routes/body_metric_routes.py:110`); `test_context_only_contains_the_data_of_the_session_user` |

## 3. Cumplimiento del plan

- Contrato `AnalysisRequest`/`CalorieSuggestion`, reglas de validación, orden de comprobaciones del servicio, constructor con `clock` inyectado y textos del mensaje coinciden con plan §3.2-3.3.
- Frontend: `insightsView.ts`, `analysisRequest.ts`, `CalorieSuggestionBlock.tsx`, schemas zod y `api.ts` con `apiFetch` como dice §3.4. `BodyMetricsPage` pinta desde `formatInsights`; los tests de regresión de la página siguen verdes según `verify-report.md`.
- Desviación menor (sin impacto): el plan y `tasks.md` citan `frontend/src/pages/BodyMetricsPage.tsx`; el archivo real es `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx` (ya anotado por el verifier).
- Desviación menor: `formatInsights` acepta `Insights | { paceStatus: string | null }` y hace `input as Insights` (`insightsView.ts:77-81`) para que compile el test, que castea con `as unknown as` (`insightsView.test.ts:73-76`). No está en el plan (ver F4).
- Sin cambios de modelo: no hace falta migración (comprobado: el diff no toca `backend/models/` ni `migrations/`).

## 4. Checklist de la constitución

- [x] Art. 2: los 9 archivos de `tests_snapshot` tienen el mismo SHA-256 que en el commit de tests (`a469bb9`); `git diff a469bb9 HEAD` no toca archivos de test.
- [ ] Art. 4: los marcadores `SDD:` son coherentes con los AC que prueban — **parcial**: los 6 tests de validación del cuerpo llevan marcadores de AC que no prueban (F2).
- [x] Art. 5: sin tests borrados, saltados ni debilitados; `FakeUserRepository` escrito a mano e inyectado; sin `unittest.mock`/`monkeypatch`; ningún test de rutas llega a Anthropic.
- [x] Art. 6: la ruta solo parsea, llama y serializa; lógica en `services/`; `ConflictError`/`ValidationError`/`RateLimitError`/`ServiceUnavailableError`; solo `UnitOfWork` hace commit; `apiFetch`; organización por feature; zod en request y response.
- [x] Art. 6.4: sin cambios de modelo, no aplica.
- [x] Art. 7: sin secretos; `@require_auth` y filtrado por el `user_id` del token; el cuerpo no lleva identificadores; validación con lista blanca, longitudes y rangos en el servicio.
- [x] Art. 6.11: textos visibles nuevos en español correcto y sin voseo; el system prompt deja de usar voseo. Hay comentarios nuevos sin tilde o con regionalismos (F5, NIT).

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `backend/services/progress_analysis_context.py:139-142` | El servidor rechaza con 400 un `rate_kg_per_week` fuera de [-10, 10], pero el cliente envía el ritmo que calcula sin ese tope (`analysisRequest.ts:39`) y las mediciones aceptan pesos de 29,9 a 300 kg con al menos 10 días de ventana. Un registro erróneo (p. ej. 80, 80 y 98 kg en 10 días, unos +12 kg/sem) deja al usuario sin poder pedir ningún análisis y le muestra "Error (400): Los datos del análisis no son válidos.", un mensaje que no le dice qué corregir. La spec no cubre el caso. Opciones: que el cliente envíe el ritmo recortado o como sin ritmo, que el servidor lo trate como `insufficient` en vez de 400, o dejar constancia del caso en la spec. | planner |
| F2 | MENOR | `backend/tests/test_services/test_progress_analysis_service.py:789,795,801,812,818,824`; `backend/tests/test_routes/test_progress_analysis_routes.py:187` | Los tests de validación del cuerpo (cuerpo ausente, `today` fuera de margen, salto de línea, `pace_status` desconocido, kcal no enteras, 400 en la ruta) llevan marcadores `SDD: REQ-002 AC-002.1`, `REQ-004 AC-004.1` y `NFR-001 AC-N001.1`, pero no prueban esos AC. El plan §5 los declara "sin AC propio". Inflan la trazabilidad de esos AC. Conviene marcarlos con el REQ/NFR más cercano sin AC concreto o justificarlo en la spec. | test-author |
| F3 | NIT | `backend/services/progress_analysis_context.py:26` y `backend/services/calorie_suggestion.py:18` | `PACE_STATUSES_WITH_RATE` está duplicada en dos módulos; conviene importarla de `calorie_suggestion`. | implementer |
| F4 | NIT | `frontend/src/features/body-metrics/insightsView.ts:77-81` | `InsightsInput` y `input as Insights` abren un agujero de tipos solo para acomodar el `as unknown as` del test (`insightsView.test.ts:73-76`). Sería mejor que el test usara el tipo `Insights` y que `formatInsights` recibiera `Insights`. | test-author |
| F5 | NIT | `backend/services/progress_analysis_service.py:144`; `frontend/src/features/body-metrics/components/ProgressAnalysis.tsx:40`; `frontend/src/features/body-metrics/api.ts:41` | Comentarios nuevos o reescritos con regionalismos o sin tildes: "503 prolijo", "errores tecnicos", "se envia". | implementer |
| F6 | NIT | `frontend/src/features/body-metrics/analysisRequest.ts:19,39-40` | `hasRate && rate.kind === "ok"` repite la comprobación ya incluida en `hasRate` (necesaria solo para que TypeScript estreche el tipo); se puede simplificar con una variable estrechada. | implementer |
| F7 | NIT | `backend/services/progress_analysis_service.py:104` | Tras el despliegue, una pestaña con el bundle anterior envía la petición sin cuerpo y, si el usuario tiene perfil y mediciones, recibe 400 hasta recargar. Es transitorio; puede valer una nota en la etapa docs. | planner |

## 6. Decisión

**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. Los MENORES F1 y F2 pueden corregirse ahora o diferirse a una tarea futura si el usuario lo aprueba. Los NIT son opcionales.
