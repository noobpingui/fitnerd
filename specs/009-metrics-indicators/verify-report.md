# Verify report 009 — Indicadores de progreso de Métricas especificados y con tests

- **Modo:** red (tras la etapa tests, iteración 2)
- **Fecha:** 2026-10-13T01:48:22.012Z · **Rama:** `feat/009-metrics-indicators` @ `5b61f52`
- **Resultado:** PASS (con excepción aceptada por el usuario: 87 tests de caracterización, ver §4)

## 1. Comandos ejecutados
| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run` sobre los 5 archivos con tests nuevos (`insights.test.ts`, `dateUtils.test.ts`, `units.test.ts`, `components/TrendChart.test.tsx`, `pages/BodyMetricsPage.test.tsx`) | ⚠️ | Tests 134: 87 passed (caracterización aceptada), 47 failed (todos rojo legítimo) |

Desglose por archivo:

| Archivo | Passed | Failed | Fallos |
|---|---|---|---|
| `insights.test.ts` | 28 | 31 | 30 × `Error: not implemented`; 1 × `AssertionError` (altura 0 devuelve `Infinity`) |
| `dateUtils.test.ts` | 5 | 3 | 2 × `periodStart` not implemented; 1 × `AssertionError` en `isWithinLastMonths` |
| `onboarding/units.test.ts` | 0 | 4 | `heightCmFromAnswers` not implemented |
| `components/TrendChart.test.tsx` | 1 | 0 | — (AC-005.6, caracterización) |
| `pages/BodyMetricsPage.test.tsx` | 53 | 9 | `TestingLibraryElementError` (texto ausente) en AC-003.10, 003.13, 003.14, 004.4, 004.13, 009.2, 009.5, 010.1, 010.3 |

Comprobaciones de scaffold: los 6 esqueletos (`rateIndicator`, `ratePercent`, `paceStatusFromPercent`, `trendChartData`, `periodStart`, `heightCmFromAnswers`) lanzan solo `Error("not implemented")` con parámetros prefijados con `_`, sin lógica. OK.

Grep de `.skip`, `.only`, `xit`, `xtest`, `xdescribe`, `it.todo` y `xfail` en los archivos de test de la feature: ninguno. Los cambios en tests existentes (`BodyMetricsPage.test.tsx`, `dateUtils.test.ts`) solo añaden líneas, el reloj fijo y los imports; no se quita ninguna aserción.

No se ha ejecutado `tsc -b` (no es parte del modo red). Los errores de TypeScript en los tests no aparecen como fallos en vitest, que no hace typecheck.

## 2. Trazabilidad (red)
Cada AC tiene al menos un test con marcador `SDD:`. Estado en esta etapa: los tests que fallan lo hacen por comportamiento ausente; los que pasan son caracterización (§4).

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado en red |
|---|---|---|---|---|
| REQ-001 | AC-001.1..9 | T-010, T-025 | `insights.test.ts`, `BodyMetricsPage.test.tsx` | ✅ cubiertos; los fallos no aplican a este REQ salvo por caracterización |
| REQ-002 | AC-002.1..5 | T-011, T-026 | idem | ✅ cubiertos |
| REQ-003 | AC-003.1..14 | T-012, T-013, T-027, T-028 | idem | ❌ AC-003.1..9 fallan por `rateIndicator` ausente; AC-003.10, 003.13, 003.14 fallan en página |
| REQ-004 | AC-004.1..13 | T-014, T-015, T-029, T-030, T-035 | idem | ❌ `ratePercent`/`paceStatusFromPercent` ausentes; AC-004.4 y AC-004.13 fallan en página |
| REQ-005 | AC-005.1..6 | T-016, T-017, T-036 | idem | ❌ AC-005.1..5 fallan por `trendChartData`/`periodStart`; AC-005.6 pasa (caracterización) |
| REQ-006 | AC-006.1..6 | T-018, T-031 | idem | ✅ pasan (caracterización) |
| REQ-007 | AC-007.1..5 | T-019, T-023, T-032 | idem | ❌ AC-007.3 falla por `heightCmFromAnswers`; el resto pasa (caracterización) |
| REQ-008 | AC-008.1..6 | T-021, T-033 | idem | ✅ pasan (caracterización) |
| REQ-009 | AC-009.1..5 | T-022, T-034 | idem | ❌ AC-009.2 y AC-009.5 fallan ("1 registro"); resto pasa |
| REQ-010 | AC-010.1..3, AC-004.11 | T-020, T-035 | idem | ❌ AC-010.1 y AC-010.3 fallan; AC-010.2 y AC-004.11 pasan (caracterización) |

- ACs sin test: —
- REQs sin tarea: —
- Tareas sin marcar `[x]`: — (en esta etapa las tareas de tests están `[x]`; las de implementación T-040..T-051 están pendientes, como corresponde)

## 3. Criterios de aceptación
Ningún AC requiere comprobación manual en esta etapa; la comprobación visual y de UX se hará en `full`.

## 4. Fallos y caracterización

### 4.1 Rojo legítimo (47 tests, todos por comportamiento ausente)

No hay `SyntaxError`, errores de import, de fixture ni de TypeScript en los tests.

| # | Qué falló | Salida relevante (recortada) | Responsable probable |
|---|---|---|---|
| 1 | Funciones nuevas del scaffold sin implementar: `rateIndicator`, `ratePercent`, `paceStatusFromPercent`, `trendChartData`, `periodStart`, `heightCmFromAnswers` (36 tests) | `Error: not implemented` (ADR-0012) | implementer (fase B) |
| 2 | `isWithinLastMonths` no incluye una medición de hace un mes por la tarde | `AssertionError: expected false to be true` en `dateUtils.test.ts` | implementer (T-044) |
| 3 | `composition` con altura 0 o no finita devuelve `Infinity` en lugar de `null` | `AssertionError: expected Infinity to be null` en `insights.test.ts` | implementer (T-046) |
| 4 | Página: "Sin registros recientes" no aparece en el ritmo (AC-003.10, 003.13, 003.14, 004.13) | `Unable to find an element with the text: Sin registros recientes` | implementer (T-042, T-050) |
| 5 | Página: "Fuera del rango de tu meta" no aparece con `maintain` (AC-004.4) | `Unable to find ... Fuera del rango de tu meta` | implementer (T-043, T-050) |
| 6 | Página: "1 registro" en singular no existe (AC-009.2, AC-009.5) | `Unable to find ... 1 registro` | implementer (T-051) |
| 7 | Página sin perfil: IMC y FFMI no muestran "—" (AC-010.1, AC-010.3) | `Unable to find ... —` | implementer (T-046, T-049) |

Los 47 fallos coinciden con los esperados en plan §5.6 (los unitarios de las funciones nuevas, y en página AC-003.10, 003.13, 003.14, 004.4, 004.13, 009.2, 009.5, 010.1 y 010.3). Además falla AC-005.1 vía `trendChartData`, como prevé el plan.

### 4.2 Caracterización aceptada por el usuario (87 tests que pasan)

Estos tests pasan sin implementación porque describen comportamiento que el código ya tiene. Plan §5.6 lo declara y el usuario lo aceptó como caracterización (entrada `user_decision` en `state.json.history`, respuesta "A"). Incluye, entre otros, los AC-001.1, AC-002.1, AC-006.1, AC-008.1 y AC-009.1 de la página, la leyenda de `TrendChart` (AC-005.6), los unitarios de `latestWithDelta`, `composition` (salvo altura 0), `streak` e `isWithinLastMonths` (salvo el caso de la tarde), y los tests de página de las secciones de KPI, composición, IMC y racha. Los 5 tests de `dateUtils.test.ts` y los 28 de `insights.test.ts` que pasan forman parte de esta lista. Los tests de página de regresión de las specs 006 y 008 (perfil del servidor, historial) también pasan y no son nuevos.

La regla de `red` dice PASS solo si todos los tests nuevos fallan. Con la aceptación del usuario, la comprobación se cumple para los 47 tests no aceptados, y el resultado es PASS. Sin esa aceptación el resultado sería FAIL.

## 5. Resultado para el orquestador
- Red check: **PASS** con la excepción aceptada de 87 tests de caracterización.
- Siguiente etapa: implement. Los 47 tests en rojo legítimo son el objetivo de T-040..T-051.
