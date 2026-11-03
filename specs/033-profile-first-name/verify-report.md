# Verify report 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-11-03T01:04:58.488Z · **Rama:** `feat/033-profile-first-name` @ `41af941` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Modo red: solo se ejecutan los tests nuevos o adaptados (archivos con marcador `SDD: 033`). Lint, typecheck y build no aplican en este modo.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` sobre los 5 archivos con marcador `SDD: 033` (`backend`) | ⚠️ rojo esperado | 90 failed, 272 passed (362). Los 90 fallos son rojo legítimo (sección 4). Los 272 pasan incluyen tests ya existentes de esos archivos. Los 27 marcadores `SDD: 033` fallan todos. |
| frontend | `npx vitest run` sobre los 11 archivos con marcador `SDD: 033` (`frontend`) | ⚠️ rojo esperado | 51 failed, 175 passed (226). De los 42 marcadores `SDD: 033`, 41 fallan por comportamiento ausente. AC-003.1 pasa por la excepción aprobada (ver sección 4). |
| backend | lint, typecheck, build | — | `null` en la config: no aplican |
| frontend | lint, typecheck, build | — | No se ejecutan en modo red |

Esqueletos (Art. B5.6), comprobados a mano en `frontend/src/features/home/greeting.ts`, `frontend/src/features/auth/schemas.ts` y `frontend/src/features/profile/mappers.ts`:
- `homeGreeting`, `firstNameMessage` y `payloadFromProfileForm` lanzan `new Error("not implemented")`, sin lógica y con parámetros prefijados con `_`. Correcto.
- `firstNameSchema` solo delega en `firstNameMessage`; las constantes tienen los valores de la spec. Correcto.
- Tipos andamiados en `frontend/src/features/profile/types.ts` (`first_name`, `firstName`, `ProfileFormErrorKey`). Correcto.
- Backend: no había símbolos de andamiaje (lo indica `tasks.md`).

Comprobaciones del rojo:
- No hay errores de sintaxis, de import, de configuración ni de fixture en los archivos de test nuevos o adaptados.
- Backend: el helper `register` de `test_auth_service.py` llama a `AuthService.register` con 4 argumentos y el servicio actual exige 5 (`missing 1 required positional argument: 'date_of_birth'`). Es la firma que fija el plan; el fallo es comportamiento ausente y no un error del test.
- Ninguna aserción del test depende de un fallo de fixture. Los errores `ValueError` de `date_of_birth_rules.py` salen al procesar `"2001-02-30"` en el código actual y se convierten en `ValidationError` en la cadena de excepciones. El test falla por aserción.

## 2. Trazabilidad
Estado de cada AC en modo red. «Rojo» significa que el test con su marcador falla en el comportamiento que prueba.

