# Review 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

- **Iteración:** 2 de 4
- **Diff revisado:** `git diff main...fix/027-restore-token-hardening` @ `0986bed`, con foco en `git diff 39c9116 HEAD` (correcciones F1–F4). Sin commitear: solo `state.json` y `verify-report.md` de la feature.
- **Veredicto:** APPROVED

## 1. Resumen
Esta segunda review comprueba las correcciones de F1–F4 de la iteración 1. F1, F2 y F3 están resueltos. F4 no: el implementer aplicó `is_db_id` en `_parse_usda_item` (`backend/services/meal_rules.py:227`), que no era el sitio señalado y ya hacía la misma comprobación. La condición duplicada de `parse_snapshot_payload` (`backend/services/meal_rules.py:166`) sigue igual. El cambio en `_parse_usda_item` es equivalente (`is_db_id` = `is_int(value) and 1 <= value <= MAX_DB_INTEGER`, `meal_rules.py:321-322`), así que no hay regresión. F4 sigue siendo un NIT. No hay hallazgos BLOQUEANTES ni MAYORES.

## 2. Cumplimiento de la spec
La implementación de producción de la 027 no cambia respecto a la iteración 1, salvo las anotaciones de tipo y el refactor equivalente de `_parse_usda_item`. La tabla de evidencias de la iteración 1 sigue valiendo. Cambian estos puntos:

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 a AC-001.6 | Sí | `backend/config.py:44-50`, `backend/app.py:32-42`; `test_secret_key_config.py` |
| AC-002.1 a AC-002.3 | Sí | `backend/config.py:50` devuelve `value` sin `strip()`; `test_secret_key_config.py:136` |
| AC-003.1 a AC-003.3 | Sí | `backend/config.py:47`, `:64`, `:124` |
| AC-004.1 a AC-004.4 | Sí | `backend/services/meal_rules.py:136-140` |
| AC-005.1 a AC-005.5 | Sí | `backend/services/meal_rules.py:160` |
| AC-006.1 a AC-006.5 | Sí | `backend/services/meal_rules.py:166` |
| AC-N001.1 / AC-N001.2 | Sí | `test_meal_rules.py` (ida y vuelta); `test_secret_key_config.py:155` (renombrado); la suite de la 026 no cambia |
| AC-N002.1 | Sí (en CI, pendiente de confirmar) | `test_secret_key_config.py:144` (renombrado), `backend/tests/conftest.py:227` |

He vuelto a ejecutar `test_secret_key_config.py`, `test_meal_rules.py` y `test_meal_routes.py`: 393 passed.

## 3. Cumplimiento del plan
- La firma de `resolve_secret_key` ya coincide con la del plan (`backend/config.py:44`).
- Desviación sin impacto: el commit `0986bed` toca `_parse_usda_item`, código de la 022 que el plan de la 027 no menciona. Es un refactor equivalente y no cambia el comportamiento.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` da idéntico (snapshot del 07:28:34). Los renombrados de `9127597` llegan tras un `rework tests` registrado en `history` y un `snapshot` posterior. `commits.tests` = `9127597`, y desde ahí `0986bed` no toca `backend/tests/**`.
- [x] B4: el nombre de los dos tests marcados ya describe lo que comprueban (F1 y F2).
- [x] B5: no se borra, salta ni debilita ningún test. Los cambios de `9127597` solo afectan a nombres y docstrings.
- [x] B5.7: el ratchet no tiene violaciones nuevas (verify tras F1–F4).
- [x] B6.5: el diff no trae secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: sin `monkeypatch` ni `unittest.mock`. Docstrings en español.
- [x] P2.1–P2.4: no cambian las capas ni los modelos, y no hay migración.
- [ ] P2.5: queda una duplicación de `is_db_id` en `meal_rules.py:166` (F4, NIT).
- [x] P3.2 / P3.5: la validación es más estricta y no hay variables nuevas.
- [ ] P4: pendiente de la etapa `docs` (doc-keeper), como indica el orquestador. Esta review no lo cuenta como defecto.
- [x] P5.1: sin CRLF en el diff.

## 5. Hallazgos
### Estado de los hallazgos de la iteración 1
| # | Estado | Evidencia |
|---|---|---|
| F1 | Resuelto | Renombrado a `test_production_app_starts_in_tests_with_the_make_app_test_secret_key` (`backend/tests/test_services/test_secret_key_config.py:144`). El nombre ya no promete que falte la variable en el entorno. |
| F2 | Resuelto (aceptado) | Renombrado a `test_restore_token_format_guard_signer_round_trip_is_unchanged_by_027` (`test_secret_key_config.py:155`), con un docstring que explica que es una guarda del formato. El marcador `AC-N001.2` se conserva, ahora con un nombre honesto. |
| F3 | Resuelto | `backend/config.py:44`: `def resolve_secret_key(value: str \| None, *, required: bool) -> str`. |
| F4 | **No resuelto** | Ver F5. |

### Hallazgos de esta iteración
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F5 | NIT | `backend/services/meal_rules.py:166` | Es el F4 de la iteración 1, que sigue abierto. La condición `fdc_id is not None and (not is_int(fdc_id) or not 1 <= fdc_id <= MAX_DB_INTEGER)` repite `is_db_id` (`meal_rules.py:321-322`). El commit `0986bed` cambió `_parse_usda_item` (`meal_rules.py:227`), que ya hacía esa comprobación y no era el sitio señalado. Propuesta: `if fdc_id is not None and not is_db_id(fdc_id): return None`. | implementer |

Observaciones que no son hallazgos:
- El cambio de `_parse_usda_item` (`meal_rules.py:227`) es equivalente y no rompe nada, pero queda fuera del alcance de la 027. Se puede conservar.
- `backend/.pytest_cache` todavía guarda los nombres antiguos de los tests. Es caché local, no está versionada y no afecta a nada.
- Siguen pendientes para `docs` y el cierre P4 (comprobar `SECRET_KEY` en EC2 antes del merge y documentar los comandos locales con `FLASK_ENV=production`), la longitud mínima de `SECRET_KEY` (Q3) y las validaciones de longitud de los campos del token. Todo está en el backlog.

## 6. Decisión
APPROVED. No hay hallazgos BLOQUEANTES ni MAYORES. F1, F2 y F3 están resueltos. F4 sigue abierto como NIT (F5) y no bloquea: puede ir al backlog o corregirse en una pasada del implementer. Los tests coinciden con el snapshot autorizado y la suite de la feature pasa.

## Comentarios del usuario
