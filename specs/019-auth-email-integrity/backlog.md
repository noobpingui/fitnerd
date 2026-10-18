# Backlog · 019-auth-email-integrity

## spec · spec-writer
- [ ] Si la respuesta a Q2 es aceptar el riesgo, anotar el caso de los correos no ASCII con la garantía activa.
- [ ] Documentar en docs/deploy-runbook.md el volcado completo previo y la aplicación manual de la migración, y decidir si va antes del merge como en la 014 (etapa docs, Art. P4).

## spec (cierre tras respuestas) · spec-writer
- [ ] Riesgo aceptado (Q2): un correo con letras no ASCII se pasa a minúsculas de forma distinta en la aplicación y en la base, así que la base puede rechazarlo y el registro devolver un 500. Habría que estudiar si se rechazan esos correos en la validación.

## plan · planner
- [ ] Simplificar `UserRepository.get_by_email` a una igualdad exacta (con la CHECK activa equivale y usa el índice de `email`).
- [ ] Riesgo Q2: correos con letras no ASCII y blancos Unicode que `str.strip()` quita y `[[:space:]]` puede no cubrir; valorar rechazarlos en `validate_email`.
- [ ] Revisar si los tests de la 014 de "cuentas antiguas con mayúsculas" siguen teniendo sentido una vez aplicada la 019 en todos los entornos, junto con el `lower()` de `get_by_email`.
