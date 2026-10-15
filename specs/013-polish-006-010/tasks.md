# Tareas 013 — Pulido del código y la documentación de las features 006 a 010

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-15)

## Fase A0 — Andamiaje (implementer, modo scaffold)
Solo `isTestConsoleNoise` es un símbolo nuevo que importan los tests. `number_validation.py` no lo importa ningún test (se ejercita a través de los servicios) y sus cambios se hacen en la fase B. En el andamiaje no se conecta `onConsoleLog` en `vite.config.ts`.

- [x] T-000 [NFR-005, AC-N005.1, AC-N005.2] (scaffold) Crear `isTestConsoleNoise(_log: string): boolean` exportado, que lance `Error("not implemented")` — `frontend/src/lib/testConsoleNoise.ts`

## Fase A — Tests (test-author)

### Backend · servicios (con fakes)
- [x] T-001 [REQ-001, AC-001.1, AC-001.2, AC-001.3] (test) `save_profile` lanza `ValidationError` con el mensaje de rango exacto con `height_cm`, `weight` kg y `weight` lb de 10^400 / -10^400 — `backend/tests/test_services/test_profile_service.py`
- [x] T-002 [REQ-001, AC-001.4] (test) Con un perfil previo, `save_profile` con `weight` 10^400 no cambia el perfil ni hace commit — `backend/tests/test_services/test_profile_service.py`
- [x] T-003 [REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) `save_metric` rechaza con el mensaje exacto `weight`, `body_fat_percentage` y `muscle_mass_percentage` enormes y no crea nada — `backend/tests/test_services/test_body_metric_service.py`
- [x] T-004 [REQ-002, AC-002.4] (test) `update_metric` con `weight` 10^400: 400, medición sigue en 80 kg, peso del perfil intacto y sin commit — `backend/tests/test_services/test_body_metric_service.py`
- [x] T-005 [REQ-003, AC-003.1, AC-003.2, AC-003.3] (test) `assert_invalid` con `rate_kg_per_week` 10^400, `latest_weight_kg` 10^400 y `unrealistic` con -10^400; incluye caso con `count_since_value=1` sin filas creadas ni llamada al LLM — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-006 [REQ-004, NFR-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5, AC-004.6, AC-N004.1] (test) Cambiar solo los marcadores de los 6 tests de "Validación del cuerpo" a `SDD: 013 REQ-004 AC-004.x` (sin citar `REQ-002 AC-002.1`, `REQ-004 AC-004.1` ni `NFR-001 AC-N001.1` de la spec 010) — `backend/tests/test_services/test_progress_analysis_service.py`
- [x] T-007 [NFR-002, NFR-003, AC-N002.9, AC-N003.1, AC-N003.2] (test) Test que recorre el código fuente: "Usuario no encontrado", `PACE_STATUSES_WITH_RATE =` y la tupla de estados con ritmo una sola vez; docstrings (por `ast`) de `test_body_metric_routes.py` sin "unicas", "restriccion", "medicion", "invalido", "valido"; `progress_analysis_service.py` sin "prolijo" — `backend/tests/test_services/test_source_cleanup_013.py`

### Backend · rutas (necesitan Postgres)
- [x] T-008 [REQ-001, AC-001.1, AC-001.2, AC-001.3] (test) `PUT /api/profile` con `height_cm`, `weight` kg y `weight` lb enormes responde 400 con `{"error": …}` exacto — `backend/tests/test_routes/test_profile_routes.py`
- [x] T-009 [REQ-001, AC-001.4] (test) Perfil guardado, `PUT` con `weight` 10^400 y `GET /api/profile` devuelve lo mismo que antes — `backend/tests/test_routes/test_profile_routes.py`
- [x] T-010 [REQ-001, AC-001.5] (test) `PUT /api/profile` con cuerpo en texto (`data=` + `content_type`) y `weight` de 5000 dígitos construido como cadena: 400 "Los datos del perfil no son válidos" — `backend/tests/test_routes/test_profile_routes.py`
- [x] T-011 [REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) `POST /api/body-metrics` con `weight`, grasa y músculo enormes: 400 con mensaje exacto y listado sin cambios — `backend/tests/test_routes/test_body_metric_routes.py`
- [x] T-012 [REQ-002, AC-002.4] (test) `PUT /api/body-metrics/{id}` con `weight` 10^400: 400, medición con 80 kg y `GET /api/profile` mantiene el peso — `backend/tests/test_routes/test_body_metric_routes.py`
- [x] T-013 [REQ-002, AC-002.5] (test) `POST /api/body-metrics` con cuerpo en texto y `weight` de 5000 dígitos: 400 "Los datos de la medición no son válidos" — `backend/tests/test_routes/test_body_metric_routes.py`
- [x] T-014 [NFR-003, AC-N003.1] (test) Poner tildes a todos los docstrings del archivo (módulo y tests) — `backend/tests/test_routes/test_body_metric_routes.py`
- [x] T-015 [REQ-003, AC-003.1] (test) Con 2 análisis sembrados, `POST /api/body-metrics/analysis` con `rate_kg_per_week` 10^400 responde 400 con el mensaje del análisis y `analysis_rows == 2` — `backend/tests/test_routes/test_progress_analysis_routes.py`
- [x] T-016 [REQ-004, NFR-004, AC-004.7, AC-N004.1] (test) Cambiar el marcador de `test_an_invalid_body_returns_bad_request_and_creates_no_row` a `# SDD: 013 REQ-004 AC-004.7` — `backend/tests/test_routes/test_progress_analysis_routes.py`

