# Review 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Iteración:** 1 de 4
- **Diff revisado:** `git diff main...feat/028-diary-food-library` @ `56a780a` (+ cambios sin commitear en `specs/028-diary-food-library/{backlog.md,state.json,verify-report.md}`, solo artefactos)
- **Veredicto:** APPROVED

## 1. Resumen
La feature añade la biblioteca de alimentos propios (`custom_foods`), los favoritos (`food_favorites`) y el vínculo
`meal_items.custom_food_id` (`ON DELETE SET NULL`), con una migración aditiva que rellena la biblioteca. También añade
`/api/food-library/*` (búsqueda conjunta con erratas, recientes, favoritos y borrado), `custom_food_id` en `/api/meals`
y en el token de deshacer, y un `FoodSearchPanel` que comparten el diálogo de añadir y la propuesta de foto. El backend
es sólido: respeta las capas, aísla por usuario, bloquea la fila del usuario y la migración está bien probada. Quedan
hallazgos menores de UX y accesibilidad en la confirmación de borrado en línea, código muerto en el frontend y un coste
de CPU alto en la pasada de erratas ante consultas adversarias. No hay hallazgos bloqueantes ni mayores.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 (AC-001.1 a AC-001.10) | Sí | `backend/services/meal_service.py:371` (`_save_custom_foods`: agrupa por clave, gana el último, actualiza nombre y valores); `meal_service.py:155-165` (`custom_food_id` en el alimento); clave en `backend/services/food_library_rules.py:24`; concurrencia por `_lock_user` (`meal_service.py:132`) y `uq_custom_foods_user_id_name_key` (`backend/models/custom_food.py:39`); tests en `test_meal_library_routes.py` y `test_meal_service.py` |
| REQ-002 (AC-002.1 a AC-002.3) | Sí | `meal_service.py:383-389`: se comprueba el límite antes de escribir y solo cuenta los nombres nuevos; el `rollback` del `except` deja la comida sin cambios |
| REQ-003 (AC-003.1 a AC-003.5) | Sí | `backend/services/meal_rules.py` (`_parse_library_item`, `parse_items` con cuatro orígenes); `meal_service.py:355` copia los valores antes de tocar la biblioteca (AC-003.4); el filtro por usuario está en `custom_food_repository.py:22` |
| REQ-004 (AC-004.1 a AC-004.4) | Sí | `backend/services/food_library_service.py` (`delete_custom_food`, 404 con id no válido o ajeno); FK `SET NULL` y `CASCADE` en el modelo y la migración (`e6a8c0d2f4b7_create_food_library.py:75-100`) |
| REQ-005 (AC-005.1 a AC-005.3) | Sí | `e6a8c0d2f4b7_create_food_library.py:113-153`: ordena por `created_at, id`, agrupa con la clave local, toma el último registro, vincula con `IN` expandido y no aplica el límite; `test_food_library_migration.py` (13 tests, `downgrade` y `upgrade` incluidos) |
| REQ-006 (AC-006.1 a AC-006.12) | Sí | `backend/services/catalog_search_service.py:12` («-ces» → «z»), `:60` (OSA), `:77` (distancia frente a cada inicio), `:101` y `:136-165` (dos pasadas); `rank_catalog` también la usa, así que vale para `GET /api/catalog/search` |
| REQ-007 (AC-007.1 a AC-007.7) | Sí | `food_library_service.py` `search`: catálogo con `source_order=0` y propios del usuario con `source_order=1`, sin sinónimos; desempate por `(grupo, fold, source_order, …)` |
| REQ-008 (AC-008.1 a AC-008.8) | Sí | `backend/repositories/meal_repository.py:42` (`row_number` por `(catalog_id, custom_food_id)` por `created_at`, solo alimentos del catálogo vigente o con vínculo); `recent()` devuelve los valores actuales |
| REQ-009 (AC-009.1 a AC-009.5) | Sí | `food_library_service.py:116-150`: idempotentes, bloquean la fila del usuario y aplican el límite solo al crear |
| REQ-010 (AC-010.1 a AC-010.3) | Sí | `favorites()` omite los del catálogo retirados y ordena por `fold(name)` y catálogo primero |
| REQ-011 | Sí | `backend/routes/food_library_routes.py`: las seis funciones de ruta (ocho combinaciones) con `@require_auth` y `g.decoded_token["id"]` |
| REQ-012 (AC-012.1, AC-012.2) | Sí | `meal_rules.py` (`cf` solo si no es `None`; `parse_snapshot_payload` exige `is_db_id` y `source == "custom"`); `meal_service.py:405` (`_still_linked` comprueba la propiedad) |
| REQ-013 (AC-013.1 a AC-013.9) | Sí | `frontend/src/features/diary/components/FoodSearchPanel.tsx:64-88` (`useWatch`, `useDebouncedValue`, Intro con `flush`), clave por consulta en `food-library/hooks.ts:28` (AC-013.3) |
| REQ-014 (AC-014.1 a AC-014.6) | Sí | `FoodSearchPanel.tsx:126-246`; `staleTime: 0` e invalidación en `diary/hooks.ts` (AC-014.6); `gramsText(last_grams)` (AC-014.5) |
| REQ-015 (AC-015.1 a AC-015.5) | Sí | `LibraryFoodList.tsx:29-63` (`aria-pressed`, nombres accesibles); error con `favoriteErrorMessage` en `FoodSearchPanel.tsx:215` |
| REQ-016 (AC-016.1 a AC-016.3) | Sí | `AddFoodDialog.tsx` (envía `{ custom_food_id }` o `{ catalog_id }`); aviso en `CustomFoodForm.tsx:124` |
| REQ-017 (AC-017.1 a AC-017.4) | Sí, con desviación del plan | Confirmación en línea, `role="alertdialog"` (`FoodSearchPanel.tsx:277-337`); ver la sección 3 y F1 y F2 |
| REQ-018 (AC-018.1 a AC-018.6) | Sí | `PhotoReview.tsx:81-130` (vistas `search` y `custom` con `index` nulo o fila); `proposal.ts:61` (`libraryEntry`) y `:138` (`custom_food_id` al guardar) |
| REQ-019 (AC-019.1 a AC-019.4) | Sí | `PhotoReview.tsx:66-67` (`useWatch` + `mergeProposalEntries` por `key`); `proposal.ts:83-102` |
| REQ-020 | Sí | Se borran `FoodsPage`, `FoodResultList`, `FoodSearchForm`, `foods/hooks.ts` y `ProposalSearchStep`; `foodsRoute.test.tsx` en verde |
| REQ-021 | Sí | `PrivacyPolicyPage.tsx:5,39-40` |
| NFR-001 | Sí | `FoodLibraryService` sin cliente de embeddings ni `rate_limiter` |
| NFR-002 | Sí (AC-N002.2, prueba manual pendiente) | Región `role="status"` en `FoodSearchPanel.tsx:171`; listas con `aria-label` |
| NFR-003 | Sí | `PhotoReview.tsx` sin `form.watch`; el verify confirma que el lint está limpio |

