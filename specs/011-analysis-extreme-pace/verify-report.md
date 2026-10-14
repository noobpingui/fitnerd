# Verify report 011 — Ritmo poco realista por una medición errónea sin bloquear el análisis con IA

- **Modo:** red (tras la etapa tests), iteración 4
- **Fecha:** 2026-10-14T04:40:09.798Z · **Rama:** `fix/011-analysis-extreme-pace` @ `c907a5d`
- **Resultado:** PASS

## 1. Comandos ejecutados

Solo los tests nuevos (marcador `SDD:`) de los archivos modificados por la feature. Los tests que ya existían en esos archivos y que siguen pasando se cuentan en el total, pero no se analizan.

| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `backend/.venv/Scripts/python.exe -m pytest -q` sobre `tests/test_services/test_calorie_suggestion.py`, `tests/test_services/test_progress_analysis_service.py`, `tests/test_routes/test_progress_analysis_routes.py` | ✅ rojo legítimo | 56 passed, 39 failed. Los 33 tests nuevos fallan (legítimo). Ninguno pasa. Los 6 tests existentes modificados fallan por el mensaje nuevo (legítimo). |
| frontend | `npx vitest run` sobre `analysisRequest.test.ts`, `components/MetricsHistory.test.tsx`, `components/ProgressAnalysis.test.tsx`, `insights.test.ts`, `insightsView.test.ts`, `pages/BodyMetricsPage.analysis.test.tsx`, `pages/BodyMetricsPage.test.tsx`, `schemas.test.ts` | ✅ rojo legítimo | 187 passed, 65 failed (252 tests). Los 65 fallidos son tests nuevos. Ninguno nuevo pasa. |

No se ejecutaron `ruff`, `npm run lint`, `npx tsc -b` ni `npm run build`: en modo red no aplican.

## 2. Trazabilidad

No se evalúa en modo red (se comprueba en modo full). Como comprobación informativa: los 45 AC de `spec.md` aparecen en al menos un marcador `SDD:` de los tests. Todas las REQ aparecen en `tasks.md`.

## 3. Criterios de aceptación

No se evalúan en modo red.

## 4. Fallos

Ninguno.

### 4.1 Rojo legítimo (verificado por tipo de error)

- **Backend, esqueleto `is_unrealistic_rate`:** 7 tests fallan con `NotImplementedError: not implemented` del esqueleto (ADR-0012).
- **Backend, comportamiento ausente:** `AssertionError` (400 donde se espera 200 o 429, sugerencia calculada donde se espera `None`, mensaje antiguo donde se espera el nuevo, prompt sin las frases nuevas). Hay 3 tests de servicio que fallan con `ValidationError` lanzado por `progress_analysis_context.py:134`: el código actual rechaza el estado `unrealistic` porque aún no existe. El error sale del código de producción, no de un import, una fixture ni el propio test.
- **Frontend, esqueleto de `insights.ts`:** 13 tests fallan con `Error: not implemented` (`median`, `rateWindow`, `suspiciousPoint`, `isUnrealisticRate`).
- **Frontend, comportamiento ausente:** `too_slow` donde se espera `unrealistic`, `undefined` donde se espera la fecha del aviso, aviso "Tu ritmo de las últimas 4 semanas…" ausente, marca "Revisa este peso" ausente, "Revisa tus mediciones" ausente, schema que rechaza `unrealistic`.

### 4.2 Rojo ilegítimo

Ninguno. No hay `SyntaxError`, `ModuleNotFoundError`, errores de fixture ni de `conftest`, ni errores de TypeScript en los tests.

### 4.3 Test nuevo que pasa sin implementación

Ninguno. Se cruzaron los nombres de los tests añadidos en el diff (`git diff HEAD`) con los resultados de la ejecución: ninguno pasa.

La iteración 4 corrige el caso anterior de AC-009.9 (`MetricsHistory.test.tsx`): ahora falla por la ausencia de "Revisa este peso".

### 4.4 Escaneo de scaffolds (Art. 5.7)

- `backend/services/calorie_suggestion.py`: `is_unrealistic_rate` lanza `NotImplementedError("not implemented")`. Constantes `UNREALISTIC_RATE_PCT = 2.0` y `RATE_EPS = 1e-9`. Sin lógica. OK.
- `frontend/src/features/body-metrics/insights.ts`: `rateWindow`, `isUnrealisticRate`, `median` y `suspiciousPoint` lanzan `Error("not implemented")` con parámetros prefijados con `_`. Constante `UNREALISTIC_RATE_PCT = 2`. Sin lógica. OK.

### 4.5 Otros

- No hay `skip`, `xfail`, `.only` ni `.skip` nuevos en el diff.
- Aviso para la etapa full (no bloquea): varios tests de backend reutilizan IDs de la spec 010 (por ejemplo, `SDD: REQ-005 AC-005.1`, `REQ-006 AC-006.1`, `REQ-008 AC-008.3`). Una búsqueda por AC también encontrará tests de la 010. Conviene revisarlo en verify full.
- Las tareas de scaffold y de tests están marcadas `[x]`. Las de implementación (Fase B) están en `[ ]`, como corresponde a este punto.
