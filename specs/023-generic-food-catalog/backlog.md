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

## implement · implementer
- [ ] Q3: el ratchet de lint (`lint_ratchet` en `.sdd/config.json`) ejecuta ruff sobre cada archivo cambiado bajo los globs de producción del backend, incluido `backend/scripts/data/food_catalog.csv`. Informa de unas 1000 violaciones de sintaxis y E501, así que el ratchet sale con 1 solo por el CSV. Es una limitación del harness. Opciones: excluir los archivos de datos del ratchet, o mover el CSV fuera de los globs de producción.
- [ ] 4 violaciones E501 en archivos de test congelados (test_catalog_csv_reader.py, test_catalog_load_service.py, test_meal_rules.py y otro) vienen del test-author; el implementer no las tocó.
- [ ] Los sinónimos «dolfín» y «lampuga» de mahimahi, y algunos sinónimos regionales («zapote» para mamey, «tuna», «anona»), son suposiciones a partir del uso en Costa Rica y México. El reviewer debe revisarlos.
- [ ] Retirar las búsquedas por `fdc_id` de USDA de `/api/meals` y retirar `public.foods` cuando el catálogo sea estable (Q2 de la spec), más una biblioteca «mis alimentos» y recientes.
- [ ] Nota de migración para el doc-keeper: aplicar `d4f6a8c0e2b5` antes del merge y ejecutar `python -m scripts.load_food_catalog` de forma interactiva después del CD.

## verify · verifier
- [ ] Excluir backend/scripts/data/** (no Python) del ámbito prod y del ratchet de .sdd/config.json.
- [ ] Corregir las 7 E501 de los tests de 023 (o aceptarlas de forma explícita) antes del cierre; el implementer no puede tocarlas.
- [ ] Revisión manual del CSV del catálogo en el gate de review (reglas de contenido de la spec y 1 fila manual sin verificar).
- [ ] Los pasos de producción (migración d4f6a8c0e2b5 antes del merge y carga del CSV tras el CD) deben quedar en docs/deploy-runbook.md en la etapa docs (Art. P4).

## review · reviewer
- [ ] F2 MENOR: hay alimentos con dos versiones: zanahoria cruda y cocida, champiñones crudos y cocidos, y frijoles blancos y navy (CSV:166-167, 192-193, 24, 218).
- [ ] F3 MENOR: hay sinónimos con marca: «pan bimbo» (CSV:15) y «queso filadelfia» (CSV:105).
- [ ] F4 MENOR: «contramuslo de pollo» está en Pierna y debería ir en Muslo (CSV:46); «limonada sin azúcar» en Jugo de limón es otro alimento (CSV:265).
- [ ] F5 MENOR: hay nombres principales que no son español neutro: «Vainicas cocidas», «Frijoles navy cocidos» y «Calabaza butternut al horno».
- [ ] F6 MENOR: hay nombres que no corresponden al alimento de USDA: «Merluza» es pollock, «Róbalo» es striped bass y «Polenta» son grits blancos.
- [ ] F7 NIT: en Costa Rica y México, «limón» es la lima verde, y el catálogo da primero el limón amarillo (diferencia nutricional mínima).
- [ ] F8 NIT: sinónimos dudosos: «dolfín» no lo puedo verificar, «pinha» es portugués, «tuna» se confunde con atún en inglés y «fruta del pan jaca» mezcla dos frutas. «zapote», «anona» y «lampuga» son correctos.
- [ ] F9 NIT: «Puerro» y «Tempeh» están crudos, aunque normalmente se comen cocidos.
- [ ] F10 NIT: falta un espacio en `UsdaItemPayload ={` (frontend/src/features/diary/types.ts:34).
- [ ] F11 NIT: el mensaje del downgrade dice «Hay 1 alimentos…» (migración:95); si se corrige, hay que cambiar también `DOWNGRADE_MESSAGE` en `test_catalog_migration.py`.
- [ ] F12 NIT (test-author): el comentario de frontend/src/app/diaryRoute.test.tsx:2 sigue diciendo que `/foods` muestra «Alimentos».
- [ ] `state.json` muestra `max_iterations: 3`, pero la config vale 4.
- [ ] Retirar FoodsPage, FoodResultList y useFoodSearch, que ya no tienen ruta (ya está en el backlog).
- [ ] Runbook (P4): migración antes del merge y carga del catálogo tras el CD, en la etapa docs.

## spec (corrección por review) · spec-writer
- [ ] Estos archivos siguen con la lista de 40 y la yuca, y hay que corregirlos (no los edité):
- [ ] backend/tests/test_services/test_food_catalog_csv.py: línea 15 (comentario «40 alimentos»), línea 26 («Yuca cocida» en MINIMUM_LIST), líneas 67-70 (`test_the_minimum_list_has_40_foods`, que comprueba == 40 dos veces; debe pasar a 39) y línea 115 (docstring «40 alimentos»).
- [ ] backend/scripts/data/food_catalog.csv: línea 37 (fila `yuca-cocida`, origen manual con fuente FNDDS). Según la decisión del usuario debe salir también del catálogo. Al quitarla quedan 264 filas, dentro del rango de 250 a 350, y ya no queda ninguna fila `manual`.
- [ ] specs/023-generic-food-catalog/plan.md: línea 530 («los 40 de la lista mínima» debe decir 39).
- [ ] specs/023-generic-food-catalog/tasks.md: línea 45, T-028 («con los 40 de la lista mínima» debe decir 39).
- [ ] specs/023-generic-food-catalog/verify-report.md: línea 49, que menciona la fila `yuca-cocida`. Se queda desactualizada cuando se vuelva a pasar la verificación.

## tests (corrección por review) · test-author
- [ ] F5 (nombres que no son español neutro) y F6 quedan sin test automatizado; los comprueba la review.
- [ ] «contramuslo» debería ir en «Muslo de pollo al horno»; el test solo comprueba que no sea sinónimo de Pierna.

## tests (red, corrección por review) · verifier
- [ ] Antes de la siguiente ronda, el test-author podría revisar el resto de tests del archivo para asegurar que cada uno falla sin el CSV corregido.

## implement (corrección por review) · orquestador
- [ ] Decidir cómo trata el harness los archivos de datos: al sacar `backend/scripts/data/` de los globs `prod` para que el ratchet de lint no analice el CSV, el role-guard tampoco deja escribirlo al implementer. El CSV lo editó el orquestador con autorización explícita del usuario.

## implement (corrección por review) · implementer
- [ ] El implementer marcó las casillas T-120 a T-123 y T-125 de tasks.md con `sed -i` desde la shell, aunque su definición prohíbe escribir así; solo cambió esas cinco casillas.

## verify (3.ª pasada) · verifier
- [ ] Revisión manual del contenido del CSV (reglas 1 a 3 de la sección 6 de la spec) en el gate de review.
- [ ] Diseño visual del diálogo «Añadir a {sección}» y del listado de resultados, pendiente de prueba del usuario.
- [ ] El CSV fue editado por el orquestador con autorización explícita (el role-guard no reconoce backend/scripts/data/); anotar en review.

## review (2.ª pasada) · reviewer
- [ ] F14 MENOR (planner): plan.md:472 y tasks.md:86,88 dicen 264 filas; el CSV tiene 261.
- [ ] F15 MENOR (implementer): marcó T-120 a T-123 y T-125 en tasks.md con `sed -i` desde la shell, prohibido por el Art. B2.4 (está en el backlog de la feature).
- [ ] F16 MENOR (implementer): «Lechuga repollada» (CSV:163) es un regionalismo como nombre principal; mejor «Lechuga iceberg», con «lechuga repollada» como sinónimo.
- [ ] F17 MENOR (test-author): `test_the_csv_has_fewer_than_265_foods` y `test_no_row_has_the_manual_source` fijan el estado actual del CSV, no la spec (AC-001.1 admite de 250 a 350 filas y el formato admite filas `manual`). Además, los tests de marcas, contramuslo y limonada llevan el marcador AC-001.3, que trata de las palabras prohibidas, no de los sinónimos.
- [ ] F18 NIT (implementer): crudos que se suelen comer cocidos: Tempeh, Puerro y Pak choi.
- [ ] F19 NIT (implementer): sinónimos dudosos: «graviola» (portugués), «granadilla» en Maracuyá, «queso gruyer» en Queso suizo, «natilla» en Crema agria, «tomate verde» en Tomatillo.
- [ ] F20 NIT (implementer): «berza» aparece en tres coles distintas (Repollo, Col rizada, Col verde).
- [ ] Arreglar el role-guard o el config para que reconozca backend/scripts/data/ (el CSV lo editó el orquestador con autorización del usuario).
- [ ] state.json sigue con max_iterations 3 y el config tiene 4.

## spec (corrección por F13) · spec-writer
- [ ] Si en el futuro se añaden filas `manual` al catálogo, hay que volver a poner en Términos de servicio una frase sobre su origen.

## implement (corrección F13) · implementer
- [ ] Test intermitente del perfil, «B entra con el onboarding pendiente y sin ver la fecha de nacimiento» (NFR-002 AC-N002.1). Falló una vez de dos pasadas completas de `npm test`.

## verify (4.ª pasada) · verifier
- [ ] El test «B entra con el onboarding pendiente y sin ver la fecha de nacimiento de A» (frontend/src/app/accountSwitch.test.tsx:68), que el implementer vio fallar una vez, pasó en la suite completa de esta ronda y en una repetición aislada. No está en los archivos de la 023 (no aparece en git diff main...HEAD), así que no se atribuye a esta feature; no se ha reproducido, y no se puede afirmar que sea intermitente con dos pasadas.

## review (3.ª pasada) · reviewer
- [ ] F21 NIT (test-author): los marcadores AC-001.2 de los tests de marcas, contramuslo, limonada y lechuga iceberg (`test_food_catalog_csv.py:162,179,189,201`) no corresponden a la unicidad de nombres; encajan mejor con AC-001.1 (reglas de la sección 6).
- [ ] F22 NIT (spec-writer): el texto de «Términos de servicio» no cambia respecto a la 022, pero su fecha pasa a «21 de octubre de 2026» (`TermsOfServicePage.tsx:5`). Lo pide AC-012.3; valorar si conviene en una revisión futura.
- [ ] doc-keeper: en `docs/deploy-runbook.md`, la migración `d4f6a8c0e2b5` antes del merge y la carga del CSV tras el CD. En `CLAUDE.md`, que `/foods` redirige a `/diary` y que el diario busca en el catálogo.