## 3. Cumplimiento del plan
- **Confirmación de borrado en línea en lugar de `ConfirmDialog` (plan 3.3, «Borrar») y sin la prop `confirmContainer`
  (plan 3.2, `FoodSearchPanel` y `PhotoReview`).** La desviación está justificada. El test congelado de AC-017.3
  (`FoodSearchPanel.test.tsx:891`) consulta la lista «Resultados» con `getByRole`, sin `hidden`, mientras la
  confirmación está abierta. Un modal de Radix marca el resto como `aria-hidden` y ese test no pasaría. Una confirmación
  no modal cumple lo que pide la spec: título, texto, «Borrar» y «Cancelar». Sin `confirmContainer` no hace falta cambiar
  `MealPhotoDialog`, que el plan pensaba tocar. Se acepta, pero tiene dos efectos secundarios, F1 y F2. Además, ni el
  plan ni la ADR-0036 recogen la decisión (F8).
- `RecentFoodRow` vive en `repositories/meal_repository.py` y `food_library_rules.py` lo reexporta. Así un repositorio
  no importa de `services/` (B1 del red check). La desviación es correcta.
- `MealPhotoDialog.tsx` y `ProposalEntryRow.tsx` no cambian, aunque el plan los listaba. No hacía falta: las filas
  propias usan la variante `custom` existente.
