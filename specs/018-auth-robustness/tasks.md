# Tareas 018 — Endurecer /register y /login: 400 ante entradas inválidas, validación del registro y mensajes en español

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-18)

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-001 [REQ-001, REQ-002, REQ-003, REQ-004, AC-001.3, AC-003.1, AC-004.1] (scaffold) Crear `auth_input_rules.py` con las constantes de mensajes (valores reales), `MAX_NAME_CHARS`, y `require_json_object`, `validate_first_name` y `validate_last_name` que lancen "not implemented" — `backend/services/auth_input_rules.py`
- [x] T-002 [REQ-001, REQ-002, REQ-007, REQ-008, AC-001.3, AC-002.3, AC-007.1, AC-008.1] (scaffold) Añadir a `AuthService` el parámetro `clock=utc_now` (guardado en `self.clock` sin lanzar), `register_from_body` y `login_from_body` que lancen "not implemented", y las constantes `WRONG_CREDENTIALS_MESSAGE` y `EMAIL_TAKEN_MESSAGE` con su valor real (sin tocar aún la lógica de `register` ni `login`) — `backend/services/auth_service.py`

## Fase A — Tests (test-author)
- [x] T-010 [REQ-009, AC-009.1, AC-009.2] (test) Doble de prueba `FakeSequenceClock(*instants)`: devuelve los instantes en orden, repite el último y cuenta las consultas en `calls` — `backend/tests/fakes.py`
- [x] T-011 [REQ-001, REQ-002, AC-001.3, AC-001.4, AC-002.3, AC-002.4] (test) `require_json_object` devuelve el dict y lanza `ValidationError` "La petición no es válida" para `None`, lista, número, texto y booleano — `backend/tests/test_services/test_auth_input_rules.py`
- [x] T-012 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5, AC-003.6, AC-003.7] (test) `validate_first_name`: requerido (ausente, no texto, en blanco), demasiado largo (101 y 300), recorte (100 con espacios, "María José") — `backend/tests/test_services/test_auth_input_rules.py`
- [x] T-013 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5] (test) `validate_last_name`: requerido, demasiado largo (101), recorte (" Pérez  ") — `backend/tests/test_services/test_auth_input_rules.py`
- [x] T-014 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5, AC-005.7] (test) `AuthService.register` rechaza `date_of_birth` ausente, nula, vacía, numérica, con formato erróneo, inexistente, futura, de 13 y de 101 años, sin crear cuenta (con `FakeClock` fijo) — `backend/tests/test_services/test_auth_service.py`
- [x] T-015 [REQ-005, REQ-003, REQ-004, AC-005.6, AC-005.8, AC-003.5, AC-003.6, AC-004.5] (test) `AuthService.register` acepta 14 años exactos y 100 años, guarda la fecha como `date` y el nombre y apellido recortados — `backend/tests/test_services/test_auth_service.py`
- [x] T-016 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5] (test) Orden de validaciones del registro: correo, contraseña, nombre, apellido, fecha y, al final, duplicado (sin consultar duplicados si falla una validación previa) — `backend/tests/test_services/test_auth_service.py`
- [x] T-017 [REQ-001, REQ-002, AC-001.3, AC-001.4, AC-002.3, AC-002.4, AC-002.5] (test) `register_from_body` y `login_from_body` con `None` y lista dan "La petición no es válida" sin consultar el repositorio; `login_from_body({})` da `AuthenticationError` "Correo o contraseña incorrectos" — `backend/tests/test_services/test_auth_service.py`
- [x] T-018 [REQ-007, REQ-008, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-008.1, AC-008.2] (test) Mensajes en español de login (contraseña errónea, correo inexistente, cuenta de Google, datos anómalos) y de correo duplicado (incluida variante en mayúsculas); actualizar los helpers y constantes existentes (`WRONG_CREDENTIALS`, "Email already registered", `register` con `"1990-01-01"`) — `backend/tests/test_services/test_auth_service.py`
- [x] T-019 [REQ-009, AC-009.1, AC-009.2] (test) `reset_password` usa un único instante: con `FakeSequenceClock(T+4min, T+6min)` tiene éxito y `used_at == T+4min`; con `(T+5min, T+4min)` responde enlace no válido o caducado y no cambia la contraseña — `backend/tests/test_services/test_password_reset_service.py`
- [x] T-020 [REQ-001, REQ-002, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5] (test) Integración: cuerpos no JSON (text/plain, malformado, `null`, lista, sin cuerpo) dan 400 "La petición no es válida" en `/register` y `/login` (sin cuentas ni token); `{}` en login sigue en 401 — `backend/tests/test_routes/test_auth_routes.py`
- [x] T-021 [REQ-003, REQ-004, REQ-005, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5, AC-003.6, AC-003.7, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5, AC-005.6, AC-005.7, AC-005.8] (test) Integración: nombre, apellido y fecha de nacimiento del registro (mensajes exactos, sin cuenta en rechazos, valores guardados recortados, fronteras de edad con helper `years_ago`, `GET /api/profile` devuelve la fecha) — `backend/tests/test_routes/test_auth_routes.py`
- [x] T-022 [REQ-006, REQ-007, REQ-008, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-008.1, AC-008.2] (test) Integración: orden de validaciones, 401 "Correo o contraseña incorrectos" y 409 "Ya existe una cuenta con este correo"; actualizar `WRONG_CREDENTIALS`, `DUPLICATE` y docstrings existentes — `backend/tests/test_routes/test_auth_routes.py`
- [x] T-023 [NFR-001, AC-N001.1] (test) Integración parametrizada: batería de cuerpos anómalos en `/register` y `/login` sin 5xx, errores `{"error": <texto>}` sin textos en inglés ni del framework — `backend/tests/test_routes/test_auth_routes.py`

