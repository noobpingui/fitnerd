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

## tests · verifier (red, iteración 1)
- [ ] Esqueleto de resolve_secret_key sin anotaciones de tipo (value: str | None, -> str) según el texto de T-001; cosmético, no bloquea.
- [ ] Tras implementar, comprobar en CI sin SECRET_KEY en el entorno que los tests de producción de la 020 siguen pasando (AC-N002.1); en local, el .env de backend puede definir SECRET_KEY y ocultar el caso.

## tests · verifier (red, iteración 3 · PASS)
- [ ] AC-N001.2: el marcador va en un test nuevo del firmante de la 026, no en la suite; la evidencia real es la suite de la 026 en verify (ya pasa en regresión).
- [ ] AC-N002.1: no reproducible en local porque backend/.env define SECRET_KEY (load_dotenv); confirmar en CI que la suite de la 020 pasa sin SECRET_KEY en el entorno.
- [ ] Esqueleto resolve_secret_key con _value sin anotaciones de tipo frente a value: str | None del plan (cosmético).
- [ ] Ejecutar en verify la suite completa del backend, incluida la 026, para cerrar AC-N001.2 y lint_ratchet.

## implement · implementer
- [ ] El test-author debe corregir el orden de imports (I001) en backend/tests/test_routes/test_meal_routes.py L8, o el verifier debe decidir cómo tratarlo, porque hace fallar el ratchet.