- Por lo demás, el modelo de datos, las firmas, la migración, los endpoints y la estrategia de pruebas coinciden con el
  plan.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` es idéntico (26 archivos). El diff de tests entre
      `commits.tests` (`20960b4`) y HEAD tiene dos orígenes: los cambios autorizados en `history` («rework tests 4/4»,
      aprobado por el usuario: claves exactas con `custom_food_id`, margen del debounce y 27 E501), seguidos de un
      `snapshot`, y el borrado de `FoodsPage.test.tsx`, previsto en el plan (sección 5) y en T-130 junto con el código
      que retira REQ-020.
- [x] B4: los marcadores `SDD: 028 …` son coherentes. El verify confirma 107/107 AC.
- [x] B5: no hay tests saltados ni debilitados. Los de la 023 y la 025 que se reescriben responden a comportamiento
      sustituido por la spec, y el número de tests crece (`AddFoodDialog` 34→45, `MealPhotoDialog` 92→116,
      `test_catalog_search_service` 34→61). No se llama a servicios externos y no quedan `not implemented`.
- [x] B5.7: el ratchet de ruff no tiene violaciones nuevas y oxlint, `tsc` y `build` están limpios, según el verify. El
      `as never` de F6 oculta un desajuste de tipos sin error de compilación.
- [x] B6.5: no hay secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: marcadores con número de spec, fakes a mano en `tests/fakes.py` (sin `mock` ni `monkeypatch`), mocks en
      `food-library/api` y nombres en inglés en el backend y en español en el frontend.
- [x] P2.backend.1: capas `routes → services → repositories → models`. Las rutas solo parsean, llaman y serializan.
      Solo `UnitOfWork` hace `commit` o `rollback`, y `CustomFoodRepository.create` solo hace `flush`.
- [x] P2.backend.2: dependencias por constructor y `_build_food_library_service()`.
- [x] P2.backend.3: errores con `ValidationError` y `ResourceNotFoundError`, sin respuestas de error construidas a mano.
- [x] P2.backend.4 y P4: la migración `e6a8c0d2f4b7` existe, es la única cabeza (`down_revision = d4f6a8c0e2b5`) y
      coincide con el modelo: mismos nombres de restricciones, índice, FK `SET NULL` y `CASCADE`, y `CHECK` de origen.
      El relleno usa `sa.text` con parámetros enlazados y `bindparam(expanding=True)`. El `downgrade` quita la `CHECK`,
      el índice, la FK y la columna, y después las dos tablas; los registros se conservan (test
      `test_downgrade_removes_the_column_and_both_tables_without_losing_the_items`) y se pierden los favoritos, como
      documenta el plan. El paso manual para producción queda para la etapa docs (backlog del verify).
- [x] P2.backend.5: reutiliza `fold`, `words`, `word_forms`, `match_group`, `normalize_query`, `is_db_id`,
      `is_catalog_id` y `RestoreTokenSigner`.
- [x] P2.frontend: la feature de datos `food-library` (api, hooks, types, schemas) es de solo datos, como justifica el
      plan. Todo pasa por `apiFetch`, usa TanStack Query con sus claves en `hooks.ts`, y los formularios usan
      react-hook-form con zod.
- [x] P2.general: textos en español correcto (los mensajes son literales de la spec).
- [x] P3.1: los endpoints usan `@require_auth` y el `user_id` del token. Los repositorios filtran por usuario en la
      misma consulta: un alimento o favorito ajeno responde 404 o 400, como si no existiera. El token de deshacer con
      `cf` está firmado y ligado al usuario, y además se comprueba la propiedad al restaurar.
- [x] P3.2: entradas validadas en el servicio (`parse_custom_food_id`, `is_catalog_id`, `normalize_query`) y con zod
      en el frontend.
- [x] P3.3: no aplica (sin proveedores de IA). Ver F4 sobre el coste de la búsqueda sin límite.
- [x] P3.4: sin SQL concatenado.
- [x] P3.5: sin variables nuevas ni `.env`.
- [x] P5.1: los archivos están en LF en el índice (la copia de trabajo tiene CRLF por `autocrlf`, ya anotado por el
      verifier).
- [x] P5.2: la ADR-0036 queda en «Propuesta» y la acepta la sesión principal en este gate.
- [x] P5.3: no se tocan `backend/scripts/data/**`.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `frontend/src/features/diary/components/FoodSearchPanel.tsx:306-308` | El manejador de Escape de la confirmación en línea no llega a ejecutarse en el uso real. Radix registra Escape en `document` en fase de captura (`@radix-ui/react-use-escape-keydown`, `capture: true`). Por eso, con la confirmación abierta, Escape cierra todo el diálogo «Añadir a {sección}» (se pierde la búsqueda), y en la propuesta de foto abre la confirmación de descartar la propuesta (026) en lugar de cancelar el borrado. Solución propuesta: que el diálogo contenedor intercepte `onEscapeKeyDown` mientras haya una confirmación abierta (`preventDefault` y cancelar), o una alternativa equivalente, con un test de Escape con la confirmación abierta. | implementer |
| F2 | MENOR | `frontend/src/features/diary/components/FoodSearchPanel.tsx:97-103,262-271` | Al confirmar o cancelar el borrado, la confirmación se desmonta con el foco dentro y el foco cae en `body` (o lo recoge la trampa de Radix al principio del diálogo), no vuelve a la lista ni al botón «Borrar». Además, la confirmación se pinta al final del panel, lejos del alimento. Es un problema de accesibilidad con teclado y lector de pantalla. | implementer |
| F3 | MENOR | `backend/services/food_library_service.py:125,209` | Un favorito del catálogo cuyo alimento retira una carga posterior sigue contando para el límite de 100, no aparece en la lista y no se puede quitar: `DELETE` responde 404 porque `_require_food` exige que exista. Con muchos alimentos retirados, el usuario puede quedarse sin poder marcar favoritos sin saber por qué. Es conforme a la spec (REQ-009 y REQ-010) y ya figura en el backlog del planner; conviene decidir si el límite cuenta solo los visibles o si `DELETE` admite favoritos huérfanos. | spec-writer |
| F4 | MENOR | `backend/services/catalog_search_service.py:101-165` (vía `backend/routes/food_library_routes.py:526`) | La pasada con tolerancia recorre todo el catálogo y los 500 propios calculando OSA por palabra antes de comparar con la tolerancia. Medido en local: con 261 alimentos del catálogo y 500 propios, una consulta adversaria de 100 caracteres (`"arroces " * 12 + "qzxw"`) tarda unos 0,9 s de CPU por petición, y el endpoint no tiene límite de uso (NFR-001). Un usuario con sesión puede ocupar los workers de gunicorn. Mitigaciones baratas: no calcular la distancia de las formas de menos de 4 caracteres (su tolerancia es 0, basta `startswith`), cortar en cuanto una palabra de la consulta no encaja con ningún término o limitar el número de palabras de la consulta. | implementer |
| F5 | MENOR | `frontend/src/features/catalog/api.ts`, `frontend/src/features/catalog/hooks.ts`, `frontend/src/features/catalog/components/CatalogResultList.tsx`, `frontend/src/features/foods/api.ts`, `frontend/src/features/diary/proposal.ts:50` | Código de producción que ya no usa ninguna pantalla, solo los tests: `searchCatalog`, `useCatalogSearch`, `CatalogResultList`, `searchFoods` y `catalogEntry`. Ya está en el backlog del planner y del implementer, y se puede diferir. | planner |
| F6 | NIT | `frontend/src/features/diary/components/PhotoReview.tsx:58` | `zodResolver(proposalFormSchema) as never` silencia el desajuste entre `ProposalFormEntry` (`key` obligatoria) y el esquema (`key` opcional). Mejor alinear los tipos (por ejemplo, `z.input`/`z.output` o un esquema con `key` obligatoria) que forzar el tipo. | implementer |
| F7 | MENOR | `frontend/src/features/diary/proposal.ts:138-141` | En la propuesta de foto, si el usuario elige un alimento propio y después lo borra de su biblioteca desde «Añadir otro alimento», la fila conserva `customFoodId`. Al guardar, toda la propuesta falla con 400 «No encontramos ese alimento.» sin indicar qué fila es. Es un caso límite, no cubierto por la spec. | spec-writer |
| F8 | NIT | `specs/028-diary-food-library/plan.md:287,329,425-428`; `docs/sdd/decisions/ADR-0036-biblioteca-de-alimentos-propios.md` | El plan sigue describiendo `ConfirmDialog` y `confirmContainer`, que la implementación sustituyó por una confirmación en línea. Conviene que la etapa docs refleje la decisión en el plan o en la ADR para que no quede documentación desfasada. | planner |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. Los AC están implementados como se especificaron, los tests
están íntegros (snapshot idéntico y cambios posteriores autorizados), la migración está incluida, revisada y probada en
`upgrade`, `downgrade` y relleno, y el aislamiento por usuario es correcto en todas las rutas nuevas y en el token de
deshacer. La confirmación en línea se acepta como desviación justificada del plan. F1, F2 y F4 conviene resolverlos
pronto, en esta feature si el usuario lo prefiere o como primeras tareas del backlog. El resto pasa al backlog del
proyecto. Antes del merge, el paso manual de la migración `e6a8c0d2f4b7` debe quedar en `docs/deploy-runbook.md`
(etapa docs, Art. P4), y la prueba manual de AC-N002.2 con lector de pantalla sigue pendiente.

## Comentarios del usuario

Vamos a corregir de F1 a F8
