# Backlog · 022-meal-diary

## spec · spec-writer
- [ ] Biblioteca de alimentos personalizados reutilizables, y alimentos favoritos o recientes.
- [ ] Navegar entre días y editar días pasados desde la pantalla.
- [ ] Deshacer al quitar un alimento.
- [ ] Que el diario cambie solo de día al pasar la medianoche con la pantalla abierta.
- [ ] Decidir si /foods se retira o redirige a /diary.
- [ ] Medidas caseras y onzas, y el diario en kJ.

## spec (2.ª pasada) · spec-writer
- [ ] Biblioteca «mis alimentos» de alimentos personalizados reutilizables (Q4)
- [ ] Deshacer la acción de quitar un alimento (Q11)
- [ ] Navegar a días anteriores en la pantalla Diario (Q5)

## plan · planner
- [ ] Sacar a un componente compartido el bloque de estado de la búsqueda («Busca un alimento…», «Buscando…», sin resultados, error con «Reintentar»), que ahora se repite en FoodsPage y AddFoodDialog.
- [ ] Valorar ON DELETE CASCADE de users hacia meals (y body_metrics) cuando exista el borrado de cuentas.
- [ ] El diálogo de añadir guarda un alimento por petición aunque la API acepta varios; añadir varios de una vez puede llegar con la 024.
- [ ] Test de la migración b3d5f7a9c1e4 contra una base real (ahora solo hay revisión manual).
- [ ] Botón para borrar una comida entera desde la pantalla: la API ya tiene DELETE /api/meals/{id} y la pantalla no lo usa.
