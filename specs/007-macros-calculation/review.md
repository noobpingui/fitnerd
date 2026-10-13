# Review 007 — Cálculo de calorías y macros con límites de proteína y carbohidratos

- **Iteración:** 1 de 3
- **Commit / diff revisado:** `git diff chore/frontend-redesign...feat/007-macros-calculation` @ `624532e` (base según `state.json.base_branch`)
- **Veredicto:** APPROVED

## 1. Resumen
El cambio fija el cálculo de `calculateMacros()` y añade el suelo calórico (1200/1500 kcal), el tope de proteína por IMC 27 y el mínimo de 100 g de carbohidratos con cesión de grasas (hasta el 20 %) y después de proteínas. La implementación es pequeña, pura y sigue el algoritmo del plan paso a paso; la nota informativa reproduce el texto literal de la spec. Los tests cubren los 29 AC con cifras concretas y un barrido de invariantes de 400 combinaciones. Solo hay observaciones menores de estilo.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `calculations.ts:73-78` (conversión sin redondear); `calculations.test.ts:74` |
| AC-001.2 | Sí | `calculations.ts:79` (`ageFromIsoDate`); `calculations.test.ts:94` |
| AC-001.3 | Sí | `calculations.ts:79`; `calculations.test.ts:107` |
| AC-002.1 | Sí | `calculations.ts:82-83`; `calculations.test.ts:122` |
| AC-002.2 | Sí | `calculations.ts:82-83`; `calculations.test.ts:133` |
| AC-003.1 | Sí | `calculations.ts:84`; `calculations.test.ts:144` |
| AC-004.1 | Sí | `calculations.ts:85-88` (suelo sobre el valor sin redondear; mantenimiento intacto en `:123`); `calculations.test.ts:160` |
| AC-004.2 | Sí | `calculations.ts:85-88`; `calculations.test.ts:171` |
| AC-004.3 | Sí | `calculations.ts:85-88` (suelo aunque supere el mantenimiento); `calculations.test.ts:182` |
| AC-004.4 | Sí | `calculations.ts:85-88`; `calculations.test.ts:204` |
| AC-004.5 | Sí | `calculations.ts:85-88`; `calculations.test.ts:193` |
| AC-005.1 | Sí | `calculations.ts:92-94`; `calculations.test.ts:213` |
| AC-006.1 | Sí | `calculations.ts:91` (`min(kg, 27 × m²)`); `calculations.test.ts:225` |
| AC-006.2 | Sí | `calculations.ts:74,91`; `calculations.test.ts:235` |
| AC-006.3 | Sí | `calculations.ts:91`; `calculations.test.ts:248` |
| AC-007.1 | Sí | `calculations.ts:100-106` (las grasas ceden; la proteína resultante es igual a la estándar); `calculations.test.ts:258` |
| AC-007.2 | Sí | `calculations.ts:103` (grasas al 20 %) y `:105` (proteína como resto); `calculations.test.ts:268` |
| AC-007.3 | Sí | `calculations.ts:100` (comparación sin redondear); `calculations.test.ts:278` |
| AC-007.4 | Sí | `calculations.ts:85-106`; `calculations.test.ts:287` |
| AC-008.1 | Sí | `calculations.ts:105,119,125` (último macro como resto; campos `exactKcal`/`exactTargetKcal`); `calculations.test.ts:299` |
| AC-008.2 | Sí | `calculations.ts:118` (`share = exactKcal / target`); `calculations.test.ts:332` |
| AC-009.1 | Sí | `MacrosPage.tsx` sin cambios de lógica; `MacrosPage.test.tsx` (test "con 120 kg muestra 3379 kcal…") |
| AC-009.2 | Sí | `MacrosPage.tsx:130` (`Math.round(share × 100) % del total`); `MacrosPage.test.tsx` (test "con el mínimo de carbohidratos…") |
| AC-009.3 | Sí | conversión a kJ preexistente sobre kcal redondeadas; `MacrosPage.test.tsx` (test "al cambiar a kJ…") |
| AC-009.4 | Sí | `HomePage.tsx:38-41` consume `calculateMacros`; `HomePage.test.tsx:62` |
| AC-009.5 | Sí | `MacrosPage.test.tsx` (test "con el suelo calórico…") y `HomePage.test.tsx:80` |
| AC-010.1 | Sí | `MacrosPage.tsx:158-163` (texto literal de la sección 6) |
| AC-010.2 | Sí | `MacrosPage.tsx` mantiene `<strong>Mifflin-St Jeor</strong>` |
| AC-010.3 | Sí | `MacrosPage.tsx:158` |

