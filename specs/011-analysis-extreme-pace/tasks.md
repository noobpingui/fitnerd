# Tareas 011 — Ritmo poco realista por una medición errónea sin bloquear el análisis con IA

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-14)

## Fase A0 — Andamiaje (implementer, modo scaffold)
Solo para los símbolos nuevos que los tests importan. Las constantes de texto y los valores nuevos de enums no necesitan andamiaje: los tests usan los textos literales de la spec.

- [ ] T-000 [REQ-001, REQ-006] (scaffold) Crear `is_unrealistic_rate(rate_kg_per_week, latest_weight_kg)` exportada, que lance `not implemented` — `backend/services/calorie_suggestion.py`
- [ ] T-001 [REQ-001, REQ-009] (scaffold) Crear `UNREALISTIC_RATE_PCT`, `rateWindow`, `isUnrealisticRate`, `median` y `suspiciousPoint` exportadas; las funciones lanzan `not implemented` — `frontend/src/features/body-metrics/insights.ts`

## Fase A — Tests (test-author)
- [ ] T-010 [REQ-001, REQ-006, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.6, AC-006.3] (test) `is_unrealistic_rate` en (12.6, 98), (-12.6, 80), (2.0, 100), (2.1, 100.2), (1.6, 80), (-0.5, 79.4) y `suggest_calories("unrealistic", …)` devuelve `None` — `backend/tests/test_services/test_calorie_suggestion.py`
- [ ] T-011 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4] (test) Cuerpo `unrealistic` (+12,6/98 y -12,6/80): sin sugerencia, mensaje al modelo con "Ritmo semanal: +12,6 kg/sem (Revisa tus mediciones)" y el texto fijo, sin "Ajuste:", "Calorías sugeridas" ni "mantener"; cuenta contra el límite (un commit, 429 con cuota agotada) — `backend/tests/test_services/test_progress_analysis_service.py`
- [ ] T-012 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6] (test) El servidor normaliza `too_fast`/`on_track` con ritmo >2 % a "Revisa tus mediciones" sin sugerencia, conserva la sugerencia en el 2 % exacto y acepta `unrealistic` con cualquier número (-45, -0,5) — `backend/tests/test_services/test_progress_analysis_service.py`
- [ ] T-013 [REQ-005, AC-005.1, AC-005.2] (test) El system prompt contiene las tres frases nuevas literales y conserva las de dietas/rutinas y español neutro sin voseo — `backend/tests/test_services/test_progress_analysis_service.py`
- [ ] T-014 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4] (test) Actualizar `INVALID_MESSAGE` al mensaje nuevo; 400 sin llamada al modelo ni fila para `too_fast` con +12,6, ritmo no numérico (con y sin `unrealistic`) y peso fuera de [20, 400]; 409 sin perfil con cuerpo mal formado — `backend/tests/test_services/test_progress_analysis_service.py`
- [ ] T-015 [REQ-008, AC-008.3] (test) Con mediciones corregidas (80, 80, 79,5) y cuerpo `too_slow` -0,35/79,5 se calcula la sugerencia — `backend/tests/test_services/test_progress_analysis_service.py`
- [ ] T-016 [REQ-006, REQ-007, AC-006.4, AC-006.5, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.6] (test) Ruta `POST /api/body-metrics/analysis`: `unrealistic` (+12,6/98 y -45) con cuota agotada da 429 (no 400); 400 con el mensaje nuevo y sin filas para `too_fast` +12,6, ritmo `"x"` y `unrealistic` con `"x"`; 409 sin perfil; actualizar `INVALID_MESSAGE` — `backend/tests/test_routes/test_progress_analysis_routes.py`
- [ ] T-017 [REQ-001, REQ-009, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.6, AC-009.1, AC-009.2, AC-009.3, AC-009.4] (test) `isUnrealisticRate`, `median`, `rateWindow` y `suspiciousPoint` con las fixtures "salto arriba/abajo", "límite", "justo encima", "empate" y "en ritmo" — `frontend/src/features/body-metrics/insights.test.ts`
- [ ] T-018 [REQ-001, REQ-002, REQ-003, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-002.1, AC-002.2, AC-003.1, AC-003.2, AC-003.4, AC-003.5, AC-003.6] (test) `buildInsights` y `formatInsights`: estado `unrealistic`, "Revisa tus mediciones" con tono warn, ritmo en kg y lb, `suspiciousDate` y `paceWarning` con `formatDate` — `frontend/src/features/body-metrics/insightsView.test.ts`
- [ ] T-019 [REQ-004, AC-004.2, AC-007.6] (test) `buildAnalysisRequest` con "salto arriba" envía `pace_status` `"unrealistic"`, `rate` "+12,6 kg/sem", `rate_kg_per_week` ≈ 12,6 y `latest_weight_kg` 98 — `frontend/src/features/body-metrics/analysisRequest.test.ts`
- [ ] T-020 [REQ-004, AC-004.2] (test) `analysisRequestSchema` acepta `pace_status: "unrealistic"` — `frontend/src/features/body-metrics/schemas.test.ts`
- [ ] T-021 [REQ-003, REQ-004, REQ-007, AC-003.1, AC-003.3, AC-004.1, AC-007.5] (test) `ProgressAnalysis`: aviso visible antes y después del análisis con el botón habilitado, respuesta sin sugerencia sin bloque ni error, mensaje 400 nuevo visible y el antiguo ausente, sin `warning` no hay `data-tone="warn"` — `frontend/src/features/body-metrics/components/ProgressAnalysis.test.tsx`
- [ ] T-022 [REQ-009, AC-009.1, AC-009.5, AC-009.8, AC-009.9] (test) `MetricsHistory`: marca "Revisa este peso" con `data-tone="warn"` solo en la fila de `suspiciousDate` con peso, en kg y lb, con botones corregir/borrar conservados y sin marca con `null` — `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx`
- [ ] T-023 [REQ-002, REQ-008, REQ-009, AC-002.1, AC-002.2, AC-002.3, AC-008.1, AC-008.2, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6, AC-009.7, AC-009.8, AC-009.9] (test) Página: tarjeta "Ritmo" con "Revisa tus mediciones", marca en la fila correcta (o en ninguna), y recuperación al corregir (79,5) o borrar la medición del 2026-10-11 — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [ ] T-024 [REQ-003, REQ-004, REQ-008, AC-003.1, AC-003.2, AC-003.4, AC-003.5, AC-003.6, AC-004.1, AC-004.4, AC-007.6, AC-008.1, AC-008.3] (test) Página con `ProgressAnalysis` real: aviso con ritmo y fecha, clic envía `pace_status: "unrealistic"` sin error ni bloque de ajuste, y tras corregir desaparece el aviso y el clic envía `too_slow` — `frontend/src/features/body-metrics/pages/BodyMetricsPage.analysis.test.tsx`

