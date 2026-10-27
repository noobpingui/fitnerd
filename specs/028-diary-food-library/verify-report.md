# Verify report 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Modo:** red (tras la etapa tests, iteración 2 de la red: T-137 a T-155, con la corrección del test-author sobre `proposalReviewSchema`)
- **Fecha:** 2026-10-27T18:55:20.774Z · **Rama:** `feat/028-diary-food-library` @ `0e8f5c2` (con cambios de la iteración 2 sin commit) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -v -rfE --tb=line` sobre los 10 archivos de test de la feature que cambian (`backend`) | ⚠️ | 906 passed, 25 failed. Los 25 fallos son rojos legítimos (19 tests nuevos y 6 existentes que fallan por `count_by_user`, ver sección 4) |
| frontend | `npx vitest run <10 archivos de test de la feature que cambian> --reporter=verbose` (`frontend`) | ⚠️ | 393 passed, 27 failed (420 tests). Los 27 fallos son rojos legítimos |

Los comandos son los de `scopes.<ámbito>.test_files` con las opciones de salida (`-v`, `-rfE`, `--tb=line`, `--reporter=verbose`). No se ejecutan `lint`, `typecheck` ni `build` (modo red). El ratchet no aplica en esta etapa.

Archivos de backend ejecutados: `tests/test_routes/test_catalog_routes.py`, `test_food_library_routes.py`, `test_meal_library_routes.py`, `test_meal_routes.py`, `tests/test_services/test_catalog_search_service.py`, `test_food_library_migration.py`, `test_food_library_rules.py`, `test_food_library_service.py`, `test_meal_rules.py`, `test_meal_service.py`.

Archivos de frontend ejecutados: `src/lib/useEscapeCapture.test.ts`, `src/features/diary/components/FoodSearchPanel.test.tsx`, `AddFoodDialog.test.tsx`, `MealPhotoDialog.test.tsx`, `PhotoReview.source.test.ts`, `src/features/diary/proposal.test.ts`, `schemas.test.ts`, `src/app/foodsRoute.test.tsx`, `mealPhotoRoute.test.tsx`, `diaryRoute.test.tsx`.

Nota de alcance: se ejecutan archivos completos (con sus tests previos) para ver también los tests adaptados. Los archivos de catálogo eliminados en T-155 no se ejecutan.

## 2. Trazabilidad
Solo para los AC de la iteración 2. El resto se comprueba en verify.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-009 | AC-009.6 | T-137, T-140, T-141, T-142 | `test_food_library_service.py::test_a_favorite_whose_food_left_the_catalog_does_not_count_for_the_limit`, `test_food_library_routes.py::test_a_favorite_removed_from_the_catalog_does_not_count_for_the_limit` | ❌ (rojo legítimo, sección 4) |
| REQ-009 | AC-009.7 | T-140, T-142 | `test_food_library_service.py::test_remove_favorite_of_a_food_that_left_the_catalog_deletes_it_for_good`, `test_food_library_routes.py::test_unmarking_a_favorite_removed_from_the_catalog_is_204_and_it_does_not_come_back` | ❌ (legítimo) |
| REQ-009 | AC-009.8 | T-140, T-142 | `test_food_library_service.py::test_remove_favorite_of_a_food_nowhere_for_this_user_is_not_found`, `test_food_library_routes.py::test_unmarking_a_food_that_is_nowhere_for_this_user_is_404_and_leaves_the_other_user_alone` | ❌ (legítimo) |
| REQ-009 | AC-009.4, AC-009.5 | T-139, T-141 (adaptados) | `test_food_library_routes.py::test_marking_a_new_food_with_100_favorites_is_400_and_an_existing_one_is_204`, `test_a_favorite_can_be_marked_again_after_removing_one_at_the_limit`, `test_favorites_of_one_user_do_not_appear_for_another`; `test_food_library_service.py::test_add_favorite_that_already_is_a_favorite_works_with_100_favorites`, `test_favorites_do_not_include_the_ones_of_another_user` | ✅ (guardas aceptadas, sección 4) |
| NFR-004 | AC-N004.1 | T-138, T-140, T-142 | `test_catalog_search_service.py::test_the_long_query_of_repeated_words_makes_the_same_comparisons_as_the_short_one`, `test_food_library_service.py::test_the_joint_search_with_the_long_query_stays_within_the_bound_like_the_short_one`, `test_food_library_routes.py::test_a_search_of_100_characters_answers_200_empty_within_the_comparison_bound` | ❌ (legítimo) |
| NFR-004 | AC-N004.2 | T-138, T-140, T-143 | `test_catalog_search_service.py::test_a_typo_search_with_results_stays_within_the_bound_and_finds_the_food`, `test_food_library_service.py::test_the_joint_search_with_typos_finds_the_food_within_the_bound`, `test_catalog_routes.py::test_the_long_query_of_repeated_words_answers_200_empty_within_the_bound` | ❌ (legítimo) |
| NFR-004 | AC-N004.3 | T-138, T-140 | `test_catalog_search_service.py::test_exact_matches_and_forms_shorter_than_four_characters_make_no_comparisons`, `test_food_library_service.py::test_the_joint_search_with_exact_matches_or_short_forms_makes_no_comparisons`, y los de `TypoDistances` (`test_within_tolerance_*`, `test_typo_comparison_bound_is_forms_times_distinct_words`) | ❌ (legítimo) |
| REQ-017 | AC-017.5 | T-144, T-146, T-147 | `useEscapeCapture.test.ts` (5 tests), `FoodSearchPanel.test.tsx` («Escape cierra la confirmación…»), `AddFoodDialog.test.tsx` («con la confirmación de borrar abierta…») | ❌ (legítimo: «not implemented» y `alertdialog` ausente) |
| REQ-017 | AC-017.6 | T-144, T-149 | `MealPhotoDialog.test.tsx` («Escape en la búsqueda de «Añadir otro alimento»…») | ❌ (legítimo) |
| REQ-017 | AC-017.7 | T-146, T-163, T-164 | `FoodSearchPanel.test.tsx` (««Borrar» de «Recientes» pinta la confirmación dentro del elemento de «Recientes»…») | ❌ (legítimo) |
| NFR-002 | AC-N002.3 | T-146 | `FoodSearchPanel.test.tsx` («al abrir la confirmación el foco está en «Cancelar»») | ❌ (legítimo) |
| NFR-002 | AC-N002.4 | T-145, T-146 | `FoodSearchPanel.test.tsx` («si el borrado falla…», «Cancelar…» y «Escape devuelve el foco…», «un borrado que falla cierra la confirmación…») | ❌ (legítimo) |
| NFR-002 | AC-N002.5 | T-146 | `FoodSearchPanel.test.tsx` («tras un borrado correcto…», «avisa con el id borrado tras un 204/404», «no avisa tras un borrado que falla…») | ❌ (legítimo) |
| REQ-018 | AC-018.7 | T-135, T-149, T-150, T-151, T-152 | `MealPhotoDialog.test.tsx` («al borrar un propio que ya está en la propuesta…»), `proposal.test.ts` (`unlinkCustomFood`, 3 tests), `schemas.test.ts` (`proposalReviewSchema`, 4 bloques, 9 casos), `PhotoReview.source.test.ts` («usa `proposalReviewSchema`…») | ❌ (legítimo, salvo `schemas.test.ts`, que son guardas aceptadas, sección 4) |
| REQ-018 | AC-018.8 | T-149 | `MealPhotoDialog.test.tsx` («si guardar responde 400 «No encontramos ese alimento.»…») | ❌ (legítimo) |
| NFR-003 | AC-N003.1 | T-152 | `PhotoReview.source.test.ts` (3 tests: `as never`, `as unknown as`, `proposalReviewSchema`) | ❌ (legítimo) |
| REQ-020 | AC-020.1 | T-153, T-154 | `foodsRoute.test.tsx` («el código sin uso de la búsqueda de la 023 y de USDA ya no existe») | ❌ (legítimo: `features/catalog` y `features/foods/api.ts` siguen existiendo) |

- AC sin test: — (en modo red solo se comprueban los AC de la iteración 2)
- REQ sin tarea: —
- Tareas sin marcar `[x]`: T-160 a T-168 (esperado: son de la fase B de la iteración 2)
- Scaffolds de la iteración 2 (T-132 a T-136): `TypoDistances.within_tolerance`, `typo_comparison_bound`, `TypoSearchStats` (solo contador), `useEscapeCapture` y `unlinkCustomFood` lanzan `not implemented`; los parámetros `stats`, `renderInline` y `onCustomFoodDeleted` son solo firmas. Correcto.
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: no revisado (no aplica en modo red)

## 3. Criterios de aceptación manuales
Ninguno en esta etapa.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno. Todos los tests nuevos fallan por comportamiento ausente o pasan por una guarda aceptada (ver notas) | — | — |

### Notas de la verificación (no son fallos)

**Rojos legítimos (19 backend nuevos, 27 frontend en los 10 archivos):**
- Backend: `not implemented` de `TypoDistances` y `typo_comparison_bound`; `assert 0 > 0` sobre `TypoSearchStats.comparisons` (no se cuentan comparaciones); `assert 400 == 204` y `404 == 204` al quitar o marcar favoritos retirados del catálogo; `ResourceNotFoundError` al quitar un favorito retirado.
- Frontend: `not implemented` de `useEscapeCapture` y `unlinkCustomFood`; `Unable to find role="alertdialog"` (confirmación en línea ausente, 11 tests); mensaje de error no encontrado tras un 204/fallo; `Escape` no atendido; `PhotoReview.tsx` sin `proposalReviewSchema` y con `as never`; `foodsRoute` con `features/catalog` y `features/foods/api.ts` presentes; la fila desvinculada aún se envía con `custom_food_id` en lugar de `name` y `per_100g`.

**Rojos por `AttributeError` (6 backend existentes, aceptados):** `FakeFoodFavoriteRepository` ya no tiene `count_by_user` (T-137), pero `food_library_service.py:132` todavía lo llama. Afecta a `test_add_favorite_of_a_catalog_food_saves_it_and_commits`, `test_add_favorite_of_an_own_food_saves_it_with_its_custom_food_id`, `test_add_favorite_accepts_the_own_food_id_as_text`, `test_add_favorite_twice_does_not_duplicate_it`, `test_add_favorite_with_100_favorites_is_rejected_with_the_limit_message` y `test_the_favorites_limit_counts_only_the_favorites_of_the_user`, más `test_a_favorite_whose_food_left_the_catalog_does_not_count_for_the_limit`. Es un «atributo ausente» (clasificación legítima) y lo elimina la T-161. Se mantiene la decisión de la iteración anterior.

**Guardas aceptadas en esta iteración (decisión sobre `proposalReviewSchema`):** ACEPTADAS. Las cuatro entradas de `describe("proposalReviewSchema")` en `schemas.test.ts` (sin la guarda `?raw` y sin el test estructural «escritas una sola vez») son 4 bloques con 9 casos, y los 9 pasan con el andamiaje. Motivos:
1. El esquema es declarativo y el andamiaje lo entrega completo (T-135), como los demás esquemas zod de la 028 según las notas de alcance de `tasks.md`.
2. La regla de gramos es la de `proposalFormSchema`, ya implementada y en verde desde la 025. La única parte nueva es `key` obligatoria, que la spec trata como interna (F6: «no cambia ningún requisito»).
3. Son discriminantes: fallarían si el esquema aceptara entradas sin `key`, perdiera `customFoodId` o validara los gramos de una entrada sin coincidencia. Lo he comprobado leyendo `frontend/src/features/diary/schemas.ts` (líneas 232-266) y el propio test.

El rojo de F6 lo aportan `PhotoReview.source.test.ts` (3 tests, legítimos) y `proposal.test.ts` (`unlinkCustomFood`). Esta aceptación es una excepción explícita a la lectura literal del Art. B5.2, y la decide la sesión que orquesta.

**Otras guardas aceptadas (existentes, adaptadas, que pasan):**
- Backend (T-139, T-141 y AC-009.4/AC-009.5): `test_marking_a_new_food_with_100_favorites_is_400_and_an_existing_one_is_204`, `test_a_favorite_can_be_marked_again_after_removing_one_at_the_limit`, `test_favorites_of_one_user_do_not_appear_for_another`, `test_add_favorite_that_already_is_a_favorite_works_with_100_favorites`, `test_favorites_do_not_include_the_ones_of_another_user`.
- Frontend `foodsRoute.test.tsx`: `abrir /foods termina en /diary…`, `con el onboarding pendiente…`, `router.tsx ya no importa FoodsPage…`, `el código de la pantalla «Alimentos» de la 021 ya no existe`, `/foods sigue llevando a /diary…` (estas dos últimas, ya aceptadas antes).
- Frontend `AddFoodDialog.test.tsx` («busca en la biblioteca (catálogo y propios) y muestra la pechuga…», renombrado en T-147, mismo comportamiento) y `proposal.test.ts` (`libraryEntry` y `proposalItems`, adaptados de `catalogEntry` en T-150). Tests de `diaryRoute.test.tsx` y `mealPhotoRoute.test.tsx` tras quitar los mocks (T-154).

**Observaciones (no bloquean):**
- `tasks.md` (T-134) escribe `useEscapeCapture(active, onEscape)`, pero el test y el plan usan `useEscapeCapture(onEscape, active)`. Se toma la firma del test y del plan.
- El esqueleto de `proposalReviewSchema` (T-135) incluye `superRefine` (lógica), aunque la nota de `tasks.md` dice «sin lógica». Es una copia de `proposalFormSchema`. T-165 debe conservar esa lógica compartida.
- El texto de la iteración anterior hablaba de 5 tests y 10 casos en `proposalReviewSchema`. Tras quitar la guarda quedan 4 bloques y 9 casos (el test estructural se ha eliminado).
- Las frases de T-145 («dentro del elemento de «Gallo pinto» de «Resultados»») siguen la decisión del plan, no la spec (AC-017.3 solo pide ver el mensaje).
