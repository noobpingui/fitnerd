# Review 020 — Seguimiento de métricas corporales y configuración de producción

- **Iteración:** 2 de 3
- **Diff revisado:** `git diff main...feat/020-metrics-followups-prod-config` @ `c8232eb`. Sin commitear solo están `state.json` y `verify-report.md` de la feature. Esta iteración se centra en `92c5ffb` (tests de F1 y F2) y `c8232eb` (corrección en `PhysicalDataForm.tsx`).
- **Veredicto:** APPROVED

## 1. Resumen

En el gate de la iteración 1, el usuario pidió corregir F1, F2 y F3 y mandó F4 a F8 al backlog. Las tres correcciones están aplicadas y son correctas:

- **F1:** con el aviso de relectura visible, un guardado sin medición ya no quita el aviso ni «Reintentar». Además, actualiza los valores pendientes para que el reintento no revierta lo guardado.
- **F2:** «Reintentar» ya no descarta el borrador del usuario si hay ediciones sin guardar.
- **F3:** `backend/tests/conftest.py` queda solo con LF en la copia de trabajo (0 CR) y su contenido no cambia.

Sin regresiones: los 472 tests de `src/features/profile` y `src/features/body-metrics` pasan en local, y `verify-report.md` da PASS completo (backend 1075 y frontend 794, con lint, `tsc` y build correctos). El snapshot de tests es idéntico. Los dos tests nuevos se añadieron en una iteración de tests autorizada, con red check legítimo. Solo quedan hallazgos MENORES y NIT nuevos, todos derivados de la propia corrección.

## 2. Cumplimiento de la spec

Se mantiene la tabla de la iteración 1: todos los AC están implementados como dice la spec. Cambios de esta iteración:

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-002.1, AC-002.2, AC-002.8 | Sí, sin cambios | `PhysicalDataForm.tsx:163-174` (sin cambios en `c8232eb`) |
| AC-002.3, AC-002.4 | Sí | `PhysicalDataForm.tsx:226-232`. Sin ediciones pendientes, `dirty` es falso y `finishSave` hace `form.reset(next)` como antes, así que el peso de la medición posterior (AC-002.3) se sigue mostrando. Lo confirman los tests de `PhysicalDataForm.refresh.test.tsx` en verde |
| AC-002.5, AC-002.6 | Sí | `PhysicalDataForm.tsx:228` (sin relectura correcta no se toca el estado) y `:226-232` (sin `saveProfile` ni `createMetric`) |
| F1 (plan §3.4, fuera de AC) | Corregido | `PhysicalDataForm.tsx:176-183`: solo un guardado con medición y relectura correcta limpia `refreshFailed` y `pendingFinish`. Sin medición, se conserva el aviso y se actualiza `pendingFinish.values`. Test `PhysicalDataForm.refresh-edge.test.tsx:128` |
| F2 (fuera de AC) | Corregido | `PhysicalDataForm.tsx:194,215,230`: `keepDraft = dirty` evita `form.reset` si hay ediciones sin guardar. Test `PhysicalDataForm.refresh-edge.test.tsx:148` |

## 3. Cumplimiento del plan

- La corrección de F1 alinea el código con el plan §3.4 («el aviso solo desaparece con una relectura correcta»). La desviación menor de la iteración 1 queda resuelta.
- **Nuevo cuarto parámetro `keepDraft` de `finishSave`:** el plan no lo menciona. Es una extensión mínima y justificada para F2, y su valor por defecto mantiene el comportamiento de los demás llamantes.
- El resto de la sección 3 de la iteración 1 sigue vigente: las desviaciones justificadas de `app_clock` y del parámetro `measured`, y la coherencia de la ADR-0028.

## 4. Checklist de la constitución

### Parte I (base)

- [x] **B2:**
  - `snapshot --check` da `identical: true`, con 15 archivos y el snapshot del 2026-10-19T02:23:50.
  - El único test añadido después de la etapa `tests` original es `PhysicalDataForm.refresh-edge.test.tsx` (`92c5ffb`). Está autorizado: el `history` registra `rework tests` (review 1/3), un red check PASS con rojo legítimo y el `snapshot` posterior.
  - `git diff 92c5ffb HEAD` no toca ningún archivo de test: `c8232eb` solo cambia `PhysicalDataForm.tsx` y artefactos de la feature.
  - La normalización de `conftest.py` no altera el contenido. En el índice ya estaba en LF, así que no hay diff, y la copia de trabajo tiene 0 CR.
