# Verify report 020 — Seguimiento de métricas corporales y configuración de producción

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-19T01:47:38.604Z · **Rama:** `feat/020-metrics-followups-prod-config` @ `9c0e2fa` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q {files}` (`backend`), con los 4 archivos nuevos (`test_clock.py`, `test_production_config.py`, `test_fixed_clock_routes.py`, `test_resend_email_routes.py`) | ⚠️ | 18 passed (caracterización aprobada, ver sección 4); 27 failed por `not implemented` o comportamiento ausente; 11 errores de fixture `app_clock` (esqueleto esperado) |
| backend | Mismo comando con los 2 archivos existentes modificados (`test_body_metric_routes.py`, `test_auth_routes.py`) | ⚠️ | 182 passed; 9 errores de fixture `app_clock` (esqueleto esperado) |
| backend | `lint_ratchet` | — | No se ejecuta en modo red |
| frontend | `npx vitest run {files}` (`frontend`), con los 6 archivos de test nuevos o modificados | ⚠️ | 83 tests: 36 failed, 47 passed. De los 47, 13 son nuevos y pasan sin implementación (caracterización aprobada, sección 4); los 34 restantes son tests ya existentes de `MetricsHistory.test.tsx` (el diff solo añade 5 `it` nuevos a ese archivo) |
| frontend | `lint`, `typecheck`, `build` | — | No se ejecutan en modo red |

Detalle de la salida (recortado):
- Backend, fallos legítimos: `NotImplementedError: not implemented` desde `utils/clock.py` (`utc_now`, `AdjustableClock`, `install_clock`, `get_app_clock`) y `config.py` (`resolve_frontend_base_url`); aserciones de comportamiento ausente (`DID NOT RAISE ValueError` con `FRONTEND_BASE_URL` vacía o `http://` en producción; `None == 'http://localhost:5173'` en desarrollo). Ninguna excepción de tipo `ImportError`, `SyntaxError` o de configuración.
- Backend, errores de fixture: los 20 errores nacen en `tests/conftest.py:204` (`app_clock`) → `utils/clock.py:36` (`get_app_clock`), que lanza `not implemented` (esqueleto esperado).
- Frontend, fallos legítimos: `Error: not implemented` (`historyReveal`, `RefreshFailedNotice`, `hooks`); `expected [...] to have a length of 26 but got 10`; avisos de relectura ausentes (`Guardamos tu medición…`, `Guardamos tus cambios…`, `role="alert"`). Ninguna excepción de sintaxis, import o fixture.

## 2. Trazabilidad
Modo red: solo se comprueba el estado de los tests nuevos. Resumen por REQ / NFR (AC según la matriz de `tasks.md`).

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.9 | T-022, T-023, T-024 | `RefreshFailedNotice.test.tsx`, `BodyMetricsPage.refresh.test.tsx` | ❌ falla legítimo; ⚠️ 4 tests de `BodyMetricsPage.refresh.test.tsx` pasan (caracterización aprobada). `RefreshFailedNotice.test.tsx` falla en sus 5 tests (`not implemented`), incluido «el componente renderizado muestra los textos de la spec», que ya no compara constantes |
| REQ-002 | AC-002.1 a AC-002.10 | T-022, T-027, T-028 | `PhysicalDataForm.refresh.test.tsx`, `RefreshFailedNotice.test.tsx` | ❌ falla legítimo; ⚠️ «un cambio solo de la meta…» pasa (caracterización aprobada) |
| REQ-003 | AC-003.1 a AC-003.5 | T-021, T-025, T-026 | `historyReveal.test.ts`, `MetricsHistory.test.tsx`, `BodyMetricsPage.refresh.test.tsx` | ❌ falla legítimo (`not implemented`, 10 filas en vez de 20/26); ⚠️ 7 tests pasan (caracterización aprobada) |
| REQ-004 | AC-004.1 a AC-004.3 | T-030 | `BodyMetricsPage.sync.test.tsx` | ⚠️ 5/5 pasan sin código nuevo (caracterización aprobada) |
| REQ-004 | AC-004.4 | T-017 | `test_body_metric_routes.py::test_profile_weight_follows_the_metric_with_the_latest_date_across_posts` | ❌ error de fixture `app_clock` (esqueleto esperado) |
| REQ-005 | AC-005.1 a AC-005.9 | T-011, T-013, T-014, T-016, T-018 | `test_clock.py`, `test_fixed_clock_routes.py`, `test_body_metric_routes.py`, `test_auth_routes.py` | ❌ falla o error legítimo (`not implemented`); ⚠️ los 182 tests existentes de esos archivos siguen en verde |
| REQ-006 | AC-006.1 a AC-006.6 | T-012 | `test_production_config.py` | ❌ falla legítimo en AC-006.1, .2, .3, .5; ⚠️ AC-006.4 y AC-006.6 pasan (caracterización aprobada) |
| REQ-007 | AC-007.1 a AC-007.8 | T-019, T-020 | `test_resend_email_routes.py` | ⚠️ los 10 tests pasan sin código nuevo (caracterización aprobada) |
| NFR-001 | AC-N001.1, AC-N001.2 | T-011, T-015 | `test_fixed_clock_routes.py`, `test_clock.py` | ❌ en `test_clock.py` (legítimo); ⚠️ 3 tests de `test_fixed_clock_routes.py` pasan (caracterización aprobada) |
| NFR-002 | AC-N002.1 | T-020 | `test_resend_email_routes.py` | ⚠️ pasa (caracterización aprobada) |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (modo red; las tareas de implementación T-040 a T-054 no se han hecho y se verifican en `verify`)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: — (escaneo del diff de `backend` y `frontend` sin coincidencias)

