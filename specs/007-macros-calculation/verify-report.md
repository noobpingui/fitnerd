# Verify report 007 — Cálculo de calorías y macros con límites de proteína y carbohidratos

- **Modo:** full (tras la etapa implement)
- **Fecha:** 2026-10-12T09:23:26.414Z · **Rama:** `feat/007-macros-calculation` @ `624532e`
- **Resultado:** PASS

## 1. Comandos ejecutados

| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `python -m pytest -q` | ⚠️ no aplica | El ámbito de la feature es solo frontend (`scope.backend: false`) |
| backend | `node .claude/sdd/scripts/ruff-new.mjs main` | ⚠️ no aplica | Sin .py cambiados en la feature |
| frontend | `npm test` | ✅ | 22 files passed, 174 tests passed |
| frontend | `npm run lint` | ✅ | 0 errores (2 warnings preexistentes en `ui/form.tsx` y `ui/button.tsx`) |
| frontend | `npx tsc -b` | ✅ | Sin errores (exit 0) |
| frontend | `npm run build` | ✅ | `tsc -b && vite build` OK; aviso preexistente de chunk > 500 kB |

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-001, T-024 | `calculations.test.ts` | ✅ |
| REQ-001 | AC-001.2, AC-001.3 | T-002, T-024 | `calculations.test.ts` | ✅ |
| REQ-002 | AC-002.1, AC-002.2 | T-003, T-024 | `calculations.test.ts` | ✅ |
| REQ-003 | AC-003.1 | T-004, T-024 | `calculations.test.ts` | ✅ |
| REQ-004 | AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5 | T-005, T-006, T-020 | `calculations.test.ts` | ✅ |
| REQ-005 | AC-005.1 | T-007, T-022 | `calculations.test.ts` | ✅ |
| REQ-006 | AC-006.1, AC-006.2, AC-006.3 | T-008, T-021 | `calculations.test.ts` | ✅ |
| REQ-007 | AC-007.1, AC-007.2, AC-007.3, AC-007.4 | T-009, T-022 | `calculations.test.ts` | ✅ |
| REQ-008 | AC-008.1, AC-008.2 | T-010, T-011, T-023 | `calculations.test.ts` | ✅ |
| REQ-009 | AC-009.1, AC-009.2, AC-009.3, AC-009.5 | T-012, T-013, T-026 | `MacrosPage.test.tsx` | ✅ |
| REQ-009 | AC-009.4, AC-009.5 | T-015, T-026 | `HomePage.test.tsx` | ✅ |
| REQ-010 | AC-010.1, AC-010.2, AC-010.3 | T-014, T-025 | `MacrosPage.test.tsx` | ✅ |

- ACs sin test: —
- REQs sin tarea: —
- Tareas sin marcar `[x]`: —
- Tests de los archivos de la feature sin cambios desde el commit de tests (`7e0936a`): sí, los tres `sha256` coinciden con `tests_snapshot`.
- `.skip`, `.only`, `xfail`, `it.todo` nuevos en el diff del frontend: ninguno.
- Scaffold T-000 (`Number.NaN`) sustituido por valores reales: sí, no quedan `NaN` en `calculations.ts`.

## 3. Criterios de aceptación
Los 29 AC de `spec.md` tienen al menos un test con marcador `SDD:` en los archivos de la feature, y la suite pasa completa. No hay AC que requiera comprobación manual en esta feature.

- AC-001.1 a AC-010.3: automáticos, ✅ (cubiertos por los tests de la tabla de trazabilidad).

## 4. Fallos (si los hay)
Ninguno.
