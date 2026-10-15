# Review 013 — Pulido del código y la documentación de las features 006 a 010

- **Iteración:** 2 de 3
- **Commit / diff revisado:** `git diff main...fix/013-polish-006-010` @ `e1704c1`. Foco en las correcciones `9d56d7e` (F1, F2, F4, F5 y test de F3), `7e25d58` (F3) y `0ab8421` (test de AC-N004.1). Sin cambios de código sin commitear: solo `state.json` está modificado.
- **Veredicto:** APPROVED

## 1. Resumen

Los cinco hallazgos de la iteración 1 están corregidos. Los tests corregidos siguen probando su AC, y el test nuevo de AC-N004.1 cubre lo que pide el criterio. La corrección de F3 (`metricsRef`) resuelve el cierre obsoleto sin cambiar el comportamiento de REQ-005. Quedan solo hallazgos NIT, todos diferibles.

Comprobaciones propias: `vitest run` de `MetricsHistory.test.tsx`, `lib/dates.test.ts` y `app/sourceCleanup013.test.ts` (48 passed) y `pytest tests/test_services/test_source_cleanup_013.py` (5 passed). El verify full de `e1704c1` está en PASS: pytest 727, npm test 482, lint sin warnings nuevos, y tsc, build y ruff-new OK.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 a AC-001.5 | Sí (sin cambios desde la iteración 1) | `backend/services/number_validation.py`, `profile_service.py`; tests de servicio y de ruta |
| AC-002.1 | Sí; el test es más fuerte | `test_body_metric_routes.py:716-718`: ahora crea primero una medición de 80 kg y comprueba que `before` no está vacía, así que "la lista no cambia" compara una lista real (F4 resuelto) |
| AC-002.2 a AC-002.5 | Sí (sin cambios) | `body_metric_service.py` (`_validate_values` con `is_number`) |
| AC-003.1 a AC-003.3 | Sí (sin cambios) | `progress_analysis_context.py`; validación antes de `_check_rate_limit` |
| AC-004.1 a AC-004.7 | Sí (se conserva) | Marcadores comprobados a mano: `test_progress_analysis_service.py:795,801,807,818,824,830` (AC-004.1 a 004.6, en el orden de la spec) y `test_progress_analysis_routes.py:189` (AC-004.7) |
| AC-005.1, AC-005.3, AC-005.4 | Sí (sin cambios) | `MetricsHistory.tsx:112,125` (`setFailedFor(null)`), "Mostrar más" no toca `failedFor` |
| AC-005.2 | Sí | `MetricsHistory.tsx:151` (`failedFor === metrics`). Con F3, `onFailed` guarda la lista actual (`MetricsHistory.tsx:33-36,163`), así que un cambio de la lista *durante* la petición ya no oculta para siempre el aviso de un fallo posterior. Esto no contradice AC-005.2, que habla de cambios con el aviso ya visible |
| AC-N001.1, AC-N001.2, AC-N001.4 | Sí | `verify-report.md` §1 (`e1704c1`); el warning de `no-useless-escape` ya no aparece |
| AC-N001.3 | Sí | Los únicos tests preexistentes que tocan las correcciones son `test_body_metric_routes.py` (se **añaden** aserciones) y `MetricsHistory.test.tsx:685-688`, que es un test nuevo de esta spec (ver §4). Sin `skip`, `only` ni `todo` |
| AC-N002.1 a AC-N002.10 | Sí (sin cambios) | Ver iteración 1; `sourceCleanup013.test.ts:90` ahora escapa bien el punto (`"REQ-005 AC-005\\.1"`), así que la regex exige un `.` literal (F2 resuelto) |
| AC-N003.1, AC-N003.2 | Sí (sin cambios) | `test_source_cleanup_013.py`, `sourceCleanup013.test.ts` |
| AC-N003.3 | Sí | `frontend/src/lib/dates.test.ts:9,14-15,24-25,32`: "día", "fallaría", "está", "después", "quedaría" y "podría" (F1 resuelto). Los comentarios añadidos por `7e25d58` (`MetricsHistory.tsx:32`), por el test de F3 (`MetricsHistory.test.tsx:757`) y el docstring de `test_source_cleanup_013.py:114` están en español correcto |
| AC-N004.1 | Sí | `test_source_cleanup_013.py:112-127` (`SDD: 013 NFR-004 AC-N004.1`): localiza los 7 tests por nombre, lee la línea anterior a cada `def` y exige `fullmatch` con `# SDD: 013 REQ-004 AC-004\.\d+`. Eso garantiza `SDD: 013`, un AC de REQ-004 y que no se cita ningún marcador de la spec 010. Ver N1 |
| AC-N005.1 a AC-N005.3 | Sí (sin cambios) | `lib/testConsoleNoise.ts`, `vite.config.ts` |
| AC-N006.1 a AC-N006.3 | Pendiente (etapa docs) | `traceability_exception`; `CLAUDE.md` no está en el diff |

## 3. Cumplimiento del plan

Sin desviaciones nuevas. La corrección de F3 usa la segunda opción propuesta en la iteración 1 (un ref a la lista actual) y no cambia la forma de `failedFor` ni el contrato de `DeleteMetricDialog`. El ref se actualiza en un `useEffect`, que siempre se ha ejecutado cuando llega el rechazo de la petición (es asíncrono), así que no hay carrera práctica.

