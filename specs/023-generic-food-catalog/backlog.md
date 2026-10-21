# Backlog · 023-generic-food-catalog

## spec · spec-writer
- [ ] Retirar de `/api/meals` los alimentos de USDA por `fdc_id`, si se confirma que no se usan.
- [ ] Buscar mientras se escribe en el diálogo del diario.
- [ ] Categorías del catálogo y navegarlo sin escribir.
- [ ] Tolerancia a erratas y equivalencia entre singular y plural en la búsqueda.
- [ ] Decidir si se retiran la pantalla `FoodsPage` y su código cuando `/foods` ya redirija.
- [ ] Decidir si se retira `GET /api/foods/search` cuando ninguna pantalla lo use.

## spec (respuestas del usuario) · usuario
- [ ] Eventualmente la data de USDA se retirará cuando ya tengamos nuestra propia data (csv), y también se eliminará de donde se menciona, ya sea en Términos y en cualquier otra parte.

## spec (2.ª pasada) · spec-writer
- [ ] Retirar de `/api/meals` los alimentos de USDA por `fdc_id`, si se confirma que no se usan.
- [ ] Buscar mientras se escribe en el diálogo del diario.
- [ ] Categorías del catálogo y navegarlo sin escribir.
- [ ] Tolerancia a erratas en la búsqueda.
- [ ] Decidir si se retiran la pantalla `FoodsPage` y su código cuando `/foods` ya redirija.
- [ ] Decidir si se retira `GET /api/foods/search` cuando ninguna pantalla lo use.
- [ ] Retirar los datos de USDA y sus menciones (Términos y demás) cuando el catálogo propio los sustituya (nota del usuario).

## plan · planner
- [ ] Pasar la coincidencia de la búsqueda a Postgres si el catálogo crece mucho más allá de 350 alimentos.
- [ ] Retirar `FoodsPage`, `FoodResultList` y `useFoodSearch` cuando se confirme que no se usan (ya sin ruta).
- [ ] Revisar en la review las filas `manual` del CSV y sus referencias.
- [ ] Anotar en el runbook que, entre el CD y la carga del catálogo, la búsqueda del diario está vacía.

## tasks · task-breaker
- [ ] Verificar en la verificación que el chunk de entrada de `npm run build` sigue por debajo de 500 kB (ADR-0026).
- [ ] Revisión manual de la migración `d4f6a8c0e2b5` frente a los modelos (Art. P2.4), a cargo del reviewer.
- [ ] Las filas `manual` del CSV las revisa el usuario en el gate de review.

## tests · test-author
- [ ] `diaryRoute.test.tsx` conserva en su cabecera la frase «`/foods` sigue mostrando "Alimentos"»; hay que limpiarla cuando se implemente T-137.
- [ ] La suite de la 021 (`features/foods`) y el endpoint `GET /api/foods/search` se conservan sin cambios, como indica la spec.

## tests (red) · verifier
- [ ] Cambiar pytest.raises(RuntimeError) por una excepción concreta en test_an_error_while_writing_rolls_back_and_is_raised_again.
- [ ] Revisar en la fase de implementación si los tests de constantes del esqueleto deben seguir existiendo o pasar a ser parte del test de comportamiento.
- [ ] Revisar los marcadores de las guardas 021/022 re-marcadas como 023 (test_meal_routes::test_post_validation_message_and_nothing_saved, foodsRoute, noFoodsLink).

## tests (corrección 1/3) · test-author
- [ ] Los errores de `tsc -b` por `catalog_id` en `diary/schemas.test.ts` desaparecen cuando el implementer actualice `diary/types.ts`.

## tests (red, repetición) · verifier
- [ ] Los 3 tests de constantes retirados de `test_load_food_catalog_script.py` dejan la cobertura de AC intacta (67/67), pero conviene confirmar que `CANCEL_MESSAGE` y `DEFAULT_CATALOG_PATH` siguen cubiertos por los tests de flujo del script.
- [ ] La migración `d4f6a8c0e2b5` y el CSV `backend/scripts/data/food_catalog.csv` no existen aún (T-100, T-120 a T-123). Es lo esperado en red.

## tests (red, 3.ª pasada) · verifier
- [ ] Decidir si los 3 tests frontend y los 20 casos backend de guardas deben conservar el marcador 023 o pasar a 021/022, para que el criterio de rojo no dependa de la exclusión manual.
- [ ] Revisar el marcador de test_post_validation_message_and_nothing_saved: mezcla casos de la 022 con casos de la 023 bajo el mismo marcador.
- [ ] Los 6 errores de setup de test_food_catalog_csv.py dejarán de ser errores cuando read_catalog_csv exista; en verify, comprobar que pasan a verde con el CSV real.
- [ ] Algunos tests de comportamiento 023 sin marcador en la línea inmediata (marcador encima de decoradores) no aparecen en la trazabilidad automática; la cobertura por AC sí está completa.
