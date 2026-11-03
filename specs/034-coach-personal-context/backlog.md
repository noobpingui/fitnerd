# Backlog · 034-coach-personal-context

## spec · spec-writer
- [ ] El texto de «no lo sé» del coach («No tengo informacion relacionada con ese tema en especifico.») no lleva tildes.
- [ ] Que el coach pueda responder preguntas sobre los propios datos aunque el corpus no tenga contenido relevante.
- [ ] Dar al coach lo registrado en el diario de comidas, como los totales del día frente al objetivo.
- [ ] Guardar la preferencia del interruptor en la cuenta en lugar del navegador (necesitaría una migración).
- [ ] Que la traza de Langfuse indique si la pregunta llevó contexto personal.

## plan · planner
- [ ] Anonimizar también variantes del nombre (diminutivos, sin tildes) en la traza.
- [ ] Valorar si anonimizar el nombre de la cuenta también con el contexto desactivado (hoy sí se envía a la traza si el usuario lo escribe en la pregunta, igual que antes de la feature).
- [ ] Guardar la preferencia del interruptor en la cuenta (necesita migración).
- [ ] Mockear perfil y mediciones en el `CoachPage.test.tsx` existente para evitar ruido de red en los tests.
- [ ] Que `POST /api/coach/ask` use `get_json(silent=True)` (hoy un cuerpo que no es JSON da 500); deuda previa, fuera de alcance.

## tests · test-author
- [ ] El test existente de la 028 sobre la fecha de la política («27 de octubre de 2026») se romperá si el implementer cambia esa fecha. Spec y plan no piden cambiarla: conviene no tocarla, o actualizar ese test en el mismo cambio.
- [ ] Los tests de página `CoachPage.personalContext` tardan unos 20 s en rojo por los timeouts de `findByText`. En verde serán rápidos.
- [ ] `CoachPage.test.tsx` existente no mockea `profile/api` ni `body-metrics/api`. Sus consultas fallan contra la red y la pregunta se envía sin contexto, como prevé el plan. Se podría añadir el mock para evitar ruido (opcional).

## tests · verifier (red)
- [ ] Los tests de conservación (401, 429, 503, 400, feedback_id y contexto desactivado) pasan su aserción de conservación y después fallan en la aserción de contexto personal; es rojo legítimo y se resolverá con la implementación, sin acción ahora.
- [ ] No existe .sdd/templates/verify-report.md en el proyecto; se usó la plantilla del plugin (0.2.0). Valorar si conviene copiarla al proyecto.

## implement · implementer
- [ ] Corregir las 18 líneas E501 de los tests nuevos de la 034 (`test_coach_routes.py`, `test_coach_personal_context.py` y `test_coach_service.py`). Lo debe hacer quien pueda editar tests, el test-author, o relajar el ratchet.
- [ ] Las ramas de `redact_name` en el paso `retrieval` de `coach_service.py` quedaron con una indentación poco elegante dentro del `dict`. Es solo estética.

## verify · verifier
- [ ] Comprobación manual en navegador de AC-010.1, AC-010.2, AC-010.5 y AC-011.1 a AC-011.3 (ver §3 del verify-report.md), tras el PASS.
