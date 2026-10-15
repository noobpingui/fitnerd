# Review 013 — Pulido del código y la documentación de las features 006 a 010

- **Iteración:** 1 de 3
- **Commit / diff revisado:** `git diff main...fix/013-polish-006-010` @ `035fcd5` (sin cambios de código sin commitear; solo `state.json` modificado)
- **Veredicto:** CHANGES_REQUESTED

## 1. Resumen

El cambio cumple lo que pide la spec en el código de producción. `number_validation.is_number` evita el `OverflowError` con enteros enormes. El aviso de borrado se ata a la referencia de la lista. Las siete limpiezas del frontend y las dos del backend están aplicadas, y el filtro de ruido de Vitest no toca la app. Los tests no se modificaron durante implement y no debilitan aserciones.

El único hallazgo que impide aprobar es de ortografía: AC-N003.3 no se cumple en los comentarios que se trasladaron a `frontend/src/lib/dates.test.ts`. Además hay un warning de lint nuevo en un test.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 a AC-001.3 | Sí | `backend/services/number_validation.py:6-14`; `profile_service.py:85,103` usan `is_number` → mensaje de rango. Tests: `test_profile_service.py` (bloque "Enteros enormes") y `test_profile_routes.py` (AC-001.1 a 001.3) |
| AC-001.4 | Sí | `_validate` se ejecuta antes de tocar el repositorio; `test_profile_service.py` comprueba que no hay commit y que el perfil no cambia, y `test_profile_routes.py` compara el GET antes y después |
| AC-001.5 | Sí (se conserva) | `get_json(silent=True)` devuelve `None` (límite de 4300 dígitos); `test_put_with_a_5000_digit_weight_returns_400_and_never_500` envía el cuerpo como texto |
| AC-002.1 a AC-002.3 | Sí | `body_metric_service.py:56` (`_validate_values` con `is_number`); tests de servicio y de ruta |
| AC-002.4 | Sí | `update_metric` conserva el orden (bloqueo, 404, validación); el test de ruta comprueba que la medición sigue en 80 y que el perfil no cambia, y el de servicio que no hay commit |
| AC-002.5 | Sí (se conserva) | `test_post_with_a_5000_digit_weight_is_400_and_never_500` |
| AC-003.1 a AC-003.3 | Sí | `progress_analysis_context.py:151-157`; la validación va antes de `_check_rate_limit`. Tests unitarios con `assert_invalid` y `count_since_value=1`, y test de ruta con la cuota agotada (`analysis_rows == 2`) |
| AC-004.1 a AC-004.7 | Sí (se conserva) | Solo cambian los marcadores (`test_progress_analysis_service.py:795-830`, `test_progress_analysis_routes.py:189`); las aserciones son idénticas |
| AC-005.1 | Sí | `MetricsHistory.tsx:106-109` (`setFailedFor(null)` antes de `setEditingId`) |
| AC-005.2 | Sí | `MetricsHistory.tsx:145` (`failedFor === metrics`); `BodyMetricsPage.tsx:189` pasa `data` sin transformar |
| AC-005.3 | Sí | `MetricsHistory.tsx:118-120` |
| AC-005.4 | Sí | "Mostrar más" no toca `failedFor`; lo cubre el test con `manyMetrics(15)` |
| AC-N001.1, AC-N001.2, AC-N001.4 | Sí | `verify-report.md` §1: pytest 726, npm test 481, tsc, build y ruff-new OK; lint sin errores (ver F2) |
| AC-N001.3 | Sí | Ver §4 (integridad). En el backend solo se quitan docstrings sin tilde y marcadores. En el frontend se mueven los tests de `parseLocalDate` y `todayIsoDate` con las mismas aserciones, se borran los 3 de `isWithinLastMonths` (autorizado, Q3) y se sustituye el de límite inferior (`insights.test.ts:698-719`). `insightsView.test.ts` solo pierde tipos y casts, y `BodyMetricsPage.test.tsx` cambia la espera. Sin `skip`, `only` ni `todo` |
| AC-N002.1 | Sí | `dateUtils.ts:1`; `TrendChart.tsx:15`; `BodyMetricsPage.tsx:21` |
| AC-N002.2 | Sí | `calculations.ts:35` (`Record<Gender, number>`) |
| AC-N002.3 | Sí | `calculations.test.ts:98,111,240` |
| AC-N002.4 | Sí | `calculations.ts:76` (`heightCmFromAnswers(a) ?? 0`) |
| AC-N002.5 | Sí | Se borra `isWithinLastMonths`; el sustituto está en `insights.test.ts:703-704` con los dos marcadores |
| AC-N002.6 | Sí | `TrendChart.tsx:50-52` |
| AC-N002.7 | Sí | `insightsView.ts:90` |
| AC-N002.8 | Sí | `analysisRequest.ts:19,39-40` |
| AC-N002.9 | Sí | `profile_service.py:23` es la única definición del mensaje; `calorie_suggestion.py:18`, la única de la tupla |
| AC-N002.10 | Sí | `BodyMetricsPage.test.tsx` (`renderLoaded` espera "Análisis con contexto"; `renderWithoutProfile` espera la promesa real dentro de `act`) |
| AC-N003.1 | Sí | Docstrings de `test_body_metric_routes.py` con tildes; `test_source_cleanup_013.py:65` |
| AC-N003.2 | Sí | `progress_analysis_service.py:149`, `ProgressAnalysis.tsx:55` y `api.ts:41` |
| AC-N003.3 | **No** | Ver F1: hay líneas de comentario añadidas sin tilde en `frontend/src/lib/dates.test.ts` |
| AC-N004.1 | Sí | Los 7 tests llevan `SDD: 013 REQ-004 AC-004.x` |
| AC-N005.1, AC-N005.2 | Sí | `lib/testConsoleNoise.ts`, `vite.config.ts:27-30`; el verifier confirmó la salida limpia |
| AC-N005.3 | Sí | `GoogleSignInButton.tsx` no cambia; lo cubre `GoogleSignInButton.test.tsx` |
| AC-N006.1 a AC-N006.3 | Pendiente (etapa docs) | `traceability_exception`; `CLAUDE.md` no aparece en el diff |

