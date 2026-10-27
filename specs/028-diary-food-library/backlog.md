# Backlog · 028-diary-food-library

## spec · spec-writer
- [ ] Pantalla «Mis alimentos» con edición de los alimentos propios.
- [ ] Marcar favoritos desde las filas del diario.
- [ ] Crear un alimento propio sin registrarlo en una comida.
- [ ] Recetas o platos compuestos de varios alimentos.
- [ ] Retirar `GET /api/foods/search` y los alimentos de USDA por `fdc_id` (sigue pendiente de la 023).

## plan · planner
- [ ] Retirar el código del catálogo que queda sin uso en el frontend (`CatalogResultList`, `useCatalogSearch`, `searchCatalog`) y `foods/api.ts`, ajustando los mocks de las pruebas de rutas.
- [ ] Hoy no se puede quitar un favorito del catálogo que una carga retiró (DELETE responde 404 según la spec) y sigue contando para el límite de 100.
- [ ] Valorar un test que compruebe que la clave de nombre de la migración y `custom_food_name_key` coinciden en una batería de nombres.
- [ ] Pantalla «Mis alimentos» para editar o borrar fuera de los diálogos (fuera de alcance de la 028).
