# Review 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

- **Iteración:** 1 de 4
- **Diff revisado:** `git diff main...fix/027-restore-token-hardening` @ `39c9116` (+ sin commitear: solo `state.json` y `verify-report.md` de la feature)
- **Veredicto:** APPROVED

## 1. Resumen
El cambio replica el patrón de `FRONTEND_BASE_URL` (ADR-0028). `resolve_secret_key` en `config.py` se llama desde `create_app()` y hace que producción no arranque con una `SECRET_KEY` ausente, vacía, en blanco o por defecto. Además, `parse_snapshot_payload` exige el entero `1` como versión y pone topes a la posición y al `fdc_id` según el rango de la base. El diff de producción es pequeño (3 archivos, unas 30 líneas), sin migración ni variables nuevas. Los tests cubren cada AC y los de rutas fabrican tokens con el firmante real. No encuentro hallazgos bloqueantes ni mayores.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `backend/config.py:48` (`not isinstance(value, str)` cubre `None`); `backend/app.py:39-42`; `test_secret_key_config.py:61`, `:118[None]` |
| AC-001.2 | Sí | `backend/config.py:38,48`; `test_secret_key_config.py:69`, `:118` |
| AC-001.3 | Sí | `backend/config.py:38,48`; `test_secret_key_config.py:69`, `:118` |
| AC-001.4 | Sí | `backend/config.py:48` (`strip()` contra `{""}`); `test_secret_key_config.py:76`, `:118` |
| AC-001.5 | Sí | `backend/config.py:48` (compara `value.strip()`); `test_secret_key_config.py:83`, `:118` |
| AC-001.6 | Sí | `backend/app.py:32-42` (FRONTEND_BASE_URL se evalúa antes y lanza antes de `db.init_app`); `test_secret_key_config.py:125` |
| AC-002.1 | Sí | `backend/config.py:50` (devuelve `value` original); `test_secret_key_config.py:91`, `:136` |
| AC-002.2 | Sí | `backend/config.py:50` (sin `strip()` en el retorno); `test_secret_key_config.py:91`, `:136` |
| AC-002.3 | Sí | `backend/routes/meal_routes.py:63` lee `app.config["SECRET_KEY"]` ya resuelto; `test_meal_routes.py:1802` |
| AC-003.1 | Sí | `backend/config.py:47`, `:64`; `test_secret_key_config.py:97`, `:166` |
| AC-003.2 | Sí | `backend/config.py:47`; `test_secret_key_config.py:103`, `:174` |
| AC-003.3 | Sí | `TestingConfig` hereda `SECRET_KEY_REQUIRED = False` (`backend/config.py:64`); `test_secret_key_config.py:183` |
| AC-004.1 | Sí | `backend/services/meal_rules.py:138-139`; `test_meal_rules.py:219` |
| AC-004.2 | Sí | `backend/services/meal_rules.py:139` (`is_int` excluye `bool`); `test_meal_rules.py` (versión `True` y `["1", 2, 0, None, ausente]`) |
| AC-004.3 | Sí | `test_meal_rules.py` `test_parse_snapshot_payload_accepts_version_one_with_the_full_snapshot` |
| AC-004.4 | Sí | `backend/services/meal_service.py:242-243` (`snapshot is None` lleva a 404 antes de escribir); `test_meal_routes.py:1759` |
| AC-005.1 / AC-005.4 | Sí | `backend/services/meal_rules.py:160`; `test_meal_rules.py:247` |
| AC-005.2 | Sí | `backend/services/meal_rules.py:160`; `test_meal_rules.py:255` (también `10**20`) |
| AC-005.3 | Sí | `backend/services/meal_rules.py:160`; tests de `-1`, `1.0`, `True`, `"3"`, `None` y ausente en `test_meal_rules.py` |
| AC-005.5 | Sí | `test_meal_routes.py:1767` (404, diario y conteos sin cambios) |
| AC-006.1 / AC-006.2 | Sí | `backend/services/meal_rules.py:166`; `test_meal_rules.py:281` y el test de `1.0` |
| AC-006.3 | Sí | `test_meal_rules.py:294` (`1` y `MAX_INT`) |
| AC-006.4 | Sí | `backend/services/meal_rules.py:166` (solo si `fdc_id is not None`); `test_meal_rules.py` (catálogo y personalizado sin `fdc_id`) |
| AC-006.5 | Sí | `test_meal_routes.py:1777` |
| AC-N001.1 | Sí | `test_meal_rules.py:335` (ida y vuelta por origen y posición `0`, `1` y `MAX_INT`) |
| AC-N001.2 | Sí | Suite de la 026 sin cambios (el diff de `backend/tests/**` solo añade). He vuelto a ejecutar `test_meal_rules.py`, `test_meal_routes.py`, `test_secret_key_config.py` y `test_production_config.py` sin `SECRET_KEY` en el entorno del proceso: 415 passed. El marcador está en un test del firmante (ver F2) |
| AC-N002.1 | Sí (en CI pendiente de confirmar) | `backend/tests/conftest.py:227`; `.github/workflows/backend-tests.yml:104-113` no define `SECRET_KEY`; los `make_app("production", …)` de `test_coach_observability.py` y `test_langfuse_backend.py` también se benefician |