## 3. Criterios de aceptación manuales
- Modo red: no aplica. Los AC visuales o de UX se listan en el `verify-report` de la etapa verify.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | Caracterización (excepción aprobada por el usuario): 18 tests nuevos de backend pasan sin implementación: `test_production_config.py::test_the_required_message_and_the_default_match_the_spec`, `::test_production_app_starts_with_an_https_value`, `::test_development_app_keeps_a_value_that_is_not_https`, `::test_testing_app_always_uses_the_local_default`, `::test_testing_app_ignores_the_value_of_the_environment_variable`; `test_fixed_clock_routes.py::test_production_app_uses_the_real_utc_date`, `::test_development_app_uses_the_real_utc_date`, `::test_production_app_ignores_dates_and_times_sent_in_the_request`; y los 10 tests de `test_resend_email_routes.py`. Verificado: son exactamente estos 18 | `18 passed` en la ejecución de los 4 archivos nuevos | caracterización (excepción aprobada por el usuario, Art. B5.2 vía Art. B3). Anotado, no cuenta como fallo |
| 2 | Caracterización (excepción aprobada por el usuario): 13 tests nuevos de frontend pasan sin implementación: `historyReveal.test.ts` «el bloque del Historial es de 10 filas»; `MetricsHistory.test.tsx` «sin petición, o con la fecha ya visible, deja 10 filas» y «no pliega el Historial que el usuario ya desplegó»; `BodyMetricsPage.refresh.test.tsx` «si las relecturas van bien, no se ve el aviso», «si la fila nueva ya es visible…», «con el Historial ya desplegado (25 filas)…» y «si el registro falla, el Historial sigue con 10 filas»; 5 tests de `BodyMetricsPage.sync.test.tsx` (AC-004.1 a AC-004.3); y «un cambio solo de la meta guarda con 'Cambios guardados'…» en `PhysicalDataForm.refresh.test.tsx`. Verificado: son exactamente estos 13 | `Tests 36 failed | 47 passed` (los pasados no aparecen como fallo) | caracterización (excepción aprobada por el usuario, Art. B5.2 vía Art. B3). Anotado, no cuenta como fallo |
| 3 | Resuelto en esta repetición: `RefreshFailedNotice.test.tsx` «los textos coinciden con los de la spec» ya no pasa. El test-author lo ha reescrito como «el componente renderizado muestra los textos de la spec», que renderiza el componente y falla con `not implemented`. Los 5 tests de `RefreshFailedNotice.test.tsx` fallan de forma legítima | `Error: not implemented` (`RefreshFailedNotice.tsx`) | ninguno |
| 4 | Los 20 errores de fixture `app_clock` (11 en `test_fixed_clock_routes.py`, 4 en `test_body_metric_routes.py`, 5 en `test_auth_routes.py`) | `E NotImplementedError: not implemented` · `tests\conftest.py:204: in app_clock` → `utils\clock.py:36: in get_app_clock` | ninguno: es el esqueleto esperado (legítimo). Se anota por transparencia; no cuenta como fallo |

Los escaneos de esqueletos (`clock.py`, `config.py`, `historyReveal.ts`, `hooks.ts`, `RefreshFailedNotice.tsx`) siguen solo con `not implemented`. Correcto.

## Hallazgos para el backlog (no bloquean)
- El `app_clock` no es autouse; un test que fije el reloj sin pedir el fixture lo dejaría fijado. Hoy todos los tests que fijan el reloj lo piden.

## Comentarios del usuario

- Excepción al Art. B5.2 (red check, 31 tests que pasan sin implementación): "A"
  (Opción A: aceptarlos como tests de caracterización de comportamiento ya existente y dejar la excepción documentada.)
