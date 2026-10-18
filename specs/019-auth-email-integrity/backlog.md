# Backlog · 019-auth-email-integrity

## spec · spec-writer
- [ ] Si la respuesta a Q2 es aceptar el riesgo, anotar el caso de los correos no ASCII con la garantía activa.
- [ ] Documentar en docs/deploy-runbook.md el volcado completo previo y la aplicación manual de la migración, y decidir si va antes del merge como en la 014 (etapa docs, Art. P4).

## spec (cierre tras respuestas) · spec-writer
- [ ] Riesgo aceptado (Q2): un correo con letras no ASCII se pasa a minúsculas de forma distinta en la aplicación y en la base, así que la base puede rechazarlo y el registro devolver un 500. Habría que estudiar si se rechazan esos correos en la validación.