## Fase B — Implementación (implementer)
- [ ] T-030 [REQ-005, AC-005.1, AC-005.8] (impl) Extraer `DOB_PATTERN`, `MIN_AGE`, `MAX_AGE`, los tres mensajes de fecha, `age_on` y `parse_date_of_birth` a un módulo común, y que `profile_service` los importe y los siga exponiendo con los mismos nombres (`# noqa: F401`) — `backend/services/date_of_birth_rules.py`, `backend/services/profile_service.py`
- [ ] T-031 [REQ-001, REQ-002, REQ-003, REQ-004, AC-001.3, AC-001.4, AC-002.3, AC-002.4, AC-003.1, AC-003.4, AC-003.5, AC-004.1, AC-004.4, AC-004.5] (impl) Implementar `require_json_object`, `validate_first_name` y `validate_last_name` (helper `_validate_name`, `strip`, `len`) — `backend/services/auth_input_rules.py`
- [ ] T-032 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, AC-001.3, AC-002.5, AC-005.1, AC-006.3, AC-007.1, AC-008.1] (impl) Implementar `register_from_body` y `login_from_body`, validación en `register` en el orden de REQ-006 con nombres recortados y `parse_date_of_birth(…, self.clock().date())`, y mensajes `WRONG_CREDENTIALS_MESSAGE` / `EMAIL_TAKEN_MESSAGE` — `backend/services/auth_service.py`
- [ ] T-033 [REQ-001, REQ-002, REQ-005, NFR-001, AC-001.1, AC-001.2, AC-001.5, AC-002.1, AC-002.2, AC-N001.1] (impl) `/register` y `/login` leen el cuerpo con `request.get_json(silent=True)` y llaman a `register_from_body` / `login_from_body`; se elimina `date.fromisoformat` y el import de `date` — `backend/routes/auth_routes.py`
- [ ] T-034 [REQ-009, AC-009.1, AC-009.2] (impl) Leer `now = self.clock()` una sola vez al empezar `reset_password` y pasarlo a `_ensure_link_is_usable(row, now)` (ambas comprobaciones) y a `row.used_at` — `backend/services/password_reset_service.py`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-020 | T-033 |
| REQ-001 | AC-001.2 | T-020 | T-033 |
| REQ-001 | AC-001.3 | T-011, T-017, T-020 | T-031, T-032, T-033 |
| REQ-001 | AC-001.4 | T-011, T-017, T-020 | T-031, T-032, T-033 |
| REQ-001 | AC-001.5 | T-020 | T-033 |
| REQ-002 | AC-002.1 | T-020 | T-033 |
| REQ-002 | AC-002.2 | T-020 | T-033 |
| REQ-002 | AC-002.3 | T-011, T-017, T-020 | T-031, T-032, T-033 |
| REQ-002 | AC-002.4 | T-011, T-017, T-020 | T-031, T-032, T-033 |
| REQ-002 | AC-002.5 | T-017, T-020 | T-032 |
| REQ-003 | AC-003.1 | T-012, T-021 | T-031, T-032 |
| REQ-003 | AC-003.2 | T-012, T-021 | T-031, T-032 |
| REQ-003 | AC-003.3 | T-012, T-021 | T-031, T-032 |
| REQ-003 | AC-003.4 | T-012, T-021 | T-031, T-032 |
| REQ-003 | AC-003.5 | T-012, T-015, T-021 | T-031, T-032 |
| REQ-003 | AC-003.6 | T-012, T-015, T-021 | T-031, T-032 |
| REQ-003 | AC-003.7 | T-012, T-021 | T-031, T-032 |
| REQ-004 | AC-004.1 | T-013, T-021 | T-031, T-032 |
| REQ-004 | AC-004.2 | T-013, T-021 | T-031, T-032 |
| REQ-004 | AC-004.3 | T-013, T-021 | T-031, T-032 |
| REQ-004 | AC-004.4 | T-013, T-021 | T-031, T-032 |
| REQ-004 | AC-004.5 | T-013, T-015, T-021 | T-031, T-032 |
| REQ-005 | AC-005.1 | T-014, T-021 | T-030, T-032, T-033 |
| REQ-005 | AC-005.2 | T-014, T-021 | T-030, T-032, T-033 |
| REQ-005 | AC-005.3 | T-014, T-021 | T-030, T-032 |
| REQ-005 | AC-005.4 | T-014, T-021 | T-030, T-032 |
| REQ-005 | AC-005.5 | T-014, T-021 | T-030, T-032 |
| REQ-005 | AC-005.6 | T-015, T-021 | T-030, T-032 |
| REQ-005 | AC-005.7 | T-014, T-021 | T-030, T-032 |
| REQ-005 | AC-005.8 | T-015, T-021 | T-030, T-032 |
| REQ-006 | AC-006.1 | T-016, T-022 | T-032 |
| REQ-006 | AC-006.2 | T-016, T-022 | T-032 |
| REQ-006 | AC-006.3 | T-016, T-022 | T-032 |
| REQ-006 | AC-006.4 | T-016, T-022 | T-032 |
| REQ-006 | AC-006.5 | T-016, T-022 | T-032 |
| REQ-007 | AC-007.1 | T-018, T-022 | T-032 |
| REQ-007 | AC-007.2 | T-018, T-022 | T-032 |
| REQ-007 | AC-007.3 | T-018, T-022 | T-032 |
| REQ-007 | AC-007.4 | T-018, T-022 | T-032 |
| REQ-008 | AC-008.1 | T-018, T-022 | T-032 |
| REQ-008 | AC-008.2 | T-018, T-022 | T-032 |
| REQ-009 | AC-009.1 | T-010, T-019 | T-034 |
| REQ-009 | AC-009.2 | T-010, T-019 | T-034 |
| NFR-001 | AC-N001.1 | T-023 | T-033 |
