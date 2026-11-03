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

## verify (iteración 2) · verifier
- [ ] El commit f89091e renombra una función de test (test_with_the_personal_context_off_the_message_is_the_one_from_before… a …is_the_old_one…). No afecta a la trazabilidad ni a las aserciones; anotarlo solo para tenerlo presente.

## review (iteración 1) · reviewer
- [ ] F3 MENOR (implementer): `_TEXT_PATTERN` (progress_analysis_context.py:45) usa ^…$ y acepta un "\n" final («79,4 kg\n» pasa, comprobado), contra AC-006.2. Corrección: fullmatch o \Z, más un test con el salto al final. El defecto viene de la spec 010.
- [ ] F4 MENOR (spec-writer): redact_name no anonimiza partes de un nombre compuesto («María» de «María José» llega a Langfuse). Decidir si se anonimiza cada parte o se documenta.
- [ ] F5 MENOR (spec-writer): REQ-004 choca con REQ-010. Con el interruptor desactivado, Anthropic recibe en el historial respuestas anteriores con el nombre, las kcal o el peso. Aclararlo en la ayuda o en la política, o filtrar el historial.
- [ ] F6 NIT (implementer): la sangría del dict del paso retrieval (coach_service.py:187-202) es incoherente.
- [ ] F7 NIT (planner): un fallo del lector da 503 en lugar de responder sin contexto. No está en el plan; reflejarlo en ADR-0038 o en el plan.

## plan (iteración 2) · planner
- [ ] F4 (nombres compuestos en `redact_name`) y F5 (historial con el interruptor desactivado): decisiones de la spec para el gate de review.

## tests (iteración 3) · verifier (red)
- [ ] T-047 usa el marcador «SDD: 034 REQ-011» sin AC; los AC-011.1 a AC-011.3 ya tienen cobertura en T-025. No bloquea.

## review (iteración 2) · reviewer
- [ ] F4 (spec-writer): decidir si `redact_name` anonimiza cada parte de un nombre compuesto o si se documenta la limitación.
- [ ] F5 (spec-writer): decidir qué hacer con el historial que llega a Anthropic con el interruptor desactivado (aclararlo en la ayuda o la Política, o filtrar el historial).
- [ ] F8 (test-author): añadir un test de regresión del 503 cuando `read` falla con `use_personal_context=True` y corregir el docstring de `test_coach_service.py:539`.
- [ ] F10 (planner): un nombre anterior de la cuenta que siga en el historial no se anonimiza en la traza.
- [ ] F9 (implementer): falta el espacio tras `#` en `coach_service.py:150` (es el estilo del archivo; opcional).

## spec (iteración 2) · spec-writer
- [ ] Anonimizar diminutivos y variantes sin tildes del nombre en la traza.
- [ ] Valorar un token firmado por respuesta para los nombres anteriores si Q12 se resuelve con la propuesta por defecto.
- [ ] Revisar si el test existente de AC-010.2 compara el texto de ayuda exacto y ajustarlo al texto nuevo.

## plan (iteración 3) · planner
- [ ] Token firmado por respuesta con el nombre usado (alternativa (a) de Q12), si los nombres anteriores enviados por el cliente se quedan cortos.
- [ ] Anonimizar diminutivos y variantes sin tildes del nombre en la traza (sigue fuera de alcance).
- [ ] Unificar el estilo de comentarios `#Texto` → `# Texto` del resto de coach_service.py (F9 solo pide la línea 150).

## tests (rev. 2) · verifier (red)
- [ ] Revisar el CRLF de los cuatro archivos de test de la 034 en la copia de trabajo (Art. P5.1); `.gitattributes` los normaliza al commit.

## implement (rev. 2) · implementer
- [ ] Ordenar los imports (I001, L7) de `backend/tests/test_services/test_coach_personal_context.py`. Es un archivo de tests y el ratchet lo cuenta como violación nueva, así que debe corregirlo quien pueda editar tests (etapa tests) antes de que el ratchet pase limpio.

## verify (iteración 4) · verifier
- [ ] Revisar en navegador (escritorio y móvil) la posición y el aspecto del interruptor de `/coach` (AC-010.1).
- [ ] El recuento de AC: el spec-writer informó de 66, `spec.md` define 69 (se verificaron los 69).

## review (iteración 3) · reviewer
- [ ] F11 (MENOR, implementer): poner las tildes en los docstrings de `parse_previous_names`, `name_redaction_terms` y `redact_name` (`backend/services/coach_personal_context.py`; «envia», «valida», «mas», «particulas» y la «mayúsculas» que se perdió en `redact_name`).
- [ ] F12 (NIT, test-author): «Revisión 2» en los comentarios de sección de `test_coach_personal_context.py` (líneas 882 y 1000).
- [ ] F13 (NIT, planner): un `previous_names` manipulado puede anonimizar palabras comunes de la traza de ese usuario; tenerlo en cuenta al leer trazas en Langfuse.
- [ ] Confirmar o revertir `max_iterations: 6` en `.sdd/config.json` antes del cierre (el commit 092d472 lo sube y llegaría a `main`).

## plan (iteración 4) · planner
- [ ] Ninguna regla sin diccionario distingue un nombre de una palabra común en previous_names: si F13 vuelve a importar, valorar el token firmado por respuesta (alternativa (a) de Q12, ya en el backlog).

## plan (iteración 5) · planner
- [ ] Nombres anteriores manipulados con palabras comunes de 3 letras o más, o nombres anteriores largos de muchas partes: riesgo aceptado. La alternativa es el token firmado con el nombre usado, ya en el backlog de Q12.
- [ ] Una frase hecha solo de partículas («de la») como nombre anterior se sigue anonimizando como frase completa (sus partes no). La spec solo excluye una partícula sola, así que queda como nit.

## verify (iteración 5) · verifier
- [ ] Revisar en navegador el interruptor «Usar mis datos para personalizar las respuestas», su ayuda y el texto de la Política de privacidad antes del cierre (no lo cubre ningún test automático de estilo).
