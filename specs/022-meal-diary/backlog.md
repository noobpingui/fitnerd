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

## implement · implementer
- [ ] Arreglar las tres líneas E501 de `backend/tests/test_services/test_meal_service.py` (líneas 49, 605 y 765). El archivo es del test-author.
- [ ] Documentar en `docs/deploy-runbook.md` y `CLAUDE.md` el paso manual de la migración `b3d5f7a9c1e4` (volcado verificado, aplicar antes del merge con `FLASK_ENV` bien puesto).
- [ ] Opcional: mostrar «Guardando…» global o deshabilitar por fila el botón «Quitar», más allá del indicador `isRemoving` actual.
- [ ] Opcional: enlace a `/foods` desde el diálogo del diario, o retirar `/foods` más adelante (REQ-015 lo mantiene funcionando pero sin enlace).

## verify · verifier
- [ ] Corregir el número de AC de spec.md («86» frente a los 96 definidos) en la próxima edición de la spec o en el cierre.
- [ ] Documentar en docs/deploy-runbook.md (o docs-report.md) el paso manual de producción: aplicar la migración b3d5f7a9c1e4 con FLASK_ENV bien puesto, antes del merge (Art. P4). La migración no se ha aplicado.

## verify (2.ª pasada) · verifier
- [ ] spec.md dice «86 AC» (sección 7 y estado de la fase spec), pero define 96 AC; corregir el texto en una futura edición de la spec o en docs.
- [ ] AC manuales para el gate de review: AC-014.2 (barra de calorías llena al superar el objetivo), AC-015.2 (barra inferior con 6 entradas en pantalla estrecha), AC-015.3 (estado activo de «Diario» en /diary).

## review · reviewer
- [ ] F1 (MENOR, implementer): en el formulario de alimento personalizado, un valor negativo («-5») muestra «Indica las calorías, proteína, carbohidratos y grasa por 100 g.» en vez del mensaje de rango que da la API (`frontend/src/features/diary/schemas.ts:135-138`, `:182-195`).
- [ ] F2 (NIT, implementer): «Crear alimento personalizado» siempre va al pie del paso de búsqueda, no junto a «No encontramos alimentos…» como decía el plan (`AddFoodDialog.tsx:224-229`).
- [ ] F3 (NIT, implementer): `meals.updated_at` no cambia al añadir, editar o quitar alimentos (`backend/models/meal.py:35-37`).
- [ ] F4 (NIT, planner): el ADR-0030 sigue en «Propuesta»; si el usuario lo aprueba, la etapa docs lo pasa a «Aceptada».
- [ ] Etapa docs: documentar en `docs/deploy-runbook.md` el paso manual de la migración b3d5f7a9c1e4 (volcado verificado y `flask db upgrade` con `FLASK_ENV` bien puesto antes del merge, Art. P4).
- [ ] Pendiente del usuario: revisar en el navegador los AC manuales AC-014.2, AC-015.2 y AC-015.3.
