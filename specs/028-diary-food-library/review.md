# Review 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Iteración:** 2 de 5
- **Diff revisado:** `git diff main...feat/028-diary-food-library` @ `9c8e7fd`, centrado en la iteración 2 (`56a780a..9c8e7fd`). Los cambios sin commitear están solo en `specs/028-diary-food-library/{backlog.md,state.json,verify-report.md}`, que son artefactos.
- **Veredicto:** APPROVED

## 1. Resumen
La iteración 2 corrige los hallazgos F1 a F8 de la primera review:
- **F1 y F2:** confirmación en línea dentro del `<li>`, Escape capturado en `window` con `useEscapeCapture` y foco gestionado.
- **F3:** el límite cuenta solo los favoritos visibles y se puede hacer `DELETE` de un favorito retirado.
- **F4:** cota F × P con memoria por pareja, atajo `startswith` para formas cortas y descarte por longitud.
- **F5:** se retiran `features/catalog/`, `foods/api.ts` y `catalogEntry`.
- **F6:** `proposalReviewSchema` sin `as never`.
- **F7:** `unlinkCustomFood` y `onCustomFoodDeleted`.
- **F8:** el plan y la ADR-0036 reflejan la confirmación en línea.

Todos quedan corregidos y no veo regresiones. Queda un caso límite menor de estado obsoleto en la confirmación en línea (F9) y dos NIT.

