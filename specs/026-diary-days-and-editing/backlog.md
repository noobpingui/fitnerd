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
