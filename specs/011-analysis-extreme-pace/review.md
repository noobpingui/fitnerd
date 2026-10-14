# Review 011 — Ritmo poco realista por una medición errónea sin bloquear el análisis con IA

- **Iteración:** 2 de 3
- **Commit / diff revisado:** `git diff main...fix/011-analysis-extreme-pace` @ `ee87ea4`, más los cambios sin commitear de `insightsView.ts`, `insightsView.test.ts` y `ProgressAnalysis.test.tsx` (correcciones de F1 a F3 de la iteración 1) y de los artefactos SDD (`state.json`, `tasks.md`, `verify-report.md`)
- **Veredicto:** APPROVED

## 1. Resumen
Esta iteración solo revisa las correcciones de la iteración 1; el resto del cambio no se ha tocado desde `ee87ea4` y sigue valiendo el análisis anterior (cumplimiento de la spec, del plan y de la constitución, sección 2 a 4 de la iteración 1). Las tres correcciones están bien hechas y no introducen regresiones. F4 queda fuera de esta feature por decisión del usuario: se resolverá con un ADR en una rama `chore/…` aparte.

## 2. Cumplimiento de la spec
Sin cambios respecto a la iteración 1: todos los AC (REQ-001 a REQ-009) están implementados como se especificó. Las correcciones no alteran comportamiento:
- AC-003.1 a AC-003.3: el aviso sigue construyéndose igual (`frontend/src/features/body-metrics/insightsView.ts:122-126`). `insights.suspiciousDate` vale `null` fuera de `unrealistic` (`insightsView.ts:71-74`). Con la entrada parcial `{ paceStatus }` vale `undefined`, y la condición `status === "unrealistic" && suspiciousDate` lo sigue llevando a `null`, así que quitar `?? null` es inocuo.
- El caso "empate" (`insightsView.test.ts:336-342`) fija ahora "+10,8 kg/sem", que coincide con la spec y con el cálculo (171 / 110,75 × 7 = 10,808).

## 3. Cumplimiento del plan
Sin desviaciones.

## 4. Checklist de la constitución
- [x] Art. 2: integridad de los tests. Los SHA-256 de los 11 archivos de `tests_snapshot` (actualizado el 2026-10-14T18:20:36Z) coinciden con los actuales. Los únicos cambios en tests posteriores a `3b50e54` son el arreglo de `rowOf` (autorizado, `test_fixed` 09:47) y las correcciones F1 y F3 (autorizadas, `test_fixed` 18:20), ambas registradas en `state.json`.
- [x] Art. 4: marcadores `SDD:` sin cambios. La ambigüedad de IDs entre specs (F4 de la iteración 1) se trata fuera de esta feature por decisión del usuario.
- [x] Art. 5: ningún test se debilita. F1 endurece la aserción (de la regex `/^\+10,[89] kg\/sem$/` a `toBe("+10,8 kg/sem")`), y F3 quita un alias que ocultaba errores de tipo de la prop `warning`.
- [x] Art. 6: capas, `apiFetch` y organización por feature sin cambios.
- [x] Art. 6.4: sin cambios de modelos ni migraciones.
- [x] Art. 7: sin secretos ni cambios en autenticación o validación.
- [x] Art. 6.11: el comentario nuevo de `insightsView.test.ts:339` está en español correcto.

Comprobado por ejecución propia: `npx tsc -b` sin errores y `vitest run src/features/body-metrics` 267/267.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 (it. 1) | — | `frontend/src/features/body-metrics/insightsView.test.ts:339-341` | **Resuelto.** Fija "+10,8 kg/sem" con el comentario correcto. Recordatorio para docs: **no** hay que aplicar a la spec la "corrección" +10,8 → +10,9 que quedó anotada en el historial de `state.json`; la spec ya es correcta. | — |
| F2 (it. 1) | — | `frontend/src/features/body-metrics/insightsView.ts:122` | **Resuelto.** Se lee `insights.suspiciousDate` sin cast. | — |
| F3 (it. 1) | — | `frontend/src/features/body-metrics/components/ProgressAnalysis.test.tsx:218` | **Resuelto.** Se usa `ProgressAnalysis` directamente; el cast queda limitado al objeto de prueba `REQUEST` (`:40`), que es un cuerpo ficticio y no un `AnalysisRequest` real, igual que en el resto del archivo. | — |
| F4 (it. 1) | — | — | **Fuera de alcance** por decisión del usuario (ADR en rama `chore/…` tras cerrar la 011). | — |

No hay hallazgos BLOQUEANTES ni MAYORES.

## 6. Decisión
**APPROVED.** F1 a F3 están resueltos, F4 queda fuera de esta feature y no hay hallazgos nuevos. Para la etapa docs, recuerda no aplicar la corrección +10,8 → +10,9 a la spec.
