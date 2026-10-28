# Review 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Iteración:** 3 de 5
- **Diff revisado:** `git diff main...feat/028-diary-food-library` @ `42d32da`, centrado en la iteración 3 (`9c8e7fd..42d32da`). Los cambios sin commitear están solo en `specs/028-diary-food-library/{backlog.md,state.json,verify-report.md}`, que son artefactos.
- **Veredicto:** APPROVED

## 1. Resumen
La iteración 3 corrige los tres hallazgos de la segunda review:
- **F9:** la confirmación de borrado en línea, y su aviso de error, se cierran en silencio si cambia el texto de la caja o si el alimento deja de mostrarse en su lista.
- **F10:** `typo_tolerance` usa `TYPO_MIN_FORM_LENGTH`.
- **F11:** se retira `proposalFormSchema`.

Además, la ADR-0036 pasa a «Aceptada» (la editó la sesión principal, con la aprobación del usuario en el gate). Los tres hallazgos quedan corregidos y no veo regresiones en F1 a F8. Solo quedan tres NIT.

## 2. Cumplimiento de la spec
Solo se detallan los AC que toca la iteración 3. El resto sigue como en las iteraciones 1 y 2: 121/121 AC en verde en el verify.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-017 AC-017.7 y NFR-002 AC-N002.3 (F9: la confirmación no reaparece ni roba el foco al volver la lista) | Sí | `frontend/src/features/diary/components/FoodSearchPanel.tsx:44-49` (`DeleteTarget.query`), `:144` (se guarda el texto al abrir), `:213-219` (`isTargetShown`, con los mismos datos que pintan las listas) y `:236-241` (efecto de cierre). Tests: `FoodSearchPanel.test.tsx:1157`, `:1175` y `:1216`. Los he ejecutado y están en verde |
| REQ-017 AC-017.3 (F9: el aviso de error no se repinta) | Sí | `dismissDelete` (`FoodSearchPanel.tsx:222-228`) hace `deleteFood.reset()`, así que `isError` desaparece. Si la vista no cambia, el error se queda en su elemento, porque el efecto no cierra con `typed === target.query` y `shown`. Tests: `FoodSearchPanel.test.tsx:1196` y `:1251` |
| NFR-002 AC-N002.4 (F9: fallo con el texto cambiado durante el borrado) | Sí, con la matización del plan 9.3 | `FoodSearchPanel.tsx:123-128`. Si el texto no cambió, `focusTrigger` actúa como antes. Si cambió, no mueve el foco (el usuario está escribiendo) y vuelve a anclar la confirmación al texto actual. La spec no cubre escribir durante un borrado en curso, y no cerrarla cumple «el foco no salta». Test: `FoodSearchPanel.test.tsx:1251` |
| NFR-002 (el foco no queda en el cuerpo) | Sí | `FoodSearchPanel.tsx:226-227`. Como el efecto se ejecuta después del commit, si el elemento enfocado se desmontó, `activeElement` ya es `body` y el foco pasa a la caja. Test: `FoodSearchPanel.test.tsx:1216` (quitar de favoritos desde la propia lista) |
| REQ-018 AC-018.7 (`onCustomFoodDeleted` no se pierde) | Sí | El efecto no actúa con `isPending` ni con `isSuccess` (`FoodSearchPanel.tsx:231-232` y `:237`), así que `reset()` nunca anula el `onSuccess` de `mutate` (`:117-122`). `startDelete` llama a `reset()` antes de abrir (`:143`), y `isSuccess` de un borrado anterior no bloquea el cierre de la confirmación siguiente: `reset` actualiza `getCurrentResult` de forma síncrona y el render lo lee. Siguen en verde los tests de 204 y 404 (`FoodSearchPanel.test.tsx:1090-1130`) y `MealPhotoDialog.test.tsx:1558` y `:1598` |
| REQ-006 y NFR-004 (F10: sin cambio de comportamiento) | Sí | `backend/services/catalog_search_service.py:95-101`: solo cambia el literal `4` por la constante, que ahora se declara antes; `:176` (`typo_comparison_bound`) usa la misma. He ejecutado `pytest -k "catalog_search or typo"`: 108 tests en verde |
| REQ-018 y REQ-019 a través de `proposalReviewSchema` (F11) | Sí | `frontend/src/features/diary/schemas.ts:187-233`: `proposalEntryUnion()` fija `key: z.string()`, y `proposalReviewSchema` conserva su anotación `z.ZodType<ProposalFormValues, ProposalFormValues>`. Un grep no encuentra referencias a `proposalFormSchema` fuera de las dos guardas negativas (`PhotoReview.source.test.ts:61` y `schemas.test.ts:618`) y de la ADR, que documenta la retirada. `tsc -b` está limpio |