## 2. Cumplimiento de la spec
Solo se detallan los AC nuevos o cambiados en la iteración 2. Los de la iteración 1 no cambian y siguen en verde: 121/121 AC en el verify, y las tablas de la iteración 1 siguen valiendo.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-009 AC-009.6 (límite con favoritos visibles) | Sí | `backend/services/food_library_service.py:132` y `:182-189` (`_visible_favorite_count`): cuenta todos los propios, porque el `CASCADE` no deja huérfanos, y del catálogo solo los que devuelve `get_by_ids`. Se calcula después de `_lock_user` (`:126`), así que la serialización con ADR-0020 se mantiene. Test: `test_food_library_routes.py:1031` y `test_food_library_service.py:733` |
| REQ-009 AC-009.7 (`DELETE` de un favorito retirado) | Sí | `food_library_service.py:148-155`: `get_for_food` filtrado por `user_id`; si existe se borra, sin exigir el alimento. Test: `test_food_library_routes.py:1052` y `test_food_library_service.py:749` |
| REQ-009 AC-009.8 (404 sin filtrar existencia) | Sí | `food_library_service.py:154-155`: si el usuario no tiene ese favorito, se pide `_require_food`. El favorito de otro usuario no se ve, porque `get_for_food` filtra por usuario, y no se toca. Un propio ajeno sigue dando 404 por `get_by_id_and_user`. No hay fuga de existencia: los ids del catálogo son públicos. Test: `test_food_library_routes.py:1070` y `test_food_library_service.py:764` |
| REQ-017 AC-017.5 y AC-017.6 (Escape) | Sí | `frontend/src/lib/useEscapeCapture.ts:11-21`: `keydown` en `window` en fase de captura, que va antes que el listener de Radix en `document` en captura. Hace `stopPropagation` y `preventDefault`, y la limpieza del `useEffect` lo quita al desmontar o al pasar a inactivo. El listener solo existe mientras `DeleteConfirmation` está montada (`FoodSearchPanel.tsx:351-352`). Los tests usan el Dialog real de Radix: `AddFoodDialog.test.tsx:731`, donde un segundo Escape cierra el diálogo, y `MealPhotoDialog.test.tsx:1532`, sin confirmación de descartar. Los he ejecutado y están en verde |
| REQ-017 AC-017.7 (confirmación dentro de su `<li>`) | Sí | `FoodSearchPanel.tsx:143-170` (`renderInline` por lista, que compara `list`, `kind` e `id`) y `LibraryFoodList.tsx:79` (`renderInline?.(food)` dentro del `<li>`). Es no modal y sin `aria-hidden`. Test: `FoodSearchPanel.test.tsx:998` |
| NFR-002 AC-N002.3 a AC-N002.5 (foco) | Sí | Foco en «Cancelar» al montar (`FoodSearchPanel.tsx:348`). `focusTrigger` usa `isConnected`, con la caja como respaldo (`:103-106`), al cancelar (`:127-133`) y tras un error (`:118-121`). Tras un borrado correcto, `form.setFocus("query")` (`:113`). Tests: `FoodSearchPanel.test.tsx:1013-1088` |
| NFR-004 AC-N004.1 a AC-N004.3 (cota F × P) | Sí | Detalle en las tres filas siguientes. Tests: `test_catalog_search_service.py:697-819` (contra el catálogo real de la 023), `test_food_library_service.py:825-850` y `test_catalog_routes.py:320` |
| — atajo de formas cortas | Sí | `backend/services/catalog_search_service.py:155-158`. Con tolerancia 0, `startswith` equivale a la antigua condición `prefix_edit_distance ≤ 0` |
| — descarte por longitud | Sí | `catalog_search_service.py:159-160`. `len(word) < len(form) - tol` es una cota inferior exacta de la distancia frente a cualquier inicio de la palabra, así que no cambia resultados |
| — memoria por pareja | Sí | `catalog_search_service.py:161-167`. Es determinista y `typo_distance` sigue sumando con repeticiones (`:112-125`), así que el orden de REQ-006 no cambia. Hay un solo `TypoDistances` por búsqueda (`:195`) y la pasada exacta no lo usa |
| REQ-018 AC-018.7 y AC-018.8 | Sí | `proposal.ts:92-96` (`unlinkCustomFood`) y `PhotoReview.tsx:74-81` (`replace` con `withEntryKey` en las filas desvinculadas). `proposalItems` envía `name` y `per_100g` cuando falta `customFoodId`. Tests: `MealPhotoDialog.test.tsx:1558` y `:1598`, `proposal.test.ts:544-580` y `FoodSearchPanel.test.tsx:1090-1130` |
| REQ-020 (ampliado, F5) | Sí | Se borran `features/catalog/` entero, `features/foods/api.ts`, `foodSearchResponseSchema`, los tipos de USDA, `catalogEntry` y `src/test/catalogFixtures.ts`. Un grep confirma que no quedan imports a esos módulos. Guarda en `foodsRoute.test.tsx:66-180`. `features/foods/` conserva `format`, `schemas` (formulario de búsqueda), `searchError` y `types`, todos en uso |

