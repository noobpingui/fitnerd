# Backlog · 027-restore-token-hardening

## spec · spec-writer
- [ ] Validar la longitud del nombre, del `catalog_id` y del tipo de dato dentro del token, para que un token anómalo no provoque un 500.
- [ ] Longitud mínima de `SECRET_KEY` en producción (Q3).
- [ ] Runbook y `CLAUDE.md`: comprobar `SECRET_KEY` antes del merge, y el comando local con `FLASK_ENV=production`.

## spec · spec-writer (iteración 2)
- [ ] El doc-keeper debe anotar en el runbook que `FLASK_ENV=production … flask db upgrade` desde local necesita una SECRET_KEY válida si el .env local trae "change-me".
