# Review 009 — Indicadores de progreso de Métricas especificados y con tests

- **Iteración:** 2 de 3
- **Commit / diff revisado:** `git diff chore/frontend-redesign...feat/009-metrics-indicators` @ `6c1718d`, más los cambios sin commitear del árbol de trabajo (corrección autorizada de tests tras la iteración 1: `insights.test.ts`, `dateUtils.test.ts`, `units.test.ts` y `BodyMetricsPage.test.tsx`)
- **Veredicto:** APPROVED

## 1. Resumen
Esta iteración comprueba las correcciones que el usuario autorizó tras la iteración 1 (F1, F3 y F5) y que nada más haya cambiado. Las tres están bien resueltas: los 66 nombres de `it` están en español correcto, se retiró el cast obsoleto y el `setTimeout` real ya no está. El código de producción no ha cambiado desde `63d590d`: `git diff 63d590d HEAD` solo toca `specs/`, y el árbol de trabajo solo modifica tests y artefactos de la spec. La evaluación de la spec y del plan de la iteración 1 sigue siendo válida. Por decisión del usuario, F2, F4 y F6 van al backlog.

## 2. Cumplimiento de la spec
Sin cambios respecto a la iteración 1: los 72 AC de REQ-001 a REQ-010 están implementados como se especificó (evidencia por archivo y línea en la iteración 1, §2). Los marcadores `SDD:` no han cambiado: `insights.test.ts` tiene 59 tanto en `HEAD` como en el árbol de trabajo, y el diff no añade ni quita ninguna línea `SDD:`.

## 3. Cumplimiento del plan
Sin cambios respecto a la iteración 1. Las correcciones solo afectan a tests y no introducen desviaciones nuevas.

## 4. Checklist de la constitución
- [x] Art. 2: los SHA-256 de los 5 archivos de `tests_snapshot` (actualizado el 2026-10-13T04:25:26Z por la corrección autorizada) coinciden con los del árbol de trabajo. El cambio de tests está registrado como `authorized_test_change` en `state.json.history`.
- [x] Integridad de la corrección: el diff de tests, quitando las líneas `it(`/`describe(`, se reduce a:
  - el comentario y el cast de F3 (`insights.test.ts`: `composition(metrics, heightCm)`);
  - el helper `renderLoaded` de F5 (`BodyMetricsPage.test.tsx:376-380`).
  
  Ninguna aserción cambia. No hay `.skip`, `.only` ni `.todo` nuevos. `insights.test.ts` tiene 61 líneas añadidas y 62 quitadas: 59 nombres, más el comentario de 2 líneas que pasa a 1, más la línea del cast.
- [x] Art. 4: los marcadores `SDD:` siguen intactos.
- [x] Art. 5.6: todos los `it("…")` de los 5 archivos de test de la feature están en español. Una búsqueda de nombres con palabras inglesas no devuelve nada. Los `describe` con nombre en inglés son nombres de funciones (`rateIndicator`, `periodStart`…), lo cual es aceptable.
- [x] Art. 6: `npx vitest run src/features/body-metrics src/features/onboarding` da 188/188, `npm run lint` da 0 errores (2 warnings previos fuera del diff) y `npx tsc -b` sale con 0, todo ejecutado por mí. El verify-report de la iteración 2 da 339/339 y el build en verde.
- [x] Art. 6.4 y Art. 7: no aplican (no cambian modelos, endpoints, secretos ni input externo).
- [x] Art. 6.11: los nombres traducidos están en español correcto, con tildes y sin voseo (por ejemplo, "usa el último día del mes cuando el día no existe" o "trata las pulgadas vacías como cero").

## 5. Hallazgos
Estado de los hallazgos de la iteración 1:

| # | Severidad | Estado |
|---|---|---|
| F1 | MAYOR | **Resuelto.** 59 `it` en `insights.test.ts`, 4 en `units.test.ts` y 3 en `dateUtils.test.ts` traducidos, sin cambios en las aserciones. |
| F2 | MENOR | Al backlog por decisión del usuario (duplicación de la conversión ft/in → cm en `macros/calculations.ts:78`). |
| F3 | NIT | **Resuelto.** Se retiraron el cast y el comentario obsoleto. |
| F4 | NIT | Al backlog por decisión del usuario (`isWithinLastMonths` sin uso en producción). |
| F5 | NIT | **Resuelto.** Ya no hay temporizador real. |
| F6 | NIT | Al backlog por decisión del usuario (comentario desplazado en `TrendChart.tsx`). |

Hallazgos nuevos:

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F7 | NIT | `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx:376-380` | `renderLoaded` espera con `waitFor` a que se llame a `getProfileMock` y después vacía 5 microtareas dentro de `act`. Que se haya llamado al mock no garantiza que el perfil ya esté en la caché de la query. El 5 es un número mágico que funciona porque el mock resuelve en el acto. Sería más robusto esperar una condición observable del perfil cargado, por ejemplo una unidad o un texto que dependa del perfil. No bloquea: la suite pasa de forma estable y es mejor que el `setTimeout` anterior. | test-author |

## 6. Decisión
**APPROVED.** No quedan hallazgos BLOQUEANTES ni MAYORES. F1 está resuelto sin debilitar ningún test. F3 y F5 también están resueltos. F2, F4 y F6 van al backlog por decisión del usuario, y F7 es un NIT opcional. Falta que la sesión principal haga commit de los cambios de tests del árbol de trabajo junto con los artefactos de la spec.
