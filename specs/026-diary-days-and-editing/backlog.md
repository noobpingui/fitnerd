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
