# Backlog · 027-restore-token-hardening

## spec · spec-writer
- [ ] Validar la longitud del nombre, del `catalog_id` y del tipo de dato dentro del token, para que un token anómalo no provoque un 500.
- [ ] Longitud mínima de `SECRET_KEY` en producción (Q3).
- [ ] Runbook y `CLAUDE.md`: comprobar `SECRET_KEY` antes del merge, y el comando local con `FLASK_ENV=production`.

## spec · spec-writer (iteración 2)
- [ ] El doc-keeper debe anotar en el runbook que `FLASK_ENV=production … flask db upgrade` desde local necesita una SECRET_KEY válida si el .env local trae "change-me".

## plan · planner
- [ ] Exigir una longitud mínima a SECRET_KEY en producción (Q3, p. ej. 32 caracteres).
- [ ] Validar en el snapshot la longitud del nombre, del catalog_id y de data_type (fuera de alcance según la spec).
- [ ] Comentar en backend/.env.example que change-me no vale en producción (doc-keeper).
- [ ] Documentar cómo comprobar la SECRET_KEY de EC2 sin imprimirla (doc-keeper).