## 4. Checklist de la constitución
- [x] Art. 2: cada agente se mantuvo en su rol. `7e25d58` (implementer) solo toca `MetricsHistory.tsx` y `e1704c1` (verifier) solo `state.json` y `verify-report.md`. Los cambios de tests desde `commits.tests` (`a7636e8`) están todos en commits del test-author (`9d56d7e`, `0ab8421`) aprobados en su gate. No hay `tests_snapshot` en `state.json`; la integridad se comprobó con `git diff a7636e8 HEAD --stat` sobre `backend/tests` y `frontend/src`.
- [x] Art. 4: el test nuevo de AC-N004.1 lleva `SDD: 013 NFR-004 AC-N004.1`. El de F3 lleva `SDD: 013 NFR-001` sin AC (ver N3).
- [x] Art. 5: ningún test se ha debilitado. El `hidden: true` añadido en `MetricsHistory.test.tsx:687` pertenece a un test nuevo de esta spec (AC-005.2). Solo relaja la espera de que aparezca la fila nueva (el árbol puede seguir con `aria-hidden` mientras se cierra el diálogo de Radix), y la aserción que prueba el AC (`queryByText(DELETE_FAILED)` ausente) no cambia. El test de F3 usa una promesa controlada, falla con el código anterior (red check parcial PASS registrado en `state.json`) y prueba de verdad el cierre obsoleto, porque `handleDelete` captura el `onFailed` de la renderización en que se pulsó "Borrar".
- [x] Art. 6: capas y organización por feature intactas; sin llamadas HTTP nuevas.
- [x] Art. 6.4: sin cambios de modelos, así que no hace falta migración.
- [x] Art. 7: sin secretos ni endpoints nuevos.
- [x] Art. 6.10 / AC-N001.4: lint sin warnings nuevos.
- [x] Art. 6.11: sin textos visibles nuevos.

## 5. Hallazgos

Estado de los hallazgos de la iteración 1:

| # | Estado | Evidencia |
|---|---|---|
| F1 (MAYOR) | Resuelto | `frontend/src/lib/dates.test.ts:9,14-15,24-25,32`; las aserciones no cambian |
| F2 (MENOR) | Resuelto | `frontend/src/app/sourceCleanup013.test.ts:90` |
| F3 (MENOR) | Resuelto | `MetricsHistory.tsx:33-36,163` y test `MetricsHistory.test.tsx:739-765` |
| F4 (NIT) | Resuelto | `test_body_metric_routes.py:716-718` |
| F5 (NIT) | Resuelto | La línea en blanco doble ya no está antes del bloque de la spec 013 |

Hallazgos nuevos (todos NIT y diferibles; el contador de tests está en 3/3 y ninguno lo justifica):

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| N1 | NIT | `backend/tests/test_services/test_source_cleanup_013.py:103,125-127` | Coincide con la nota del verifier. Las dos aserciones del bucle sobre `SPEC_010_MARKERS` nunca pueden fallar si pasa el `fullmatch` de la línea 124, y la de la línea 127 es una condición enrevesada (`marker != … or forbidden != …`) que cuesta leer. Además, el test acepta cualquier `AC-004.x` y no comprueba que cada test cite **su** AC (por ejemplo, AC-004.1 para el cuerpo ausente). Lo he comprobado a mano y los 7 marcadores son correctos (§2). Se podría sustituir el bucle por un diccionario `nombre → AC esperado` y quitar `SPEC_010_MARKERS`. Diferible | test-author |
| N2 | NIT | `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx:685-688` | El objeto de opciones de `findByRole` quedó con una sangría incorrecta (las claves `name` y `hidden` están al nivel de `await` y la llave de cierre, a la izquierda). Es solo formato; lint no lo marca | test-author |
| N3 | NIT | `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx:739` | El test de F3 lleva `// SDD: 013 NFR-001`, sin AC. Lo que prueba es el aviso de REQ-005 (que se muestre ante un fallo aunque la lista haya cambiado durante la petición), así que se trazaría mejor como `SDD: 013 REQ-005 AC-005.2` o con un comentario que diga que es una regresión de la review. No afecta a la trazabilidad exigida (cada AC ya tiene su test) | test-author |
| N4 | NIT | `frontend/src/features/body-metrics/components/MetricsHistory.tsx:163` | Caso límite de la corrección de F3: si durante la petición la lista cambia **porque la medición que se intentaba borrar ya no está** (por ejemplo, se borró en otra pestaña) y la petición falla, se muestra el aviso aunque la fila ya no exista. Es muy improbable y ningún AC lo cubre. Si se quiere cerrar, `onFailed` podría comprobar que `metricsRef.current` sigue conteniendo `deleting.id` | implementer |

## 6. Decisión

**APPROVED.** No quedan hallazgos BLOQUEANTES ni MAYORES. F1 a F5 están resueltos y los tests corregidos siguen probando su AC. N1 a N4 son NIT y se pueden diferir al backlog de pulido sin otra iteración de tests ni de implement. La etapa docs debe completar T-046 (AC-N006.1 a AC-N006.3, fila "Métricas corporales" de `CLAUDE.md`), que sigue pendiente por diseño.
