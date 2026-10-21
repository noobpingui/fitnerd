# Verify report 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Modo:** red (tras la etapa tests), iteración 3 de la corrección (repetición del red check tras la última corrección del test-author)
- **Fecha:** 2026-10-21T07:21:27.224Z · **Rama:** `feat/023-generic-food-catalog` @ `aeebe4e` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Modo red: solo los 22 archivos de test con marcador `SDD: 023` (11 de backend y 11 de frontend), mediante `commands.test_files`. Lint, typecheck y build no se ejecutan en red.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q <11 archivos con SDD: 023>` (`backend`) | ⚠️ | 281 passed, 325 failed, 6 errors (612 tests). Mismas cifras que la iteración 2: el cambio de la iteración 3 está solo en el frontend. Los 6 errores son de setup. |
| frontend | `npx vitest run <11 archivos con SDD: 023>` (`frontend`) | ⚠️ | 114 passed, 73 failed de 187 tests (antes 116 / 71). **0 «Unhandled Errors»**. **0 `TypeError`** y sin errores de montaje. Los 73 fallos son de comportamiento ausente. |

Verificación de la corrección de la iteración 3 (AddFoodDialog.test.tsx):
- «sin resultados, muestra «No encontramos alimentos para «gallo pinto».»…» (AC-009.5, línea 294) ahora falla: su aserción `expect(searchMock).toHaveBeenCalledTimes(1)` no se cumple (0 llamadas al catálogo; el componente sigue llamando a USDA). Cumplido.
- «sin resultados» se anuncia en la región de estado (AC-N002.2, línea 419) ahora falla por la misma causa, con `searchMock` a 0 llamadas. Cumplido.

Clasificación de los fallos (todos los tests con marcador 023 que no son guardas):
- **Rojo legítimo (backend):** `NotImplementedError: not implemented` de los esqueletos; `404` de `GET /api/catalog/search` (ruta nueva); `KeyError` de `catalog_id`/`id`/`results` (respuesta sin el campo nuevo); `ValidationError` con el mensaje antiguo «Cada alimento debe ser de USDA o personalizado.» frente al nuevo; `DID NOT RAISE` y `assert False is True` (rollback que aún no existe); `FileNotFoundError` de `backend/migrations/versions/d4f6a8c0e2b5_…py` (migración de T-100, aún no existe).
- **Rojo legítimo (frontend):** `not implemented` de `CatalogResultList` y de `searchCatalog`; `catalogSearchResponseSchema` (`z.never()`) que rechaza las respuestas válidas; `sourceLabel` que aún devuelve «Personalizado» para el catálogo; elementos ausentes («Elegir {nombre}», lista «Resultados», textos nuevos de AddFoodDialog, región de estado con el texto del catálogo); textos legales nuevos y fecha «21 de octubre de 2026»; `router.tsx` que aún importa `FoodsPage`.
- **Rojo ilegítimo:** ninguno. No hay errores de sintaxis, de configuración, de fixture ni imports fuera del plan.
- **Errores de entorno:** ninguno. Postgres en el puerto 5433 respondió y las dependencias del venv y de `node_modules` funcionan.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test (en red) |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a 001.4 | T-001, T-003, T-005, T-025, T-028, T-101, T-103, T-120 a T-124 | `test_food_catalog_csv.py`, `test_catalog_csv_reader.py` | ✅ rojo legítimo (esqueletos; el CSV aún no existe) |
| REQ-002 | AC-002.1 a 002.6 | T-001, T-004, T-007, T-010, T-026, T-029, T-100 a T-104, T-110, T-111 | `test_load_food_catalog_script.py`, `test_catalog_load_service.py` | ✅ rojo legítimo |
| REQ-003 | AC-003.1 a 003.8 | T-005, T-007, T-020, T-021, T-025, T-027, T-103, T-104, T-123, T-124 | `test_catalog_csv_reader.py`, `test_catalog_load_service.py` | ✅ rojo legítimo |
| REQ-004 | AC-004.1 a 004.16 | T-001, T-003, T-004, T-006, T-020, T-022, T-023, T-032, T-101, T-102, T-105, T-106 | `test_catalog_rules.py`, `test_catalog_search_service.py`, `test_catalog_routes.py` | ✅ rojo legítimo |
| REQ-005 | AC-005.1 a 005.4 | T-006, T-024, T-032, T-105, T-106 | `test_catalog_search_service.py`, `test_catalog_routes.py` | ✅ rojo legítimo (404 y `NotImplementedError`) |
| REQ-006 | AC-006.1 a 006.6 | T-002, T-004, T-008, T-009, T-014, T-030, T-031, T-033, T-100, T-102, T-107 a T-109 | `test_meal_rules.py`, `test_meal_service.py`, `test_meal_routes.py` | ✅ rojo legítimo |
| REQ-007 | AC-007.1, 007.2 | T-002, T-007, T-031, T-033, T-100, T-104, T-108 | `test_meal_routes.py`, `test_meal_service.py` | ✅ rojo legítimo |
| REQ-008 | AC-008.1, 008.2 | T-002, T-033, T-034, T-045, T-100, T-109, T-133 | `test_catalog_migration.py`, `test_meal_routes.py`, `test_meal_service.py`, `schemas.test.ts` | ✅ rojo legítimo |
| REQ-009 | AC-009.1 a 009.7 | T-011, T-012, T-013, T-040 a T-043, T-130 a T-132, T-135, T-136 | `AddFoodDialog.test.tsx`, `CatalogResultList.test.tsx`, `catalog/schemas.test.ts` | ✅ rojo legítimo (incluidos AC-009.5 y AC-N002.2 corregidos) |
| REQ-010 | AC-010.1 a 010.3 | T-014, T-040, T-044 a T-046, T-133, T-134 | `format.test.ts`, `schemas.test.ts`, `DiaryPage.test.tsx` | ✅ rojo legítimo |
| REQ-011 | AC-011.1, 011.2 | T-047, T-048, T-137 | `foodsRoute.test.tsx`, `diaryRoute.test.tsx`, `noFoodsLink.test.tsx` | ✅ rojo legítimo en la redirección; las dos guardas de navegación van excluidas (ver sección 4) |
| REQ-012 | AC-012.1 a 012.3 | T-049, T-050, T-138, T-139 | `TermsOfServicePage.test.tsx`, `PrivacyPolicyPage.test.tsx` | ✅ rojo legítimo |
| NFR-001 | AC-N001.1, N001.2 | T-006, T-024, T-032, T-105, T-106 | `test_catalog_search_service.py`, `test_catalog_routes.py` | ✅ rojo legítimo |
| NFR-002 | AC-N002.1, N002.2 | T-011, T-013, T-042, T-043, T-132, T-136 | `CatalogResultList.test.tsx`, `AddFoodDialog.test.tsx` | ✅ rojo legítimo |

- AC sin test: — (67 de 67 ACs tienen al menos un marcador `SDD: 023`; comprobado contra `spec.md`)
- REQ sin tarea: — (todos los REQ y NFR aparecen en `tasks.md`)
- Tareas sin marcar `[x]`: 27 de 67 (T-100 a T-111, T-120 a T-124, T-130 a T-139). Es lo esperado en modo red.
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: ninguno.

## 3. Criterios de aceptación manuales
No aplica en modo red. Los AC visuales y de UX (AC-009.1 a 009.7, AC-010.1 a 010.3, AC-N002.1 y AC-N002.2) se revisarán en verify.

## 4. Fallos (si los hay)
Ninguno en el criterio de rojo: todos los tests nuevos con marcador `SDD: 023` fallan por comportamiento ausente.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | ninguno | — | — |

**Guardas de regresión excluidas del criterio de rojo** (pasan porque el comportamiento ya existe; no prueban la 023):
- `test_meal_routes.py::test_post_validation_message_and_nothing_saved`: 20 de 30 casos pasan. Son casos de la 022 (límites de calorías, macros, gramos, nombre, tipo de comida e ítems) que mantienen su mensaje. Los 10 casos restantes (`catalog_*`, `catalog_id_*`, `fdc_id_and_name`, `neither_fdc_id_nor_name`) fallan por rojo legítimo (mensaje nuevo o ruta de catálogo ausente).
- `noFoodsLink.test.tsx`, dos tests (marcados 023 AC-011.2): son tests de la 021 con el marcador añadido; la navegación ya no enlaza `/foods`.
- `foodsRoute.test.tsx` → «con el onboarding pendiente, /foods muestra el onboarding y no el diario» (marcado 023 AC-011.1): test de la 021 con el marcador cambiado; el onboarding ya se muestra.

**Errores de setup (6, backend):** `test_food_catalog_csv.py`, fixture `records` que llama a `read_catalog_csv` (esqueleto `not implemented`). Rojo legítimo, no es un fallo del fixture.

Trazabilidad de la red: 67 de 67 ACs cubiertos por al menos un marcador `SDD: 023`.
