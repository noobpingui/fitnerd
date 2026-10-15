# Verify report 012 — Eliminar el catálogo de ejercicios, los favoritos y el plan semanal

- **Modo:** red (tras la etapa tests, iteración 2)
- **Fecha:** 2026-10-14T21:58:08.677Z · **Rama:** `feat/012-remove-catalog` @ `8db2fd5`
- **Resultado:** PASS

## 1. Comandos ejecutados

| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `python -m pytest -v` sobre los 4 archivos con `SDD: 012` (`test_retired_catalog_routes.py`, `test_catalog_removal_migration.py`, `test_no_catalog_leftovers.py`, `test_health_routes.py`) | ✅ | 30 tests: 13 failed, 17 passed. Los 13 fallos son rojo legítimo (ver §2 y §4). Los 17 verdes son todos de la excepción `red_check_exception` (AC-002.*) |
| frontend | `npx vitest run` sobre los 7 archivos con `SDD: 012` | ✅ | 30 tests: 6 failed, 24 passed. Los 6 fallos son asserts legítimos (AC-007.1 a 007.5 y AC-N001.1). Los 24 verdes son de la excepción (AC-004.*, AC-005.*, AC-006.*, AC-007.6, AC-008.*) |

Comandos de verify (lint, tsc, build, ruff-new, suite completa) no se ejecutan en modo red.

Entorno: Postgres responde en el puerto 5433; `backend/.venv/Scripts/python.exe` y `frontend/node_modules` existen. No hay errores de entorno.

<!--
Modo red: solo se ejecutan los tests nuevos. Resultado PASS significa que TODOS fallan por comportamiento
ausente (assert o 404/501 esperado), no por errores de import, sintaxis o fixture.
-->

## 2. Trazabilidad

Clasificación de los tests nuevos (`SDD: 012`) según `red_check_exception` (AC-002.\*, AC-004.\*, AC-005.\*, AC-006.\*, AC-008.\* y AC-007.6):