### Frontend
- [x] T-017 [REQ-005, AC-005.1] (test) Tras un borrado fallido, "Corregir medición del …" de otra fila hace desaparecer el aviso — `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx`
- [x] T-018 [REQ-005, AC-005.2] (test) Con `QueryClientProvider` y `rerender`, el aviso desaparece si la lista cambia (medición añadida; lista sin la medición no borrada) — `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx`
- [x] T-019 [REQ-005, AC-005.3, AC-005.4] (test) "Borrar" en otra fila quita el aviso y abre el diálogo; "Mostrar más" con la misma lista (`manyMetrics(15)`) deja el aviso — `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx`
- [x] T-020 [NFR-002, AC-N002.1] (test) Mover los tests de `parseLocalDate` y `todayIsoDate` a `src/lib/dates.test.ts` importando de `@/lib/dates`, con las mismas aserciones, y quitarlos de `dateUtils.test.ts` — `frontend/src/lib/dates.test.ts`
- [x] T-021 [NFR-001, NFR-002, AC-N001.3, AC-N002.5] (test) Borrar los 3 tests de `isWithinLastMonths` y su import; añadir el sustituto del límite inferior de "1M" con `SDD: REQ-005 AC-005.1` y `SDD: 013 NFR-002 AC-N002.5` (reloj falso, `trendChartData` con `periodStart(todayIsoDate(), 1)`) — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-022 [NFR-002, AC-N002.1, AC-N002.5] (test) Quitar de `dateUtils.test.ts` los tests movidos (T-020) y los de `isWithinLastMonths` (T-021), conservando `formatDate` y `periodStart` — `frontend/src/features/body-metrics/dateUtils.test.ts`
- [x] T-023 [NFR-002, AC-N002.3] (test) Sustituir los tres `as Record<string, string>` por objetos `OnboardingAnswers` sin cast, con los mismos valores esperados — `frontend/src/features/macros/calculations.test.ts`
- [x] T-024 [NFR-002, AC-N002.7] (test) `view()` y `view011()` usan `buildInsights(...)` y `formatInsights(insights, unit)` sin `as unknown as` ni `as never`; quitar tipos sobrantes — `frontend/src/features/body-metrics/insightsView.test.ts`
- [x] T-025 [NFR-002, AC-N002.10] (test) `renderLoaded` espera `findByText("Análisis con contexto")` (stub de `ProgressAnalysis` que depende de `request`); helper `renderWithoutProfile` para los 3 tests de perfil no disponible, sin bucles ni microtareas fijas — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-026 [NFR-005, AC-N005.1, AC-N005.2] (test) `isTestConsoleNoise` es `true` con el aviso de Google y el de Recharts `width(0)`/`height(0)` y `false` con otro aviso — `frontend/src/lib/testConsoleNoise.test.ts`
- [x] T-027 [NFR-005, AC-N005.3] (test) Sin `VITE_GOOGLE_CLIENT_ID` (`vi.stubEnv`, `vi.resetModules`, import dinámico) el botón no aparece y `console.warn` recibe el aviso — `frontend/src/features/auth/components/GoogleSignInButton.test.tsx`
- [x] T-028 [NFR-002, NFR-003, AC-N002.1, AC-N002.2, AC-N002.3, AC-N002.4, AC-N002.5, AC-N002.6, AC-N002.7, AC-N002.8, AC-N002.10, AC-N003.2] (test) Test que recorre el código fuente con `import.meta.glob` (`?raw`): sin reexportación en `dateUtils.ts`, `MIN_TARGET_KCAL: Record<`, `heightCmFromAnswers` sin `CM_PER_IN`, sin `isWithinLastMonths` y con marcadores 009 vigentes, comentario de tendencia antes de `const isWeight`, sin `as Insights`, `rate.kind === "ok"` una vez, `renderLoaded` sin `Promise.resolve()` ni `for (`, sin "tecnicos" ni "se envia" — `frontend/src/app/sourceCleanup013.test.ts`

