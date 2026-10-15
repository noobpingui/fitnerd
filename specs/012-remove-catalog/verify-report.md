# Verify report 012 — Eliminar el catálogo de ejercicios, los favoritos y el plan semanal

- **Modo:** full (tras la etapa implement, iteración 2, tras las correcciones de review F1, F2, F4 y F5)
- **Fecha:** 2026-10-15T01:43:49.980Z · **Rama:** `feat/012-remove-catalog` @ `6cfdf2c`
- **Resultado:** PASS

## 1. Comandos ejecutados

| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `backend/.venv/Scripts/python.exe -m pytest -q` | ✅ | 699 passed (37.29 s) |
| backend | `node .claude/sdd/scripts/ruff-new.mjs main` | ✅ | Exit 0. Sin violaciones nuevas en los .py cambiados (`models/__init__.py` 8 previas toleradas, `routes/__init__.py` 1 previa toleradas, el resto 0) |
| frontend | `npm test` | ✅ | 37 archivos, 462 tests passed |
| frontend | `npm run lint` | ✅ | Exit 0, 0 errores. 2 warnings preexistentes (`components/ui/form.tsx:159`, `components/ui/button.tsx:64`, `only-export-components`) |
| frontend | `npx tsc -b` | ✅ | Exit 0, sin errores |
| frontend | `npm run build` | ✅ | Exit 0. Solo el aviso de tamaño de chunk (1.08 MB), que ya existía |

Entorno: Postgres responde (los tests de backend pasan), `backend/.venv/Scripts/python.exe` y `frontend/node_modules` existen. No hay errores de entorno.

Comprobaciones de las correcciones de review (iteración 2):
- F1: `frontend/nginx.conf` ya no contiene `categories`. ✅
- F2: el comentario de `AppLayout.tsx` ya no enumera las pantallas protegidas sin `/store` ni `/profile` (se dice "TODAS las pantallas protegidas"). ✅
- F4: `PrivacyPolicyPage.test.tsx:124` ancla la fecha antigua con `(^|\D)8 de octubre de 2026`. ✅
- F5: no quedan líneas de más de 120 caracteres en `PrivacyPolicyPage.tsx` ni en `StorePage.tsx`. ✅
- F3 (MENOR de fecha, diferida al backlog por el usuario): no se comprueba aquí; `updatedAt` es "14 de octubre de 2026".

Comprobación de restos: sin coincidencias de `/api/body-regions`, `/api/exercise-categories`, `/api/exercises`, `/api/favorites`, `/api/weekly-plan`, `CATALOG_ENABLED`, `app/sections`, `features/exercises`, `weekly-plan` ni `dnd-kit` en `frontend/src`, `package.json` ni `nginx.conf` (fuera de tests). Sin referencias a las tablas retiradas en el backend (fuera de migraciones y tests).

Integridad de los tests: `tasks.md` tiene 49 tareas `[x]` y ninguna `[ ]` (la única `- [ ]` está en el comentario de plantilla de la cabecera). En el diff contra `main` no hay `skip`, `xfail`, `.only`, `.skip` ni `it.todo` nuevos.

## 2. Trazabilidad

