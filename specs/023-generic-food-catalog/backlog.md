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