## 3. Cumplimiento del plan

Sin desviaciones relevantes:
- `analysisRequest.ts` usa la segunda opción del plan (§3.4, `sentRate` con `?.`), que es una de las dos previstas.
- `heightCmFromAnswers` devuelve `null` (y por tanto 0) con alturas no finitas, donde antes salía `NaN`. Solo afecta a perfiles no válidos, que el servidor no permite (100–250 cm). El plan lo había previsto en §3.4 (`?? 0`).
- `progress_analysis_context.py` conserva `import math`, que sigue usándose en las líneas 193 y 202.
- No hay cambios de modelo, así que no hace falta migración, como dice el plan.

## 4. Checklist de la constitución
- [x] Art. 2: cada agente se mantuvo en su rol. `git diff a7636e8 HEAD -- backend/tests 'frontend/src/**/*.test.*' frontend/src/test` está vacío, así que los tests no cambiaron en implement ni en verify. `state.json` no tiene `tests_snapshot`, por lo que la integridad se comprobó con `commits.tests`.
- [x] Art. 4: los marcadores nuevos llevan `SDD: 013` y son coherentes con lo que prueban. El sustituto de AC-N002.5 conserva además el marcador de la spec 009, como pide la spec.
- [x] Art. 5: no hay tests borrados (salvo los de `isWithinLastMonths`, autorizados en Q3), saltados ni debilitados. El backend usa fakes, sin `unittest.mock` ni `monkeypatch`. El test de ruta de REQ-003 siembra la cuota para no llegar nunca a Anthropic.
- [x] Art. 6: se respetan las capas (la validación sigue en `services/`) y se usa `ValidationError`. Las rutas no cambian, no hay llamadas HTTP nuevas y la organización por feature se mantiene. `testConsoleNoise.ts` no lo importa la app.
- [x] Art. 6.4: no cambian los modelos, así que no hace falta migración.
- [x] Art. 7: no hay secretos ni endpoints nuevos. Se refuerza Art. 7.3: un entero enorme da 400 en lugar de 500.
- [x] Art. 6.11: no cambian textos visibles. El mensaje del 503 sin tilde queda fuera de alcance (Q9).
- [ ] Art. 6.10 / AC-N001.4: lint pasa sin errores, pero con un warning nuevo (F2).

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MAYOR | `frontend/src/lib/dates.test.ts:9,14,15,24,25,32` | AC-N003.3 no se cumple. Este archivo es nuevo en el diff y sus comentarios (y el nombre del `it` de la línea 9) se copiaron sin las tildes: "dia", "fallaria", "se esta evitando", "despues", "quedaria" y "podria". AC-N003.3 exige que las líneas de comentario que la feature **añade** estén en español correcto, y mover un test a otro archivo añade esas líneas. Debe quedar "día", "fallaría", "está", "después", "quedaría" y "podría". Las aserciones no cambian | test-author |
| F2 | MENOR | `frontend/src/app/sourceCleanup013.test.ts:90` | Warning nuevo de oxlint `no-useless-escape`: `"REQ-005 AC-005\.1"` es una cadena normal, así que el `\.` llega como `.` y la regex acepta cualquier carácter en esa posición. Debe ser `"REQ-005 AC-005\\.1"` o una regex literal, `/\/\/ SDD: REQ-005 AC-005\.1/`. El verify-report atribuye este warning al implementer, pero el archivo es un test: le corresponde al test-author, y conviene arreglarlo junto con F1 | test-author |
| F3 | MENOR | `frontend/src/features/body-metrics/components/MetricsHistory.tsx:157` | `onFailed` usa el `metrics` de la renderización en la que se pulsó "Borrar", porque `DeleteMetricDialog.tsx:26-30` lo invoca dentro del handler. Si la lista cambia mientras la petición está en curso (por ejemplo, por un refetch al recuperar el foco), `failedFor` guarda la lista vieja, `failedFor === metrics` nunca se cumple y el usuario no ve el aviso de un borrado que sí falló. Es un caso raro y no lo prohíbe ningún AC. Podría resolverse guardando el id de la medición fallida junto con la referencia, o con un ref a la lista actual. Se puede diferir | implementer |
| F4 | NIT | `backend/tests/test_routes/test_body_metric_routes.py` (test de AC-002.1) | `before = listing(...)` siempre es una lista vacía, porque el usuario recién registrado no tiene mediciones. Comprobar que "la lista no cambia" sería más fuerte con una medición previa | test-author |
| F5 | NIT | `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx:629-630` | Hay dos líneas en blanco seguidas antes del bloque de la spec 013 | test-author |

## 6. Decisión

**CHANGES_REQUESTED.** Hay un hallazgo MAYOR (F1, AC-N003.3) que corresponde al test-author. Conviene que en la misma iteración arregle F2, que es trivial y está en un archivo de test. F3 a F5 pueden diferirse si el usuario lo aprueba. El resto de la feature (código de producción, trazabilidad, integridad de los tests y constitución) está en orden. Tras la corrección, basta con repetir verify y una revisión rápida de `frontend/src/lib/dates.test.ts` y `frontend/src/app/sourceCleanup013.test.ts`.