## Fase B — Implementación (implementer)

### Backend (servicios)
- [ ] T-030 [REQ-001, REQ-002, REQ-003] (impl) Crear `is_number` (captura `OverflowError`, nunca bool) e `is_int` — `backend/services/number_validation.py`
- [ ] T-031 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5] (impl) Borrar `_is_number` y `_is_int` e importar los del helper; `USER_NOT_FOUND_MESSAGE` queda como única definición — `backend/services/profile_service.py`
- [ ] T-032 [REQ-002, NFR-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-N002.9] (impl) Usar `is_number` del helper e importar `USER_NOT_FOUND_MESSAGE` de `profile_service`, borrando la constante duplicada — `backend/services/body_metric_service.py`
- [ ] T-033 [REQ-003, REQ-004, NFR-002, AC-003.1, AC-003.2, AC-003.3, AC-N002.9] (impl) Borrar `_is_number`, `_is_int` y `PACE_STATUSES_WITH_RATE`; importar del helper y de `calorie_suggestion` — `backend/services/progress_analysis_context.py`
- [ ] T-034 [NFR-003, AC-N003.2] (impl) Reescribir el comentario con "prolijo" ("Un fallo de Anthropic se traduce en un 503 con un mensaje claro en lugar de un 500."), sin tocar el mensaje visible — `backend/services/progress_analysis_service.py`

### Frontend
- [ ] T-035 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4] (impl) Sustituir `deleteFailed` por `failedFor: BodyMetric[] | null` atado a la referencia de `metrics`; limpiarlo en "Corregir" y "Borrar", no en "Mostrar más" — `frontend/src/features/body-metrics/components/MetricsHistory.tsx`
- [ ] T-036 [NFR-002, AC-N002.1, AC-N002.6] (impl) Importar `todayIsoDate` de `@/lib/dates` y mover el comentario de la tendencia justo antes de `const isWeight` — `frontend/src/features/body-metrics/components/TrendChart.tsx`
- [ ] T-037 [NFR-002, AC-N002.1] (impl) Importar `todayIsoDate` de `@/lib/dates` — `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx`
- [ ] T-038 [NFR-002, AC-N002.1, AC-N002.5] (impl) Borrar la reexportación de `parseLocalDate`/`todayIsoDate` con su comentario y `isWithinLastMonths` con su comentario — `frontend/src/features/body-metrics/dateUtils.ts`
- [ ] T-039 [NFR-002, AC-N002.2, AC-N002.4] (impl) `MIN_TARGET_KCAL: Record<Gender, number>` y `heightCmFromAnswers(a) ?? 0` en lugar de la conversión propia (quitar `CM_PER_IN`) — `frontend/src/features/macros/calculations.ts`
- [ ] T-040 [NFR-002, AC-N002.7] (impl) `formatInsights(insights: Insights, weightUnit)`; borrar `InsightsInput`, su comentario y el cast — `frontend/src/features/body-metrics/insightsView.ts`
- [ ] T-041 [NFR-002, AC-N002.8] (impl) Dejar la comprobación `rate.kind === "ok"` una sola vez en el cálculo del ritmo enviado — `frontend/src/features/body-metrics/analysisRequest.ts`
- [ ] T-042 [NFR-003, AC-N003.2, AC-N003.3] (impl) Corregir "errores tecnicos" a "errores técnicos" (línea 55) — `frontend/src/features/body-metrics/components/ProgressAnalysis.tsx`
- [ ] T-043 [NFR-003, AC-N003.2, AC-N003.3] (impl) Corregir "se envia" a "se envía" (línea 41) — `frontend/src/features/body-metrics/api.ts`
- [ ] T-044 [NFR-005, AC-N005.1, AC-N005.2] (impl) Implementar `isTestConsoleNoise`: `true` solo con "VITE_GOOGLE_CLIENT_ID no esta configurado" o `/The width\(-?\d+\) and height\(-?\d+\) of chart should be greater than 0/` — `frontend/src/lib/testConsoleNoise.ts`
- [ ] T-045 [NFR-005, AC-N005.1, AC-N005.2, AC-N005.3] (config) Conectar `test.onConsoleLog` (stderr + `isTestConsoleNoise` devuelve `false`), importando con extensión `.ts`; `GoogleSignInButton.tsx` no se toca — `frontend/vite.config.ts`

