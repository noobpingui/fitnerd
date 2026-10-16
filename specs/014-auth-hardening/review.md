# Review 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

- **Iteración:** 1 de 3
- **Diff revisado:** `git diff main...feat/014-auth-hardening` @ `e2a3976` (+ cambios sin commitear: solo `state.json` y `verify-report.md` de la feature)
- **Veredicto:** APPROVED

## 1. Resumen
El cambio concentra la normalización del correo y las reglas de contraseña en `services/credential_rules.py`, hace que `UserRepository.get_by_email` no distinga mayúsculas, bloquea la fila del token de restablecimiento con `FOR UPDATE`, añade una migración solo de datos que pasa los correos a minúsculas y falla ante conflictos, escapa los caracteres de control del log de Resend y, en el frontend, comparte `newPasswordSchema` y muestra el aviso de `/login` una sola vez. La implementación es limpia, sigue el plan y respeta las capas. Solo quedan hallazgos menores y NIT.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1, AC-001.2 | Sí | `backend/services/auth_service.py:37` (`validate_email` devuelve el correo normalizado), `:42` (duplicado) y `:52` (`User(email=email…)`); `backend/repositories/user_repository.py:17-23`; tests `test_register_stores_and_returns_the_email_trimmed_and_lowercase`, `test_register_rejects_a_duplicate_email_that_differs_only_in_case` |
| AC-002.1 – AC-002.3 | Sí | `backend/services/auth_service.py:89` (`normalize_email`); `test_auth_routes.py` y `test_auth_service.py` |
| AC-003.1 – AC-003.3 | Sí | `backend/services/password_reset_service.py:60` (`validate_email`), correo normalizado en lock (`:64`), límite (`:70`), búsqueda (`:74`) y fila (`:108`); envío a `user.email` (`:85`) |
| AC-004.1, AC-004.2 | Sí | `backend/services/auth_service.py:122` (verificador inyectado) y `:132` (`normalize_email(claims["email"])`); unitarios en `test_auth_service.py` |
| AC-005.1, AC-005.2 | Sí | `backend/repositories/user_repository.py:20-22` (`func.lower`); tests con `insert_legacy_user` |
| AC-005.3, AC-005.4 | Sí | `backend/migrations/versions/a7d3f9c1e5b2_lowercase_user_emails.py:24-39`; `test_lowercase_emails_migration.py` |
| AC-006.1 – AC-006.10 | Sí | `backend/services/credential_rules.py:25-30`; orden correo → contraseña → duplicado en `auth_service.py:37-44` |
| AC-007.1 – AC-007.4 | Sí | `backend/services/credential_rules.py:19-22` (`isinstance` antes de `strip`, sin 5xx) |
| AC-008.1 – AC-008.6 | Sí | `frontend/src/features/auth/schemas.ts:10-16` y `:26`; `RegisterForm.test.tsx` |
| AC-009.1 – AC-009.5 | Sí | `backend/services/auth_service.py:82-87` (tipos y `exceeds_bcrypt_limit` antes de consultar) |
| AC-010.1, AC-010.2, AC-010.4 | Sí | `backend/repositories/password_reset_repository.py:36-43` (`with_for_update`); `password_reset_service.py:123-147` (lectura dentro del `try`, `rollback` libera el bloqueo) |
| AC-010.3 | Parcial (ver F1) | El intento con contraseña inválida no consume el enlace, pero el mensaje que recibe depende del orden en la cola del bloqueo |
| AC-011.1 – AC-011.5 | Sí | `frontend/src/features/auth/hooks.ts:83-98` (`useState` al montar + `navigate(…, { replace: true, state: null })`); `LoginForm.tsx:25` |
| AC-012.1 – AC-012.6 | Sí | `backend/utils/email_sender.py:38-57` (`escape_log_text`) y `:85` (quitar key → recortar → escapar, el orden de la spec) |
| AC-N001.1 | Sí | Suites completas en verde (verify: backend 804, frontend 494); ningún test existente modificado, borrado ni saltado |

## 3. Cumplimiento del plan
- Sin desviaciones relevantes: archivos, firmas, orden de validación, migración (`revision a7d3f9c1e5b2`, `down_revision f2c4e6a8b0d1`, única cabeza) y esquema del frontend coinciden con `plan.md` §2–§3.
- `test_auth_service.py` usa un `FakeUserRepository` con comparación exacta en lugar de la comparación sin mayúsculas descrita en el plan (§5). Es más estricto (solo pasa si el servicio normaliza antes de consultar) y está explicado en su docstring: desviación justificada.
- El diseño de `reset_password` (bloqueo antes de validar la contraseña, plan §3.3) es el origen de F1.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol; `snapshot --check` es idéntico, y los cambios de tests posteriores a `commits.tests` (`ba93e2f` → `e2a3976`) son solo docstrings acortados, con `rework tests` y `snapshot` registrados en `history`
- [x] B4: los marcadores `SDD: 014 …` son coherentes con los AC que prueban (revisados por muestreo en `test_auth_routes.py`, `test_password_reset_routes.py`, `test_lowercase_emails_migration.py`, `LoginForm.test.tsx`, `RegisterForm.test.tsx`)
- [x] B5: no hay tests borrados, saltados ni debilitados; sin `skip`/`xfail`/`.only`; sin llamadas reales a Google ni Resend (verificador de Google inyectado, `FakeOpener`); esqueletos sustituidos
- [x] B5.7: ratchet de ruff sin violaciones nuevas; `npm run lint`, `tsc -b` y `build` en verde (verify-report)
- [x] B6.5: sin secretos; no hay variables nuevas

