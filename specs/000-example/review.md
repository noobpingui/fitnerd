# Review 000 — Utilidad clamp(value, min, max) en el frontend (prueba en seco del harness)

- **Iteración:** 1 de 3
- **Commit / diff revisado:** `git diff chore/sdd-harness...feat/000-example` @ `17592a3` (base según `state.json.base_branch`; excepción documentada en spec §1)
- **Veredicto:** APPROVED

## 1. Resumen
El cambio añade `frontend/src/lib/clamp.ts`, una función pura que acota un número a `[min, max]` y lanza `RangeError` si un límite es `NaN` o si `min > max`, y su test unitario `clamp.test.ts` con un `it` por AC (20 en total). La implementación sigue al pie de la letra el orden de evaluación del plan §3.3. Los tests no se tocaron después del commit de la etapa `tests` y discriminan de verdad los casos delicados (límites `NaN`, mensaje exacto). No hay hallazgos bloqueantes ni mayores.

Comprobaciones propias: `npx vitest run src/lib/clamp.test.ts` da 20/20 en verde y `npx oxlint` sobre los dos archivos no reporta nada.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `clamp.ts:28`; `clamp.test.ts:8-11` |
| AC-001.2 | Sí (límite inclusivo por `Math.max`/`Math.min`) | `clamp.ts:28`; `clamp.test.ts:13-16` |
| AC-001.3 | Sí | `clamp.ts:28`; `clamp.test.ts:18-21` |
| AC-001.4 | Sí | `clamp.ts:28`; `clamp.test.ts:23-26` |
| AC-002.1 | Sí | `clamp.ts:28`; `clamp.test.ts:30-33` |
| AC-002.2 | Sí | `clamp.ts:28`; `clamp.test.ts:35-38` |
| AC-003.1 | Sí | `clamp.ts:28`; `clamp.test.ts:42-45` |
| AC-003.2 | Sí | `clamp.ts:28`; `clamp.test.ts:47-50` |
| AC-004.1 | Sí (comparación estricta `>` en `clamp.ts:20` no lanza con `min === max`) | `clamp.ts:20,28`; `clamp.test.ts:54-57` |
| AC-004.2 | Sí | `clamp.ts:20,28`; `clamp.test.ts:59-62` |
| AC-005.1 | Sí | `clamp.ts:20-22`; `clamp.test.ts:66-69` |
| AC-005.2 | Sí (template literal = `String(n)`, mensaje idéntico a spec §6) | `clamp.ts:21`; `clamp.test.ts:71-84` (compara con `toBe`, no subcadena) |
| AC-005.3 | Sí (validación de rango antes de mirar `value`) | `clamp.ts:20-26`; `clamp.test.ts:86-89` |
| AC-006.1 | Sí | `clamp.ts:24-26`; `clamp.test.ts:93-96` |
| AC-006.2 | Sí (chequeo de `NaN` en límites antes que `min > max`) | `clamp.ts:16-18`; `clamp.test.ts:98-101` |
| AC-006.3 | Sí | `clamp.ts:16-18`; `clamp.test.ts:103-106` |
| AC-006.4 | Sí (mensaje literal idéntico a spec §6) | `clamp.ts:17`; `clamp.test.ts:108-120` |
| AC-006.5 | Sí (chequeo explícito de `value` NaN antes del acotado) | `clamp.ts:24-26`; `clamp.test.ts:122-125` |
| AC-007.1 | Sí | `clamp.ts:28`; `clamp.test.ts:129-132` |
| AC-007.2 | Sí | `clamp.ts:28`; `clamp.test.ts:134-137` |

Firma y contrato (spec §6): exportación con nombre `clamp(value: number, min: number, max: number): number` en `frontend/src/lib/`, sin efectos. Cumple.

## 3. Cumplimiento del plan
- Archivo propio `src/lib/clamp.ts` (decisión Q4) y test al lado: cumplido.
- Orden de evaluación §3.3 (NaN en límites → `min > max` → `value` NaN → `Math.min(Math.max(...))`): cumplido exactamente en `clamp.ts:16-28`.
- `Number.isNaN` en lugar del `isNaN` global: cumplido.
- JSDoc en español con límites inclusivos, errores y trato de `NaN`: cumplido (`clamp.ts:1-14`).
- Esqueleto de andamiaje (T-000) que lanzaba `Error` genérico sin devolver `value`: cumplido en `255de3c`, sustituido en `17592a3`.
- Estilo sin punto y coma: coherente con `utils.ts` y `dateUtils.ts` (el esqueleto sí lo tenía; la implementación lo alinea con el resto).
- Desviaciones: ninguna.

## 4. Checklist de la constitución
- [x] Art. 2: cada agente se mantuvo en su rol. `git diff 255de3c 17592a3 -- backend/tests frontend/src` solo toca `frontend/src/lib/clamp.ts`; `clamp.test.ts` no cambió durante implement.
- [x] Art. 4: los 20 marcadores `// SDD: REQ-00X AC-00X.Y` están en la línea anterior a su `it` y cada uno corresponde al AC que prueba (valores y aserciones coinciden con la spec).
- [x] Art. 5: no hay tests borrados, saltados ni debilitados; imports desde `vitest` (`globals: false`); sin red ni mocks; nombres de `it` en español. Los tests de AC-006.2/006.3 fallarían si faltara el chequeo de `NaN` en límites (sin él, `clamp(5, NaN, 10)` devolvería `NaN` sin lanzar), así que prueban el comportamiento, no solo lo ejercitan.
- [x] Art. 6: utilidad transversal en `src/lib/` (no pertenece a ninguna feature); sin HTTP, así que `apiFetch` no aplica; no se duplica ninguna utilidad existente (no hay otro `clamp` en `src/`).
- [x] Art. 6.4: no aplica (sin cambios de modelo ni backend).
- [x] Art. 7: sin secretos ni variables nuevas; sin endpoints; sin input externo directo (la validación zod corresponde al futuro consumidor, plan §3.4).
- [x] Art. 6.11: no hay textos visibles; los mensajes de error están en español correcto, con tildes ("números válidos") y sin voseo.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | NIT | `specs/000-example/verify-report.md:4` (y `state.json:64`) | La fecha del verify full es `2026-09-25T22:54:00Z`, posterior a la aprobación de la etapa verify (`2026-09-25T05:02:38Z`) y al inicio del review. Probablemente debía ser `04:54Z` o similar (el historial marca el fin del verify a `04:56:34Z`). No afecta al código; conviene corregir la marca de tiempo para que la trazabilidad temporal sea coherente. | verifier (lo corrige el orquestador; fuera de los responsables habituales) |
| F2 | NIT | `frontend/src/lib/clamp.test.ts:122-125` | AC-006.5 pasaría también sin el chequeo explícito de `value` NaN (`clamp.ts:24-26`), porque `Math.max(NaN, 3)` ya propaga `NaN`. El test cubre el AC tal como está escrito, así que no hace falta cambiarlo; solo se señala que el paso 3 del plan es documental y no lo discrimina ningún test. | test-author (opcional, sin acción requerida) |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. Los dos NIT son opcionales y no requieren devolver ninguna etapa.
