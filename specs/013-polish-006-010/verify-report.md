# Verify report 013 — Pulido del código y la documentación de las features 006 a 010

- **Modo:** red (tras la etapa tests) · **Iteración de tests:** 2/3
- **Fecha:** 2026-10-15T20:48:43.083Z · **Rama:** `fix/013-polish-006-010` @ `9cc1bcb`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `backend/.venv/Scripts/python.exe -m pytest -q` sobre los 34 tests con marcador `SDD: 013` (7 archivos; Postgres en 5433 respondió) | ⚠️ | 34 tests: 24 fallan por comportamiento ausente y 10 pasan (los 10 están en `red_check_exception`) |
| frontend | `npx vitest run` sobre los 6 archivos con marcador `SDD: 013` (24 tests) | ⚠️ | 24 tests: 15 fallan por comportamiento ausente o `not implemented`, y 9 pasan (los 9 están en `red_check_exception`) |

Comandos no ejecutados en modo red (no aplican): `npm test` completo, lint, `tsc -b`, `build`, ruff-new.

## 2. Trazabilidad (modo red)
Solo informativa en este modo. Los AC sin test automático están en `traceability_exception` de `state.json`.

- Scaffold `frontend/src/lib/testConsoleNoise.ts`: solo lanza `Error("not implemented")` con `_log` prefijado. Cumple ADR-0012 y Art. 5.7.
- Fallos del backend: `assert 500 == 400` y `OverflowError` lanzado desde `profile_service.py`, `progress_analysis_context.py` o `body_metric_service.py`; `assert 2 == 1` (duplicados de `PACE_STATUSES_WITH_RATE` y "Usuario no encontrado"); `'prolijo' is contained here` (wording). Todos son rojo legítimo. No hay `SyntaxError`, `ModuleNotFoundError` ni errores de fixture.
- Fallos del frontend: `Error: not implemented` (scaffold) y `expect(...).not.toBeInTheDocument()`, `expected ... to contain ...`, `expected ... not to match ...`, `expected true to be false` (código de producción sin cambiar). Todos son rojo legítimo.
- Tareas sin marcar `[x]`: T-030 a T-046 (fase B y docs; esperado en esta etapa).

## 3. Criterios de aceptación (estado en red)
"Excepción" = listado en `red_check_exception` de `state.json`.

