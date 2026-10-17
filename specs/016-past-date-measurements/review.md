# Review 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Iteración:** 3 de 3 (revisión de seguimiento de F8)
- **Diff revisado:** `git diff main...feat/016-past-date-measurements` @ `c4e57df`, con foco en `git diff 0da0cbd c4e57df`: test de F8 en `ac42e38` y corrección en `c4e57df`. Sin commitear solo hay cambios en `specs/016-past-date-measurements/backlog.md`, `state.json` y `verify-report.md`.
- **Veredicto:** APPROVED

## 1. Resumen

Revisión de seguimiento de F8 (MAYOR), tras la opción (a) que eligió el usuario: fijar la unidad al abrir el diálogo. F8 está resuelto. La unidad se guarda en estado al pulsar "Registrar medición" y el diálogo recibe esa unidad fija, así que la etiqueta, el esquema y el payload usan la unidad que el usuario vio al escribir aunque el perfil llegue o cambie con el diálogo abierto.

Además:
- F1 a F7 siguen resueltos.
- El cambio en `useCreateBodyMetric` no altera el comportamiento de sus dos usos.
- `snapshot --check` da idéntico, también al comparar los hashes sin CR.
- He vuelto a ejecutar vitest sobre `body-metrics`, `profile` y `app`: 447 tests en verde. `tsc -b` también pasa.

No hay hallazgos nuevos.

## 2. Cumplimiento de la spec

La tabla de la iteración 1, con los cambios de las iteraciones 2 y 3, sigue siendo válida. Solo cambian estas filas:

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.4 / AC-001.7 | Sí. La unidad se fija al abrir el diálogo y no cambia mientras está abierto | `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx:45` (`registeringUnit`), `:92` (`setRegisteringUnit(weightUnit)` en el `onClick`) y `:98-103` (el diálogo recibe `registeringUnit`). Test "si el perfil llega en lb con el diálogo abierto, la unidad no cambia y se guarda el peso en kg tal como se escribió" en `BodyMetricsPage.register.test.tsx:289-347` |
| Supuesto de la spec (spec.md:48: "los pesos se guardan en kg y se muestran en la unidad del perfil") | Sí. La unidad de la etiqueta (`RegisterMetricDialog.tsx:121`), la del esquema (`:44`) y la del payload (`:75`) salen ahora de la misma prop fija | `BodyMetricsPage.tsx:101` |

## 3. Cumplimiento del plan

- La corrección es mínima: un `useState<WeightUnit | null>` sustituye al booleano `registering` y sirve a la vez de indicador de "diálogo abierto" y de unidad fija. No hay dependencias nuevas.
- **`hooks.ts:35-36`:** `mutationFn` pasa de `createBodyMetric` a `(payload) => createBodyMetric(payload)`. El motivo es que TanStack Query v5 llama a `mutationFn(variables, context)`, y el test nuevo comprueba los argumentos con `toHaveBeenCalledWith`.
  - `createBodyMetric(payload)` (`api.ts:18`) solo usa el primer argumento, así que en producción el comportamiento no cambia.
  - Los dos consumidores (`RegisterMetricDialog.tsx:41` y `PhysicalDataForm.tsx:67`) llaman a la mutación con un único payload. Sus tests (`RegisterMetricDialog.test.tsx` y `ProfilePage.test.tsx`) siguen en verde.
  - Es una desviación menor y justificada.
- Sin migración, sin dependencias nuevas y sin ADR.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B1.3: la corrección pasó por `rework tests` con la elección del usuario, la opción (a), y por las etapas tests, implement y verify.
- [x] B2: `snapshot --check` da idéntico al snapshot del 2026-10-17T02:51:18, que se rehízo tras el `rework tests` autorizado.
  - He recalculado el sha256 de los 9 archivos de test sin CR y coinciden todos con `tests_snapshot`.
  - `git diff ac42e38 HEAD` (commit `tests`) solo toca `hooks.ts`, `BodyMetricsPage.tsx` y `state.json`: implement no cambió ningún test.
- [x] B4: el test nuevo lleva `// SDD: 016 REQ-001 AC-001.4 AC-001.7`.
- [x] B5: no se borró ni debilitó ningún test. Según el red check, el test de F8 estaba en rojo por aserción (etiqueta "Peso (lb)" con el diálogo abierto). No hay `skip` ni `only`.
- [x] B5.7: según verify (`c4e57df`), el ratchet de ruff no tiene violaciones nuevas, el lint da 0 errores y `build` pasa. He comprobado `tsc -b` en local.
- [x] Integridad de datos: el peso se guarda en la unidad que el usuario vio al escribirlo (F8 resuelto).
- [x] B6.5: sin secretos y sin variables nuevas.

### Parte II (proyecto)
- [x] P1 frontend: el test está junto al archivo, con `it("…")` en español y la red simulada con mocks. Usa su propio `QueryClient` y lo limpia al final. El reintento queda controlado por una promesa que el test libera, así que no depende de tiempos reales salvo un margen de 50 ms dentro de `act`.
- [x] P2 frontend: organización por feature y TanStack Query. El comentario de `BodyMetricsPage.tsx:43-44` está en español correcto.
- [x] P3 y P4: sin cambios en el backend ni en la autorización; sin migración.

## 5. Hallazgos

### Seguimiento de iteraciones anteriores

| # | Severidad | Estado | Evidencia |
|---|---|---|---|
| F1 | MENOR | Resuelto (sin cambios) | `RegisterMetricDialog.tsx:57-63`, `:131`; tests de accesibilidad en verde |
| F2 | MENOR | Resuelto (sin cambios) | `BodyMetricsPage.tsx:53`, `:91`: el botón sigue deshabilitado mientras el perfil carga por primera vez |
| F3 | NIT | Resuelto (sin cambios) | `BodyMetricsPage.register.test.tsx`, test de AC-007.7 con "1M" |
| F4 | NIT | Resuelto (sin cambios) | `PhysicalDataForm.tsx:1-25` |
| F5 | NIT | Resuelto (sin cambios) | `PhysicalDataForm.tsx:117-121`, `:161-167` |
| F6 | NIT | Resuelto (sin cambios) | `backlog.md:21` |
| F7 | NIT | Resuelto (sin cambios) | `BodyMetricsPage.tsx:50-53`: el botón se habilita tras el primer fallo del perfil |
| F8 | MAYOR | Resuelto | `BodyMetricsPage.tsx:45`, `:92`, `:98-103`; test en `BodyMetricsPage.register.test.tsx:289-347` |

### Nuevos

Ninguno.

Observación sin severidad: el punto de verify sobre los finales de línea (`backlog.md`, "verify (iteración 3)") no afecta a esta revisión. `snapshot --check` da `identical: true` con los archivos del working tree, así que la CLI ya normaliza CRLF o los compara de forma equivalente.

## 6. Decisión

**APPROVED.** F8 está resuelto tal como eligió el usuario y F1 a F7 siguen resueltos. El cambio en `useCreateBodyMetric` no altera el comportamiento de sus usos y los tests coinciden con el snapshot autorizado. No quedan hallazgos BLOQUEANTES ni MAYORES.

## Comentarios del usuario

## Comentarios del usuario

> F1 a F6, vamos a arreglarlas todas de una vez

> Corrige ahora el F7

> a
