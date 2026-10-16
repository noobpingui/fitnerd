# Verify report 015 — Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-16T04:50:48.718Z · **Rama:** `fix/015-onboarding-profile-rhf` @ `2dc8b48` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run` sobre los 5 archivos con marcador `SDD:` (`frontend`) | ❌ (esperado en rojo) | 139 tests en total: 102 pasan, 37 fallan. Los 37 fallos son rojos legítimos (`not implemented` del esqueleto o aserción sobre AC-003.5). Ningún error de sintaxis, configuración, fixture o import fuera del plan. |

Archivos ejecutados: `src/features/onboarding/pages/OnboardingPage.test.tsx`, `src/features/onboarding/schemas.test.ts`, `src/features/onboarding/units.test.ts`, `src/features/profile/schemas.test.ts`, `src/features/profile/pages/ProfilePage.test.tsx`. Salida JSON de vitest en `C:/Users/alber/AppData/Local/Temp/claude/C--Users-alber-source-repos-fitnerd/9d9ae304-66b6-4231-b812-d0cd7bf97228/scratchpad/vitest015.json`.

Excepción de caracterización (confirmada por el usuario en la iteración 1, ver "Comentarios del usuario"): los tests nuevos en verde son comportamiento ya existente (caracterización), incluidos los de T-016, T-018, T-023 y T-024. Se aceptan como guardas.

Comandos no ejecutados en modo red: `lint`, `typecheck` y `build` (solo se ejecutan en verify).

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 … AC-001.4 | T-010, T-011, T-012, T-017, T-023 | `onboarding/schemas.test.ts`, `onboarding/pages/OnboardingPage.test.tsx`, `profile/pages/ProfilePage.test.tsx` | ❌ rojo legítimo (scaffold) en los unitarios; ✅ en los de interfaz (caracterización) |
| REQ-002 | AC-002.1, AC-002.2 | T-011, T-015, T-023 | `onboarding/schemas.test.ts`, `profile/schemas.test.ts`, `ProfilePage.test.tsx` | ❌ rojo legítimo (scaffold); ✅ en interfaz (caracterización) |
| REQ-003 | AC-003.1 … AC-003.5 | T-013, T-016, T-018, T-019, T-024 | los cuatro archivos de test | ❌ rojo legítimo en AC-003.5 y en unitarios; ✅ en el resto (caracterización) |
| REQ-004 | AC-004.1 … AC-004.3 | T-014, T-018, T-019, T-024 | `schemas.test.ts`, `OnboardingPage.test.tsx`, `ProfilePage.test.tsx` | ❌ rojo legítimo en unitarios; ✅ en interfaz (caracterización) |
| REQ-005 | AC-005.1 … AC-005.3 | T-015, T-025 | `profile/schemas.test.ts`, `ProfilePage.test.tsx` | ❌ rojo legítimo (scaffold); ✅ en interfaz (caracterización) |
| REQ-006 | AC-006.1 … AC-006.4 | T-016, T-020, T-026 | `onboarding/units.test.ts`, `OnboardingPage.test.tsx`, `ProfilePage.test.tsx` | ❌ rojo legítimo en AC-003.5 (`5.5` ft); ✅ en el resto (caracterización) |
| REQ-007 | AC-007.1 … AC-007.5 | T-021 | `OnboardingPage.test.tsx` | ✅ (caracterización) |
| REQ-008 | AC-008.1 … AC-008.3 | T-022 | `OnboardingPage.test.tsx` | ✅ (caracterización) |
| REQ-009 | AC-009.1 … AC-009.6 | T-027, T-028 | `ProfilePage.test.tsx` | ✅ (caracterización) |
| REQ-010 | AC-010.1, AC-010.2 | T-029 | `ProfilePage.test.tsx` | ✅ (caracterización) |

- AC sin test: — (los 37 AC de `spec.md` aparecen en al menos un marcador `SDD:` de los tests)
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (T-001 a T-030 marcadas; T-040 a T-046 son de la fase B, fuera de este modo)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: —
- Scaffold (T-001 a T-003): en `onboarding/schemas.ts` y `profile/schemas.ts` las funciones solo lanzan `not implemented`; las constantes de mensaje y los enums llevan su valor definitivo; `physicalDataShape` es un objeto de definición de tipos de zod. En `profile/types.ts` solo hay tipos. Sin lógica.
- `onboarding/validation.test.ts` eliminado (T-030, borrado por el usuario; sus casos están trasladados en T-012).

## 3. Criterios de aceptación manuales
No se evalúan en modo red. Los AC visuales o de UX se revisarán en la etapa verify.

## 4. Fallos (si los hay)
Ninguno bloqueante. Los 37 tests en rojo son rojos legítimos:

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | 24 tests de `onboarding/schemas.test.ts` (traslado de 006 y casos de 015) fallan por esqueleto (`makePhysicalDataSchema`, `fieldMessages`). Rojo legítimo. | `Error: not implemented` (schemas.ts) | ninguno (rojo legítimo) |
| 2 | 8 tests de `profile/schemas.test.ts` fallan por esqueleto (`makeProfileFormSchema`). Rojo legítimo. | `Error: not implemented` (profile/schemas.ts) | ninguno (rojo legítimo) |
| 3 | 1 test de `units.test.ts` (AC-003.5, `5.5` ft no se convierte) falla por aserción: la conversión actual pasa a `168` cm. Rojo legítimo. | `expected { heightUnit: 'cm', heightCm: '168' } to deeply equal { heightUnit: 'cm' }` | ninguno (rojo legítimo) |
| 4 | 2 tests de `OnboardingPage.test.tsx` (AC-003.5, `5.5` ft y `5` ft con `2.5` in) fallan por aserción: "Siguiente" sigue habilitado. Rojo legítimo. | `expect(element).toBeDisabled()` | ninguno (rojo legítimo) |
| 5 | 2 tests de `ProfilePage.test.tsx` (AC-003.5, decimales en ft/in) fallan porque no aparece "Entre 3 y 8 ft". Rojo legítimo. | `Unable to find an element with the text: Entre 3 y 8 ft` | ninguno (rojo legítimo) |

Los tests nuevos que pasan sin implementación son caracterización de comportamiento existente, aceptados por la excepción confirmada por el usuario.

## Comentarios del usuario

1. Si, confirmado. 2. A