| REQ / NFR | AC | Tests con `SDD: 012` | Estado | Clasificación |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | `test_retired_list_endpoints_return_404_for_a_regular_user` (5 params) | ❌ rojo | Rojo legítimo (assert 200/400 en vez de 404) |
| REQ-001 | AC-001.2 | `test_retired_admin_post_endpoints_return_404` | ❌ rojo | Rojo legítimo (assert 201 en vez de 404) |
| REQ-001 | AC-001.2 | `test_retired_admin_delete_endpoints_return_404` (3 params) | ❌ rojo | Rojo legítimo (`sigue registrada en el url_map`) |
| REQ-001 | AC-001.3 | `test_retired_favorite_endpoints_return_404` | ❌ rojo | Rojo legítimo (`sigue registrada en el url_map`) |
| REQ-001 | AC-001.3 | `test_retired_weekly_plan_write_endpoints_return_404` | ❌ rojo | Rojo legítimo (`POST /api/weekly-plan sigue registrada en el url_map`) |
| REQ-001 | AC-001.4 | `test_retired_endpoints_return_404_not_401_without_authorization` (2 params) | ❌ rojo | Rojo legítimo (assert 401 en vez de 404) |
| REQ-002 | AC-002.1 | `test_url_map_keeps_the_rules_of_the_remaining_areas`, `test_health_check_does_not_change_row_counts` | ✅ verde | Permitido (excepción AC-002.*) |
| REQ-002 | AC-002.2 | `test_health_still_returns_200` | ✅ verde | Permitido (excepción AC-002.*) |
| REQ-002 | AC-002.3 | `test_profile_and_body_metrics_keep_their_format` | ✅ verde | Permitido (excepción AC-002.*) |
| REQ-003 | AC-003.1 | `test_upgrade_drops_the_five_tables_and_keeps_users_profiles_and_metrics` | ❌ rojo | Rojo legítimo (`NotImplementedError` del scaffold, ADR-0012) |
| REQ-003 | AC-003.2 | `test_downgrade_recreates_the_five_tables_empty_with_their_structure` | ❌ rojo | Rojo legítimo (`NotImplementedError` del scaffold, ADR-0012) |
| REQ-003 | AC-003.3 | `test_test_database_has_none_of_the_retired_tables` | ❌ rojo | Rojo legítimo (assert: `public.body_regions` sigue en metadata) |
| NFR-001 | AC-N001.2 | `test_backend_source_has_no_retired_routes_or_table_names` | ❌ rojo | Rojo legítimo (assert: 29 coincidencias en el backend) |
| NFR-001 | AC-N001.2 | `test_catalog_migration_script_to_production_no_longer_exists` | ❌ rojo | Rojo legítimo (assert: el script existe) |
| REQ-004 | AC-004.1 | 4 tests de `router.test.tsx` (`/categories`, `/categories/r1`, `/categories/r1/c1`, `/favorites` con sesión) | ✅ verde | Permitido (excepción AC-004.*) |
| REQ-004 | AC-004.2 | `/favorites` sin sesión | ✅ verde | Permitido (excepción AC-004.*) |
| REQ-005 | AC-005.1 | `Navbar.test.tsx` | ✅ verde | Permitido (excepción AC-005.*) |
| REQ-005 | AC-005.2 | `BottomTabBar.test.tsx` | ✅ verde | Permitido (excepción AC-005.*) |
| REQ-006 | AC-006.1, AC-006.2 | `AuthHero.test.tsx` (`/login`, `/register`) | ✅ verde | Permitido (excepción AC-006.*) |
| REQ-007 | AC-007.1 | `PrivacyPolicyPage.test.tsx` "Actividad en la app" | ❌ rojo | Rojo legítimo (assert: contiene "favoritos") |
| REQ-007 | AC-007.2 | `PrivacyPolicyPage.test.tsx` "Para qué usamos tu información" | ❌ rojo | Rojo legítimo (assert: contiene "catálogo") |
| REQ-007 | AC-007.3 | `PrivacyPolicyPage.test.tsx` fecha | ❌ rojo | Rojo legítimo (assert: contiene "8 de octubre de 2026") |
| REQ-007 | AC-007.4 | `TermsOfServicePage.test.tsx` "No es asesoría médica" | ❌ rojo | Rojo legítimo (assert: contiene "catálogo") |
| REQ-007 | AC-007.5 | `TermsOfServicePage.test.tsx` fecha | ❌ rojo | Rojo legítimo (assert: contiene "2 de septiembre de 2026") |
| REQ-007 | AC-007.6 | 2 tests de voseo (privacidad y términos) | ✅ verde | Permitido (excepción AC-007.6) |
| REQ-008 | AC-008.1, AC-008.2 | 5 tests de `router.test.tsx` (`/macros`, `/body-metrics`, `/coach`, `/store`, `/profile`) | ✅ verde | Permitido (excepción AC-008.*) |
| NFR-001 | AC-N001.1 | `noRetiredSections.test.ts` | ❌ rojo | Rojo legítimo (assert: 16 coincidencias en el frontend) |
| NFR-001 | AC-N001.3 | Comandos del verifier en verify (sin marcador, excepción de trazabilidad) | — | No aplica en red |

- ACs sin test: ninguno (AC-N001.3 cubierto por la excepción de trazabilidad).
- REQs sin tarea: ninguno.
- Tareas sin marcar `[x]`: T-030..T-052 pendientes (fase B, esperado en red). T-000..T-025 marcadas.

## 3. Criterios de aceptación

Los AC que no se pueden comprobar de forma automática no están en esta etapa. AC-N001.3 (lint, tsc, build, ruff-new) se comprueba en la etapa verify.

## 4. Fallos (si los hay)

Ninguno ilegítimo. Los tres fallos de la iteración 1 (AC-001.2 DELETE, AC-001.3 favoritos y plan semanal) quedan corregidos: ahora fallan por `sigue registrada en el url_map`, es decir, por la ruta retirada todavía viva.

Rojos legítimos en esta iteración (no son fallos): 13 backend y 6 frontend, por assert, `NotImplementedError` del scaffold o lista de coincidencias no vacía.

Sin errores de import, sintaxis ni fixture en ningún test nuevo. Sin `skip`, `xfail` ni `.only` en los archivos con marcador `SDD: 012`.
