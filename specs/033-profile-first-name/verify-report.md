# Verify report 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

- **Modo:** red (tras la etapa tests, reaprobación del red check)
- **Fecha:** 2026-11-03T02:24:26.899Z · **Rama:** `feat/033-profile-first-name` @ `2f1242d` (cambios de tests sin commitear sobre `e9db40a`) · **Base:** `main`
- **Resultado:** PASS (reaprobado sobre el red check del commit `e9db40a`)

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q tests/test_services/test_auth_service.py` (`backend`) | ⚠️ | 62 passed. Solo informativo: la implementación ya está en la rama, así que el rojo no se puede repetir; se comprueba que el retiro de `clock=` de `make_service` no rompe nada (el constructor de `AuthService` aún tiene `clock=utc_now` por defecto, auth_service.py:36) |

Red check original: `e9db40a` («Add failing tests for 033-profile-first-name»), registrado en `state.json.history` el 2026-11-03T01:06:14Z como `red PASS`: backend 90 failed / 272 passed en 5 archivos (27 marcados en rojo por comportamiento ausente) y frontend 51 failed / 175 passed en 11 archivos (41 de 42 marcados en rojo); AC-003.1 pasa por la excepción B5.2 aprobada por el usuario.

### Comprobación de los cambios de tests desde `e9db40a`
`git diff e9db40a -- backend/tests frontend/src/**/*.test.* frontend/src/test` (working tree) solo contiene:
- **Líneas largas (E501, commit `b1e03ac` y reflow posterior):** `test_fixed_clock_routes.py` (firma de un test partida en varias líneas) y `test_auth_service.py` (lista de `parametrize` partida; los mismos 11 valores, mismo orden).
- **Helpers y payloads de registro sin `date_of_birth`:** `conftest.py`, `test_auth_routes.py`, `test_canonical_email_routes.py`, `test_food_library_routes.py`, `test_meal_library_routes.py`, `test_meal_routes.py`, `test_password_reset_routes.py`, `test_resend_email_routes.py` (se quita la clave del cuerpo de `POST /api/auth/register`); en `test_fixed_clock_routes.py` el helper `register_payload` ya no pone la fecha por defecto y solo la añade si se pasa.
- **Comentarios y docstrings:** `test_auth_service.py` (docstring de `test_register_validates_the_last_name_before_the_duplicate_check`, mismo assert) y `HomePage.test.tsx` (nota que apunta al marcador de AC-009.4 en `ProfilePage.test.tsx`; solo un comentario).
- **Dependencia `clock` fuera de `make_service` (F4, aprobado):** `test_auth_service.py` quita `FakeClock`, `NOW`, `datetime` y `clock=FakeClock(NOW)`. No hay assert afectado.

Comprobaciones sobre ese diff: no hay líneas de aserción modificadas ni eliminadas; ningún `date_of_birth` de aserción cambia (solo se retiran claves de payload); los marcadores `SDD: 033` no cambian; no aparecen `skip`, `xfail`, `.only` ni `.skip` nuevos. Ningún test de frontend cambió salvo el comentario de `HomePage.test.tsx`.

## 2. Trazabilidad
Esta pasada no vuelve a ejecutar la suite (modo red con implementación presente). Mapeo de referencia, de `tasks.md`:

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.4 | T-010, T-011, T-012, T-040 | `test_auth_routes.py`, `test_auth_service.py`, `test_fixed_clock_routes.py` | ✅ (red PASS en `e9db40a`) |
| REQ-002 | AC-002.1, AC-002.2 | T-021, T-050, T-051 | `RegisterForm.test.tsx`, `auth/schemas.test.ts` | ✅ (red PASS en `e9db40a`) |
| REQ-003 | AC-003.1 | T-022 | `OnboardingPage.test.tsx` (guarda de regresión, excepción B5.2 aprobada) | ✅ (pasa por excepción) |
| REQ-004 | AC-004.1 a AC-004.3 | T-013, T-023, T-025, T-042, T-052 | `test_profile_routes.py`, `profile/schemas.test.ts` | ✅ (red PASS en `e9db40a`) |
| REQ-005 | AC-005.1 a AC-005.4 | T-014, T-016, T-041 | `test_profile_routes.py`, `test_profile_service.py` | ✅ (red PASS en `e9db40a`) |
| REQ-006 | AC-006.1 a AC-006.4 | T-015, T-016, T-041 | `test_profile_routes.py`, `test_profile_service.py` | ✅ (red PASS en `e9db40a`) |
| REQ-007 | AC-007.1 a AC-007.8 | T-024, T-026, T-027, T-028, T-052, T-053 | `ProfilePage.test.tsx`, `mappers.test.ts`, `profile/schemas.test.ts`, `schemas.test.ts` | ✅ (red PASS en `e9db40a`) |
| REQ-008 | AC-008.1 a AC-008.6 | T-020, T-021, T-023, T-050 | `auth/schemas.test.ts`, `profile/schemas.test.ts`, `RegisterForm.test.tsx` | ✅ (red PASS en `e9db40a`) |
| REQ-009 | AC-009.1 a AC-009.4 | T-026, T-029 a T-033, T-054 | `greeting.test.ts`, `HomePage.test.tsx`, `ProfilePage.test.tsx`, `router.test.tsx`, `lazyRoutes.test.tsx`, `diaryRoute.test.tsx` | ✅ (red PASS en `e9db40a`) |

- AC sin test: ninguno en los marcadores.
- REQ sin tarea: ninguno.
- Tareas sin marcar `[x]`: ninguna en `tasks.md` (T-028 figura como hecha sin cambios de archivo; ver observaciones).
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno.

## 3. Criterios de aceptación manuales
Los AC de texto y estructura están cubiertos por tests automáticos. Conviene que el usuario compruebe en el navegador:
- AC-007.1 y AC-007.8: el aspecto visual del campo «Nombre» como primer campo de «Datos personales» en `/profile`.
- AC-009.4: que tras guardar un nombre en `/profile` y navegar a `/home` sin recargar, el saludo se actualiza en la app real.
- AC-003.1: que una cuenta nueva ve la fecha vacía en `/onboarding` y no avanza sin fecha válida (el test pasa en jsdom, no en navegador).

## 4. Fallos (si los hay)
Ninguno.

Nota sobre F4: la reaprobación esperaba un `TypeError` en `test_auth_service.py` al quitar `clock=` de `make_service`. No ocurre: `AuthService.__init__` conserva `clock=utc_now` por defecto (`backend/services/auth_service.py:36`) y el archivo pasa 62/62. Retirar `clock` de `AuthService` sigue siendo una limpieza pendiente de implement (review F4), no un requisito para el rojo.

## Observaciones (no bloquean; van al backlog de la feature)
- `tasks.md` marca T-028 como hecha, pero `frontend/src/features/profile/components/PhysicalDataForm.refresh.test.tsx` no aparece en el diff (review F1).
- El marcador `SDD: 033` de AC-009.4 está en `ProfilePage.test.tsx` (review F3; el comentario añadido en `HomePage.test.tsx` lo referencia).
- Los helpers de registro del backend que aún envían `date_of_birth` ya no se han retirado en su totalidad: el cambio de `e9db40a` quitó la clave en los archivos listados; cualquier resto es inocuo (review F5).

## Resultado de la etapa
PASS (red). Los tests nuevos de `e9db40a` fallan por comportamiento ausente (backend 90 y frontend 51, con AC-003.1 por excepción B5.2 aprobada). Desde `e9db40a` solo cambian líneas largas, helpers y payloads de registro sin `date_of_birth`, comentarios y la retirada de `clock` de `make_service`; no hay cambios de aserciones ni skips. Reaprobado por decisión del usuario (opción 1).