## Fase B — Implementación (implementer)
Backend (servicios), en orden de dependencia.

- [ ] T-100 [REQ-001, REQ-006] (impl) Implementar `UNREALISTIC_RATE_PCT`, `RATE_EPS` e `is_unrealistic_rate` (2 % exacto no cuenta) — `backend/services/calorie_suggestion.py`
- [ ] T-101 [REQ-006, REQ-007] (impl) `INVALID_ANALYSIS_REQUEST_MESSAGE` nuevo, `UNREALISTIC`, `PACE_LABELS["unrealistic"]` y `parse_analysis_request`: rama `unrealistic` sin rango de ritmo, rango [-10, 10] y normalización a `unrealistic` solo para estados de meta — `backend/services/progress_analysis_context.py`
- [ ] T-102 [REQ-004] (impl) `UNREALISTIC_SUGGESTION_TEXT`, línea del ritmo con el estado `unrealistic` y `_suggestion_block` en `build_user_message` — `backend/services/progress_analysis_context.py`
- [ ] T-103 [REQ-005] (impl) Añadir las tres frases nuevas al `PROGRESS_ANALYSIS_SYSTEM_PROMPT` sin quitar las existentes — `backend/services/progress_analysis_service.py`

Frontend, en orden `types → schemas → lógica pura → api → componentes → páginas`.

