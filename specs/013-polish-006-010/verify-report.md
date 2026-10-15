# Verify report 013 — Pulido del código y la documentación de las features 006 a 010

- **Modo:** full (tras la etapa implement) · **Iteración de verify:** 3/3 (tras la corrección de review, F3 en `7e25d58`)
- **Fecha:** 2026-10-15T22:21:12.176Z · **Rama:** `fix/013-polish-006-010` @ `7e25d58`
- **Resultado:** FAIL

Excepciones vigentes en state.json: `red_check_exception`, `traceability_exception` (AC-N006.1 a AC-N006.3, AC-N001.1, AC-N001.2, AC-N001.3, AC-N001.4, AC-N003.3) y `tasks_checkbox_exception` (T-046).

## 1. Comandos ejecutados
| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `backend/.venv/Scripts/python.exe -m pytest -q` | ✅ | 726 passed (Postgres en 5433) |
| backend | `node .claude/sdd/scripts/ruff-new.mjs main` | ✅ | sin violaciones nuevas en los 12 .py cambiados (exit 0) |
| frontend | `npm test` | ✅ | 41 files, 482 passed (antes 481; el test nuevo de F3 suma 1). Salida sin "VITE_GOOGLE_CLIENT_ID no esta configurado", sin aviso de Recharts `width(0)`/`height(0)` y sin líneas de stderr |
| frontend | `npm run lint` | ✅ | 0 errores. 2 warnings preexistentes en `components/ui/form.tsx:159` y `components/ui/button.tsx:64`. El warning de `sourceCleanup013.test.ts:90` de la iteración anterior ya no aparece |
| frontend | `npx tsc -b` | ✅ | exit 0, sin salida |
| frontend | `npm run build` | ✅ | exit 0 (aviso de tamaño de chunk preexistente) |

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD: 013` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a 001.3 | T-001, T-008 | `test_profile_service.py` (628–646), `test_profile_routes.py` (427–453) | ✅ |
| REQ-001 | AC-001.4 | T-002, T-009 | `test_profile_service.py:646`, `test_profile_routes.py:466` | ✅ |
| REQ-001 | AC-001.5 | T-010 | `test_profile_routes.py:479` | ✅ |
| REQ-002 | AC-002.1 a 002.4 | T-003, T-004, T-011, T-012 | `test_body_metric_service.py` (793–811), `test_body_metric_routes.py` (712–745) | ✅ |
| REQ-002 | AC-002.5 | T-013 | `test_body_metric_routes.py:767` | ✅ |
| REQ-003 | AC-003.1 a 003.3 | T-005, T-015 | `test_progress_analysis_service.py` (1128–1153), `test_progress_analysis_routes.py:331` | ✅ |
| REQ-004 | AC-004.1 a 004.6 | T-006, T-033 | `test_progress_analysis_service.py` (795–830) | ✅ |
| REQ-004 | AC-004.7 | T-016 | `test_progress_analysis_routes.py:189` | ✅ |
| REQ-005 | AC-005.1 a 005.4 | T-017, T-018, T-019 | `MetricsHistory.test.tsx` (664–726) | ✅ |
| NFR-001 | AC-N001.1, AC-N001.2, AC-N001.4 | comandos (exención) | pytest 726 passed, npm test 482 passed, lint/tsc/build/ruff-new OK | ✅ |
| NFR-001 | AC-N001.3 | exención (reviewer sobre el diff) | — | manual (reviewer) |
| NFR-002 | AC-N002.1 | T-020, T-022, T-028 | `lib/dates.test.ts:8,29`, `app/sourceCleanup013.test.ts:36,43` | ✅ |
| NFR-002 | AC-N002.2 a 002.4, 002.6 a 002.8, 002.10 | T-023, T-025, T-028 | `app/sourceCleanup013.test.ts` (57–129) | ✅ |
| NFR-002 | AC-N002.5 | T-021, T-022, T-028 | `body-metrics/insights.test.ts:704` (`SDD: 013 NFR-002 AC-N002.5`), `sourceCleanup013.test.ts:76,88`; marcadores 009 `SDD: REQ-005 AC-005.1` vigentes | ✅ |
| NFR-002 | AC-N002.9 | T-007 | `backend/tests/test_services/test_source_cleanup_013.py:38,44` | ✅ |
| NFR-003 | AC-N003.1 | T-007, T-014 | `test_source_cleanup_013.py:65` | ✅ |
| NFR-003 | AC-N003.2 | T-007, T-028 | `test_source_cleanup_013.py:81`, `sourceCleanup013.test.ts:141` | ✅ |
| NFR-003 | AC-N003.3 | exención (reviewer sobre el diff) | — | manual (reviewer) |
| NFR-004 | AC-N004.1 | T-006, T-016 | Ningún test lleva `SDD: 013 NFR-004 AC-N004.1`; ver §3 y §4 | ❌ |
| NFR-005 | AC-N005.1, AC-N005.2 | T-026, T-044, T-045 | `lib/testConsoleNoise.test.ts:13,18,28`; salida de `npm test` limpia | ✅ |
| NFR-005 | AC-N005.3 | T-027, T-045 | `auth/components/GoogleSignInButton.test.tsx:14` (comprobación en navegador: manual) | ✅ (test) / manual (navegador) |
| NFR-006 | AC-N006.1 a 006.3 | exención `traceability_exception` (T-046) | Pendiente: la escribe el doc-keeper en la etapa docs | manual (orquestador, gate de docs) |

- **REQs sin tarea:** —
- **NFR sin tarea:** —
- **Tareas sin marcar `[x]`:** T-046 (única; exenta por `tasks_checkbox_exception`, se completa en la etapa docs).
- **Skips nuevos:** ninguno (`.skip`, `.only`, `.todo`, `xfail`, `pytest.mark.skip` no aparecen en las líneas añadidas del diff).
- **Marcadores de la spec 010 que citaban IDs ajenos (AC-N004.1):** ninguno en los 7 tests de validación del cuerpo del análisis. Los `REQ-002 AC-002.1` y `NFR-001 AC-N001.1` que quedan en `test_progress_analysis_service.py` (líneas 343 y 732) pertenecen a tests de indicadores e identificadores, no de validación.

## 3. Criterios de aceptación
- **AC-N004.1 (NFR-004):** el contenido se cumple. Los 6 tests de validación del servicio llevan `SDD: 013 REQ-004 AC-004.1` a `AC-004.6` (líneas 795–830) y el de la ruta lleva `SDD: 013 REQ-004 AC-004.7` (línea 189). Pero la regla de trazabilidad exige que el AC aparezca en un marcador `SDD: NNN` de un test, y ningún test lleva `NFR-004 AC-N004.1`. El AC describe el marcador en sí, así que no hay test que lo compruebe. Ver §4.
- **AC-N002.9:** "Usuario no encontrado" está definido una sola vez (`backend/services/profile_service.py:23`), y la tupla de estados con ritmo una sola vez (`backend/services/calorie_suggestion.py:18`).
- **AC-N002.3 y AC-N002.7:** no hay `as Record<string, string>` en `calculations.test.ts`, ni `as Insights` ni `as unknown as` en `insightsView.ts` ni en su test. Las coincidencias de `as unknown as` que quedan están en otros archivos fuera del alcance de AC-N002.7.
- **AC-N002.5:** no hay `isWithinLastMonths` en `frontend/src`. El test sustituto lleva `SDD: 013 NFR-002 AC-N002.5` y el marcador 009 `SDD: REQ-005 AC-005.1` sigue en los archivos previstos.
- **AC-N003.2:** no hay "prolijo" en `progress_analysis_service.py`, ni "tecnicos" ni "se envia" en `ProgressAnalysis.tsx` ni en `api.ts`. Hay "prolijo" en `coach_service.py`, pero ese archivo no está en el alcance de la spec.
- **AC-N005.3:** el test de Vitest cubre la comprobación. Lo que se ve en el navegador (botón ausente y aviso en consola) requiere revisión manual.
- **AC-N006.1 a AC-N006.3 (`CLAUDE.md`):** comprobación manual pendiente del orquestador en el gate de docs. La fila "Métricas corporales" sigue sin dividir porque T-046 está en la etapa docs.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable |
|---|---|---|---|
| 1 | AC-N004.1 no aparece en ningún marcador `SDD: 013`. La regla del `CLAUDE.md` (Art. 4.3) exige que cada AC esté cubierto por un test con marcador. La tarea T-006 lista AC-N004.1, pero el test-author no lo añadió a ningún marcador. El resultado de la comprobación anterior ("✅ por los 7 tests") no cumple la regla literal. | `grep -rn "N004" backend/tests frontend/src` → solo `CoachFeedbackButtons.test.tsx:50` (`NFR-004 AC-N004.1`, de otra spec). | test-author |

Qué se puede hacer: añadir un test de recorrido de fuente en `backend/tests/test_services/test_source_cleanup_013.py` con marcador `# SDD: 013 NFR-004 AC-N004.1` que compruebe que los tests de validación del cuerpo del análisis llevan `SDD: 013 REQ-004 AC-004.x` y ninguno de los IDs prohibidos. O bien que el orquestador decida una exención en `traceability_exception`. Esa decisión es del usuario, no del verifier.

Notas sin impacto en el resultado:
- Los 2 warnings de `npm run lint` son preexistentes (`components/ui/`). No hay warnings nuevos.
- El test nuevo de F3 (`MetricsHistory.test.tsx:739`) lleva `SDD: 013 NFR-001` según la instrucción de la verificación. No cita un AC concreto.
- Siguen pendientes de la etapa docs: T-046 (`CLAUDE.md`) y las comprobaciones manuales de AC-N006.x. Los AC manuales del reviewer (AC-N001.3, AC-N003.3) siguen en su gate.
