# Verify report 019 — Integridad de los correos guardados: recorte de espacios y garantía en la base

- **Modo:** full (etapa verify)
- **Fecha:** 2026-10-18T21:29:19.665Z · **Rama:** `fix/019-auth-email-integrity` @ `ec0f765` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend/`, contra `fitnerd_test` en `localhost:5433`) | ✅ | 1018 passed in 70.60s, 0 failed, 0 skipped |
| backend | `lint_ratchet` (`node scripts/lint-ratchet.mjs backend`) | ✅ | Sin violaciones nuevas respecto a `main` (exit 0). Los archivos nuevos no tienen violaciones; `models/user.py` tiene 2 violaciones previas (E501 en la línea 52 de `main`), toleradas |
| backend | `typecheck` | — | `null` en la config: no aplica |
| backend | `build` | — | `null` en la config: no aplica |

Comprobación adicional de la migración (sin base de datos, con `alembic.script.ScriptDirectory` en local, sin `flask db`):
- `heads` = `['e5b7d9f1a3c6']`: es la única cabeza de Alembic. ✅
- `e5b7d9f1a3c6` tiene `down_revision = 'a7d3f9c1e5b2'`. ✅
- No se ejecutó ningún comando contra una base real ni de producción.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-011, T-030 | `test_canonical_emails_migration.py::test_upgrade_trims_the_spaces_around_an_account_email` | ✅ |
| REQ-001 | AC-001.2 | T-011, T-030 | `test_canonical_emails_migration.py::test_upgrade_lowercases_and_trims_an_account_email` | ✅ |
| REQ-001 | AC-001.3 | T-011, T-030 | `test_canonical_emails_migration.py::test_upgrade_keeps_every_other_column_of_accounts_untouched` | ✅ |
| REQ-001 | AC-001.4 | T-016, T-030 | `test_canonical_email_routes.py::test_login_works_after_migrating_an_old_account_stored_with_a_leading_space` | ✅ |
| REQ-002 | AC-002.1 | T-012, T-030 | `test_canonical_emails_migration.py::test_upgrade_fails_listing_conflicting_emails_exactly_as_stored` | ✅ |
| REQ-002 | AC-002.2 | T-012, T-030 | `test_canonical_emails_migration.py::test_upgrade_groups_conflicts_by_canonical_form_and_modifies_nothing` | ✅ |
| REQ-002 | AC-002.3 | T-012, T-030 | `test_canonical_emails_migration.py::test_failed_upgrade_creates_no_guarantee_and_leaves_requests_untouched` | ✅ |
| REQ-003 | AC-003.1 | T-013, T-030 | `test_canonical_emails_migration.py::test_upgrade_canonicalizes_a_request_email_and_keeps_its_other_fields` | ✅ |
| REQ-003 | AC-003.2 | T-013, T-030 | `test_canonical_emails_migration.py::test_upgrade_keeps_duplicate_requests_without_counting_them_as_conflict` | ✅ |
| REQ-004 | AC-004.1 | T-014, T-031, T-033 | `test_canonical_emails_migration.py::test_guarantee_rejects_an_account_with_uppercase_email` | ✅ |
| REQ-004 | AC-004.2 | T-014, T-031, T-033 | `test_canonical_emails_migration.py::test_guarantee_rejects_an_account_with_surrounding_spaces` | ✅ |
| REQ-004 | AC-004.3 | T-014, T-031, T-033 | `test_canonical_emails_migration.py::test_guarantee_rejects_changing_an_account_email_to_non_canonical` | ✅ |
| REQ-004 | AC-004.4 | T-014, T-031, T-034 | `test_canonical_emails_migration.py::test_guarantee_rejects_a_request_with_non_canonical_email` | ✅ |
| REQ-004 | AC-004.5 | T-014, T-031, T-033 | `test_canonical_emails_migration.py::test_guarantee_accepts_a_canonical_account_email` | ✅ |
| REQ-005 | AC-005.1 | T-016, T-033 | `test_canonical_email_routes.py::test_register_with_uppercase_and_spaces_stores_the_canonical_email` | ✅ |
| REQ-005 | AC-005.2 | T-016, T-033 | `test_canonical_email_routes.py::test_login_with_uppercase_and_leading_space_finds_the_registered_account` | ✅ |
| REQ-005 | AC-005.3 | T-016, T-033 | `test_canonical_email_routes.py::test_register_with_a_case_variant_of_an_existing_email_returns_409` | ✅ |
| REQ-005 | AC-005.4 | T-017, T-033 | `test_canonical_email_google.py::test_google_first_login_stores_the_canonical_email_with_the_guarantee_active` | ✅ |
| REQ-005 | AC-005.5 | T-016, T-033, T-034 | `test_canonical_email_routes.py::test_forgot_password_with_uppercase_and_spaces_sends_mail_and_stores_canonical` | ✅ |
| REQ-006 | AC-006.1 | T-015, T-032 | `test_canonical_emails_migration.py::test_downgrade_removes_the_guarantee_without_touching_emails` | ✅ |
| REQ-006 | AC-006.2 | T-015, T-031, T-032 | `test_canonical_emails_migration.py::test_upgrade_again_on_canonical_data_changes_nothing_and_reactivates_guarantee` | ✅ |

- AC sin test: —
- REQ sin tarea: — (REQ-001 a REQ-006 tienen tareas en `tasks.md`)
- Tareas sin marcar `[x]`: — (18 de 18 marcadas)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: — (búsqueda en `git diff main` de `backend/`: ninguno)
- Tests de 014 adaptados (`test_lowercase_emails_migration.py`, `test_auth_routes.py`): en verde dentro de la suite completa

## 3. Criterios de aceptación manuales
- Ninguno. Los 21 AC son comprobables de forma automática. El paso manual de producción (volcado completo previo, aplicación de `flask db upgrade` y resolución de conflictos de correos) no es un AC: lo documentará la etapa docs (Art. P4).

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | Ninguno | — | ninguno |

## Notas para el backlog (no bloquean)
- `state.json`, nota del hito `spec` («Spec 019: 6 REQ, 23 AC»): la spec tiene 21 AC (AC-001.1 a AC-006.2). El recuento de la nota es erróneo; no afecta a la cobertura.
- Las 2 violaciones E501 de `backend/models/user.py` (línea 52 en `main`) son previas a la feature y están toleradas por el ratchet.