| REQ / NFR | AC | Tareas | Tests con `SDD: 033` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-011, T-040 | `test_auth_routes.py::test_register_without_a_date_of_birth_creates_the_account`; `test_auth_service.py::test_register_creates_the_account_without_a_date_of_birth` | ✅ rojo |
| REQ-001 | AC-001.2 | T-010, T-011, T-040 | `test_auth_routes.py::test_register_ignores_a_valid_date_of_birth`; `test_auth_service.py::test_register_from_body_ignores_the_date_of_birth` | ✅ rojo |
| REQ-001 | AC-001.3 | T-010, T-011, T-012, T-040 | `test_auth_routes.py::test_register_ignores_an_invalid_date_of_birth`, `test_register_ignores_a_date_of_birth_tomorrow`; `test_fixed_clock_routes.py` (2 tests) | ✅ rojo |
| REQ-001 | AC-001.4 | T-010, T-040 | `test_auth_routes.py::test_register_without_first_name_and_date_of_birth_is_rejected` | ✅ rojo |
| REQ-002 | AC-002.1 | T-021, T-051 | `RegisterForm.test.tsx::no muestra «Fecha de nacimiento» y sí Nombre, Apellido, Email y Password` | ✅ rojo |
| REQ-002 | AC-002.2 | T-021, T-050, T-051 | `RegisterForm.test.tsx::envía una sola petición con email, password, first_name y last_name y sin date_of_birth` | ✅ rojo |
| REQ-003 | AC-003.1 | T-022 | `OnboardingPage.test.tsx::una cuenta nueva (sin fecha ni nombre) ve la fecha vacía y no avanza hasta una fecha válida` | ⚠️ pasa por excepción aprobada (ver sección 4) |
| REQ-004 | AC-004.1 | T-013, T-023, T-025 | `test_profile_routes.py::test_get_returns_the_saved_first_name`; `profile/schemas.test.ts::la respuesta conserva first_name` | ✅ rojo |
| REQ-004 | AC-004.2 | T-013, T-023, T-025 | `test_profile_routes.py::test_get_returns_a_null_first_name_for_an_account_without_one`; `profile/schemas.test.ts::la respuesta sin la clave first_name la deja en null` | ✅ rojo |
| REQ-004 | AC-004.3 | T-013 | `test_profile_routes.py::test_put_response_includes_the_stored_first_name` | ✅ rojo |
| REQ-005 | AC-005.1 | T-014, T-016 | `test_profile_routes.py::test_put_saves_the_first_name_trimmed`; `test_profile_service.py::test_save_profile_stores_the_first_name_trimmed` | ✅ rojo |
| REQ-005 | AC-005.2 | T-014, T-016 | `test_profile_routes.py::test_put_without_first_name_keeps_the_stored_one`; `test_profile_service.py::test_save_profile_without_first_name_does_not_touch_the_stored_name` | ✅ rojo |
| REQ-005 | AC-005.3 | T-014 | `test_profile_routes.py::test_put_without_first_name_keeps_an_account_without_name_nameless` | ✅ rojo |
| REQ-005 | AC-005.4 | T-014 | `test_profile_routes.py::test_put_accepts_a_first_name_of_100_characters_surrounded_by_spaces` | ✅ rojo |
| REQ-006 | AC-006.1 | T-015, T-016 | `test_profile_routes.py::test_put_rejects_an_empty_or_non_text_first_name`; `test_profile_service.py::test_rejects_an_invalid_first_name_without_commit` | ✅ rojo |
| REQ-006 | AC-006.2 | T-015 | `test_profile_routes.py::test_put_rejects_a_first_name_of_101_characters` | ✅ rojo |
| REQ-006 | AC-006.3 | T-015, T-016 | `test_profile_routes.py::test_put_validates_the_first_name_before_the_physical_data`; `test_profile_service.py::test_validates_the_first_name_before_the_birth_date` | ✅ rojo |
| REQ-006 | AC-006.4 | T-015 | `test_profile_routes.py::test_put_rejects_a_first_name_of_300_characters_without_a_server_error` | ✅ rojo |
| REQ-007 | AC-007.1 | T-027, T-053 | `ProfilePage.test.tsx::muestra el campo «Nombre» con el nombre de la cuenta` | ✅ rojo |
| REQ-007 | AC-007.2 | T-027, T-053 | `ProfilePage.test.tsx::sin nombre el campo está vacío, con el aviso «El nombre es obligatorio», y el resto se puede usar` | ✅ rojo |
| REQ-007 | AC-007.3 | T-024, T-026, T-027, T-028, T-053 | `ProfilePage.test.tsx::al cambiar solo el nombre a «Beatriz» envía el perfil con first_name y no registra medición`; `mappers.test.ts::payloadFromAnswers (el del onboarding) no lleva first_name` | ✅ rojo (ambos) |
| REQ-007 | AC-007.4 | T-024, T-027, T-052, T-053 | `ProfilePage.test.tsx::«  Beatriz  » se envía como «Beatriz»`; `mappers.test.ts::recorta first_name y conserva el resto del cuerpo de payloadFromAnswers` | ✅ rojo |
| REQ-007 | AC-007.5 | T-023, T-027, T-052, T-053 | `ProfilePage.test.tsx::con el nombre "" aparece «El nombre es obligatorio»…`; `profile/schemas.test.ts::un nombre vacío o de solo espacios da 'El nombre es obligatorio'` | ✅ rojo |
| REQ-007 | AC-007.6 | T-023, T-027, T-052, T-053 | `ProfilePage.test.tsx::con 101 caracteres aparece el aviso de longitud…`; `profile/schemas.test.ts::un nombre de 101 caracteres da el mensaje de longitud` | ✅ rojo |
| REQ-007 | AC-007.7 | T-027, T-053 | `ProfilePage.test.tsx::«Descartar» devuelve el nombre a «Ana»` | ✅ rojo |
| REQ-007 | AC-007.8 | T-027, T-053 | `ProfilePage.test.tsx::la sección se titula «Datos personales», conserva su descripción y «Nombre» va antes que «Género»` | ✅ rojo |
| REQ-008 | AC-008.1 | T-020, T-050 | `auth/schemas.test.ts::«  Ana  » es válido y el valor resultante es «Ana»` | ✅ rojo |
| REQ-008 | AC-008.2 | T-020, T-023, T-050 | `auth/schemas.test.ts::"" no es válido: «El nombre es obligatorio»`; `auth/schemas.test.ts::"   " no es válido: «El nombre es obligatorio»` | ✅ rojo |
| REQ-008 | AC-008.3 | T-020, T-023, T-050 | `auth/schemas.test.ts::100 caracteres rodeados de espacios son válidos y 101 no`; `profile/schemas.test.ts::un nombre de 100 caracteres rodeado de espacios es válido` | ✅ rojo (ambos) |
| REQ-008 | AC-008.4 | T-020, T-050 | `auth/schemas.test.ts::cuenta emojis como un carácter: 100 son válidos y 101 no` | ✅ rojo |
| REQ-008 | AC-008.5 | T-021, T-050 | `RegisterForm.test.tsx::un nombre «   » muestra «El nombre es obligatorio» y no envía la petición`; `RegisterForm.test.tsx::un nombre de 101 caracteres muestra el mensaje de longitud y no envía la petición` | ✅ rojo |
| REQ-008 | AC-008.6 | T-021, T-050 | `RegisterForm.test.tsx::con nombre y apellido vacíos muestra cada mensaje y no envía la petición` | ✅ rojo |
| REQ-009 | AC-009.1 | T-029, T-030, T-031, T-032, T-033, T-054 | `greeting.test.ts::saluda con el nombre y una coma`; `HomePage.test.tsx::el encabezado principal dice «Hola de nuevo, Ana» con first_name «Ana»`; `router.test.tsx`, `lazyRoutes.test.tsx` y `diaryRoute.test.tsx` (h1 «Hola de nuevo, Ana») | ✅ rojo |
| REQ-009 | AC-009.2 | T-029, T-030, T-054 | `greeting.test.ts::sin nombre (null) saluda sin coma ni nombre`; `HomePage.test.tsx::con first_name null dice «Hola de nuevo» sin coma ni nombre` | ✅ rojo (ambos) |
| REQ-009 | AC-009.3 | T-029, T-030, T-054 | `greeting.test.ts::con un nombre de solo espacios saluda sin coma ni nombre`; `HomePage.test.tsx::con first_name de solo espacios dice «Hola de nuevo»` | ✅ rojo (ambos) |
| REQ-009 | AC-009.4 | T-026, T-030, T-054 | `ProfilePage.test.tsx::tras guardar «Beatriz», /home saluda «Hola de nuevo, Beatriz» sin otra lectura del perfil` | ✅ rojo |

