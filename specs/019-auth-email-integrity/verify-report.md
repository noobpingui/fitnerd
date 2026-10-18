# Verify report 019 — Integridad de los correos guardados: recorte de espacios y garantía en la base

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-18T21:23:42.953Z · **Rama:** `fix/019-auth-email-integrity` @ `e741624` (con cambios sin commit de la etapa tests) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` sobre los 3 archivos nuevos con marcador `SDD: 019` (`backend/`) | ✅ (rojo esperado) | 21 collected, 21 failed, 0 passed: los 21 tests nuevos fallan por comportamiento ausente (sección 2) |
| backend | Tests 014 adaptados (`test_lowercase_emails_migration.py` ×3, `test_auth_routes.py` ×2 `test_register_rejects_an_email_matching_a_legacy_account_with_uppercase` y `test_login_finds_a_legacy_account_stored_with_uppercase`) (`backend/`) | ✅ | 5 passed |
| backend | `lint_ratchet` | — | No se ejecuta en modo red |

Nota: en los tests 014 adaptados el diff solo añade el parámetro `legacy_email_schema` (o `drop_canonical_email_checks`) a la firma o a la preparación; no cambian aserciones ni marcadores (`git diff`, sin líneas `skip`/`xfail`/`.only`).

Suite completa: no se repite en modo red. En la ejecución anterior de la etapa tests (21:20) era 998 passed y 20 failed, y los 20 fallos eran nuevos de 019.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-011, T-030 | `test_canonical_emails_migration.py::test_upgrade_trims_the_spaces_around_an_account_email` | ❌ rojo legítimo (`NotImplementedError: not implemented`) |
| REQ-001 | AC-001.2 | T-011, T-030 | `test_canonical_emails_migration.py::test_upgrade_lowercases_and_trims_an_account_email` | ❌ rojo legítimo (`not implemented`) |
| REQ-001 | AC-001.3 | T-011, T-030 | `test_canonical_emails_migration.py::test_upgrade_keeps_every_other_column_of_accounts_untouched` | ❌ rojo legítimo (`not implemented`) |
| REQ-001 | AC-001.4 | T-016, T-030 | `test_canonical_email_routes.py::test_login_works_after_migrating_an_old_account_stored_with_a_leading_space` | ❌ rojo legítimo (`not implemented` en `run_upgrade`) |
| REQ-002 | AC-002.1 | T-012, T-030 | `test_canonical_emails_migration.py::test_upgrade_fails_listing_conflicting_emails_exactly_as_stored` | ❌ rojo legítimo (mensaje `'not implemented'` en lugar del de conflicto) |
| REQ-002 | AC-002.2 | T-012, T-030 | `test_canonical_emails_migration.py::test_upgrade_groups_conflicts_by_canonical_form_and_modifies_nothing` | ❌ rojo legítimo (`assert False` en `conflict_groups`: el mensaje no empieza por el prefijo) |
| REQ-002 | AC-002.3 | T-012, T-030 | `test_canonical_emails_migration.py::test_failed_upgrade_creates_no_guarantee_and_leaves_requests_untouched` | ❌ rojo legítimo (`assert False`: el `NotImplementedError` del andamiaje no empieza por el prefijo del conflicto; ya no pasa sin implementar) |
| REQ-003 | AC-003.1 | T-013, T-030 | `test_canonical_emails_migration.py::test_upgrade_canonicalizes_a_request_email_and_keeps_its_other_fields` | ❌ rojo legítimo (`not implemented`) |
| REQ-003 | AC-003.2 | T-013, T-030 | `test_canonical_emails_migration.py::test_upgrade_keeps_duplicate_requests_without_counting_them_as_conflict` | ❌ rojo legítimo (`not implemented`) |
| REQ-004 | AC-004.1 | T-014, T-031, T-033 | `test_canonical_emails_migration.py::test_guarantee_rejects_an_account_with_uppercase_email` | ❌ rojo legítimo (`not implemented`) |
| REQ-004 | AC-004.2 | T-014, T-031, T-033 | `test_canonical_emails_migration.py::test_guarantee_rejects_an_account_with_surrounding_spaces` | ❌ rojo legítimo (`not implemented`) |
| REQ-004 | AC-004.3 | T-014, T-031, T-033 | `test_canonical_emails_migration.py::test_guarantee_rejects_changing_an_account_email_to_non_canonical` | ❌ rojo legítimo (`not implemented`) |
| REQ-004 | AC-004.4 | T-014, T-031, T-034 | `test_canonical_emails_migration.py::test_guarantee_rejects_a_request_with_non_canonical_email` | ❌ rojo legítimo (`not implemented`) |
| REQ-004 | AC-004.5 | T-014, T-031, T-033 | `test_canonical_emails_migration.py::test_guarantee_accepts_a_canonical_account_email` | ❌ rojo legítimo (`not implemented`) |
| REQ-005 | AC-005.1 | T-016, T-033 | `test_canonical_email_routes.py::test_register_with_uppercase_and_spaces_stores_the_canonical_email` | ❌ rojo legítimo (precondición: `ck_users_email_canonical` no existe en `pg_constraint`) |
| REQ-005 | AC-005.2 | T-016, T-033 | `test_canonical_email_routes.py::test_login_with_uppercase_and_leading_space_finds_the_registered_account` | ❌ rojo legítimo (precondición: la garantía no existe) |
| REQ-005 | AC-005.3 | T-016, T-033 | `test_canonical_email_routes.py::test_register_with_a_case_variant_of_an_existing_email_returns_409` | ❌ rojo legítimo (precondición: la garantía no existe) |
| REQ-005 | AC-005.4 | T-017, T-033 | `test_canonical_email_google.py::test_google_first_login_stores_the_canonical_email_with_the_guarantee_active` | ❌ rojo legítimo (precondición: la garantía no existe) |
| REQ-005 | AC-005.5 | T-016, T-033, T-034 | `test_canonical_email_routes.py::test_forgot_password_with_uppercase_and_spaces_sends_mail_and_stores_canonical` | ❌ rojo legítimo (precondición: la garantía no existe) |
| REQ-006 | AC-006.1 | T-015, T-032 | `test_canonical_emails_migration.py::test_downgrade_removes_the_guarantee_without_touching_emails` | ❌ rojo legítimo (`not implemented`) |
| REQ-006 | AC-006.2 | T-015, T-031, T-032 | `test_canonical_emails_migration.py::test_upgrade_again_on_canonical_data_changes_nothing_and_reactivates_guarantee` | ❌ rojo legítimo (`not implemented`) |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: T-030 a T-034 (fase B, implementer; esperado en esta etapa)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: —
- Tests nuevos que pasan sin implementación: — (0 de 21)

Verificación de scaffolds (Art. B5.6):
- `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py`: `upgrade()` y `downgrade()` solo lanzan `NotImplementedError("not implemented")`; las constantes tienen su valor final. ✅
- `backend/models/user.py`: solo la constante `CANONICAL_EMAIL_CONDITION`, sin `CheckConstraint` ni lógica. ✅

## 3. Criterios de aceptación manuales
- Ninguno en esta etapa. Las pruebas manuales de producción (volcado previo, `flask db upgrade`, comprobación de conflictos) las documentará la etapa docs (Art. P4).

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | Ninguno. El fallo anterior (AC-002.3 pasaba sin implementar) queda resuelto: ahora falla por el prefijo del mensaje de conflicto. | `test_canonical_emails_migration.py:238`: `assert False` tras `startswith(CONFLICT_PREFIX)` sobre `NotImplementedError('not implemented')` | ninguno |
| 2 | Ninguno. Los 21 fallos son rojo legítimo esperado en red (`not implemented` en el andamiaje o precondición `ck_…` ausente en `pg_constraint`). | Ver sección 2. Sin errores de sintaxis, fixture o import fuera del plan. | ninguno (esperado: implementer en T-030 a T-034) |