- [x] **B4:** los marcadores `AC-002.5` y `AC-002.6` de los tests de F1 y F2 son aproximados, porque F1 y F2 no tienen AC propio. Está anotado en el backlog y en `verify-report.md`. Es aceptable.
- [x] **B5:**
  - Sin tests debilitados ni borrados, y sin `skip` ni `only`.
  - Los dos tests nuevos prueban el comportamiento corregido. F1 comprueba el aviso, el botón «Reintentar», que no hay una segunda medición y que el formulario queda sin cambios pendientes. F2 comprueba que se conserva el 75, que desaparece el aviso y que no se repite ningún guardado.
  - Sigue vigente la excepción del Art. B5.2 aprobada por el usuario (31 tests de caracterización), sin cambios.
- [x] **B5.7:** ratchet de ruff, `npm run lint`, `tsc -b` y build correctos (`verify-report.md`).
- [x] **B6.5:** sin cambios relevantes en esta iteración.

### Parte II (proyecto)

- [x] **P1 frontend:**
  - El test nuevo está junto al componente, importa `vitest` explícitamente y tiene nombres en español.
  - La red se simula en `api.ts`, igual que en `PhysicalDataForm.refresh.test.tsx`.
- [x] **P2 frontend:** el formulario sigue con react-hook-form. No hay textos visibles nuevos ni HTTP fuera de `apiFetch`.
- [ ] **P4:** sigue pendiente para la etapa `docs`: el paso manual de `FRONTEND_BASE_URL` en EC2 antes del merge y aceptar la ADR-0028 (F7). Está en el backlog.

## 5. Hallazgos

Hallazgos de la iteración 1:

- F1, F2 y F3: corregidos y verificados.
- F4 a F8: pendientes aceptados por el usuario y enviados al backlog de la feature (`backlog.md`, sección «review · reviewer»). No son hallazgos abiertos de esta review.

Hallazgos nuevos de esta iteración:

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F9 | MENOR | `frontend/src/features/profile/components/PhysicalDataForm.refresh-edge.test.tsx:128-146` | La corrección de F1 añade `setPendingFinish({ ...pendingFinish, values })` (`PhysicalDataForm.tsx:182`) para que un reintento posterior no revierta lo guardado sin medición. Ningún test lo cubre: el test de F1 no pulsa «Reintentar» con éxito ni comprueba que la meta «Aumentar peso» se conserva en el formulario después. Si alguien quitara esa línea, `retryRefresh` haría `form.reset` con la meta anterior y ningún test fallaría. | test-author |
| F10 | NIT | `frontend/src/features/profile/components/PhysicalDataForm.tsx:230,221` | Con `keepDraft`, `finishSave` pone `justSaved` a `true`, así que se ve «Cambios guardados» mientras el formulario tiene ediciones sin guardar y el botón «Guardar cambios» está activo. El mensaje se refiere al guardado anterior, pero puede confundir. El implementer ya lo anotó en el backlog. | implementer |
| F11 | NIT | `frontend/src/features/profile/components/PhysicalDataForm.tsx:226-230` | `retryRefresh` lee `dirty` del render en que se pulsó «Reintentar». Si el usuario empieza a editar mientras la relectura está en curso, `dirty` vale `false` y `form.reset` descarta esa edición. Es un caso muy raro. Leer el estado en el momento, por ejemplo con `form.formState.isDirty` o comparando `form.getValues()` con `saved`, lo evitaría. | implementer |

## 6. Decisión

**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES:

- F1, F2 y F3 están corregidos sin regresiones, con tests que fallaban antes de la corrección y pasan ahora.
- La integridad de los tests es correcta: snapshot idéntico, cambios autorizados por el `history` y ningún test modificado durante implement.
- F9 (MENOR) y F10-F11 (NIT) pueden ir al backlog, con la aprobación del usuario.
- Pendiente para la etapa `docs`: el paso manual de `FRONTEND_BASE_URL` en EC2 (P4) y aceptar la ADR-0028 (F7).


## Comentarios del usuario

- Gate de review: "Corrijamos, F1,F2 y F3. Lo demas al backlog"