| REQ / NFR | AC | Tareas | Tests con `SDD: 012` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-001, T-031, T-032, T-033 | `test_retired_catalog_routes.py:44` | ✅ |
| REQ-001 | AC-001.2 | T-002, T-031, T-032 | `test_retired_catalog_routes.py:63`, `:90` | ✅ |
| REQ-001 | AC-001.3 | T-003, T-031, T-033 | `test_retired_catalog_routes.py:105`, `:119` | ✅ |
| REQ-001 | AC-001.4 | T-004, T-031 | `test_retired_catalog_routes.py:138` | ✅ |
| REQ-002 | AC-002.1 | T-005, T-012, T-013, T-014, T-031 | `test_retired_catalog_routes.py:147`, `test_health_routes.py:123` | ✅ |
| REQ-002 | AC-002.2 | T-006, T-031 | `test_retired_catalog_routes.py:166` | ✅ |
| REQ-002 | AC-002.3 | T-007, T-031 | `test_retired_catalog_routes.py:174` | ✅ |
| REQ-003 | AC-003.1 | T-008, T-030 | `test_catalog_removal_migration.py:107` | ✅ |
| REQ-003 | AC-003.2 | T-009, T-030 | `test_catalog_removal_migration.py:191` | ✅ |
| REQ-003 | AC-003.3 | T-010, T-038, T-039, T-040 | `test_catalog_removal_migration.py:305` | ✅ |
| REQ-004 | AC-004.1 | T-015, T-042 | `router.test.tsx:116` | ✅ |
| REQ-004 | AC-004.2 | T-016, T-042 | `router.test.tsx:135` | ✅ |
| REQ-005 | AC-005.1 | T-018, T-043 | `Navbar.test.tsx:26` | ✅ |
| REQ-005 | AC-005.2 | T-019, T-044 | `BottomTabBar.test.tsx:8` | ✅ |
| REQ-006 | AC-006.1 | T-020, T-045 | `AuthHero.test.tsx:22` | ✅ |
| REQ-006 | AC-006.2 | T-020, T-045 | `AuthHero.test.tsx:33` | ✅ |
| REQ-007 | AC-007.1 | T-021, T-050 | `PrivacyPolicyPage.test.tsx:91` | ✅ |
| REQ-007 | AC-007.2 | T-021, T-050 | `PrivacyPolicyPage.test.tsx:107` | ✅ |
| REQ-007 | AC-007.3 | T-021, T-050 | `PrivacyPolicyPage.test.tsx:118` | ✅ |
| REQ-007 | AC-007.4 | T-023, T-051 | `TermsOfServicePage.test.tsx:26` | ✅ |
| REQ-007 | AC-007.5 | T-023, T-051 | `TermsOfServicePage.test.tsx:37` | ✅ |
| REQ-007 | AC-007.6 | T-022, T-024, T-050, T-051 | `PrivacyPolicyPage.test.tsx:127`, `TermsOfServicePage.test.tsx:46` | ✅ |
| REQ-008 | AC-008.1 | T-017, T-042 (suite completa `npm test`) | `router.test.tsx:144` + suite completa (462 passed) | ✅ |
| REQ-008 | AC-008.2 | T-017, T-042 | `router.test.tsx:144` | ✅ |
| NFR-001 | AC-N001.1 | T-025, T-042, T-046 a T-049 | `noRetiredSections.test.ts:23` | ✅ |
| NFR-001 | AC-N001.2 | T-011, T-034 a T-037, T-039 a T-041 | `test_no_catalog_leftovers.py:43`, `:65` | ✅ |
| NFR-001 | AC-N001.3 | T-052 (y todas las impl) | Sin marcador: excepción de trazabilidad aprobada en el gate de tasks. Cubierto por los comandos ruff-new, lint, tsc y build de la sección 1 | ✅ (por comandos) |

- ACs sin test: ninguno (AC-N001.3 cubierto por la excepción de trazabilidad y los comandos).
- REQs sin tarea: ninguno (REQ-001 a REQ-008 y NFR-001 aparecen en `tasks.md`).
- Tareas sin marcar `[x]`: ninguna.
- `skip`, `xfail`, `.only` o `.skip` nuevos en el diff: ninguno.

## 3. Criterios de aceptación

Todos los AC se comprueban de forma automática, salvo AC-N001.3, comprobado con comandos. No hay AC que requiera revisión manual en esta etapa.

Las aserciones visuales (por ejemplo, la distribución de la barra móvil) se verifican a nivel de DOM en los tests. Si quiere confirmarlo a ojo, eso queda para el gate del usuario.

## 4. Fallos (si los hay)

Ninguno. Todas las comprobaciones están en verde.