**Análisis del efecto de F9:**
- **Sin bucles:** `dismissDelete` deja `target = null`, y en la ejecución siguiente el efecto sale en la primera guarda.
- **Sin carreras con `isPending`:** `mutate` pone `pending` de forma síncrona, así que no hay un render entre el clic en «Borrar» y `isDeleting = true`.
- **Un refetch no cierra la confirmación:** TanStack Query conserva `data` durante el refetch. Si el refetch falla con datos previos, `hasResults` pasa a `false`, la lista se oculta y la confirmación se cierra a la vez, lo que es coherente.
- **Escape:** el listener se quita al desmontar `DeleteConfirmation`, como antes.

## 3. Cumplimiento del plan
- **Desviación registrada: `eslint-disable-next-line react-hooks/exhaustive-deps` en el efecto de F9 (`FoodSearchPanel.tsx:240`).** El plan 9.7 decía «el efecto nuevo declara todas sus dependencias, sin `eslint-disable`», y el implementer lo anotó en `history` («a revisar»).
  - **Lo he comprobado con oxlint** sobre copias del archivo en el scratchpad, sin tocar el repositorio:
    - Sin la directiva, oxlint avisa `react-hooks(exhaustive-deps)` por `dismissDelete`.
    - Sin las dos directivas aparece además un aviso `react(set-state-in-effect)` en la llamada `dismissDelete()`.
    - Ninguna alternativa directa queda limpia. Meter `dismissDelete` en las dependencias haría que el efecto se ejecutara en cada render, aunque sin cambiar el resultado gracias a las guardas. Escribir su cuerpo dentro del efecto pone el `setState` en el propio efecto.
  - **No hay riesgo de cierre obsoleto:** el efecto se crea en cada render y usa el `dismissDelete` de ese render. La omisión solo evita que se reejecute cuando cambia la identidad de la función.
  - **Conclusión:** la desviación está justificada. Queda como NIT para que el plan refleje lo implementado (F12).