## 3. Cumplimiento del plan
- Se sigue el plan al pie de la letra: tabla de comportamiento de `resolve_secret_key`, orden en `create_app()` (`backend/app.py:32-42`), atributos de clase (`backend/config.py:64`, `:124`) y reglas de `parse_snapshot_payload`.
- Desviación cosmética: el plan fija `resolve_secret_key(value: str | None, *, required: bool) -> str`, y la implementación (`backend/config.py:44`) no lleva anotaciones de tipo. Es coherente con `resolve_frontend_base_url`, del mismo módulo, que tampoco las lleva. Ver F3.
- `MealService`, `RestoreTokenSigner` y las rutas no cambian, como estaba previsto.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` da idéntico. El último cambio de tests (`39c9116`, I001) es posterior al implement, pero lo autoriza el `rework tests` registrado en `history`, con un `snapshot` posterior. `git diff 39c9116 HEAD -- backend/tests` está vacío.
- [x] B4: los marcadores `SDD: 027` coinciden con los AC que prueban, salvo el matiz de F2.
- [x] B5: no se borra, salta ni debilita ningún test. No hay llamadas externas. No queda ningún `NotImplementedError` en `resolve_secret_key`.
- [x] B5.7: el ratchet no tiene violaciones nuevas (verify, iteración 2).
- [x] B6.5: sin secretos en el diff ni variables nuevas.

### Parte II (proyecto)
- [x] P1.1: los marcadores llevan el número de spec. Docstrings y comentarios en español.
- [x] P1 backend: unitarios en `test_services/` e integración en `test_routes/` con `client`. Sin `unittest.mock` ni `monkeypatch` («ausente» se expresa con `SECRET_KEY=None`). Solo se usa el Postgres de prueba.
- [x] P2.1–P2.3: la validación sigue en `services/meal_rules.py` y el 404 sale de `ResourceNotFoundError`. Las rutas no cambian.
- [x] P2.4: no hay cambios de modelo ni migraciones, y no hace falta ninguna.
- [x] P2.5: se reutilizan `RestoreTokenSigner`, `is_int` y `MAX_DB_INTEGER`. Queda una oportunidad de reutilizar `is_db_id` (F4, NIT).
- [x] P2 General: el mensaje y los comentarios están en español correcto, con tildes.
- [x] P3.2: la validación del contenido del token es más estricta.
- [x] P3.5: no hay variables nuevas. `SECRET_KEY` ya figura en `backend/.env.example`.
- [ ] P4 (pendiente de `docs`): el paso manual de comprobar en EC2 que `SECRET_KEY` existe y no es un valor por defecto antes del merge debe quedar en `docs/deploy-runbook.md` y en `CLAUDE.md`. Si no se hace, el CD dejaría el contenedor sin arrancar. Corresponde al `doc-keeper` y ya está en el backlog de la feature.
- [x] P5.1: sin CRLF en el diff (verify).

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `backend/tests/test_services/test_secret_key_config.py:144` | `test_production_app_starts_in_tests_without_secret_key_in_the_environment` no elimina `SECRET_KEY` del entorno. En local, `backend/.env` la define y `load_dotenv()` la carga en `Config.SECRET_KEY`. El test solo comprueba que el fixture `make_app` aporta `"test-production-secret-key"`, así que el nombre promete más de lo que verifica. AC-N002.1 solo se confirma de verdad en CI. Propuesta: renombrar el test, p. ej. `test_make_app_gives_production_its_own_test_secret_key`. Ya está en el backlog. | test-author |
| F2 | NIT | `backend/tests/test_services/test_secret_key_config.py:154-162` | El marcador `AC-N001.2` está en un test nuevo del firmante (`RestoreTokenSigner("test-secret")`) que no tiene relación con el contenido del snapshot. La evidencia real de AC-N001.2 es que la suite de la 026 pasa sin cambios. El test no aporta nada a la 027 y está en un archivo de configuración. | test-author |
| F3 | NIT | `backend/config.py:44` | `resolve_secret_key` no lleva las anotaciones `value: str \| None, *, required: bool) -> str` del plan. Es cosmético y coherente con `resolve_frontend_base_url`. | implementer |
| F4 | NIT | `backend/services/meal_rules.py:166` | La condición `is_int(fdc_id) and 1 <= fdc_id <= MAX_DB_INTEGER` repite lo que ya hace `is_db_id` (`backend/services/meal_rules.py:321-322`). Se podría escribir `fdc_id is not None and not is_db_id(fdc_id)`. | implementer |

Observaciones que no son hallazgos (para `docs` y el cierre):
- Con la 027, `FLASK_ENV=production flask db upgrade` desde local y los scripts que llaman a `create_app()` fallan si el `.env` local trae `change-me`. Hay que documentarlo (Q1 de la spec, backlog).
- La longitud mínima de `SECRET_KEY` (Q3) y la validación de la longitud del nombre, del `catalog_id` y de `dt` en el token quedan fuera de alcance. Ya están en el backlog.

## 6. Decisión
APPROVED. No hay hallazgos BLOQUEANTES ni MAYORES. Cada AC está implementado como dice la spec, con evidencia en el código y en los tests. Los tests no han cambiado desde el snapshot autorizado. Los hallazgos MENOR y NIT pueden ir al backlog.

## Comentarios del usuario
