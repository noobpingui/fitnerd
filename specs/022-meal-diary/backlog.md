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

## tests · test-author
- [ ] Cuando haya Postgres, ejecutar la suite de backend para confirmar el rojo y revisar los pocos tests que dependen de detalles del ORM sin sesión. Por ejemplo, `Meal(items=…)` y `meal.items.remove` en los dobles del servicio.
- [ ] Posible duplicación entre los helpers de `AddFoodDialog.test.tsx` y `DiaryPage.test.tsx`. Se podrían compartir en `src/test/` si crece.
- [ ] Los tests de la migración `b3d5f7a9c1e4` no existen. Según el plan los revisa el `reviewer` a mano.

## tests · verifier (red)
- [ ] Endurecer las aserciones de fecha de las páginas legales (AC-016.1 y AC-016.2) para que exijan «20 de octubre de 2026» en lugar de «distinta de la anterior».
- [ ] Decidir si las guardas de regresión (p. ej. /foods, voseo, contenido legal existente) cuentan como tests de feature o se mueven a un test de no regresión.
- [ ] Repetir la ejecución de test_meal_routes.py cuando Postgres esté disponible, para cerrar el rojo legítimo de las rutas.

## tests (corrección 1/3) · test-author
- [ ] Los 13 tests anteriores de las páginas legales (specs 005 y 012) pasan antes de implementar. Son guardas de regresión preexistentes, no pruebas de la 022. El verifier debería excluirlos del criterio de rojo.

## tests (red, repetición) · verifier
- [ ] `diaryRoute.test.tsx` comprueba el texto de `router.tsx` con expresiones regulares (lazyNamed, path="/diary"). Es frágil; valorar si conviene un test de comportamiento.
- [ ] Varios tests de la suite de rutas leen el JSON de una respuesta 404 en helpers (KeyError 'id'); al implementar, la causa desaparece, pero conviene que los helpers asserten el status antes de leer el cuerpo.
- [ ] Tests de fecha de legales: la comprobación «no es la del 2 de septiembre» (TermsOfServicePage, preexistente) es débil; pendiente de revisar en el backlog del proyecto.
