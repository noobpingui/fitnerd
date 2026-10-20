# Review 022 — Diario de comidas con totales del día frente al objetivo de Macros

- **Iteración:** 3 de 3 (tercera pasada; van 2 de 3 correcciones)
- **Diff revisado:** `git diff main...feat/022-meal-diary` @ `e1f4de4`, con foco en `git show e1f4de4` (corrección de F5). Hay cambios sin commitear solo en `specs/022-meal-diary/{backlog.md,state.json,verify-report.md,review.md}`.
- **Veredicto:** APPROVED

## 1. Resumen
Tercera pasada, después del commit `e1f4de4`, que corrige F5. En código de producción solo cambia
`frontend/src/features/diary/schemas.ts`, en dos sitios. F5 queda resuelto, F1 no regresa y no hay regresiones:
pasan los 148 tests de `diary` en el frontend, y oxlint y `tsc -b` salen limpios (los ejecuté de nuevo). Verify da
backend 1487 y frontend 1004 en verde. No hay hallazgos nuevos. Todo lo demás de las revisiones anteriores sigue vigente.

## 2. Cumplimiento de la spec
La tabla de la iteración 1 y las filas actualizadas en la iteración 2 siguen siendo válidas. El único código que cambia
es este:

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-012.4 (mensajes de rango en el formulario personalizado) | Sí | `frontend/src/features/diary/schemas.ts:34-41`: `parseSignedDecimalText` normaliza «-0» y «-0,0» a `0` (`:38`) y los negativos siguen dando el mensaje de rango (`:86`, `:95-97`), así que F1 se mantiene |
| AC-012.x (envío del alimento personalizado) | Sí | `schemas.ts:113-116`: `customItemPayload` usa el mismo parser que la validación, así que todo lo que el formulario da por válido llega al servidor como número. Con valores no negativos el resultado es idéntico a `parseDecimalText`, y los negativos nunca llegan al payload porque la validación los rechaza antes. Así, «-0» se envía como `0` y la API lo acepta (rango de 0 a 900 y de 0 a 100, `backend/services/meal_rules.py:80`, `:101-106`) |

Casos límite que revisé sobre el código:
- «- 5»: `slice(1)` da « 5» y `parseDecimalText` lo recorta, así que vale -5 y sale el mensaje de rango.
- «--5» y «+5»: `null`, así que sale el mensaje «Indica las calorías…», como antes de F1.
- Gramos: no cambian (`parseDecimalText`, `:51`, `:111`). «-0» se sigue rechazando con el mensaje de rango de gramos.

## 3. Cumplimiento del plan
- La corrección de F5 es exactamente la primera solución que proponía la revisión anterior: un solo parser para la validación y el payload, y `-0` normalizado a `0`.
- No hay desviaciones nuevas del plan, ni dependencias, variables ni cambios de esquema nuevos.
- **F4** (ADR-0030 a «Aceptada»): lo hace la etapa `docs`, por decisión del usuario. No es un hallazgo de esta pasada.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` da idéntico (17 archivos, sin `changed`, `missing` ni `added`). `e1f4de4` no toca ningún test: solo `schemas.ts`, `backlog.md` y `state.json`.
- [x] B4: los marcadores no han cambiado y verify da 96/96 AC con test.
- [x] B5: no hay tests borrados, saltados ni debilitados. El caso «-0» no tiene test propio porque los tests están congelados desde el snapshot. Queda en el backlog, en F6, por decisión de flujo.
- [x] B5.7: verify da el ratchet sin violaciones nuevas, y oxlint y `tsc -b` pasan. Los ejecuté de nuevo.
- [x] B6.5: no hay secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: no hay cambios de tests.
- [x] P2 (frontend): un único esquema zod con react-hook-form y sin llamadas HTTP nuevas. Se reutiliza la utilidad existente sin duplicarla.
- [x] P2 General: los comentarios no cambian y están en español correcto.
- [x] P3.1 a P3.5: no hay cambios en la autorización, la validación del servidor ni los secretos. El servidor sigue siendo la autoridad.
- [ ] P4: el paso manual de la migración `b3d5f7a9c1e4` en `docs/deploy-runbook.md` y el ADR-0030 a «Aceptada» siguen pendientes de la etapa `docs`. No son hallazgos de esta revisión.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | — | `frontend/src/features/diary/schemas.ts:34-41`, `:84-99` | **Resuelto** en `972e456`. Sin regresión en `e1f4de4`: los negativos siguen dando el mensaje de rango. | implementer |
| F2 | — | `frontend/src/features/diary/components/AddFoodDialog.tsx:125-130`, `:153-156` | **Resuelto** en `972e456`. | implementer |
| F3 | — | `backend/models/meal.py:45-48`, `backend/services/meal_service.py:154-155`, `:171`, `:187-188` | **Resuelto** en `972e456`. | implementer |
| F5 | — | `frontend/src/features/diary/schemas.ts:38`, `:113-116` | **Resuelto** en `e1f4de4`. «-0» se valida y se envía como `0`, y la validación y el payload usan el mismo parser. | implementer |
| F6 | NIT | `backend/models/meal.py:45-48`; `frontend/src/features/diary/schemas.ts:38` | Sigue en el backlog por decisión de flujo: faltan un test de que `updated_at` avanza y uno de «-0» en el formulario personalizado. No es un hallazgo nuevo. | test-author |

## 6. Decisión
**APPROVED.** F1, F2, F3 y F5 quedan resueltos sin regresiones y no hay hallazgos BLOQUEANTES ni MAYORES. Solo queda
F6 (NIT), en el backlog. Pendiente para la etapa `docs`:
- pasar el ADR-0030 a «Aceptada», por decisión del usuario;
- documentar el paso manual de la migración `b3d5f7a9c1e4`: volcado verificado y `flask db upgrade` con `FLASK_ENV` bien puesto, antes del merge (Art. P4).

Además, el usuario debe revisar en el navegador los AC manuales AC-014.2, AC-015.2 y AC-015.3.

## Comentarios del usuario

1. Vamos a arreglar de una vez F1, F2, F3 y F4. 2. ADR-00-30 aceptada

2. Resolvamos F5 de una vez
