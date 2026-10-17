# Verify report 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Modo:** full (etapa verify, tras corregir F8 de review)
- **Fecha:** 2026-10-17T02:55:22.236Z · **Rama:** `feat/016-past-date-measurements` @ `c4e57df` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Ámbitos tocados: backend, frontend. Los comandos a `null` no se listan.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 831 passed |
| backend | ratchet ruff: `lint-ratchet.mjs backend` (raíz) | ✅ | Sin violaciones nuevas respecto a main (`body_metric_service.py`, `test_body_metric_routes.py`, `test_body_metric_service.py` OK) |
| frontend | `npm test` (`frontend`) | ✅ | 47 archivos, 689 passed |
| frontend | `npm run lint` (`frontend`) | ✅ | 0 errores; 2 warnings previos fuera de la feature (`src/components/ui/form.tsx:159`, `src/components/ui/button.tsx:64`) |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores (exit 0) |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto (aviso habitual de chunk > 500 kB, no bloqueante) |

## 2. Trazabilidad

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1, AC-001.2 | T-020, T-036 | `BodyMetricsPage.register.test.tsx` | ✅ |
| REQ-001 | AC-001.3, AC-001.5, AC-001.6 | T-005, T-018, T-035 | `RegisterMetricDialog.test.tsx` | ✅ |
| REQ-001 | AC-001.4, AC-001.7 | T-018, T-035 | `RegisterMetricDialog.test.tsx`, `BodyMetricsPage.register.test.tsx:289` (test de F8) | ✅ |
| REQ-002 | AC-002.1 … AC-002.7 | T-003, T-014, T-015, T-018, T-031, T-032, T-035 | `dates.test.ts`, `schemas.test.ts`, `RegisterMetricDialog.test.tsx` | ✅ |
| REQ-003 | AC-003.1, AC-003.2, AC-003.3 | T-016, T-019, T-032 | `schemas.test.ts`, `RegisterMetricDialog.test.tsx` | ✅ |
| REQ-003 | AC-003.4, AC-003.9 | T-020, T-036 | `BodyMetricsPage.register.test.tsx` | ✅ |
| REQ-003 | AC-003.5, AC-003.6 | T-019, T-035 | `RegisterMetricDialog.test.tsx` | ✅ |
| REQ-003 | AC-003.7, AC-003.8 | T-010, T-013, T-030 | `test_body_metric_service.py`, `test_body_metric_routes.py` | ✅ |
| REQ-004 | AC-004.1, AC-004.2, AC-004.3 | T-019, T-035 | `RegisterMetricDialog.test.tsx` | ✅ |
| REQ-005 | AC-005.1 … AC-005.5 | T-001, T-010, T-012, T-030 | `test_body_metric_service.py`, `test_body_metric_routes.py` | ✅ |
| REQ-006 | AC-006.1 … AC-006.4, AC-006.6 | T-011, T-030 | `test_body_metric_service.py` | ✅ |
| REQ-006 | AC-006.5 | T-013, T-030 | `test_body_metric_routes.py` | ✅ |
| REQ-007 | AC-007.1, AC-007.3 … AC-007.7 | T-021, T-034 | `BodyMetricsPage.register.test.tsx` | ✅ |
| REQ-007 | AC-007.2 | T-022, T-034 | `BodyMetricsPage.analysis.test.tsx` | ✅ |
| REQ-008 | AC-008.1, AC-008.2, AC-008.4 | T-021, T-034 | `BodyMetricsPage.register.test.tsx` | ✅ |
| REQ-008 | AC-008.3 | T-023, T-034, T-037 | `ProfilePage.test.tsx` | ✅ |
| REQ-009 | AC-009.1 … AC-009.4 | T-017, T-023, T-033, T-037 | `laterWeight.test.ts`, `ProfilePage.test.tsx` | ✅ |
| REQ-009 | AC-009.5 | T-011, T-013, T-030 | `test_body_metric_service.py`, `test_body_metric_routes.py` | ✅ |
| REQ-010 | AC-010.1, AC-010.2 | T-020, T-036 | `BodyMetricsPage.register.test.tsx` | ✅ |
| NFR-001 | AC-N001.1, AC-N001.2 | T-013, T-030 | `test_body_metric_routes.py` | ✅ |
| NFR-002 | AC-N002.1 | T-005, T-019, T-035 | `RegisterMetricDialog.test.tsx` | ✅ |
| NFR-002 | AC-N002.2 | T-019, T-035 | `RegisterMetricDialog.test.tsx` | ✅ |

- Los 59 AC de `spec.md` tienen al menos un marcador `SDD: 016` y todos sus tests pasan (backend 831 passed, frontend 689 passed).
- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (27/27 marcadas)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: — (ninguno en `git diff main...HEAD`)
- Tests de la feature sin cambios desde su snapshot (`state.json.tests_snapshot`): sí. Los sha256 de los 9 archivos coinciden con el snapshot una vez normalizados los finales de línea (CRLF en el working tree de Windows). El último commit que toca tests es `ac42e38`.

## 3. Criterios de aceptación manuales
Ninguno. Todos los AC de la spec tienen comprobación automática en verde.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno | — | — |
