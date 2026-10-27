# Backlog · 026-diary-days-and-editing

## spec · spec-writer
- [ ] Deshacer el borrado de una comida entera y los cambios de gramos.
- [ ] Objetivos históricos por día.
- [ ] Calendario con marcas de los días con registros, resúmenes semanales y copiar una comida a otro día.

## plan · planner
- [ ] Impedir la reutilización del token de restauración (que deshacer sea idempotente).
- [ ] Sacar la firma HMAC compartida entre `FeedbackTokenSigner` y `RestoreTokenSigner` a una utilidad común.
- [ ] Deshacer también los cambios de gramos y el borrado de una comida entera (la spec los deja fuera).
- [ ] Que «Hoy» se mantenga al pasar la medianoche en el límite inferior exacto del intervalo navegable.

## tests · test-author
- [ ] Cobertura de `useToday` sin `visibilitychange` del documento oculto: solo se prueba el paso a visible, que es lo que exige la spec.
- [ ] La caducidad del token a través de la ruta HTTP no tiene test de integración. Solo hay test de servicio con `FakeClock`, porque `app_clock` no permite avanzar el tiempo entre peticiones con tanta claridad.
- [ ] Los tests de página de `DiaryPage` usan `settle()` de 30 ms en tiempo real; si resultan frágiles en CI, conviene pasarlos a avance de temporizadores con `renderHook`.

## tests (red check, iteración 2) · verifier
- [ ] formatDiaryDate: T-005 pedía un esqueleto que lance not implemented. El implementer conservó la función vigente con un parámetro opcional, lo que evita romper DiaryPage. Ajustar la descripción del plan o aceptarlo en la revisión.
- [ ] Tests que leen el cuerpo de un 204 (.get_json()["restore_token"] sobre None): son rojo legítimo, pero una aserción de estado 200 antes de leer el cuerpo daría un fallo más claro.
- [ ] AC-010.3 y AC-014.2 no tienen test propio de la 026 (son referencias a la 022).

## tests (iteración 3) · test-author
- [ ] Los 2 errores de tipos de `DiaryPage.test.tsx` desaparecerán cuando el implementer cambie el tipo de retorno de `removeMealItem` (T-029). Conviene confirmarlo con `tsc` tras esa tarea.

## tests (red check, iteración 3) · verifier
- [ ] Aceptada la desviación de formatDiaryDate(isoDate, today?): conserva la implementación de la 022 y solo añade _today.
- [ ] Aceptado removalResponseSchema declarativo (T-006).
- [ ] AC-010.3 y AC-014.2 sin test propio de la 026 (referencias a la 022).

## tests (red check PASS) · verifier
- [ ] Alinear el marcador SDD (022 o 026) con el comentario de guarda en test_remove_item_without_a_signer_returns_none.
- [ ] Alinear el marcador SDD (022 o 026) con el comentario de guarda en test_deleting_the_meal_of_another_user_is_a_404_and_leaves_it_intact.

## implement · implementer
- [ ] Cada `MealSection` pinta siempre una región `role="status"`, vacía cuando no hay aviso. Son cuatro regiones en vivo vacías, como pide el plan. Se podría unificar en una sola.
- [ ] Con el diálogo de descarte dentro de `DialogContent`, en móvil (diálogo a pantalla completa) el posicionamiento `fixed` del overlay y del contenido depende del contenedor transformado. Conviene revisarlo a mano en un dispositivo.

## verify · verifier
- [ ] Marcadores de guarda: test_remove_item_without_a_signer_returns_none (test_meal_service.py) y test_deleting_the_meal_of_another_user_is_a_404_and_leaves_it_intact (test_meal_routes.py) llevan `SDD: 026` con comentario de guarda de la 022; el test-author debe decidir si el marcador pasa a 022 o si el caso se reescribe.
- [ ] state.json dice «9 REQ, 59 AC, 2 NFR»; el spec tiene 54 AC de REQ y 6 de NFR (60). Corregir la nota de estado, no el spec.
- [ ] Warning de lint preexistente en frontend/src/features/diary/components/PhotoReview.tsx:57 (react incompatible-library), fuera del diff de la 026.

## review (iteración 1) · reviewer
- [ ] F2 MENOR (planner): SECRET_KEY por defecto "DEFAULT SECRET" en config.py:47. ProductionConfig debería fallar sin un valor propio, porque con la clave por defecto se pueden fabricar restore_token para la propia cuenta.
- [ ] F3 MENOR (implementer): parse_snapshot_payload acepta v == 1.0 y no pone tope a position (MAX_DB_INTEGER), en meal_rules.py:136,157.
- [ ] F4 NIT (test-author): marcadores laxos: AC-002.10 en los tests de la 022 y la 025 (DiaryPage.test.tsx:154,665) y AC-007.3 en los tests de token inválido y cuerpo no objeto (test_meal_routes.py:1625,1646).
- [ ] F5 NIT (test-author): marcadores 026 con comentario de guarda de la 022 (test_remove_item_without_a_signer_returns_none y test_deleting_the_meal_of_another_user_is_a_404_and_leaves_it_intact).
- [ ] F6 NIT (implementer): cuatro regiones role="status" vacías en MealSection.tsx:106; se podrían unificar en una sola por día.
- [ ] F7 NIT (planner): la línea «Decidido por» de la ADR-0035 dice que se acepta en el gate de review, pero se aceptó en el gate del plan.

## implement (corrección de review F1) · implementer
- [ ] Comprobación manual en navegador (escritorio y móvil, lista desplazada) de la confirmación «¿Descartar la propuesta?». El diálogo de la foto ya no usa transform: se coloca a `top: 5vh` en escritorio.

## review (iteración 2, APPROVED) · reviewer
- [ ] F8 NIT (implementer): en escritorio, el diálogo de foto con poco contenido queda arriba (5vh) en vez de centrado en vertical; se podría centrar sin transform.
- [ ] Comprobación manual en navegador (escritorio y móvil, lista desplazada hasta abajo) de la confirmación «¿Descartar la propuesta?» (AC-009.1, AC-009.3 y AC-009.4) antes del gate de close.
