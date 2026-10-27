# Review 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

- **Iteración:** 3 de 4
- **Diff revisado:** `git diff main...fix/027-restore-token-hardening` @ `84b4921`, con foco en `git diff 0986bed HEAD` (corrección F5). Sin commitear: solo `state.json` y `verify-report.md` de la feature.
- **Veredicto:** APPROVED

## 1. Resumen
Esta tercera review comprueba la corrección de F5 (antes F4). Está resuelto. `parse_snapshot_payload` usa ahora `is_db_id(fdc_id)` (`backend/services/meal_rules.py:166`). El cambio fuera de alcance de `0986bed` en `_parse_usda_item` se revirtió, y esa función vuelve a ser idéntica a la de `main`: ya no aparece en `git diff main...HEAD`. No hay regresiones ni hallazgos nuevos.

## 2. Cumplimiento de la spec
El código de producción de la 027 respecto a `main` se limita a `backend/config.py`, `backend/app.py` y `backend/services/meal_rules.py`, con 37 líneas en total. La evidencia de las iteraciones 1 y 2 sigue valiendo:

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 a AC-001.6 | Sí | `backend/config.py:44-50`, `backend/app.py:38-42`, `backend/config.py:124`; `test_secret_key_config.py` |
| AC-002.1 a AC-002.3 | Sí | `backend/config.py:50` devuelve `value` sin `strip()` |
| AC-003.1 a AC-003.3 | Sí | `backend/config.py:37-38`, `:63-64` |
| AC-004.1 a AC-004.4 | Sí | `backend/services/meal_rules.py:136-140`: `v` debe ser un entero (no un booleano) igual a 1 |
| AC-005.1 a AC-005.5 | Sí | `backend/services/meal_rules.py:160`: `0 <= position <= MAX_DB_INTEGER` |
| AC-006.1 a AC-006.5 | Sí | `backend/services/meal_rules.py:166`: `is_db_id(fdc_id)` = `is_int(value) and 1 <= value <= MAX_DB_INTEGER` (`meal_rules.py:321-322`). El comportamiento es el mismo que el de la condición en línea anterior. |
| AC-N001.1 / AC-N001.2 | Sí | Ida y vuelta en `test_meal_rules.py`; guarda del formato en `test_secret_key_config.py` |
| AC-N002.1 | Sí (pendiente de confirmar en CI) | `test_secret_key_config.py`, `backend/tests/conftest.py` |

He ejecutado `test_meal_rules.py`, `test_secret_key_config.py` y `test_meal_routes.py`: 393 passed.

## 3. Cumplimiento del plan
- No quedan desviaciones. Se revirtió el cambio de `_parse_usda_item` (código de la 022), que el plan no incluía.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` da `identical: true` con el snapshot de las 07:28:34. `git diff 9127597 HEAD -- backend/tests` está vacío: ni `0986bed` ni `84b4921` tocan tests.
- [x] B4: los nombres de los tests describen lo que comprueban.
- [x] B5: no se borra, salta ni debilita ningún test.
- [x] B5.7: el ratchet no tiene violaciones nuevas (verify de la iteración 3).
- [x] B6.5: el diff no trae secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: sin `monkeypatch` ni `unittest.mock`. Comentarios y docstrings en español.
- [x] P2.1–P2.4: no cambian las capas ni los modelos, y no hay migración.
- [x] P2.5: se reutiliza `is_db_id` y no queda duplicación.
- [x] P3.2 / P3.5: la validación es más estricta y no hay variables nuevas.
- [ ] P4: pendiente de la etapa `docs` (doc-keeper), como indica el orquestador. Esta review no lo cuenta como defecto.
- [x] P5.1: sin CRLF en el diff.

## 5. Hallazgos
### Estado de los hallazgos de iteraciones anteriores
| # | Estado | Evidencia |
|---|---|---|
| F1 | Resuelto (iteración 2) | `test_secret_key_config.py`, renombrado |
| F2 | Resuelto (iteración 2) | `test_secret_key_config.py`, renombrado, con docstring de guarda |
| F3 | Resuelto (iteración 2) | `backend/config.py:44` |
| F4 / F5 | Resuelto | `backend/services/meal_rules.py:166` usa `is_db_id(fdc_id)`. `_parse_usda_item` es idéntico al de `main`. |

### Hallazgos de esta iteración
No hay ninguno.

Observaciones que no son hallazgos:
- `is_db_id` está definida al final del módulo (`meal_rules.py:321`), después de `parse_snapshot_payload`. Funciona igual, porque el nombre se resuelve cuando se llama a la función.
- Siguen pendientes para `docs` y el cierre P4 (comprobar `SECRET_KEY` en EC2 antes del merge y documentar los comandos locales con `FLASK_ENV=production`), la longitud mínima de `SECRET_KEY` (Q3) y las validaciones de longitud de los campos del token. Todo está en el backlog.

## 6. Decisión
APPROVED. No quedan hallazgos abiertos de ninguna severidad. Los tests coinciden con el snapshot autorizado y la suite de la feature pasa (393 passed).

## Comentarios del usuario
