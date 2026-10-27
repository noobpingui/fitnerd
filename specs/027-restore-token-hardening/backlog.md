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
- [x] Esqueleto de resolve_secret_key sin anotaciones de tipo (value: str | None, -> str) según el texto de T-001; cosmético, no bloquea.
- [ ] Tras implementar, comprobar en CI sin SECRET_KEY en el entorno que los tests de producción de la 020 siguen pasando (AC-N002.1); en local, el .env de backend puede definir SECRET_KEY y ocultar el caso.

## tests · verifier (red, iteración 3 · PASS)
- [ ] AC-N001.2: el marcador va en un test nuevo del firmante de la 026, no en la suite; la evidencia real es la suite de la 026 en verify (ya pasa en regresión).
- [ ] AC-N002.1: no reproducible en local porque backend/.env define SECRET_KEY (load_dotenv); confirmar en CI que la suite de la 020 pasa sin SECRET_KEY en el entorno.
- [ ] Esqueleto resolve_secret_key con _value sin anotaciones de tipo frente a value: str | None del plan (cosmético).
- [ ] Ejecutar en verify la suite completa del backend, incluida la 026, para cerrar AC-N001.2 y lint_ratchet.

## implement · implementer
- [x] El test-author debe corregir el orden de imports (I001) en backend/tests/test_routes/test_meal_routes.py L8, o el verifier debe decidir cómo tratarlo, porque hace fallar el ratchet.

## verify · verifier (full, iteración 1)
- [x] test_production_app_starts_in_tests_without_secret_key_in_the_environment prueba el valor por defecto del fixture make_app, no la ausencia real de la variable; el nombre es más fuerte que lo que comprueba.
- [ ] Confirmar AC-N002.1 en la ejecución de CI tras el push (CI sin SECRET_KEY).

## tests · test-author (iteración 4)
- [x] Renombrar test_production_app_starts_in_tests_without_secret_key_in_the_environment (backend/tests/test_services/test_secret_key_config.py L144) para que el nombre no prometa más de lo que comprueba.

## review · reviewer
- [x] F1 (MENOR, test-author): `test_production_app_starts_in_tests_without_secret_key_in_the_environment` (`backend/tests/test_services/test_secret_key_config.py:144`) promete más de lo que comprueba; renombrarlo. AC-N002.1 se confirma en CI.
- [x] F2 (NIT, test-author): el marcador AC-N001.2 está en un test del firmante que no tiene que ver con la 027 (`test_secret_key_config.py:154-162`).
- [x] F3 (NIT, implementer): faltan las anotaciones de tipo de `resolve_secret_key` (`backend/config.py:44`).
- [x] F4 (NIT, implementer): reutilizar `is_db_id` para el `fdc_id` en `backend/services/meal_rules.py:166`.
- [ ] docs (P4): documentar en el runbook y en `CLAUDE.md` que hay que comprobar en EC2, antes del merge, que `SECRET_KEY` existe y no es un valor por defecto, y que los comandos locales con `FLASK_ENV=production` necesitan una clave válida.

## review · reviewer (iteración 3)
- [ ] P4 (docs, doc-keeper): comprobar SECRET_KEY en el backend/.env de EC2 antes del merge y documentar los comandos locales con FLASK_ENV=production.
- [ ] Confirmar AC-N002.1 en CI (sin SECRET_KEY en el entorno).