| AC | Test(s) | Estado | Motivo |
|---|---|---|---|
| AC-001.1 a 001.4 | `test_profile_service.py`, `test_profile_routes.py` | ❌ rojo legítimo | `OverflowError` / `500 == 400` |
| AC-001.5 | `test_put_with_a_5000_digit_weight_returns_400_and_never_500` | ✅ pasa | Excepción |
| AC-002.1 a 002.4 | `test_body_metric_service.py`, `test_body_metric_routes.py` | ❌ rojo legítimo | `OverflowError` / `500 == 400` |
| AC-002.5 | `test_post_with_a_5000_digit_weight_is_400_and_never_500` | ✅ pasa | Excepción |
| AC-003.1 a 003.3 | `test_progress_analysis_service.py`, `test_a_huge_integer_rate_is_bad_request_even_with_the_quota_exhausted` | ❌ rojo legítimo | `OverflowError` / `500 == 400` |
| AC-004.1 a 004.6 | 6 tests de validación del servicio | ✅ pasa | Excepción (AC-004.*) |
| AC-004.7 | `test_an_invalid_body_returns_bad_request_and_creates_no_row` | ✅ pasa | Excepción (AC-004.*) |
| AC-005.1 | `MetricsHistory.test.tsx` "Corregir en otra fila" | ❌ rojo legítimo | El aviso sigue visible |
| AC-005.2 | 2 tests de `MetricsHistory.test.tsx` (lista que gana una medición; medición borrada ya no está) | ❌ rojo legítimo | El aviso sigue visible |
| AC-005.3, 005.4 | `MetricsHistory.test.tsx` "Borrar" y "Mostrar más" | ✅ pasa | Excepción |
| AC-N002.1 | `dates.test.ts` (2 tests movidos) | ✅ pasa | Excepción (añadida en la iteración 1) |
| AC-N002.1 | `sourceCleanup013.test.ts` ("dateUtils.ts no reexporta…", "ningún archivo importa…") | ❌ rojo legítimo | Reexportación e imports presentes |
| AC-N002.2 | `sourceCleanup013.test.ts` "tipo explícito" | ❌ rojo legítimo | Falta la anotación |
| AC-N002.3 | `sourceCleanup013.test.ts` "no usa casts" | ✅ pasa | Excepción |
| AC-N002.4 | `sourceCleanup013.test.ts` "reutiliza la conversión de altura" | ❌ rojo legítimo | Conversión propia presente |
| AC-N002.5 | Test sustituto de `insights.test.ts` ("incluye una medición de exactamente un mes atrás…") | ✅ pasa | Excepción |
| AC-N002.5 | `sourceCleanup013.test.ts` "siguen existiendo los marcadores REQ-005 AC-005.1 de la spec 009" | ✅ pasa | Excepción (añadida en la iteración 1) |
| AC-N002.5 | `sourceCleanup013.test.ts` "no queda ninguna referencia a la función sin uso" | ❌ rojo legítimo | `isWithinLastMonths` aún existe |
| AC-N002.6 | `sourceCleanup013.test.ts` "comentario de la tendencia" | ❌ rojo legítimo | Comentario en otro sitio |
| AC-N002.7 | `sourceCleanup013.test.ts` "insightsView y su test no usan casts" | ❌ rojo legítimo | Quedan `as Insights` / `as unknown as` |
| AC-N002.8 | `sourceCleanup013.test.ts` "rate ... una sola vez" | ❌ rojo legítimo | Comprobación repetida (3 veces) |
| AC-N002.9 | `test_source_cleanup_013.py` ("Usuario no encontrado" y lista de estados con ritmo) | ❌ rojo legítimo | Definiciones duplicadas (2 y 2) |
| AC-N002.10 | `sourceCleanup013.test.ts` "renderLoaded" | ✅ pasa | Excepción |
| AC-N003.1 | `test_body_metric_routes_test_docstrings_have_their_accents` | ✅ pasa | Excepción |
| AC-N003.2 | `test_progress_analysis_service_has_no_regional_wording` y `sourceCleanup013.test.ts` ("palabras sin tilde") | ❌ rojo legítimo | "prolijo", "tecnicos", "se envia" presentes |
| AC-N004.1 | Marcadores de los tests de validación | — | Sin test propio; cubierto por los tests de §3 |
| AC-N005.1, 005.2 | `testConsoleNoise.test.ts` (3 tests) | ❌ rojo legítimo | `Error: not implemented` del scaffold |
| AC-N005.3 | `GoogleSignInButton.test.tsx` | ✅ pasa | Excepción |
| AC-N006.1 a 006.3 | `CLAUDE.md` (exención de trazabilidad) | — | Lo escribe el doc-keeper en docs |

## 4. Fallos (si los hay)
Ninguno fuera de la excepción. Los dos fallos de la iteración 1 (F1: tests de `dates.test.ts` y F2: marcadores 009 en `sourceCleanup013.test.ts`) quedan cubiertos por la ampliación de `red_check_exception` aprobada por el usuario.

| # | Qué falló | Salida relevante (recortada) | Responsable probable |
|---|---|---|---|
| — | Ninguno | — | — |

Nota: el JSON de Vitest reporta `numFailedTestSuites: 6` aunque solo 3 de los 6 archivos tienen tests fallidos (`testConsoleNoise`, `sourceCleanup013`, `MetricsHistory`). Es un recuento del reporter, no afecta al resultado: los 15 tests fallidos son los esperados.

## 5. Entorno
- Postgres en 5433: respondió (los tests de rutas se ejecutaron).
- `.venv` y `node_modules`: presentes.
- `backend/services/number_validation.py` no existe todavía: esperado en fase B. Ningún test lo importa.
