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