- AC sin test: ninguno. Los 36 AC de `spec.md` tienen al menos un test con marcador `SDD: 033` (se comprueba por texto en modo red, no por la ejecución).
- REQ sin tarea: no se comprueba en modo red.
- Tareas sin marcar `[x]`: no se comprueba en modo red. T-040 a T-054 están pendientes, como corresponde a esta etapa.
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: no se comprueba en modo red.

## 3. Criterios de aceptación manuales
No aplica en modo red. Los AC visuales o de UX se revisarán en la etapa verify.

## 4. Fallos (si los hay)
Ningún test con marcador `SDD: 033` pasa sin implementación, salvo la excepción aprobada. Los 7 casos de la ronda anterior (F-B1, F-B2, F-1 a F-4) fallan ahora por comportamiento ausente.

Excepción aprobada (Art. B5.2, «Comentarios del usuario» de `tasks.md`):
- `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx::una cuenta nueva (sin fecha ni nombre) ve la fecha vacía y no avanza hasta una fecha válida` (AC-003.1) pasa. Se conserva como guarda de regresión, como indicó el usuario ("sí, opción 1"). No cuenta como FAIL.

Fallos legítimos, en la etapa implement se resuelven:
- Backend: 90 tests rojos por comportamiento ausente. Incluyen los 27 marcados y los tests existentes que dependen del registro sin fecha (`test_login_*`, `test_register_*`, `test_a_user_id_in_the_body_does_not_affect_another_user`, `test_get_for_a_google_user_without_birth_date_or_profile`), que fallan en cascada porque el registro aún exige fecha de nacimiento.
- Frontend: 51 tests rojos. Son los 41 marcados y 10 tests existentes sin marcador 033 pero adaptados al nuevo contrato o cuyo h1 cambia a «Hola de nuevo, Ana». Son `router.test.tsx` (4 redirecciones a /home), `lazyRoutes.test.tsx` (1), `RegisterForm.test.tsx` (3 de 014: «36 eñes», «contraseña demasiado larga» y «correo recortado»), `auth/schemas.test.ts` (1, 014: «el registro recorta el correo») y `ProfilePage.test.tsx` (1, «al cambiar solo la meta»). Todos fallan por lo que pide la spec. Conviene que implement los deje en verde y que en review se añada el marcador 033 a los adaptados.
- `date_of_birth_rules.py` lanza `ValueError` con `"2001-02-30"` en `register_from_body` (ver sección 1). T-040 debe ignorar la fecha antes de parsearla.
- `AuthService.register` necesita la firma de 4 argumentos (T-040).
- `saveProfilePayloadSchema` es estricto y rechaza `first_name` hasta T-052.

Observaciones (no bloquean la etapa red):
- `tasks.md` marca T-028 como hecha, pero `frontend/src/features/profile/components/PhysicalDataForm.refresh.test.tsx` no se ha modificado. No tiene ninguna aserción exacta del cuerpo del `PUT` y sus 10 tests pasan. No hace falta acción, pero la casilla es inexacta.
- `state.json` y `spec.md` hablan de 37 AC, pero `spec.md` define 36 (4+2+1+3+4+4+8+6+4). Todos tienen test marcado. Es un dato a corregir en el backlog.

Estado de la etapa: PASS. Todos los tests nuevos o adaptados fallan por comportamiento ausente (backend 27/27 marcados, frontend 41/42 marcados), salvo la excepción aprobada de AC-003.1.