- **Directiva de la línea 82 (`onQueryChange`).** Es de la iteración 1 (`56a780a`), no de esta. Se podría evitar llamando a `onQueryChange` desde el `onChange` de la caja (F13).
- **NFR-003:** se limita a que `PhotoReview.tsx` no tenga avisos `incompatible-library`, y ni la iteración ni las directivas afectan a ese archivo. `npm run lint` (oxlint) está limpio y `PhotoReview.source.test.ts` en verde.
- **F10 y F11:** coinciden con el plan 9.2 y 9.3. La ADR-0036 actualiza las decisiones 7 y 9 y su estado está en «Aceptada» en `ADR-0036…md:3` y en el índice (`docs/sdd/decisions/README.md:42`), editados en el commit `implement` por la sesión principal tras el «ADR-0036 Aceptada» del usuario (Art. P5.2).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` es idéntico (28 archivos). `git diff 8dbf4e7 HEAD` no toca ningún archivo de test: la implementación de la iteración 3 no modificó tests. Los cambios de tests están en el commit `tests` (`8dbf4e7`), tras el red check PASS, con su `snapshot` en `history`.
- [x] B4: los cinco tests de F9 trazan a AC-017.3, AC-017.7, AC-N002.3 y AC-N002.4, que es coherente. El test nuevo de F11 lleva `AC-018.7`, que no es lo que prueba (F14, NIT).
- [x] B5.3: no hay tests saltados ni debilitados. Las adaptaciones de `schemas.test.ts` siguen la lista cerrada del plan 9.4:
  - `proposalIssues` da `key` a las entradas, y los mensajes esperados no cambian;
  - la contraste con `proposalFormSchema` se sustituye por `gramsError(grams)`, que no es tautológico y conserva `toEqual({0: message, 1: message})`;
  - la parte «sin clave» de AC-019.1 la cubre el rechazo de entradas sin `key`.
- [x] B5.2 y B5.6 (excepción ratificada): no se amplía. El bloque `describe("proposalReviewSchema")` mantiene 4 pruebas (9 casos) con el marcador `regression guard` (5 apariciones antes y después, contando la cabecera). Solo pierde la comparación con el esquema retirado. `max_iterations: 5` sigue en `.sdd/config.json:14`, sin más cambios.
- [x] B5.4: no hay llamadas a servicios externos; se usan los mocks de `food-library/api`.
- [x] B5.7: el ratchet de ruff no tiene violaciones nuevas (según el verify). He ejecutado `npm run lint` (sin avisos) y `npx tsc -b` (limpio).
- [x] B6.5: no hay secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1 (frontend): tests junto a su archivo, nombres en español que describen el comportamiento, red simulada en `api.ts` y sin dobles nuevos.
- [x] P2.backend.5: F10 reutiliza la constante en lugar del literal.
- [x] P2.backend.4 y P4: no hay cambios de modelo ni migración. La migración `e6a8c0d2f4b7` de la iteración 1 sigue siendo la única. Su paso manual en `docs/deploy-runbook.md` queda para la etapa docs.
- [x] P2.frontend.3: el panel sigue con react-hook-form (`getValues`, `setFocus`) y TanStack Query.
- [x] P2.frontend.5: oxlint sin errores ni avisos.
- [x] P2.general.1: comentarios y textos en español correcto.
- [x] P3: la iteración no cambia autorización, validación ni consultas.
- [x] P5.2: la ADR-0036 la acepta la sesión principal con la aprobación explícita del usuario («ADR-0036 Aceptada» en los comentarios de la review 2).

### Estado de los hallazgos de la iteración 2
| # | Estado | Evidencia |
|---|---|---|
| F9 | Corregido | `FoodSearchPanel.tsx:44-49,123-128,144,213-241` y los cinco tests de `FoodSearchPanel.test.tsx:1142-1279` |
| F10 | Corregido | `catalog_search_service.py:95-101` |
| F11 | Corregido | `schemas.ts:187-233`, sin referencias colgantes; test `schemas.test.ts:617` |

F1 a F8 siguen corregidos. Los tests de Escape con Radix real (`AddFoodDialog.test.tsx` y `MealPhotoDialog.test.tsx`), los de foco, `unlinkCustomFood` y `onCustomFoodDeleted`, y los de favoritos visibles y cota F × P del backend están en verde. He ejecutado 355 tests de los cinco archivos afectados del frontend y 108 del backend.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F12 | NIT | `frontend/src/features/diary/components/FoodSearchPanel.tsx:239-240` y `specs/028-diary-food-library/plan.md` (9.7) | El efecto de F9 lleva `eslint-disable-next-line react-hooks/exhaustive-deps`, aunque el plan 9.7 dice «sin `eslint-disable`». La directiva está justificada: no hay cierre obsoleto, y quitarla, añadir `dismissDelete` a las dependencias o escribir su cuerpo en el efecto da avisos de oxlint (`exhaustive-deps` o `set-state-in-effect`). Pero el plan no describe lo implementado. Además, el comentario de la línea 239 («solo usa referencias estables y setters») omite que la razón real es no reejecutar el efecto en cada render. Conviene ajustar el plan o el comentario. | implementer |
| F13 | NIT | `frontend/src/features/diary/components/FoodSearchPanel.tsx:79-83` | La directiva de `onQueryChange` es de la iteración 1. Se puede evitar llamando a `onQueryChange?.(event.target.value)` desde el `onChange` de la caja (`:259-262`), en lugar de con un efecto sobre `typed`, si nadie depende de la llamada inicial al montar. Hay que comprobarlo en `MealPhotoDialog`, que guarda el texto entre vistas. | implementer |
| F14 | NIT | `frontend/src/features/diary/schemas.test.ts:616` | El test «`schemas.ts` ya no exporta `proposalFormSchema`…» lleva `SDD: 028 REQ-018 AC-018.7`, pero no prueba ese AC (desvincular filas al borrar un alimento propio): es una guarda estructural de F11. El plan 9.4 lo pedía así. Sería más fiel un marcador del tipo `SDD: 028 regression guard (F11)` sin AC, porque AC-018.7 ya tiene cobertura propia. | test-author |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES.
- F9, F10 y F11 están corregidos según el plan de la iteración 3 y no hay regresiones en F1 a F8.
- Los tests están íntegros: el snapshot es idéntico y la implementación no tocó tests después del commit `tests` (`8dbf4e7`). Las adaptaciones de `schemas.test.ts` no debilitan ninguna aserción de comportamiento.
- La excepción ratificada a B5.2 y B5.6 y el `max_iterations` 5 siguen en vigor y no se amplían.
- La ADR-0036 está «Aceptada».
- Los tres NIT pueden ir al backlog.
- Siguen pendientes:
  - el paso manual de la migración `e6a8c0d2f4b7` en `docs/deploy-runbook.md` (etapa docs, Art. P4);
  - la prueba manual de AC-N002.2 con un lector de pantalla.

## Comentarios del usuario

Vamos a corregir de F1 a F8

Corrijames F9,F10 Y F11. ADR-0036 Aceptada
