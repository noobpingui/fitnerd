# Verify report NNN — <Título de la feature>

- **Modo:** red (tras la etapa tests) | full (tras la etapa implement)
- **Fecha:** <ISO-8601> · **Rama:** `feat/NNN-slug` @ `<sha>`
- **Resultado:** PASS | FAIL | BLOCKED (entorno)

## 1. Comandos ejecutados
| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `python -m pytest -q` | ✅ / ❌ / ⚠️ | 30 passed |
| backend | `ruff check <archivos .py cambiados>` | | |
| frontend | `npm test` | | |
| frontend | `npm run lint` | | 0 errores (3 warnings preexistentes) |
| frontend | `npx tsc -b` | | |
| frontend | `npm run build` | | |

<!--
Modo red: solo se ejecutan los tests nuevos. Resultado PASS significa que TODOS fallan por comportamiento
ausente (assert o 404/501 esperado), no por errores de import, sintaxis o fixture.
-->

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-001, T-011 | `test_x.py::test_y` | ✅ |

- ACs sin test: —
- REQs sin tarea: —
- Tareas sin marcar `[x]`: —

## 3. Criterios de aceptación
<!-- Cualquier AC que no se pueda comprobar automáticamente se marca "manual" y se deja para el usuario en el gate. -->

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable |
|---|---|---|---|
