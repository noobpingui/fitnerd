# Verify report 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

- **Modo:** full (etapa verify), iteración 3, tras la corrección de F5 de la review
- **Fecha:** 2026-10-27T07:42:00.441Z · **Rama:** `fix/027-restore-token-hardening` @ `84b4921` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 2182 passed en 126,25 s (suite completa). |
| backend | `lint_ratchet` (`node .../lint-ratchet.mjs backend`, desde la raíz) | ✅ | Sin violaciones nuevas respecto a main en los 7 archivos del ámbito. |
| backend | `lint` | — | `null` en `backend`; el ratchet lo sustituye. |
| backend | `typecheck`, `build` | — | `null` en `backend`; no se ejecutan. |

Comprobaciones adicionales (no son comandos de la config):
- Huellas SHA-256 de los 4 archivos de `backend/tests/**` de la feature: coinciden con `tests_snapshot.sha256` de `state.json`. `git diff 9127597 HEAD -- backend/tests` está vacío, así que los tests no han cambiado desde el snapshot.
- F5 de la review (`is_db_id` en `parse_snapshot_payload`): `backend/services/meal_rules.py:166` usa `not is_db_id(fdc_id)`, con `is_db_id` definido en `:321`. `_parse_usda_item` no aparece en `git diff main -- backend/services/meal_rules.py`, así que es idéntico a main. El único hunk del archivo está dentro de `parse_snapshot_payload`, que la 027 cambia por diseño (REQ-004 a REQ-006). La condición de `fdc_id` es la misma que tenía antes del cambio (entero en 1..MAX_DB_INTEGER), así que no cambia el comportamiento.
- Sin `SECRET_KEY` en el proceso (`env -u SECRET_KEY`): `test_secret_key_config.py`, `test_meal_rules.py` y `test_meal_routes.py` pasan, 393 passed. Nota: si `backend/.env` local define `SECRET_KEY`, esta prueba no reproduce del todo AC-N002.1; la confirmación definitiva queda para el CI (`backend-tests.yml`, que no define `SECRET_KEY`).
- CRLF en `git diff main...HEAD -- backend`: ninguno (P5.1).

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.5 | T-011, T-014 / T-030, T-031 | `backend/tests/test_services/test_secret_key_config.py` (`:61`, `:69`, `:76`, `:83`, `:118`) | ✅ |
| REQ-001 | AC-001.6 | T-014 / T-030, T-031 | `test_secret_key_config.py:125` | ✅ |
| REQ-002 | AC-002.1, AC-002.2 | T-012, T-015 / T-030, T-031 | `test_secret_key_config.py:91`, `:136` | ✅ |
| REQ-002 | AC-002.3 | T-023 / T-030, T-031 | `backend/tests/test_routes/test_meal_routes.py:1801` | ✅ |
| REQ-003 | AC-003.1, AC-003.2 | T-013, T-015 / T-030, T-031 | `test_secret_key_config.py:97`, `:103`, `:166`, `:174` | ✅ |
| REQ-003 | AC-003.3 | T-015 / T-030, T-031 | `test_secret_key_config.py:184` | ✅ |
| REQ-004 | AC-004.1, AC-004.2, AC-004.3 | T-016 / T-032 | `backend/tests/test_services/test_meal_rules.py:219`, `:226`, `:231`, `:238` | ✅ |
| REQ-004 | AC-004.4 | T-020 / T-032 | `test_meal_routes.py:1758` | ✅ |
| REQ-005 | AC-005.1, AC-005.4 | T-017 / T-032 | `test_meal_rules.py:244`, `:245` | ✅ |
| REQ-005 | AC-005.2, AC-005.3 | T-017 / T-032 | `test_meal_rules.py:253`, `:260`, `:266`, `:272` | ✅ |
| REQ-005 | AC-005.5 | T-021 / T-032 | `test_meal_routes.py:1766` | ✅ |
| REQ-006 | AC-006.1, AC-006.2 | T-018 / T-032 | `test_meal_rules.py:278`, `:279`, `:286` | ✅ |
| REQ-006 | AC-006.3, AC-006.4 | T-018 / T-032 | `test_meal_rules.py:292`, `:303` | ✅ |
| REQ-006 | AC-006.5 | T-022 / T-032 | `test_meal_routes.py:1776` | ✅ |
| NFR-001 | AC-N001.1 | T-019 / T-032 | `test_meal_rules.py:319` | ✅ |
| NFR-001 | AC-N001.2 | T-019 / T-032 | `test_secret_key_config.py:154` (guarda del firmante) y suite de la 026 sin cambios | ✅ |
| NFR-002 | AC-N002.1 | T-010 / T-030, T-031 | `test_secret_key_config.py:143` | ✅ en local con `SECRET_KEY` quitada del proceso; CI pendiente |

- AC sin test: — (los 29 AC de `spec.md` aparecen en al menos un marcador `SDD: 027`).
- REQ sin tarea: — (REQ-001 a REQ-006, NFR-001 y NFR-002 aparecen en `tasks.md`).
- Tareas sin marcar `[x]`: — (18 de 18 tareas marcadas `[x]`).
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: — (revisado en `git diff main...HEAD -- backend`).

## 3. Criterios de aceptación manuales
- Ninguno. Todos los AC de la 027 son comprobables con tests de backend.

## 4. Fallos (si los hay)
Ninguno.
