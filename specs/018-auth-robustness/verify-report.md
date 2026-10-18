# Verify report 018 — Endurecer /register y /login: 400 ante entradas inválidas, validación del registro y mensajes en español

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-18T20:06:17.807Z · **Rama:** `fix/018-auth-robustness` @ `e441c7d` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Ejecución de los cuatro archivos de test con marcador `SDD:` del ámbito `backend` (cwd `backend`), con el comando `commands.test_files` de la config:
`".venv/Scripts/python.exe" -m pytest -q tests/test_services/test_auth_input_rules.py tests/test_services/test_auth_service.py tests/test_routes/test_auth_routes.py tests/test_services/test_password_reset_service.py`

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `pytest` sobre los 4 archivos de test de la feature (`backend`) | ✅ | 170 failed, 93 passed (31 s). Sin errores de colección, import, sintaxis ni fixture. Cada test nuevo se clasificó por separado (§2). |

Lint, typecheck y build no se ejecutan en modo red.

## 2. Trazabilidad
En modo red no se exige la trazabilidad completa (se comprobará en `verify`). Estado de los tests nuevos (marcador `SDD: 018`):

| Tests nuevos (`SDD: 018`) | Casos | Estado |
|---|---|---|
| `test_auth_input_rules.py` (T-011, T-012, T-013) | los 28 casos | ❌ rojo legítimo (`NotImplementedError` del esqueleto) |
| `test_auth_service.py` (T-014 a T-018) | todos los nuevos | ❌ rojo legítimo (`DID NOT RAISE`, mensajes en inglés, fecha guardada como texto, esqueleto de `register_from_body`/`login_from_body`) |
| `test_password_reset_service.py` (T-019) | `…uses_a_single_instant_for_expiry_and_used_at` | ❌ rojo legítimo (AC-009.1: `ValidationError` por la lectura doble del reloj) |
| `test_password_reset_service.py` (T-019) | `…rejects_when_the_first_instant_is_already_expired` | ✅ permitido (AC-009.2, nota del plan) |
| `test_auth_routes.py` (T-021) | `test_register_accepts_someone_who_turns_14_today` | ✅ permitido (AC-005.6, nota del plan) |
| `test_auth_routes.py` (T-021) | `test_register_accepts_100_years_and_the_profile_returns_the_date` | ✅ permitido (AC-005.8, nota del plan) |
| `test_auth_routes.py` y `test_auth_service.py` (T-016, T-022) | `…validates_the_email_before_the_first_name` y `…validates_the_password_before_the_first_name` (ruta y servicio) | ❌ rojo legítimo (AC-006.1 y AC-006.2 ya no pasan sin implementar: el registro acepta el cuerpo y responde 201 o 500) |
| `test_auth_routes.py` (T-023) | `test_anomalous_bodies_never_cause_a_server_error[…]`, 37 casos | ❌ rojo legítimo en 31 casos; ✅ permitido en 6 (`register-email-{number,null,list}` y `register-password-{number,null,list}`, guardas de la spec 014, nota del plan) |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: T-030 a T-034 (son tareas de implementación; esperado en esta etapa)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: —
- Esqueletos (Art. B5.6, P1.5): `auth_input_rules.py` (`require_json_object`, `validate_first_name`, `validate_last_name`) y `AuthService.register_from_body` / `login_from_body` solo lanzan `NotImplementedError("not implemented")`; `AuthService.__init__` guarda `clock` sin lanzar. Conforme.

## 3. Criterios de aceptación manuales
- Ninguno en esta etapa.

## 4. Fallos (si los hay)
Ninguno. Los casos que pasan sin implementar en la iteración anterior (AC-006.1 y AC-006.2 en ruta y servicio, y 14 casos de la batería AC-N001.1) ahora fallan por comportamiento ausente. Los 6 casos de la batería que siguen en verde son guardas de regresión de la spec 014 y están permitidos por la nota del plan.
