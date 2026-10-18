# Review 018 — Endurecer /register y /login: 400 ante entradas inválidas, validación del registro y mensajes en español

- **Iteración:** 1 de 3
- **Diff revisado:** `git diff main...fix/018-auth-robustness` @ `94b1e8f` (+ cambios sin commitear solo en `state.json` y `verify-report.md`)
- **Veredicto:** APPROVED

## 1. Resumen
Las rutas `/register` y `/login` leen el cuerpo con `get_json(silent=True)` y delegan en `AuthService.register_from_body` / `login_from_body`, que rechazan con 400 todo lo que no sea un objeto JSON. El registro valida nombre, apellido y fecha de nacimiento (reglas de fecha extraídas del perfil a un módulo común) en el orden de REQ-006, los mensajes de credenciales y duplicado pasan al español y `reset_password` usa un único instante. El cambio es pequeño, sigue el plan al pie de la letra y está bien cubierto; solo hay observaciones menores.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 a AC-001.5 | Sí | `backend/routes/auth_routes.py:39` (`get_json(silent=True)`) → `backend/services/auth_service.py:45` → `backend/services/auth_input_rules.py:12`; tests `test_register_rejects_a_plain_text_body` … `test_register_rejects_a_request_without_body` (`test_auth_routes.py`) |
| AC-002.1 a AC-002.4 | Sí | `backend/routes/auth_routes.py:46`, `backend/services/auth_service.py:56`; tests `test_login_rejects_*` (`test_auth_routes.py`) |
| AC-002.5 | Sí | `{}` llega a `login(None, None)` → 401 (`auth_service.py:56-58`, `:117`); `test_login_with_an_empty_object_is_still_a_401` |
| AC-003.1 a AC-003.7 | Sí | `backend/services/auth_input_rules.py:20-28` (no `str` / en blanco → obligatorio; `len` tras `strip` > 100 → demasiado largo; devuelve recortado); `auth_service.py:66`; tests de rutas, servicio y reglas |
| AC-004.1 a AC-004.5 | Sí | `auth_input_rules.py:20-40`; `auth_service.py:67`; `test_register_stores_the_last_name_trimmed` |
| AC-005.1 a AC-005.8 | Sí | `backend/services/date_of_birth_rules.py:23-35` (movido sin cambios desde `profile_service._parse_dob`); `auth_service.py:68` con `self.clock().date()` (UTC); fronteras exactas con `FakeClock` en `test_auth_service.py` y de extremo a extremo en `test_auth_routes.py` (AC-005.8 comprueba `GET /api/profile`) |
| AC-006.1 a AC-006.5 | Sí | Orden en `auth_service.py:64-74`: correo, contraseña, nombre, apellido, fecha y duplicado dentro del `try` |
| AC-007.1 a AC-007.4 | Sí | `auth_service.py:117, 121, 128, 131` (`WRONG_CREDENTIALS_MESSAGE`) |
| AC-008.1, AC-008.2 | Sí | `auth_service.py:74` (`EMAIL_TAKEN_MESSAGE`) |
| AC-009.1, AC-009.2 | Sí | `backend/services/password_reset_service.py:131` (`now` leído al empezar), `:142`, `:150`, `:157`; tests con `FakeSequenceClock` (incluye `clock.calls == 1`) |
| AC-N001.1 | Sí | Batería parametrizada `test_anomalous_bodies_never_cause_a_server_error` (registro y login, cuerpos crudos, `{}` y cada campo como número, `null` y lista), con respuesta exacta por caso |

