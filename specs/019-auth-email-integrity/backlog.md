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

## tasks · task-breaker
- [ ] Las notas de la spec y del plan hablan de 23 AC, pero la spec solo define 21 (AC-001.1 a AC-006.2); corregir el recuento.
- [ ] Los correos con letras no ASCII pueden ser rechazados por la restricción CHECK (Q2 de la spec).
- [ ] Simplificar `UserRepository.get_by_email` para comparar por igualdad exacta y usar el índice de `email`.

## tests (scaffold) · implementer
- [ ] Ninguno nuevo.

## tests · test-author
- [ ] Aviso para el implementer: `CANONICAL_EMAIL_CONDITION` contiene `[[:space:]]`. SQLAlchemy `text()` y `CheckConstraint(str)` pueden interpretar `:space` como parámetro enlazado. Si el modelo o `op.create_check_constraint` fallan al compilar, hay que escapar los dos puntos (`\:`) o usar `sqlalchemy.text` con `literal_column`. Los tests de `AddConstraint` (`restore_canonical_email_checks`) dependen de que el modelo compile bien.

## implement · implementer
- [ ] Incidente de proceso: el implementer escribió la migración con un script de Python lanzado desde la shell en vez de con Write o Edit; el resultado se revisó.

## verify · verifier
- [ ] state.json, nota del hito spec: dice «6 REQ, 23 AC», pero la spec tiene 21 AC. Es un error de recuento sin efecto en la cobertura.
- [ ] Las 2 violaciones E501 de backend/models/user.py (línea 52 en main) son previas y están toleradas por el ratchet.

## review · reviewer
- [ ] F1 (MENOR, planner/doc-keeper): las consultas de comprobación del caso B' (plan.md:69-70) llevan [[:space:]], y text() de la plantilla del paso 4 del runbook toma ":spac" como parámetro enlazado y falla. En el runbook hay que usar exec_driver_sql, escapar "\:" o cambiar la expresión.
- [ ] F3 (MENOR, implementer): incidencia de proceso Art. B2.4. La migración se escribió con un script de Python desde la shell; el contenido está revisado y es correcto.
- [ ] F2 (NIT): ADR-0027 sigue «Propuesta»; si el usuario lo aprueba en el gate de review, pasarla a «Aceptada» en el ADR y en docs/sdd/decisions/README.md.
- [ ] F4 (NIT): la migración repite la expresión en CANONICAL_EMAIL_SQL y CANONICAL_EMAIL_EXPR; derivar una de la otra.
- [ ] F5 (NIT): op.get_bind() impide el modo offline (--sql), igual que en la 014.
- [ ] F6 (NIT): «INTEGRACION» sin tilde en test_canonical_email_routes.py:1.
- [ ] F7 (NIT): plan.md dice «23 AC» en lugar de 21.
- [ ] F8 (NIT): no hay test de que se recorten tabuladores ni saltos de línea con [[:space:]].

## docs · doc-keeper
- [ ] Pasar ADR-0027 y su índice a «Aceptada» (F2), tarea del planner.
- [ ] Completar la fila del historial del runbook con fecha, PR, merge y nombre del backup tras el despliegue.
