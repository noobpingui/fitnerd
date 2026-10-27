# Tareas 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-27)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden:
    1. tareas (scaffold): las ejecuta el implementer en modo scaffold (solo firmas que lanzan "not implemented");
    2. tareas (test): las ejecuta el test-author;
    3. tareas impl, migration y config, en orden de dependencia: las ejecuta el implementer.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
Solo `config.py` tiene símbolos nuevos que los tests importan. `parse_snapshot_payload` ya existe (cambia su comportamiento, no su firma), y el atributo `SECRET_KEY_REQUIRED` de las clases lo añade la implementación (su ausencia es rojo legítimo).
- [ ] T-001 [REQ-001, REQ-002, REQ-003] (scaffold) Crear en `config.py` las constantes `DEFAULT_SECRET_KEY = "DEFAULT SECRET"`, `KNOWN_DEFAULT_SECRET_KEYS = frozenset({"DEFAULT SECRET", "change-me"})` y `SECRET_KEY_REQUIRED_MESSAGE` (texto exacto de la spec), y la función `resolve_secret_key(value: str | None, *, required: bool) -> str` con el cuerpo `raise NotImplementedError("not implemented")` (parámetros con prefijo `_`) — `backend/config.py`

## Fase A — Tests (test-author)
- [ ] T-010 [NFR-002, AC-N002.1] (test) Cambiar el fixture `make_app` para que añada `SECRET_KEY` propia de pruebas (`"test-production-secret-key"`) a sus valores por defecto, sobrescribible por `overrides`, y actualizar su docstring; los tests de producción de la 020 no se tocan y pasan sin `SECRET_KEY` en el entorno — `backend/tests/conftest.py`
- [ ] T-011 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5] (test) `resolve_secret_key(required=True)` lanza `ValueError` con el mensaje exacto ante `None`, `"DEFAULT SECRET"`, `"change-me"`, vacía, solo espacios/tabuladores/saltos de línea y valores por defecto con espacios en los extremos; comprobar las constantes y `ProductionConfig.SECRET_KEY_REQUIRED is True` — `backend/tests/test_services/test_secret_key_config.py`
- [ ] T-012 [REQ-002, AC-002.1, AC-002.2] (test) `resolve_secret_key(required=True)` devuelve idénticas `"una-clave-propia-de-produccion"` y `"  clave con espacios  "` — `backend/tests/test_services/test_secret_key_config.py`
- [ ] T-013 [REQ-003, AC-003.1, AC-003.2] (test) `resolve_secret_key(required=False)` devuelve `"DEFAULT SECRET"` ante `None` y conserva `"change-me"`; `DevelopmentConfig` y `TestingConfig` tienen `SECRET_KEY_REQUIRED` a `False` — `backend/tests/test_services/test_secret_key_config.py`
- [ ] T-014 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6] (test) `create_app` de producción con `FRONTEND_BASE_URL` válido falla con `ValueError` y mensaje exacto para cada clave inválida (usando el override `SECRET_KEY=None` para «ausente»); con `FRONTEND_BASE_URL` y `SECRET_KEY` inválidos falla con `ValueError` de cualquiera de los dos mensajes — `backend/tests/test_services/test_secret_key_config.py`
- [ ] T-015 [REQ-002, REQ-003, AC-002.1, AC-002.2, AC-003.1, AC-003.2, AC-003.3] (test) `create_app` de producción arranca con clave propia y conserva su valor exacto; desarrollo arranca sin clave (`"DEFAULT SECRET"`) y con `"change-me"`; pruebas arranca con `SECRET_KEY=None` y con `"DEFAULT SECRET"` — `backend/tests/test_services/test_secret_key_config.py`
- [ ] T-016 [REQ-004, AC-004.1, AC-004.2, AC-004.3] (test) `parse_snapshot_payload` rechaza la versión `1.0`, `True`, `"1"`, `2`, `0`, `None` y ausente, y acepta la `1` devolviendo la copia completa — `backend/tests/test_services/test_meal_rules.py`
- [ ] T-017 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4] (test) `parse_snapshot_payload` acepta posición `0` y `2147483647`, y rechaza `2147483648`, `-1`, `1.0`, `True`, `"3"`, `None` y ausente — `backend/tests/test_services/test_meal_rules.py`
- [ ] T-018 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4] (test) `parse_snapshot_payload` de USDA rechaza `fdc_id` `2147483648`, `0`, `-5` y `1.0`, acepta `2147483647`, y sigue aceptando catálogo y personalizado sin `fdc_id` — `backend/tests/test_services/test_meal_rules.py`
- [ ] T-019 [NFR-001, AC-N001.1, AC-N001.2] (test) Ida y vuelta `parse_snapshot_payload(snapshot_payload(x)) == x` parametrizada por origen (catálogo, USDA, personalizado) y posición (`0`, `1`, `MAX_DB_INTEGER`); la suite existente de la 026 no se modifica — `backend/tests/test_services/test_meal_rules.py`
- [ ] T-020 [REQ-004, AC-004.4] (test) `POST /api/meals/restore` con un token bien firmado de versión `1.0` responde 404 con el mensaje habitual y las comidas no cambian — `backend/tests/test_routes/test_meal_routes.py`
- [ ] T-021 [REQ-005, AC-005.5] (test) `POST /api/meals/restore` con un token bien firmado de posición `2147483648` responde 404 (no 500) y las comidas no cambian — `backend/tests/test_routes/test_meal_routes.py`
- [ ] T-022 [REQ-006, AC-006.5] (test) `POST /api/meals/restore` con un token bien firmado de USDA con `fdc_id` `2147483648` responde 404 (no 500) y las comidas no cambian — `backend/tests/test_routes/test_meal_routes.py`
- [ ] T-023 [REQ-002, AC-002.3] (test) En una app de producción con `SECRET_KEY` propia, quitar un alimento con `?undo=1` y restaurar con el `restore_token` devuelve el alimento a su comida y posición — `backend/tests/test_routes/test_meal_routes.py`