### Parte II (proyecto)
- [x] P1 general: marcador con número de spec (ADR-0022)
- [ ] P1.2 / P2 general: docstrings, comentarios y nombres de tests en español correcto — varios sin tildes (F2)
- [x] P1 backend: tests en `test_services/` y `test_routes/`, nombres en inglés, fakes a mano, sin `unittest.mock` ni `monkeypatch`
- [x] P1 frontend: `vi.mock` de la `api` en `RegisterForm.test.tsx`; `fetch` simulado en `LoginForm.test.tsx`, excepción justificada en `plan.md` §7
- [x] P2.1–P2.3: lógica en `services/`, consultas en `repositories/`, solo `UnitOfWork` hace commit/rollback, errores con `ValidationError`/`ConflictError`/`AuthenticationError`; rutas sin cambios
- [x] P2.4: sin cambio de modelo; la migración de datos está incluida, revisada a mano y encadenada a la cabeza actual
- [x] P2.5: se reutiliza `utils/email_sender.py`; `EMAIL_PATTERN` y reglas movidas sin duplicar (reexportadas desde `password_reset_service`)
- [x] P2 frontend: cambios dentro de `features/auth`, zod y hooks; sin llamadas HTTP nuevas
- [x] P3.2: correo y contraseña del registro validados en el servicio y con zod
- [x] P3.4: SQL estático en la migración y parámetros enlazados en el test de concurrencia
- [ ] P4: el paso manual en producción (volcado + `flask db upgrade` de `a7d3f9c1e5b2`) aún no está en `docs/deploy-runbook.md`; corresponde a la etapa `docs` (anotado en el backlog de la feature)

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `backend/services/password_reset_service.py:126-137` | AC-010.3 exige que, con dos peticiones simultáneas (`"corta"` y `ClaveDos123`), la de `"corta"` reciba "La contraseña debe tener al menos 8 caracteres". Como el `FOR UPDATE` se toma antes de validar la contraseña y la precedencia "enlace no válido" se conserva, si la petición válida entra antes en la cola del bloqueo, la de `"corta"` relee la fila con `used_at` fijado y recibe "El enlace no es válido…". El test `test_invalid_password_in_a_simultaneous_reset_does_not_consume_the_link` pasa (20/20 ejecuciones) solo porque el primer hilo arrancado suele llegar antes a Postgres. Lo esencial del AC (un intento inválido no consume el enlace) sí se cumple. Arreglo posible sin romper la precedencia existente: leer el token sin bloqueo, validar enlace y contraseña, y después releer con `FOR UPDATE` y revalidar el enlace. | implementer |
| F2 | MENOR | `backend/tests/test_routes/test_password_reset_routes.py:546,567-570,611,644,656,671,691-692,716`; `backend/tests/test_services/test_email_sender.py:213,263`; `frontend/src/features/auth/components/LoginForm.test.tsx:209`; `frontend/src/features/auth/components/RegisterForm.test.tsx:60,70,82,94` | Docstrings, comentarios y nombres de tests nuevos sin tildes ("maximo", "condicion", "conexion", "contrasena", "peticion", "exito", "linea", "simultaneos", "envia"…), contra Art. P1.2 y P2 general ("español correcto, con tildes"). | test-author |
| F3 | NIT | `backend/utils/email_sender.py:42-43` | Las claves de U+2028 y U+2029 en `_NAMED_ESCAPES` son los caracteres literales, invisibles en el editor y en los diffs. Más legible con `" "` y `" "`. | implementer |
| F4 | NIT | `backend/tests/test_routes/test_password_reset_routes.py:599` | `concurrent_resets` ignora el resultado de `wait_until`: si se agota el tiempo sin que las peticiones lleguen a esperar el bloqueo, el test sigue y puede pasar sin haber probado la concurrencia. Un `assert` sobre ese resultado haría explícito el fallo de sincronización. | test-author |
| F5 | NIT | `frontend/src/features/auth/schemas.ts:25` | `registerSchema.email` usa `z.email` sin `trim`, así que el formulario rechaza `"  Ana@Example.COM "` aunque el servidor ya lo acepta (AC-001.1). Fuera del alcance de la spec; mejora de UX posible. | spec-writer |

## 6. Decisión
APPROVED: no hay hallazgos BLOQUEANTES ni MAYORES. F1 y F2 son menores y pueden ir al backlog con la aprobación del usuario en el gate; F3–F5 son sugerencias opcionales. Pendiente para `docs`: documentar el paso manual de la migración `a7d3f9c1e5b2` en `docs/deploy-runbook.md` (Art. P4) y pasar ADR-0025 a "Aceptada" si el usuario la aprueba en este gate.

## Comentarios del usuario

Vamos a corregir todos de una vez, desde f1 a f5
