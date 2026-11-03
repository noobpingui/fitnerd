# Review 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

- **Iteración:** 1 de 5
- **Diff revisado:** `git diff main...feat/033-profile-first-name` @ `b1e03ac` (+ cambios sin commitear: solo `state.json` y `verify-report.md` del orquestador y el verifier)
- **Veredicto:** APPROVED

## 1. Resumen
El registro deja de leer `date_of_birth`. `GET` y `PUT /api/profile` exponen `first_name`, y el `PUT` lo valida primero con la regla de la 018, solo si viene la clave. El nombre también se valida con una regla compartida en el frontend. `/profile` gana el campo «Nombre» en «Datos personales» y `/home` saluda por el nombre. El cambio es pequeño, sigue el plan casi al pie de la letra, reutiliza `validate_first_name` y no necesita migración. Solo hay hallazgos menores de artefactos y NITs.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `backend/services/auth_service.py:46-51` (no pasa la fecha), `:81-84` (`User` sin fecha); `test_auth_routes.py:681` |
| AC-001.2 | Sí | ídem; `test_auth_routes.py:696` |
| AC-001.3 | Sí | se quitó `parse_date_of_birth` del registro (`auth_service.py:60-65`); `test_auth_routes.py:709`, `:718`; `test_auth_service.py:350`; `test_fixed_clock_routes.py:183-200` |
| AC-001.4 | Sí | orden en `auth_service.py:61-65`; `test_auth_routes.py:729` |
| AC-002.1 | Sí | `RegisterForm.tsx` sin el `FormField` de la fecha; `RegisterForm.test.tsx` «no muestra «Fecha de nacimiento»…» |
| AC-002.2 | Sí | `features/auth/schemas.ts:51-56` (sin `date_of_birth`), `types.ts:8-13`; test «envía una sola petición…» |
| AC-003.1 | Sí (sin cambio de código) | `OnboardingPage.test.tsx:226`; guarda de regresión con excepción al Art. B5.2 aprobada por el usuario (`tasks.md`, «Comentarios del usuario») |
| AC-004.1 | Sí | `backend/routes/profile_routes.py:39`; `test_profile_routes.py` `test_get_returns_the_saved_first_name` |
| AC-004.2 | Sí | ídem; `test_get_returns_a_null_first_name_for_an_account_without_one`; `profile/schemas.ts:74` (`default(null)`) |
| AC-004.3 | Sí | `_serialize` compartido por `GET` y `PUT`; `test_put_response_includes_the_stored_first_name` |
| AC-005.1 | Sí | `profile_service.py:50-51`, `:142-143`; `test_put_saves_the_first_name_trimmed` |
| AC-005.2 | Sí | `profile_service.py:107-109` (solo si la clave está); `test_put_without_first_name_keeps_the_stored_one` |
| AC-005.3 | Sí | ídem; `test_put_without_first_name_keeps_an_account_without_name_nameless` |
| AC-005.4 | Sí | `auth_input_rules.py:20-28` (`len` tras `strip`); `test_put_accepts_a_first_name_of_100_characters_surrounded_by_spaces` |
| AC-006.1 | Sí | validación antes de abrir la transacción (`profile_service.py:50-51`); test parametrizado con `""`, `"   "`, `None` y `123`, que compara el `GET` completo antes y después |
| AC-006.2 | Sí | `test_put_rejects_a_first_name_of_101_characters` |
| AC-006.3 | Sí | el nombre se valida antes que la fecha y el resto (`profile_service.py:50-53`); `test_put_validates_the_first_name_before_the_physical_data`; unitario `test_profile_service.py:473` |
| AC-006.4 | Sí | `test_put_rejects_a_first_name_of_300_characters_without_a_server_error` |
| AC-007.1 | Sí | `PhysicalDataForm.tsx:69-73`, `:248-260`; `ProfilePage.tsx:68-72`; `ProfilePage.test.tsx` |
| AC-007.2 | Sí | `profile/schemas.ts:36-39` (aviso con valor vacío); `ProfilePage.test.tsx` |
| AC-007.3 | Sí | `measurementChanged` no depende del nombre (`PhysicalDataForm.tsx:122-125`); `payloadFromProfileForm` (`mappers.ts:31-38`); `ProfilePage.test.tsx` |
| AC-007.4 | Sí | `PhysicalDataForm.tsx:135`, `mappers.ts:36`; `mappers.test.ts` y `ProfilePage.test.tsx` |
| AC-007.5 | Sí | `errors.firstName` entra en `allValid` (`PhysicalDataForm.tsx:93-101`); `ProfilePage.test.tsx`, `profile/schemas.test.ts` |
| AC-007.6 | Sí | `firstNameMessage` (`auth/schemas.ts:34-41`); ídem |
| AC-007.7 | Sí | `firstName` en `defaultValues`/`saved`, así que «Descartar» (`form.reset(saved)`) lo revierte; `ProfilePage.test.tsx` |
| AC-007.8 | Sí | `ProfilePage.tsx:58` (título, misma descripción); el campo «Nombre» va primero en la rejilla (`PhysicalDataForm.tsx:248`); test con `compareDocumentPosition` (`ProfilePage.test.tsx:~1270-1282`) |
| AC-008.1 | Sí | `auth/schemas.ts:43-49`; `auth/schemas.test.ts` |
| AC-008.2 | Sí | ídem |
| AC-008.3 | Sí | ídem |
| AC-008.4 | Sí | `Array.from(trimmed).length` (`auth/schemas.ts:37`); test con emojis |
| AC-008.5 | Sí | `registerSchema.first_name = firstNameSchema`; `RegisterForm.test.tsx` (2 tests) |
| AC-008.6 | Sí | `last_name` sigue con «Campo obligatorio»; `RegisterForm.test.tsx` |
| AC-009.1 | Sí | `greeting.ts:1-4`, `HomePage.tsx:44`; `HomePage.test.tsx`, `greeting.test.ts` y el `h1` adaptado en `router`, `diaryRoute` y `lazyRoutes` |
| AC-009.2 | Sí | ídem |
| AC-009.3 | Sí | `firstName?.trim()`; `HomePage.test.tsx`, `greeting.test.ts` |
| AC-009.4 | Sí | `useSaveProfile` escribe la respuesta del `PUT` en la caché; `ProfilePage.test.tsx:1285` (navega a `/home` y comprueba `getProfileMock` llamado una vez) |