He comprobado a mano que la rama `if` de `calculations.ts:100-106` deja la proteína igual a `proteinStd` cuando las grasas bastan (`target − 400 − (fatStd − 400 + carbsStd) = proteinStd`), como afirma el plan, y que `fatStd = 0,25·target ≥ 0,20·target`, así que las grasas nunca suben al aplicar el mínimo.

## 3. Cumplimiento del plan
Sin desviaciones. Constantes (`MIN_TARGET_KCAL`, `PROTEIN_CAP_BMI`, `MIN_FAT_SHARE`, `MIN_CARBS_G`), algoritmo (pasos 1-7), campos nuevos de tipo, eliminación del `Math.max(…, 0)` provisional y de los comentarios "TEMPORAL"/"Pendiente para la fase SDD", y texto de la nota coinciden con el plan. `HomePage.tsx` y `Pie3D.tsx` no se tocaron, como estaba previsto; `Pie3D` sigue funcionando porque los `share` suman 1.

## 4. Checklist de la constitución
- [x] Art. 2: cada agente se mantuvo en su rol. Los SHA-256 de los tres archivos de `tests_snapshot` coinciden con los actuales, y `git diff 7e0936a HEAD -- frontend/src` solo toca `calculations.ts` y `MacrosPage.tsx`.
- [x] Art. 4: los marcadores `SDD:` coinciden con los AC que prueban (29/29); las cifras de cada test son las del AC.
- [x] Art. 5: no hay tests borrados, saltados ni debilitados (los de la spec 006 siguen intactos); la red se simula en `features/profile/api` con el patrón vigente; fechas fijadas por parámetro o con `vi.setSystemTime`.
- [x] Art. 6: lógica en una función pura de `features/macros`; sin llamadas HTTP nuevas; organización por feature respetada. Tests de la feature en verde (48/48 reejecutados en esta revisión); lint, `tsc -b` y build en verde según `verify-report.md`.
- [x] Art. 6.4: no aplica (sin cambios de modelo ni backend).
- [x] Art. 7: sin secretos, endpoints ni input externo nuevos.
- [x] Art. 6.11: la nota está en español correcto, sin voseo, y es el literal de la spec.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | NIT | `frontend/src/features/macros/calculations.ts:34` | `MIN_TARGET_KCAL` no lleva anotación de tipo, al contrario que las demás tablas del archivo (`ACTIVITY_FACTOR`, `GOAL_FACTOR`, `KCAL_PER_GRAM`, que usan `Record<…, number>`). Sugerencia: `Record<"male" \| "female", number>` por coherencia. | implementer |
| F2 | NIT | `frontend/src/features/macros/calculations.test.ts:98,111,240` | Los casts `as Record<string, string>` al reextender `profileFor(...)` en `makeAnswers` no son necesarios para el comportamiento y esconden el tipo real (`OnboardingAnswers` con campos `null`). Se podría construir el perfil directamente con `makeAnswers({...})`. No afecta a la validez de los tests. | test-author |
| F3 | NIT | `specs/007-macros-calculation/spec.md:85-86` | AC-004.5 aparece antes que AC-004.4 en la spec. Solo afecta a la lectura; los IDs y la trazabilidad son correctos. | spec-writer |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. Los tres NIT son opcionales y pueden ignorarse o atenderse en una tarea futura.

Nota para el orquestador: `state.json` y `verify-report.md` tienen cambios sin commitear (los de la etapa verify), que deben entrar en el commit de la siguiente etapa.