### Documentación (etapa docs, doc-keeper)
- [ ] T-046 [NFR-006, AC-N006.1, AC-N006.2, AC-N006.3] (docs) Dividir la fila "Métricas corporales" (máx. 300 caracteres) y añadir la lista "Métricas corporales, en detalle" tras la tabla, sin perder datos. Sin tarea test por `traceability_exception`; lo comprueba el orquestador en el gate de docs — `CLAUDE.md`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-001, T-008 | T-030, T-031 |
| REQ-001 | AC-001.2 | T-001, T-008 | T-030, T-031 |
| REQ-001 | AC-001.3 | T-001, T-008 | T-030, T-031 |
| REQ-001 | AC-001.4 | T-002, T-009 | T-030, T-031 |
| REQ-001 | AC-001.5 | T-010 | T-031 |
| REQ-002 | AC-002.1 | T-003, T-011 | T-030, T-032 |
| REQ-002 | AC-002.2 | T-003, T-011 | T-030, T-032 |
| REQ-002 | AC-002.3 | T-003, T-011 | T-030, T-032 |
| REQ-002 | AC-002.4 | T-004, T-012 | T-030, T-032 |
| REQ-002 | AC-002.5 | T-013 | T-032 |
| REQ-003 | AC-003.1 | T-005, T-015 | T-030, T-033 |
| REQ-003 | AC-003.2 | T-005 | T-030, T-033 |
| REQ-003 | AC-003.3 | T-005 | T-030, T-033 |
| REQ-004 | AC-004.1 | T-006 | T-033 |
| REQ-004 | AC-004.2 | T-006 | T-033 |
| REQ-004 | AC-004.3 | T-006 | T-033 |
| REQ-004 | AC-004.4 | T-006 | T-033 |
| REQ-004 | AC-004.5 | T-006 | T-033 |
| REQ-004 | AC-004.6 | T-006 | T-033 |
| REQ-004 | AC-004.7 | T-016 | T-033 |
| REQ-005 | AC-005.1 | T-017 | T-035 |
| REQ-005 | AC-005.2 | T-018 | T-035 |
| REQ-005 | AC-005.3 | T-019 | T-035 |
| REQ-005 | AC-005.4 | T-019 | T-035 |
| NFR-001 | AC-N001.1 | verifier (pytest) | T-031, T-032, T-033 |
| NFR-001 | AC-N001.2 | verifier (`npm test`) | T-035 a T-045 |
| NFR-001 | AC-N001.3 | T-021 (reviewer compara el diff) | T-038 |
| NFR-001 | AC-N001.4 | verifier (lint, tsc, build, ruff) | T-030 a T-045 |
| NFR-002 | AC-N002.1 | T-020, T-022, T-028 | T-036, T-037, T-038 |
| NFR-002 | AC-N002.2 | T-028 | T-039 |
| NFR-002 | AC-N002.3 | T-023, T-028 | — (solo tests; T-023 lo cumple) |
| NFR-002 | AC-N002.4 | T-028 | T-039 |
| NFR-002 | AC-N002.5 | T-021, T-022, T-028 | T-038 |
| NFR-002 | AC-N002.6 | T-028 | T-036 |
| NFR-002 | AC-N002.7 | T-024, T-028 | T-040 |
| NFR-002 | AC-N002.8 | T-028 | T-041 |
| NFR-002 | AC-N002.9 | T-007 | T-032, T-033 |
| NFR-002 | AC-N002.10 | T-025, T-028 | — (solo tests; T-025 lo cumple) |
| NFR-003 | AC-N003.1 | T-007, T-014 | — (solo tests; T-014 lo cumple) |
| NFR-003 | AC-N003.2 | T-007, T-028 | T-034, T-042, T-043 |
| NFR-003 | AC-N003.3 | reviewer (diff) | T-042, T-043 |
| NFR-004 | AC-N004.1 | T-006, T-016 | — (solo marcadores; los cumplen T-006 y T-016) |
| NFR-005 | AC-N005.1 | T-026 | T-044, T-045 |
| NFR-005 | AC-N005.2 | T-026 | T-044, T-045 |
| NFR-005 | AC-N005.3 | T-027 | T-045 |
| NFR-006 | AC-N006.1 | exención (`traceability_exception`) | T-046 |
| NFR-006 | AC-N006.2 | exención (`traceability_exception`) | T-046 |
| NFR-006 | AC-N006.3 | exención (`traceability_exception`) | T-046 |
