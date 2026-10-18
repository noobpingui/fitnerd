# Verify report 018 — Endurecer /register y /login: 400 ante entradas inválidas, validación del registro y mensajes en español

- **Modo:** full (etapa verify, repetición tras fix de lint)
- **Fecha:** 2026-10-18T20:11:59.909Z · **Rama:** `fix/018-auth-robustness` @ `94b1e8f` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 997 passed in 68.64s (suite completa, nuevos y existentes) |
| backend | ratchet de ruff (`node scripts/lint-ratchet.mjs backend`, raíz del repo) | ✅ | sin violaciones nuevas respecto a main (`lint-ratchet [backend]: sin violaciones nuevas respecto a main. OK`, EXIT 0) |

Typecheck y build no aplican al ámbito `backend` (`null` en la config).

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.5 | T-011, T-017, T-020, T-031, T-032, T-033 | `test_auth_routes.py`, `test_auth_service.py`, `test_auth_input_rules.py` | ✅ |
| REQ-002 | AC-002.1 a AC-002.5 | T-011, T-017, T-020, T-031, T-032, T-033 | `test_auth_routes.py`, `test_auth_service.py`, `test_auth_input_rules.py` | ✅ |
| REQ-003 | AC-003.1 a AC-003.7 | T-012, T-015, T-021, T-031, T-032 | `test_auth_input_rules.py`, `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-004 | AC-004.1 a AC-004.5 | T-013, T-015, T-021, T-031, T-032 | `test_auth_input_rules.py`, `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-005 | AC-005.1 a AC-005.8 | T-014, T-015, T-021, T-030, T-032, T-033 | `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-006 | AC-006.1 a AC-006.5 | T-016, T-022, T-032 | `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-007 | AC-007.1 a AC-007.4 | T-018, T-022, T-032 | `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-008 | AC-008.1, AC-008.2 | T-018, T-022, T-032 | `test_auth_service.py`, `test_auth_routes.py` | ✅ |
| REQ-009 | AC-009.1, AC-009.2 | T-010, T-019, T-034 | `test_password_reset_service.py` | ✅ |
| NFR-001 | AC-N001.1 | T-023, T-033 | `test_auth_routes.py` | ✅ |

- AC sin test: — (todos los IDs `AC-…` de `spec.md` aparecen en al menos un marcador `SDD: 018`; 80 marcadores en `backend/tests`)
- REQ sin tarea: — (los 9 REQ y el NFR-001 aparecen en `tasks.md`)
- Tareas sin marcar `[x]`: — (21 de 21 marcadas)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: — (ninguno en `git diff main -- backend`)
- Nota: el estado y `tasks.md` mencionan 45 AC; `spec.md` contiene 44 IDs únicos. Sin impacto en el resultado; se anota en el backlog.

## 3. Criterios de aceptación manuales
- Ninguno. Todos los AC son de backend y se comprueban con tests automáticos.

## 4. Fallos (si los hay)
Ninguno. El fallo anterior (5 E501 nuevos en tests, responsable test-author) queda resuelto: el ratchet de ruff no reporta violaciones nuevas y la suite sigue en verde.