## Fase B — Implementación (implementer)
- [ ] T-030 [REQ-001, REQ-002, REQ-003] (impl) Implementar `resolve_secret_key` según la tabla del plan (sin recortar la clave devuelta), usar `DEFAULT_SECRET_KEY` en `Config.SECRET_KEY` y añadir `SECRET_KEY_REQUIRED` (`False` en `Config`, `True` en `ProductionConfig`) — `backend/config.py`
- [ ] T-031 [REQ-001, REQ-002, REQ-003] (impl) Llamar a `resolve_secret_key` en `create_app()` tras resolver `FRONTEND_BASE_URL` y guardar el resultado en `app.config["SECRET_KEY"]` — `backend/app.py`
- [ ] T-032 [REQ-004, REQ-005, REQ-006] (impl) Endurecer `parse_snapshot_payload`: versión entera `1`, posición entera en `0..MAX_DB_INTEGER` y `fdc_id` entero en `1..MAX_DB_INTEGER` cuando exista, reutilizando `is_int` y `MAX_DB_INTEGER` — `backend/services/meal_rules.py`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-011, T-014 | T-030, T-031 |
| REQ-001 | AC-001.2 | T-011, T-014 | T-030, T-031 |
| REQ-001 | AC-001.3 | T-011, T-014 | T-030, T-031 |
| REQ-001 | AC-001.4 | T-011, T-014 | T-030, T-031 |
| REQ-001 | AC-001.5 | T-011, T-014 | T-030, T-031 |
| REQ-001 | AC-001.6 | T-014 | T-030, T-031 |
| REQ-002 | AC-002.1 | T-012, T-015 | T-030, T-031 |
| REQ-002 | AC-002.2 | T-012, T-015 | T-030, T-031 |
| REQ-002 | AC-002.3 | T-023 | T-030, T-031 |
| REQ-003 | AC-003.1 | T-013, T-015 | T-030, T-031 |
| REQ-003 | AC-003.2 | T-013, T-015 | T-030, T-031 |
| REQ-003 | AC-003.3 | T-015 | T-030, T-031 |
| REQ-004 | AC-004.1 | T-016 | T-032 |
| REQ-004 | AC-004.2 | T-016 | T-032 |
| REQ-004 | AC-004.3 | T-016 | T-032 |
| REQ-004 | AC-004.4 | T-020 | T-032 |
| REQ-005 | AC-005.1 | T-017 | T-032 |
| REQ-005 | AC-005.2 | T-017 | T-032 |
| REQ-005 | AC-005.3 | T-017 | T-032 |
| REQ-005 | AC-005.4 | T-017 | T-032 |
| REQ-005 | AC-005.5 | T-021 | T-032 |
| REQ-006 | AC-006.1 | T-018 | T-032 |
| REQ-006 | AC-006.2 | T-018 | T-032 |
| REQ-006 | AC-006.3 | T-018 | T-032 |
| REQ-006 | AC-006.4 | T-018 | T-032 |
| REQ-006 | AC-006.5 | T-022 | T-032 |
| NFR-001 | AC-N001.1 | T-019 | T-032 |
| NFR-001 | AC-N001.2 | T-019 (suite existente de la 026, sin cambios) | T-032 |
| NFR-002 | AC-N002.1 | T-010 | T-030, T-031 |
