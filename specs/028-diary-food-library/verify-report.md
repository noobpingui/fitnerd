# Verify report 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Modo:** red (tras la etapa tests), iteración 4 del red check (última permitida)
- **Fecha:** 2026-10-27T16:57:46.226Z · **Rama:** `feat/028-diary-food-library` @ `e3203f3` (con cambios sin commitear de las etapas scaffold y tests) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Solo se ejecutan los tests nuevos o reescritos de la feature. Los ficheros de test cambiados contienen también tests previos que se conservaron; el recuento incluye ambos. La comprobación de "pasa sin implementación" se hizo por nombre de test, con sus parametrizaciones, contra el listado de tests en verde.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q {files}` (`backend`), 10 archivos | ✅ rojo legítimo | 382 failed, 530 passed (912). Ninguno de los tests nuevos o reescritos pasa sin implementación (76 nombres comprobados, parametrizaciones incluidas). Los 530 que pasan son tests previos de esos archivos. |
| frontend | `npx vitest run {files}` (`frontend`), 14 archivos | ⚠️ rojo legítimo, 1 excepción aceptada | Test Files 13 failed \| 1 passed (14); Tests 229 failed, 328 passed (557). De los 179 tests nuevos por título, 178 fallan y 1 pasa: la guarda aceptada por el usuario (sección 4, fallo 1). |

No se ejecutan lint, typecheck ni build: en modo red no se piden (se ejecutan en modo full). Lint de backend en modo red: no se pide.

Entorno: Postgres de prueba disponible (los tests de rutas y servicios con base de datos se ejecutan), venv de backend y `node_modules` del frontend responden. No hay BLOCKED.

Clasificación de los rojos:
- **Backend (382 fallos):**
  - `NotImplementedError: not implemented` de los esqueletos (168).
  - Aserciones de valores, de estado o de contenido de la biblioteca y del límite de 500 (104 y otras).
  - 404 en rutas `/api/food-library/*` aún no registradas, y 401 esperado que llega como 404 (53).
  - `KeyError` de campos aún no devueltos (`custom_food_id`, `id`, `cf`) (18).
  - `ValidationError «Cada alimento debe ser del catálogo, de USDA o personalizado.»` lanzado por el parser actual ante un `custom_food_id` que aún no reconoce (4).
  - `Failed: DID NOT RAISE ValidationError`, porque la regla actual ignora `custom_food_id` (3).
  - `FileNotFoundError` de `backend/migrations/versions/e6a8c0d2f4b7_create_food_library.py` en `test_food_library_migration.py` (13). La migración la define el plan (T-100) y todavía no existe: rojo legítimo.
- **Frontend (229 fallos):** `Error: not implemented` (49), `TestingLibraryElementError` por roles, nombres o textos ausentes (72), `AssertionError` de llamadas a mocks o de valores (25) y `expect` sobre elementos inexistentes (4). Además, `PhotoReview.source.test.ts` busca `useWatch(` en el código actual, que aún usa `form.watch`.
- **Rojo ilegítimo:** ninguno. No hay errores de sintaxis, de importación de módulos fuera del plan, de configuración ni de fixtures del test. Todos los ficheros se colectan, y no aparece ningún `ImportError`, `ModuleNotFoundError` ni `Failed to resolve import`.
- **Guardas de backend de la iteración anterior:** retiradas (ya no existen `test_the_limits_and_messages_match_the_spec` ni `test_the_service_has_no_embedding_client_or_rate_limiter`).
- **Tests previos reescritos por la spec 028** (`test_post_response_has_the_full_contract_shape`, `DiaryPage.test.tsx`, `AddFoodDialog.test.tsx`, `MealPhotoDialog.test.tsx`): fallan por la búsqueda compartida, el botón «Elegir» del panel nuevo o el campo `custom_food_id` aún ausentes. Son rojo legítimo y deben volver a verde en implement, sin debilitarse (Art. B5.3). Son 51 en frontend y 1 en backend.
- **Esqueletos `(scaffold)`:** comprobado. Solo lanzan `not implemented` en `food_library_rules.py`, `food_library_service.py` (los seis métodos), `custom_food_repository.py`, `food_favorite_repository.py`, `catalog_search_service.py` (`edit_distance`, `prefix_edit_distance`, `typo_tolerance`, `typo_distance`, `rank_candidates`), `meal_repository.list_recent_foods`, `useDebouncedValue`, `FoodSearchPanel`, `LibraryFoodList`, `food-library/api.ts`, `food-library/hooks.ts`, `favoriteErrorMessage`, `gramsText`, `libraryEntry`, `withEntryKey` y `mergeProposalEntries`. Los constructores solo guardan dependencias (`FoodLibraryService`, repositorios, `MealService` con `custom_food_repository=None`). Los modelos `CustomFood` y `FoodFavorite`, la columna `MealItem.custom_food_id`, `LibraryItemInput`, los tipos y los esquemas zod son declarativos.

## 2. Trazabilidad
Modo red: la trazabilidad completa (cada AC con un test que pasa y cada REQ con su tarea) se comprueba en modo full. Aquí se comprueba solo que los tests nuevos fallan por comportamiento ausente.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 a REQ-021, NFR-001 a NFR-003 | — | T-030 a T-073 | Marcas `SDD: 028` en los ficheros de test nuevos o cambiados | ✅ 0 tests nuevos de backend pasan sin implementación; ⚠️ 1 test nuevo de frontend pasa (guarda aceptada, sección 4) |

- AC sin test: no se evalúa en modo red.
- REQ sin tarea: no se evalúa en modo red.
- Tareas sin marcar `[x]`: no se evalúa en modo red (las tareas de Fase B están sin marcar, como corresponde).
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno encontrado en los ficheros de test cambiados.

## 3. Criterios de aceptación manuales
Ninguno en modo red. Los AC visuales o de UX (por ejemplo, la lectura de los avisos por lectores de pantalla, AC-N002.2) se listarán en modo full.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | Test nuevo de frontend que pasa sin implementación, **aceptado por el usuario** como guarda de regresión: `frontend/src/app/foodsRoute.test.tsx` «/foods sigue llevando a /diary también cuando se abre con parámetros». Lo mismo ocurre con la guarda «abrir /foods termina en /diary y muestra la pantalla «Diario», no «Alimentos»», que ya existía en HEAD y solo recibe el marcador `SDD: 028`. Ambas comprueban el comportamiento de la 023 (la redirección de `/foods` a `/diary`), que no cambia. No bloquea el red check. | `✓ src/app/foodsRoute.test.tsx > AppRouter - ruta /foods > /foods sigue llevando a /diary …` | — (aceptada por el usuario) |

Ningún otro fallo bloqueante. Ningún fallo se atribuye a entorno.

Observaciones (no bloquean el red check; van al backlog de la feature):
- **B1 (capa, Art. P2.1):** `backend/repositories/meal_repository.py` (línea 8) importa `RecentFoodRow` desde `services/food_library_rules.py`. Un repositorio no debe depender de un servicio. Propuesta: mover `RecentFoodRow` a `models` o a `repositories`. Responsable implementer, al implementar `list_recent_foods` (T-104). Como incumple una regla de la constitución, el orquestador debe decidir si se corrige en implement o se trata como decisión mayor.
- **B2 (formato del scaffold):** `backend/services/meal_rules.py` escribe `_DATE_PATTERN =re.compile(...)` sin espacio antes de `=`, y `frontend/src/features/diary/types.ts` escribe `AnalysisConfidence ="high"`. No es lógica, pero el ratchet de ruff puede contar el primero como violación nueva (E225). Responsable implementer.
- **B3 (claridad de los tests):** en `test_meal_library_routes.py` (líneas 246 y 423) y en `test_meal_service.py` (líneas 1602, 1638 y 1694) se desempaqueta la biblioteca con `(saved,) = …`. Hoy el fallo sale como `ValueError: not enough values to unpack`, no como aserción. Recomendación: primero `assert len(…) == 1` con mensaje claro. Responsable test-author. No bloquea.

## Decisiones sobre las guardas (red check)
- 2 guardas de backend: RETIRADAS en la iteración 3 (verificado: ya no existen en los ficheros).
- 2 guardas de frontend de `foodsRoute.test.tsx`: ACEPTADAS por el usuario. Pasan sin implementación porque comprueban la redirección de `/foods` que ya existe en HEAD. Deben seguir en verde tras T-130.
- Resultado del red check: PASS. Ningún test nuevo de backend pasa sin implementación, y de los tests nuevos de frontend solo pasan las dos guardas aceptadas. Iteración 4 de 4.