## 3. Cumplimiento del plan
- Se sigue el plan en backend (firma de `register` con 4 argumentos, `_validate` con la clave opcional, `user.first_name` antes del bucle de `UserProfile`, `_serialize`) y en frontend (símbolos y firmas de la sección 3.2, `profileResponseSchema` con `default(null)` para el despliegue desacompasado).
- Única desviación: la tarea T-028 (adaptar `PhysicalDataForm.refresh.test.tsx`) no produjo cambios, porque ese archivo no compara el payload del `PUT` de forma exacta y ya pasa con el fixture `first_name: "Ana"`. Es inocua, pero la casilla `[x]` no refleja ningún cambio (F1).
- El test de AC-009.4 vive en `ProfilePage.test.tsx` y no en `HomePage.test.tsx`. El plan lo permitía (sección 5.2, «o `src/app/router.test.tsx`») y el test comprueba de verdad la navegación a `/home` sin otra lectura del perfil. Se acepta.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` idéntico (18 archivos). Desde `commits.tests` (`e9db40a`), los tests solo cambian en `b1e03ac`: tres partidas de línea (E501) en `test_fixed_clock_routes.py` y `test_auth_service.py`, registradas en `history` como `rework tests` con su `snapshot` posterior. Corrección autorizada, sin cambio de comportamiento.
- [x] B4: los marcadores `SDD: 033 …` corresponden a los AC que prueban; los 36 AC tienen test. Hay datos inconsistentes en los artefactos (F2).
- [x] B5: los tests 018/020 de fecha en el registro se sustituyeron por los de AC-001.x porque la spec aprobada cambia ese contrato (sección 6), sin `skip`, `xfail` ni `.only`. AC-003.1 pasa en rojo con la excepción B5.2 aprobada por el usuario. No hay llamadas externas. Los esqueletos de `firstNameMessage`, `homeGreeting` y `payloadFromProfileForm` se sustituyeron.
- [x] B5.7: ratchet de backend sin violaciones nuevas; `npm run lint`, `tsc -b` y `build` en verde (verify-report).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: marcadores con número de spec; fakes escritos a mano (`make_user` de `test_profile_service.py`), sin `unittest.mock` ni `monkeypatch`; frontend con `vi.mock` de `api.ts`, `globals: false` y nombres en español.
- [x] P2 backend: la ruta solo serializa; la lógica está en `ProfileService`; un único commit de `UnitOfWork`; errores con `ValidationError`; se reutiliza `validate_first_name` (P2.5).
- [x] P2.4: no hay cambio de modelo (`users.first_name` `String(250)` nullable y `date_of_birth` nullable ya existen), así que no hace falta migración. Comprobado a mano.
- [x] P2 frontend: organización por feature y HTTP solo por `apiFetch` (`api.ts` sin cambios); react-hook-form con zod. `profile/schemas.ts` importa de `auth/schemas.ts`, una importación entre features justificada en el plan (sección 7) y que sigue el patrón existente con `onboarding`.
- [x] P2 general: textos en español correcto («Datos personales», «Hola de nuevo, {nombre}», mensajes de la 018).
- [x] P3: no hay endpoints nuevos. `PUT /api/profile` sigue con `@require_auth` y el `user_id` del token. Se valida en el servicio y con zod, y no hay SQL a mano.
- [x] P4: sin migración ni pasos manuales en producción. El `doc-keeper` debe actualizar `CLAUDE.md`, que aún describe la validación de la fecha de nacimiento en el registro (spec 018), y `README.md` si procede (anotado en el backlog del plan).
- [x] P5: no se tocan archivos de datos ni ADRs.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `specs/033-profile-first-name/tasks.md:43` (T-028) | T-028 está marcada `[x]` («Adapta los tests de refresco de `PhysicalDataForm`…»), pero `frontend/src/features/profile/components/PhysicalDataForm.refresh.test.tsx` no aparece en el diff. Ese archivo no compara el payload del `PUT` con `toEqual` exacto y ya pasa, así que la adaptación no hacía falta. La casilla debería decir «sin cambios necesarios» o la tarea debería retirarse. | test-author |
| F2 | MENOR | `specs/033-profile-first-name/spec.md:81` y `:87-88` | AC-007.1 y AC-007.2 están en la misma línea (falta el salto tras «el valor «Ana».») y falta la línea en blanco antes de `### REQ-008`. Probablemente por eso el recuento automático dio 37 AC en `state.json` (nota del evento de spec) cuando la spec define 36 (4+2+1+3+4+4+8+6+4). Hay que corregir el formato y el recuento registrado. | spec-writer |
| F3 | NIT | `frontend/src/features/profile/pages/ProfilePage.test.tsx:1285` | El único marcador `SDD: 033 … AC-009.4` está en el test de `ProfilePage`, aunque el AC habla de `/home`. El test es correcto (navega a `/home` con el mismo `QueryClient`). Para que la trazabilidad se encuentre donde se espera, se podría añadir una referencia en `HomePage.test.tsx` o en el `describe`. | test-author |
| F4 | NIT | `backend/services/auth_service.py:36-37` | `self.clock` ya no se usa en `AuthService` tras quitar `parse_date_of_birth`: solo se guarda. El plan lo justifica (la ruta y los tests lo inyectan), pero es una dependencia muerta que convendría retirar en una limpieza futura. | implementer |
| F5 | NIT | `backend/tests/test_routes/test_auth_routes.py` (otros archivos de test, p. ej. `conftest.py:150`) | Muchos helpers de registro siguen enviando `date_of_birth`, que ahora se ignora. Es inocuo y ya está en el backlog (test-author), pero confunde a quien lea esos tests. | test-author |

Los puntos que ya estaban en `backlog.md` se mantienen allí: la diferencia entre `strip()` y `trim()` con espacios Unicode raros, el renombrado de `PhysicalDataForm` a «PersonalData…», los tests intermitentes de `router` y `lazyRoutes`, y la actualización de `CLAUDE.md` y `README.md` por el `doc-keeper`.

## 6. Decisión
APPROVED. No hay hallazgos BLOQUEANTES ni MAYORES: todos los AC están implementados como se especificaron, la integridad de los tests está confirmada (snapshot idéntico y la única corrección posterior a `tests` está autorizada en `history`) y se cumple la constitución. F1 a F5 pueden corregirse en `docs` o `close`, o pasar al backlog del proyecto.
