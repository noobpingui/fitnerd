# Verify report 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-16T20:18:53.891Z · **Rama:** `feat/016-past-date-measurements` @ `4779ea7` (con cambios sin commit en tests: AC-007.6 y E501; producción fuera del árbol por stash temporal del orquestador) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q tests/test_routes/test_body_metric_routes.py tests/test_services/test_body_metric_service.py` (`backend`) | ❌ (rojo legítimo, esperado) | 173 passed, 3 failed. Los 3 fallos son AC-005.2 y fallan por aserción: `assert 201 == 400` (`test_post_rejects_a_date_367_days_ago_and_changes_nothing`) y `DID NOT RAISE ValidationError` (×2: `test_save_rejects_a_date_367_days_before_the_server`, `test_a_too_old_date_leaves_metrics_and_profile_untouched`). Los demás tests nuevos de regresión pasan en verde por diseño (plan §5). |
| frontend | `npx vitest run` sobre los 7 archivos de test nuevos o modificados con marcador `SDD: 016` (`frontend`) | ❌ (rojo legítimo, esperado) | 86 passed, 67 failed. Los 67 fallos son tests nuevos de la feature: `Error: not implemented` (esqueletos de `shiftIsoDate`, `laterWeightMetric`, `makeMetricRegistrationSchema`, `registrationPayload` y `RegisterMetricDialog`), elemento ausente (botón "Registrar medición", textos nuevos del subtítulo y del estado vacío, aviso de la página de perfil) y 1 aserción (`expected 1 to be greater than 1`, relectura del perfil tras guardar). Ningún error de sintaxis, import, configuración ni fixture. |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores de tipos (exit 0), también en los tests nuevos. |

Comandos no ejecutados en modo red (no aplica): `lint` / `lint_ratchet`, `build` y la suite completa de cada ámbito (se ejecutan en verify).

Comprobación de la etapa tests:
- Hash de los 9 archivos de test frente a `state.json.tests_snapshot` (con CRLF normalizado): coinciden los 9. No hay cambios de tests desde la aprobación del snapshot.
- Ningún test nuevo tiene `skip`, `xfail`, `.only`, `.skip`, `it.todo` ni `pytest.mark.skip` (búsqueda en `backend/tests` y `frontend/src`).
- Los esqueletos `(scaffold)` de T-001 a T-005 solo lanzan `not implemented` (frontend) o declaran constantes (backend, `_parse_recorded_at` sin cambios). Ninguno contiene lógica.
- Ningún error de sintaxis, de configuración, de fixture ni de import fuera del plan en los tests nuevos.

## 2. Trazabilidad
Parcial (modo red). Se comprueban los marcadores `SDD:` de los tests; el resto de la trazabilidad se evalúa en verify.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-005 | AC-005.2 | T-010, T-012 | `backend/tests/test_services/test_body_metric_service.py::test_save_rejects_a_date_367_days_before_the_server`, `::test_a_too_old_date_leaves_metrics_and_profile_untouched`; `backend/tests/test_routes/test_body_metric_routes.py::test_post_rejects_a_date_367_days_ago_and_changes_nothing` | ❌ rojo legítimo (aserción) |
| REQ-002 | AC-002.2, AC-002.3 | T-014, T-015, T-018 | `frontend/src/lib/dates.test.ts`, `frontend/src/features/body-metrics/schemas.test.ts`, `RegisterMetricDialog.test.tsx` | ❌ rojo legítimo (`not implemented`) |
| REQ-009 | AC-009.1, AC-009.3 | T-017, T-023 | `frontend/src/features/body-metrics/laterWeight.test.ts`, `ProfilePage.test.tsx` | ❌ rojo legítimo (`not implemented` / elemento ausente) |
| REQ-001 a REQ-010, NFR-001, NFR-002 (resto de AC) | 59 AC en total | Según `tasks.md` | Los 59 AC de `spec.md` aparecen en al menos un marcador `SDD: 016` | Ver §4 |

- AC sin test: ninguno (los 59 AC de `spec.md` aparecen en algún marcador `SDD: 016`).
- REQ sin tarea: no evaluado en modo red (se comprueba en verify).
- Tareas sin marcar `[x]`: no evaluado en modo red (se comprueba en verify). Ver observación en §4.
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno.

## 3. Criterios de aceptación manuales
Ninguno identificado en modo red. Los AC de la feature se comprueban con tests automáticos.

## 4. Fallos (si los hay)
Ninguno. Todos los tests nuevos fallan por comportamiento ausente, o pasan en verde por diseño según el plan §5:

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno | — | — |

Detalle de los rojos legítimos (esperados hasta la fase implement):
- Backend, AC-005.2: `assert 201 == 400` y `DID NOT RAISE ValidationError` (×2). Corresponde a T-030.
- Frontend: esqueletos sin implementar (`not implemented`), botón "Registrar medición" y textos nuevos ausentes en la página, aviso del perfil ausente y la relectura del perfil tras guardar (`ProfilePage.test.tsx`, AC-008.3). Corresponde a T-031 a T-037.

Observación (no es un fallo de red, no cambia el resultado): en el árbol de trabajo, `specs/016-past-date-measurements/tasks.md` tiene marcadas `[x]` las tareas de implementación T-030 a T-037, cuando su código no está en el árbol (stash temporal). Lo marcó la etapa implement; el orquestador debe revisarlo antes de verify.