## 3. Cumplimiento del plan
- **F7, `replace` en lugar de `form.getValues` + `update` por índice (plan 3.3, `PhotoReview`).** `unlinkDeleted` reconstruye las filas desde `entries` (fusión de `fields` y `useWatch`, con los gramos editados) y hace un solo `replace`. El cierre se captura en el render en que se confirma el borrado, mientras la vista `search` está activa y las filas no se pueden editar, así que los valores son los actuales. El implementer lo registró en `history`. Es una desviación justificada y equivalente.
- **F3:** coincide con el plan. Se quita `FoodFavoriteRepository.count_by_user` y su fake. `CustomFoodRepository.count_by_user` se conserva porque lo usa el límite de 500.
- **F4:** coincide con el plan (`TypoSearchStats`, `TypoDistances`, `typo_comparison_bound` y `stats` reenviado sin tocar rutas). Los contratos HTTP no cambian.
- **F8:** `plan.md:554-590` y la ADR-0036 (decisión 9) describen la confirmación en línea, `useEscapeCapture` y el foco. Ya no se proponen `ConfirmDialog` ni `confirmContainer`. La ADR sigue en «Propuesta» (`ADR-0036…md:3` y el índice `README.md:42`).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` es idéntico (28 archivos). `git diff 1f2bed0 HEAD` no toca ningún archivo de test ni `fakes.py`: la implementación de la iteración 2 no modificó tests. Los cambios de tests de la iteración 2 están en el commit `tests` (`1f2bed0`), tras el red check PASS, con el `snapshot` registrado en `history`.
- [x] B4: hay marcadores `SDD: 028 …` en todos los AC nuevos (AC-009.6 a AC-009.8, AC-017.5 a AC-017.7, AC-018.7 y AC-018.8, AC-N002.3 a AC-N002.5 y AC-N004.1 a AC-N004.3), y el verify da 121/121.
- [x] B5.2 y B5.6: la excepción para los casos de `proposalReviewSchema`, que pasaban en el esqueleto declarativo y se aceptan como guardas de regresión, está **ratificada por el usuario** («si», `history` 2026-10-27T22:58:12). La iteración extra de tests la concedió el usuario («opción a»), y `max_iterations: 5` de `.sdd/config.json` se commiteó en `1f2bed0` con esa autorización. `state.json.max_iterations` sigue en 4 porque la CLI no lo permite subir; queda anotado en `history`.
- [x] B5.3: no hay tests saltados. Los tests existentes que cambian responden a la spec aprobada en la iteración 2:
  - favoritos visibles en AC-009.4 y AC-009.5;
  - el error de borrado fuera de la confirmación;
  - los mocks y aserciones de `features/catalog` y `foods/api`, módulos ya inexistentes. Su ausencia la vigila `foodsRoute.test.tsx`.

  Se borran `CatalogResultList.test.tsx` y `catalog/schemas.test.ts` junto con el código que retira REQ-020 (F5), como prevé el plan. No hay llamadas a servicios externos. Los tests de NFR-004 leen `backend/scripts/data/food_catalog.csv` en modo de solo lectura.
- [x] B5.7: según el verify, el ratchet de ruff no tiene violaciones nuevas y oxlint, `tsc -b` y `build` están limpios. Además desaparecen `as never` y `as unknown as` de `PhotoReview`.
- [x] B6.5: no hay secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: fakes a mano (`FakeFoodFavoriteRepository`), sin `mock` ni `monkeypatch`; nombres en inglés en el backend y en español en el frontend; marcadores con el número de spec.
- [x] P2.backend.1 y 2: el conteo de visibles vive en el servicio y usa repositorios inyectados. Solo `UnitOfWork` hace `commit` o `rollback`.
- [x] P2.backend.3: `ResourceNotFoundError` y `ValidationError`.
- [x] P2.backend.4 y P4: la iteración 2 no cambia modelos ni migraciones. La migración `e6a8c0d2f4b7` de la iteración 1 sigue siendo la única cabeza. Su paso manual queda para la etapa docs.
- [x] P2.backend.5: se reutilizan `words`, `fold`, `query_forms`, `prefix_edit_distance` y `typo_tolerance`.
- [x] P2.frontend.1: `useEscapeCapture` es genérico y va a `src/lib` con su test.
- [x] P2.frontend.2 y 3: `apiFetch` y TanStack Query sin cambios; formularios con react-hook-form y zod.
- [x] P2.general: textos y comentarios en español correcto.
- [x] P3.1: aislamiento por usuario en `remove_favorite` y en `_visible_favorite_count`. `list_by_user` y `get_for_food` filtran por usuario.
- [x] P3.2: entradas validadas en el servicio y en zod.
- [x] P3.4: sin SQL concatenado.
- [x] P5.1: archivos en LF en el índice (`git ls-files --eol`: `i/lf`).
- [x] P5.2: la ADR-0036 sigue en «Propuesta». La acepta la sesión principal en este gate si el usuario lo aprueba.
- [x] P5.3: no se edita `backend/scripts/data/**`; los tests solo lo leen.

### Estado de los hallazgos de la iteración 1
| # | Estado | Evidencia |
|---|---|---|
| F1 | Corregido | `useEscapeCapture` y los tests con Radix real (AC-017.5 y AC-017.6) |
| F2 | Corregido | Confirmación en el `<li>` y foco gestionado (AC-017.7 y AC-N002.3 a AC-N002.5) |
| F3 | Corregido | Spec Q11 y `food_library_service.py:132,148-155,182-189` |
| F4 | Corregido | NFR-004 y `catalog_search_service.py:140-218` |
| F5 | Corregido | Módulos borrados, sin imports colgantes; `tsc` y `build` en verde |
| F6 | Corregido | `schemas.ts:233-235` (`proposalReviewSchema` anotado con `ProposalFormValues`) y `PhotoReview.tsx:59` |
| F7 | Corregido | Spec Q12, `proposal.ts:92-96` y `PhotoReview.tsx:74-81` |
| F8 | Corregido | `plan.md:554-590` y la decisión 9 de la ADR-0036 |

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F9 | MENOR | `frontend/src/features/diary/components/FoodSearchPanel.tsx:90-91,143-170,348` | `target` y `confirming` sobreviven a que la lista que contiene la confirmación se desmonte. **Ejemplo:** el usuario abre «Borrar» en «Favoritos», hace clic en la caja y escribe «ar»; la lista se oculta y la confirmación se desmonta. Mientras tanto, Escape ya no se captura y cierra el diálogo: es coherente, pero el estado sigue «abierto». Al borrar el texto, «Favoritos» vuelve a montarse con la confirmación abierta, y su `useEffect` (`:348`) roba el foco de la caja hacia «Cancelar» mientras el usuario escribe. Lo mismo pasa en «Resultados» si cambia la consulta y el alimento vuelve a aparecer, y con el aviso «No se pudo borrar el alimento.», que reaparece en el elemento. La spec no lo cubre, pero choca con la intención de NFR-002 (el foco no salta). **Arreglo sugerido:** cerrar la confirmación (`target = null`, `confirming = false`, `deleteFood.reset()`) cuando cambia el texto de la caja, o cuando su lista o su alimento dejan de mostrarse. | implementer |
| F10 | NIT | `backend/services/catalog_search_service.py:96,140` | `TYPO_MIN_FORM_LENGTH = 4` se define junto a `TypoDistances`, pero `typo_tolerance` sigue usando el literal `4`. Si cambiara uno sin el otro, `typo_comparison_bound` y la tolerancia divergirían. Conviene que `typo_tolerance` use la constante. | implementer |
| F11 | NIT | `frontend/src/features/diary/schemas.ts:228` | `proposalFormSchema`, con `key` opcional, ya no tiene uso en producción: `PhotoReview` usa `proposalReviewSchema` y solo lo importan `schemas.test.ts` y la comprobación de mensajes iguales. El plan (sección 3.2) lo conserva a propósito, pero es código que solo sostienen los tests. Se puede retirar más adelante y dejar las guardas sobre `proposalReviewSchema`. | planner |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES.
- F1 a F8 están corregidos tal como pide la spec de la iteración 2 y no veo regresiones.
- Los tests están íntegros: el snapshot es idéntico, la implementación no tocó ningún test después del commit `tests` y los cambios de tests de la iteración 2 responden a la spec aprobada.
- La excepción a B5.2 y B5.6 y el `max_iterations` 5 están autorizados por el usuario y constan en `history`.
- La ADR-0036 sigue en «Propuesta» para que la acepte la sesión principal en este gate.
- F9 (MENOR) y los dos NIT pueden ir al backlog o corregirse en esta feature si el usuario lo prefiere.
- Siguen pendientes, como en la iteración 1, el paso manual de la migración `e6a8c0d2f4b7` en `docs/deploy-runbook.md` (etapa docs, Art. P4) y la prueba manual de AC-N002.2 con lector de pantalla.

## Comentarios del usuario

Vamos a corregir de F1 a F8

Corrijames F9,F10 Y F11. ADR-0036 Aceptada