## 3. Cumplimiento del plan
Sin desviaciones. Los símbolos, módulos (`auth_input_rules.py`, `date_of_birth_rules.py`), firmas (`clock=utc_now` en `AuthService`, `_ensure_link_is_usable(row, now)`) y el orden de validación coinciden con `plan.md` §3. `profile_service.py` sigue reexportando `age_on`, `DOB_PATTERN`, `MIN_AGE`, `MAX_AGE` y los tres mensajes (`profile_service.py:7`), y `_validate` usa `parse_date_of_birth` en la misma posición (`:53`), así que el perfil no cambia de comportamiento (suite de perfil en verde). No hay otros llamadores de `AuthService.register` fuera de los tests, por lo que el cambio de contrato de `date_of_birth` (texto en lugar de `date`) no rompe nada.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol; `snapshot --check` idéntico; el commit de implement (`220f752`) no toca tests; los cambios de tests posteriores (`220f752..94b1e8f`) son solo docstrings partidos por E501, autorizados en `history` (`rework tests` + `snapshot`).
- [x] B4: los marcadores `SDD: 018 …` cubren los 44 AC; dos marcadores apuntan a un AC poco relacionado (F1, NIT).
- [x] B5: no hay tests borrados, saltados ni debilitados (los cambios en tests existentes son los textos que impone la spec y el helper `register` por el nuevo contrato de fecha); sin servicios externos; esqueletos sustituidos (no queda `NotImplementedError` en los módulos tocados).
- [x] B5.7: ratchet de ruff sin violaciones nuevas (verify-report).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1.1/P1.2: marcadores con número de spec; docstrings en español.
- [x] P1 backend: fakes escritos a mano e inyectados por constructor (`FakeClock`, `FakeSequenceClock`); sin `unittest.mock` ni `monkeypatch`; integración con `client` y Postgres de prueba.
- [x] P2.1: las rutas solo leen el cuerpo, llaman al servicio y serializan; la comprobación del cuerpo vive en el servicio; solo `UnitOfWork` hace commit/rollback.
- [x] P2.2: reloj inyectado por constructor con valor por defecto; `_build_auth_service` sin cambios.
- [x] P2.3: errores con `ValidationError`, `ConflictError` y `AuthenticationError`; ninguna ruta construye errores a mano.
- [x] P2.4: sin cambios de modelo, sin migración (comprobado: el diff no toca `models/` ni `migrations/`; 100 caracteres caben en `String(250)`).
- [x] P2.5: se reutilizan `credential_rules.py` y las reglas de fecha (extraídas, no duplicadas).
- [x] P2 General: mensajes en español correcto, sin voseo.
- [x] P3.2: toda la entrada de registro y login se valida en el servicio con comprobación de tipos.
- [x] P3.1, P3.3–P3.5: sin endpoints nuevos, sin IA, sin SQL a mano, sin secretos.
- [x] P4: sin migración ni pasos manuales en producción.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | NIT | `backend/tests/test_services/test_auth_service.py:573` y `:528` | `test_login_from_body_returns_a_token_for_valid_credentials` lleva `SDD: 018 REQ-002 AC-002.1`, pero AC-002.1 trata de rechazar un cuerpo `text/plain`; y `test_register_from_body_registers_with_the_fields_of_the_object` lleva AC-001.3 (cuerpo `null`). Son tests de delegación positiva; convendría marcarlos solo con el REQ o con el AC al que realmente aportan. Los AC siguen cubiertos por otros tests. | test-author |
| F2 | NIT | `backend/tests/test_services/test_auth_service.py:134` | `years_before_today` importa `timedelta` dentro de la función en lugar de en la cabecera, donde ya se importa `datetime`. | test-author |
| F3 | MENOR | `frontend/src/features/auth/components/LoginForm.test.tsx:143, 156, 261, 273, 329` | Los tests del frontend siguen simulando el texto «Wrong Credentials», que el servidor ya no devuelve; no fallan (el frontend muestra el texto tal cual), pero documentan un contrato obsoleto. Ya está en el backlog del plan; fuera del ámbito `backend` de esta spec. | planner |
| F4 | MENOR | `backend/exceptions/custom_exceptions.py:8` | El mensaje por defecto de `ConflictError` sigue siendo «Email already registered» (y el de `AuthenticationError`, en inglés). No se usan en estos flujos, pero cualquier `raise ConflictError()` sin argumento reintroduciría el texto en inglés. Ya en el backlog del plan. | planner |
| F5 | NIT | `backend/services/auth_service.py:22` | `AuthService` importa `utc_now` de `profile_service`, lo que acopla autenticación a perfil solo por el reloj; hay además otro `utc_now` idéntico en `password_reset_service.py`. Unificarlo en un módulo de reloj (ya en el backlog). | planner |

## 6. Decisión
APPROVED. No hay hallazgos BLOQUEANTES ni MAYORES: todos los AC están implementados como se especificaron, el plan se siguió sin desviaciones, la integridad de los tests está confirmada (snapshot idéntico, cambios posteriores autorizados y solo cosméticos) y la suite afectada pasa (295 tests de auth, reset y perfil ejecutados en esta revisión). Los hallazgos MENOR y NIT pueden diferirse al backlog.