- [ ] T-110 [REQ-004] (impl) Añadir `"unrealistic"` a `PaceStatusCode` — `frontend/src/features/body-metrics/types.ts`
- [ ] T-111 [REQ-004] (impl) Añadir `"unrealistic"` al `z.enum` de `pace_status` en `analysisRequestSchema` — `frontend/src/features/body-metrics/schemas.ts`
- [ ] T-112 [REQ-001, REQ-009] (impl) Implementar `rateWindow` (extraída de `rateIndicator`, sin cambiar su comportamiento), `isUnrealisticRate`, `median` y `suspiciousPoint` — `frontend/src/features/body-metrics/insights.ts`
- [ ] T-113 [REQ-001, REQ-009] (impl) `buildInsights`: estado `unrealistic` tras `stale`/`insufficient` y antes de la meta, y campo `suspiciousDate` — `frontend/src/features/body-metrics/insightsView.ts`
- [ ] T-114 [REQ-002, REQ-003] (impl) `formatInsights`: `UNREALISTIC_COPY` ("Revisa tus mediciones", tono warn) y `paceWarning` con `formatDate` — `frontend/src/features/body-metrics/insightsView.ts`
- [ ] T-115 [REQ-004] (impl) Verificar que `buildAnalysisRequest` envía `pace_status: "unrealistic"` con ritmo y peso (sin cambios de lógica esperados; solo ajustar si el tipo lo exige) — `frontend/src/features/body-metrics/analysisRequest.ts`
- [ ] T-116 [REQ-003, REQ-004, REQ-007] (impl) Prop `warning` en `ProgressAnalysis`, siempre visible encima del botón con `CircleAlert` y `data-tone="warn"` — `frontend/src/features/body-metrics/components/ProgressAnalysis.tsx`
- [ ] T-117 [REQ-009] (impl) Prop `suspiciousDate` en `MetricsHistory` con la marca "Revisa este peso" junto al peso — `frontend/src/features/body-metrics/components/MetricsHistory.tsx`
- [ ] T-118 [REQ-002, REQ-003, REQ-008, REQ-009] (impl) Pasar `warning={view.paceWarning}` a `ProgressAnalysis` y `suspiciousDate={insights.suspiciousDate}` a `MetricsHistory` — `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-017, T-018 | T-100, T-112, T-113 |
| REQ-001 | AC-001.2 | T-010, T-017, T-018 | T-100, T-112, T-113 |
| REQ-001 | AC-001.3 | T-010, T-017, T-018 | T-100, T-112, T-113 |
| REQ-001 | AC-001.4 | T-010, T-017, T-018 | T-100, T-112, T-113 |
| REQ-001 | AC-001.5 | T-018 | T-113 |
| REQ-001 | AC-001.6 | T-010, T-017, T-018 | T-100, T-112, T-113 |
| REQ-002 | AC-002.1 | T-018, T-023 | T-114, T-118 |
| REQ-002 | AC-002.2 | T-018, T-023 | T-114, T-118 |
| REQ-002 | AC-002.3 | T-023 | T-114, T-118 |
| REQ-003 | AC-003.1 | T-018, T-021, T-024 | T-113, T-114, T-116, T-118 |
| REQ-003 | AC-003.2 | T-018, T-024 | T-113, T-114, T-116, T-118 |
| REQ-003 | AC-003.3 | T-021 | T-116 |
| REQ-003 | AC-003.4 | T-018, T-024 | T-114, T-118 |
| REQ-003 | AC-003.5 | T-018, T-024 | T-112, T-113, T-114 |
| REQ-003 | AC-003.6 | T-018, T-024 | T-112, T-113, T-114 |
| REQ-004 | AC-004.1 | T-011, T-021, T-024 | T-101, T-102, T-110, T-111, T-115, T-116 |
| REQ-004 | AC-004.2 | T-011, T-019, T-020 | T-101, T-102, T-110, T-111, T-115 |
| REQ-004 | AC-004.3 | T-011 | T-101, T-102 |
| REQ-004 | AC-004.4 | T-011, T-024 | T-101, T-102, T-115 |
| REQ-005 | AC-005.1 | T-013 | T-103 |
| REQ-005 | AC-005.2 | T-013 | T-103 |
| REQ-006 | AC-006.1 | T-012 | T-100, T-101, T-102 |
| REQ-006 | AC-006.2 | T-012 | T-100, T-101, T-102 |
| REQ-006 | AC-006.3 | T-010, T-012 | T-100, T-101 |
| REQ-006 | AC-006.4 | T-012, T-016 | T-101, T-102 |
| REQ-006 | AC-006.5 | T-012, T-016 | T-101, T-102 |
| REQ-006 | AC-006.6 | T-012 | T-101, T-102 |
| REQ-007 | AC-007.1 | T-014, T-016 | T-101 |
| REQ-007 | AC-007.2 | T-014, T-016 | T-101 |
| REQ-007 | AC-007.3 | T-014, T-016 | T-101 |
| REQ-007 | AC-007.4 | T-014, T-016 | T-101 |
| REQ-007 | AC-007.5 | T-021 | T-101, T-116 |
| REQ-007 | AC-007.6 | T-016, T-019, T-024 | T-101, T-110, T-111, T-115 |
| REQ-008 | AC-008.1 | T-023, T-024 | T-113, T-114, T-118 |
| REQ-008 | AC-008.2 | T-023 | T-113, T-117, T-118 |
| REQ-008 | AC-008.3 | T-015, T-024 | T-101, T-115 |
| REQ-009 | AC-009.1 | T-017, T-022, T-023 | T-112, T-113, T-117, T-118 |
| REQ-009 | AC-009.2 | T-017, T-023 | T-112, T-113, T-117, T-118 |
| REQ-009 | AC-009.3 | T-017, T-023 | T-112, T-113, T-117, T-118 |
| REQ-009 | AC-009.4 | T-017, T-023 | T-112, T-113, T-117, T-118 |
| REQ-009 | AC-009.5 | T-022, T-023 | T-117, T-118 |
| REQ-009 | AC-009.6 | T-023 | T-113, T-117 |
| REQ-009 | AC-009.7 | T-023 | T-113, T-117 |
| REQ-009 | AC-009.8 | T-022, T-023 | T-117, T-118 |
| REQ-009 | AC-009.9 | T-022, T-023 | T-117 |
| NFR (spec 010) | sin AC nuevos | — | sin cambios |
