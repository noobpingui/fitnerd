# Verify report 015 — Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod

- **Modo:** red (tras la etapa tests, ciclo de review 1, comprobación de F2)
- **Fecha:** 2026-10-16T08:41:55.785Z · **Rama:** `fix/015-onboarding-profile-rhf` @ `84e7e3d` (con cambios sin commitear en los tests de F2) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run src/features/onboarding/schemas.test.ts src/features/onboarding/pages/OnboardingPage.test.tsx` (`frontend`) | ✅ (red legítimo esperado) | 72 tests en 2 archivos: 67 pasan, 5 fallan. Los 5 fallos son los tests nuevos de F2 (marcador `SDD: 015 REQ-007 AC-007.4`), todos por aserción |

Alcance: solo los 5 tests nuevos de F2 (`schemas.test.ts`: 3; `OnboardingPage.test.tsx`: 2). Los 67 restantes son los de la iteración anterior, que ya estaban en verde por caracterización aceptada por el usuario.

## 2. Trazabilidad
Esta comprobación es de modo red: el alcance es el rojo legítimo de los tests nuevos. La trazabilidad completa se revisará en `verify`.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-007 | AC-007.4 | T-021, T-044 | `onboarding/schemas.test.ts` ("gender null…", "activityLevel null…", "goal null…"); `onboarding/pages/OnboardingPage.test.tsx` ("en el género sin elegir…", "en la meta sin elegir…") | ❌ falla de forma legítima (rojo esperado, F1 sin corregir) |

Detalle de los fallos legítimos:
- `schemas.test.ts:248` (y los homólogos de `activityLevel` y `goal`): `expect(isValid({ gender: null })).toBe(false)` recibe `true`. El esquema acepta `null` en el enum. Es una aserción de comportamiento ausente, no un error de test.
- `OnboardingPage.test.tsx:772`: en el paso de género sin elegir hay un botón "Siguiente" habilitado (`expect(...).not.toBeInTheDocument()` falla). Comportamiento ausente de F1.
- `OnboardingPage.test.tsx:792`: en la meta sin elegir, "Comenzar" no está deshabilitado (`expect(button).toBeDisabled()` falla). Comportamiento ausente de F1.

Ningún fallo es de sintaxis, configuración, fixture, ni import fuera del plan. El test "en la meta…" llega hasta el paso de meta antes de fallar, por lo que el flujo de los helpers `toDateStep`, `next` y `heading` funciona.

Comprobaciones de la fase de scaffold (Art. B5.6 / paso 3 del modo red): `grep "not implemented" frontend/src` no devuelve coincidencias. Los esqueletos ya se sustituyeron por la implementación en la etapa implement, así que no hay esqueletos que comprobar en este ciclo.

Estado de las tareas de la matriz: sin cambios en este ciclo (T-021, T-044 ya `[x]`).

- AC sin test: — (no se evalúa en modo red)
- REQ sin tarea: — (no se evalúa en modo red)
- Tareas sin marcar `[x]`: — (no se evalúa en modo red)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno. El diff de los tests desde `84e7e3d` solo añade líneas (60 inserciones, 0 borrados).

## 3. Criterios de aceptación manuales
Ninguno en este ciclo.

## 4. Fallos (si los hay)
Ningún fallo bloquea el PASS del modo red. Los 5 rojos son los esperados por la regresión F1 de la review (rojo legítimo):

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| R1 | `schemas.test.ts` › gender null no es válido | `expected true to be false` (`schemas.test.ts:248`) | rojo legítimo (implementer corrige F1) |
| R2 | `schemas.test.ts` › activityLevel null no es válido | `expected true to be false` | rojo legítimo (implementer corrige F1) |
| R3 | `schemas.test.ts` › goal null no es válido | `expected true to be false` | rojo legítimo (implementer corrige F1) |
| R4 | `OnboardingPage.test.tsx` › en el género sin elegir no hay "Siguiente" | `expect(element).not.toBeInTheDocument()` encuentra `<button>Siguiente</button>` (`OnboardingPage.test.tsx:772`) | rojo legítimo (implementer corrige F1) |
| R5 | `OnboardingPage.test.tsx` › en la meta sin elegir, "Comenzar" deshabilitado | `expect(element).toBeDisabled()` recibe un botón habilitado (`OnboardingPage.test.tsx:792`) | rojo legítimo (implementer corrige F1) |

## Comentarios del usuario

1. Si, confirmado. 2. A
