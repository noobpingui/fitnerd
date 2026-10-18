# Tareas 019 — Integridad de los correos guardados: recorte de espacios y garantía en la base

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-18)

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-001 [REQ-004] (scaffold) Crear la constante `CANONICAL_EMAIL_CONDITION: str` con su valor final (`"email = lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g'))"`); sin `CheckConstraint` todavía en el modelo — `backend/models/user.py`
- [x] T-002 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-006] (scaffold) Crear la migración `e5b7d9f1a3c6` (`revision`, `down_revision = 'a7d3f9c1e5b2'`, `branch_labels`, `depends_on`), las constantes `CANONICAL_EMAIL_SQL`, `USERS_CHECK`, `RESET_REQUESTS_CHECK` y `CONFLICT_MESSAGE_PREFIX` con su valor final, y `upgrade()` y `downgrade()` que lancen `NotImplementedError("not implemented")` — `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py`

## Fase A — Tests (test-author)
- [x] T-010 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-006] (test) Utilidades de test: `load_migration`, `run_upgrade`, `run_downgrade`, `CANONICAL_EMAILS_MIGRATION`, `drop_canonical_email_checks` (con `IF EXISTS` y `lock_timeout`) y `restore_canonical_email_checks` — `backend/tests/migration_helpers.py`
- [x] T-011 [REQ-001, AC-001.1, AC-001.2, AC-001.3] (test) La migración deja canónicos los correos de las cuentas (espacios, mayúsculas) y no cambia ningún otro dato ni las cuentas ya canónicas — `backend/tests/test_services/test_canonical_emails_migration.py`
- [x] T-012 [REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) Los conflictos de correos hacen fallar la migración sin modificar cuentas ni solicitudes, con el mensaje de la spec y sin crear la garantía — `backend/tests/test_services/test_canonical_emails_migration.py`
- [x] T-013 [REQ-003, AC-003.1, AC-003.2] (test) La migración deja canónicos los correos de las solicitudes de restablecimiento, conserva sus demás campos y no cuenta duplicados como conflicto — `backend/tests/test_services/test_canonical_emails_migration.py`
- [x] T-014 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5] (test) Tras la migración la base rechaza (`IntegrityError`) escrituras no canónicas en cuentas y solicitudes y acepta las canónicas — `backend/tests/test_services/test_canonical_emails_migration.py`
- [x] T-015 [REQ-006, AC-006.1, AC-006.2] (test) El downgrade retira la garantía sin tocar correos y un nuevo upgrade sobre datos canónicos vuelve a activarla — `backend/tests/test_services/test_canonical_emails_migration.py`
- [x] T-016 [REQ-001, REQ-005, AC-001.4, AC-005.1, AC-005.2, AC-005.3, AC-005.5] (test) Integración HTTP: login tras migrar una cuenta antigua, y registro, login, 409 por duplicado y restablecimiento con mayúsculas y espacios con la garantía activa — `backend/tests/test_routes/test_canonical_email_routes.py`
- [x] T-017 [REQ-005, AC-005.4] (test) Google Sign-In con Postgres real y fakes por constructor guarda el correo canónico con la garantía activa — `backend/tests/test_services/test_canonical_email_google.py`
- [x] T-018 [REQ-004, REQ-005] (test) Fixture `legacy_email_schema` que quita las restricciones y las restaura en el teardown, limpiando las filas — `backend/tests/conftest.py`
- [x] T-019 [REQ-004] (test) Adaptar la preparación de los tres tests de la 014 con `drop_canonical_email_checks` antes de insertar, sin tocar aserciones ni marcadores — `backend/tests/test_services/test_lowercase_emails_migration.py`
- [x] T-020 [REQ-004] (test) Adaptar con el fixture `legacy_email_schema` los dos tests de la 014 de cuentas antiguas con mayúsculas, sin tocar aserciones ni marcadores — `backend/tests/test_routes/test_auth_routes.py`

## Fase B — Implementación (implementer)
- [x] T-030 [REQ-001, REQ-002, REQ-003, AC-001.1, AC-001.2, AC-001.3, AC-002.1, AC-002.2, AC-002.3, AC-003.1, AC-003.2] (migration) `upgrade()`: detectar conflictos y lanzar `RuntimeError` con el mensaje de la spec antes de escribir, y convertir con `UPDATE ... WHERE email <> <canónica>` las cuentas y las solicitudes — `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py`
- [x] T-031 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5] (migration) `upgrade()`: crear `ck_users_email_canonical` y `ck_password_reset_requests_email_canonical` tras la conversión — `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py`
- [x] T-032 [REQ-006, AC-006.1, AC-006.2] (migration) `downgrade()`: retirar las dos restricciones sin tocar correos — `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py`
- [x] T-033 [REQ-004, REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5] (impl) Declarar `CheckConstraint(CANONICAL_EMAIL_CONDITION, name="ck_users_email_canonical")` en `__table_args__` de `User`, manteniendo el esquema `public` — `backend/models/user.py`
- [x] T-034 [REQ-004, AC-004.4, AC-005.5] (impl) Declarar `CheckConstraint` `ck_password_reset_requests_email_canonical` (importando la constante de `models/user.py`) al principio de `__table_args__` de `PasswordResetRequest` — `backend/models/password_reset_request.py`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-011 | T-030 |
| REQ-001 | AC-001.2 | T-011 | T-030 |
| REQ-001 | AC-001.3 | T-011 | T-030 |
| REQ-001 | AC-001.4 | T-016 | T-030 |
| REQ-002 | AC-002.1 | T-012 | T-030 |
| REQ-002 | AC-002.2 | T-012 | T-030 |
| REQ-002 | AC-002.3 | T-012 | T-030 |
| REQ-003 | AC-003.1 | T-013 | T-030 |
| REQ-003 | AC-003.2 | T-013 | T-030 |
| REQ-004 | AC-004.1 | T-014 | T-031, T-033 |
| REQ-004 | AC-004.2 | T-014 | T-031, T-033 |
| REQ-004 | AC-004.3 | T-014 | T-031, T-033 |
| REQ-004 | AC-004.4 | T-014 | T-031, T-034 |
| REQ-004 | AC-004.5 | T-014 | T-031, T-033 |
| REQ-005 | AC-005.1 | T-016 | T-033 |
| REQ-005 | AC-005.2 | T-016 | T-033 |
| REQ-005 | AC-005.3 | T-016 | T-033 |
| REQ-005 | AC-005.4 | T-017 | T-033 |
| REQ-005 | AC-005.5 | T-016 | T-033, T-034 |
| REQ-006 | AC-006.1 | T-015 | T-032 |
| REQ-006 | AC-006.2 | T-015 | T-031, T-032 |
