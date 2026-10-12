# Verify report 007 — Cálculo de calorías y macros con límites de proteína y carbohidratos

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-12T09:18:45.234Z · **Rama:** `feat/007-macros-calculation` @ `390c012`
- **Resultado:** PASS

## 1. Comandos ejecutados

| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run` sobre `calculations.test.ts`, `MacrosPage.test.tsx` y `HomePage.test.tsx` (solo tests nuevos con `SDD:`) | ❌ en 22 tests, ✅ en 26 | 48 tests: 22 fallan por aserción o por texto ausente (rojo legítimo) y 26 pasan (caracterización, ver sección 2). Ningún error de sintaxis, import, fixture ni TypeScript. |

Los tests de la spec 006 (marcadores `SDD: REQ-012`) no se ejecutan en este modo y se conservan sin cambios.

## 2. Clasificación de rojo

**Rojo legítimo (22):** todos fallan por comportamiento ausente.
- Aserciones de cifras (`expected 872 to be 1200`, `expected 240 to be 175`, `expected 1046 to be 1200`, etc.) en AC-004.1, AC-004.2, AC-004.3, AC-004.5, AC-006.1, AC-006.2, AC-006.3, AC-007.1, AC-007.2, AC-007.4 y en los invariantes de AC-008.1 (`expected 826 to be greater than or equal to 1500`).
- Aserciones de gramos y kcal de macros (`expected { key: 'carbs', kcal: 320, … } to match object { grams: 100, kcal: 400 }`) en el caso combinado de AC-007.x.
- `TestingLibraryElementError` por texto ausente en `/macros` y `/home` (AC-009.1, AC-009.2, AC-009.4, AC-009.5): no aparecen "175 g", "100 g", etc.
- Aserción sobre el texto de la nota informativa (`toHaveTextContent`) en AC-010.1 y AC-010.3.

**Pasan en verde sin implementación (26), aceptado en plan.md sección 5.4:** son tests de caracterización de comportamiento que ya existe y solo lo fijan. Los declara el plan (AC-001.x, AC-002.x, AC-003.1, AC-004.4, AC-005.1, AC-007.3, AC-008.2, AC-009.3, AC-010.2), y no cuentan como rojo ilegítimo.

**Rojo ilegítimo:** ninguno.

## 3. Scaffold (ADR-0012)

- `frontend/src/features/macros/calculations.ts`: el diff solo añade `exactKcal: number` a `MacroResult`, `exactTargetKcal: number` a `MacrosSummary` y los valores `Number.NaN` en el retorno. No hay lógica nueva ni funciones nuevas. **OK.**

## 4. Otras comprobaciones

- No hay `.skip`, `.only`, `xfail`, `it.todo` ni `test.todo` nuevos en el diff del frontend.

## 5. Trazabilidad (modo red)

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-001, T-024 | `calculations.test.ts` (conversión ft/in y lb) | ✅ caracterización |
| REQ-001 | AC-001.2, AC-001.3 | T-002, T-024 | `calculations.test.ts` (edad por cumpleaños) | ✅ caracterización |
| REQ-002 | AC-002.1, AC-002.2 | T-003, T-024 | `calculations.test.ts` (mantenimiento por actividad) | ✅ caracterización |
| REQ-003 | AC-003.1 | T-004, T-024 | `calculations.test.ts` (metas) | ✅ caracterización |
| REQ-004 | AC-004.1, AC-004.2, AC-004.3 | T-005, T-020 | `calculations.test.ts` (suelo) | ❌ rojo legítimo |
| REQ-004 | AC-004.4 | T-006, T-020 | `calculations.test.ts` | ✅ caracterización |
| REQ-004 | AC-004.5 | T-006, T-020 | `calculations.test.ts` | ❌ rojo legítimo |
| REQ-005 | AC-005.1 | T-007, T-022 | `calculations.test.ts` | ✅ caracterización |
| REQ-006 | AC-006.1, AC-006.2, AC-006.3 | T-008, T-021 | `calculations.test.ts` (tope de proteína) | ❌ rojo legítimo |
| REQ-007 | AC-007.1, AC-007.2, AC-007.4 | T-009, T-022 | `calculations.test.ts` (mínimo de carbohidratos) | ❌ rojo legítimo |
| REQ-007 | AC-007.3 | T-009, T-022 | `calculations.test.ts` | ✅ caracterización |
| REQ-008 | AC-008.1 | T-010, T-023 | `calculations.test.ts` (400 combinaciones) | ❌ rojo legítimo |
| REQ-008 | AC-008.2 | T-011, T-023 | `calculations.test.ts` | ✅ caracterización |
| REQ-009 | AC-009.1, AC-009.2 | T-012, T-026 | `MacrosPage.test.tsx` | ❌ rojo legítimo |
| REQ-009 | AC-009.3 | T-013, T-026 | `MacrosPage.test.tsx` (kJ) | ✅ caracterización |
| REQ-009 | AC-009.4 | T-015, T-026 | `HomePage.test.tsx` | ❌ rojo legítimo |
| REQ-009 | AC-009.5 | T-013, T-015, T-026 | `MacrosPage.test.tsx` y `HomePage.test.tsx` | ❌ rojo legítimo |
| REQ-010 | AC-010.1, AC-010.3 | T-014, T-025 | `MacrosPage.test.tsx` (nota) | ❌ rojo legítimo |
| REQ-010 | AC-010.2 | T-014, T-025 | `MacrosPage.test.tsx` (nota) | ✅ caracterización |

- ACs sin test: —
- REQs sin tarea: —
- Tareas sin marcar `[x]`: — (en esta etapa T-000 a T-015 están marcadas; T-020 a T-026 son de la etapa implement)

## 3. Criterios de aceptación
Modo red: no aplica la comprobación de AC completos. Se revisará en modo full.

## 4. Fallos (si los hay)
Ninguno bloqueante en modo red. Los 22 fallos son rojo legítimo esperado para la etapa implement (responsable: implementer).
