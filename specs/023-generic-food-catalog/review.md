# Review 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Iteración:** 1 de 4
- **Diff revisado:** `git diff main...feat/023-generic-food-catalog` @ `e7792b5` (+ `state.json` y `verify-report.md` sin commitear, solo artefactos del flujo)
- **Veredicto:** CHANGES_REQUESTED

## 1. Resumen
El cambio añade la tabla `catalog_foods`, su carga desde `backend/scripts/data/food_catalog.csv` (265 alimentos), la
búsqueda por texto `GET /api/catalog/search` y el origen `catalog` en `meal_items`. En el frontend, el diálogo del
diario busca en el catálogo, `/foods` redirige a `/diary` y se actualizan los textos legales. El código está bien
estructurado, respeta las capas y coincide con el plan, y la migración coincide con los modelos. Comprobé, con una
consulta de solo lectura a la base de desarrollo, que los 264 FDC ID de las filas `usda` existen y que sus cuatro valores
son exactamente los de `public.foods`. Lo que impide aprobar está en el contenido del CSV: la única fila `manual`
(`yuca-cocida`) sale de FNDDS, que la spec deja fuera de alcance, y todo indica que lleva grasa añadida. Hay además
varias desviaciones menores de las reglas de contenido que debe decidir el usuario.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 (AC-001.1 a 001.4) | Parcial | Las reglas automáticas se cumplen: `services/catalog_csv_reader.py:186-258` y `tests/test_services/test_food_catalog_csv.py`. Las reglas de contenido 1 a 3 de la sección 6 no se cumplen del todo (F1 a F6). |
| REQ-002 (AC-002.1 a 002.6) | Sí | `services/catalog_load_service.py:296-326` (una sola transacción y `rollback`); `scripts/load_food_catalog.py:59-62` (confirmación antes de construir el servicio); `scripts/database_target.py:6-16` |
| REQ-003 (AC-003.1 a 003.8) | Sí | `catalog_csv_reader.py:188-201` (archivo y columnas), `:102-144` (valores y origen), `:147-183` (unicidad); `catalog_load_service.py:328-353` (igualdad con USDA, 3.57 frente a 3.6) |
| REQ-004 (AC-004.1 a 004.16) | Sí | `services/catalog_rules.py:23-49` (`fold`, `words`, `word_forms`); `services/catalog_search_service.py:64-109` (coincidencia, grupos, orden y límite de 20) |
| REQ-005 (AC-005.1 a 005.4) | Sí | `catalog_search_service.py:118` reutiliza `normalize_query`; `routes/catalog_routes.py:29-33` con `@require_auth` |
| REQ-006 (AC-006.1 a 006.6) | Sí | `services/meal_rules.py:132-158` (una sola clave y mensaje nuevo); `services/meal_service.py:144-156` y `:242-252` (copia de nombre y valores; 400 sin guardar nada) |
| REQ-007 (AC-007.1, 007.2) | Sí | `models/meal.py:73-74`: `catalog_id` sin FK; `update_item_grams` recalcula con los `per_100g_*` guardados |
| REQ-008 (AC-008.1, 008.2) | Sí | `routes/meal_routes.py:41` (`catalog_id`); las `CHECK` nuevas admiten las filas existentes (migración, `:22-29`) |
| REQ-009 (AC-009.1 a 009.7) | Sí | `frontend/src/features/diary/components/AddFoodDialog.tsx:105` (descripción), `:120` (ejemplo), `:170` (payload `catalog_id`); `features/catalog/components/CatalogResultList.tsx` |
| REQ-010 (AC-010.1 a 010.3) | Sí | `features/diary/format.ts:49-52`; `components/MealItemRow.tsx:17-23` |
| REQ-011 (AC-011.1, 011.2) | Sí | `frontend/src/app/router.tsx:172` (`<Navigate to="/diary" replace />` dentro de `AppLayout`) |
| REQ-012 (AC-012.1 a 012.3) | Parcial | Los textos y las fechas están en `TermsOfServicePage.tsx:5,33-34` y `PrivacyPolicyPage.tsx:5,85-86`. Pero la frase «se añadieron a mano a partir de otras tablas de composición» no es cierta mientras la única fila `manual` venga de una base de USDA (FNDDS). Ver F1. |
| NFR-001 (AC-N001.1, N001.2) | Sí | `CatalogSearchService` solo recibe el repositorio; sin Voyage, sin Redis y sin límite de uso |
| NFR-002 (AC-N002.1, N002.2) | Sí | `CatalogResultList.tsx:14,29` (lista «Resultados» y botones «Elegir {nombre}»); `AddFoodDialog.tsx:123` (región `role="status"`) |

## 3. Cumplimiento del plan
- No hay desviaciones de diseño: los archivos, las firmas, los mensajes y la migración coinciden con `plan.md`.
- `import_usda_foods.py` conserva `_LOCAL_HOSTS`, `_is_local` y `_confirm` como alias de `database_target`, como decía el plan.
- El plan exigía que las filas `manual` tuvieran «una `reference` concreta y comprobable» y que no se inventaran valores. La
  fila `yuca-cocida` tiene una referencia comprobable, pero es de FNDDS, una base fuera de alcance, y su propia
  descripción dice «con o sin grasa» (F1).
- Cambio en `.sdd/config.json`, decidido por el usuario: el CSV sale del ámbito `prod` del ratchet y `max_iterations`
  pasa a 4. Está registrado en el `history`. Para el orquestador: `state.json` sigue mostrando `"max_iterations": 3`.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` da idéntico (26 archivos). El commit de implement (`d9459f3`) no toca tests. Los únicos cambios en tests después de `e0b0f5b` son los reflujos de línea de `e7792b5`, autorizados (`rework tests` y `snapshot` en `history`).
- [x] B4: los marcadores `# SDD: 023 …` y `// SDD: 023 …` corresponden a los AC que prueban. Hay mezclas 022/023 en `test_post_validation_message_and_nothing_saved` (`test_meal_routes.py:498-503`), pero están justificadas porque el mensaje de AC-006.4 sustituye al de la 022.
- [x] B5: no hay tests borrados, saltados ni debilitados. Ningún test llama a servicios externos. No quedan esqueletos `not implemented`.
- [x] B5.7: el ratchet de ruff no da violaciones nuevas y `npm run lint` y `tsc -b` no dan errores (verify-report).
- [x] B6.5: no hay secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1.1/P1.2: marcadores con número de spec; nombres de test en inglés en el backend y en español en el frontend; docstrings en español.
- [x] P1.3: dobles escritos a mano (`FakeCatalogFoodRepository`). El uso de `monkeypatch` en el test del script está justificado en `plan.md` §5.
- [x] P2.1/P2.2: capas respetadas y dependencias por constructor (`_build_catalog_search_service`, `_build_meal_service`). Solo `UnitOfWork` hace commit o rollback (`catalog_load_service.py:322-324`).
- [x] P2.3: los 400 salen por `ValidationError` y `error_handlers`. `CatalogFileError` queda fuera de `custom_exceptions` con la justificación del plan (§7).
- [x] **P2.4, revisión manual de la migración `d4f6a8c0e2b5`:**
  - `catalog_foods` coincide columna a columna con `models/catalog_food.py`: tipos, `ARRAY(Text)` con `server_default '{}'`, nulabilidad y las 6 `CHECK` con el mismo texto y nombre.
  - `meal_items.catalog_id` es `VARCHAR(60) NULL`, sin FK.
  - Las dos `CHECK` de `meal_items` se sustituyen a mano con el mismo texto que el modelo (`models/meal.py:96-111`), y los nombres originales existen en `b3d5f7a9c1e4`.
  - `down_revision` apunta a la cabeza anterior y no hay ramas.
  - El `downgrade` se niega sin tocar nada si hay filas `catalog` y no interpola valores.
  - La base de desarrollo está en `d4f6a8c0e2b5`, con 265 filas cargadas.
- [x] P2.5: reutiliza `normalize_query`, `FoodRepository.get_by_fdc_ids`, `validate_grams` y la confirmación extraída a `database_target.py`.
- [x] P2 frontend: feature `catalog` con `api.ts`, `hooks.ts`, `types.ts`, `schemas.ts` y `components/`; HTTP solo por `apiFetch`; TanStack Query.
- [ ] P2 General: los textos visibles van en español correcto, pero hay nombres del catálogo que no son español neutro (F5) y una palabra en portugués (F8).
- [x] P3.1: `@require_auth` en la búsqueda; las comidas siguen filtrando por el usuario del token.
- [x] P3.2: entradas validadas en el servicio y con zod.
- [x] P3.3: no aplica, la búsqueda no llama a proveedores de IA.
- [x] P3.4: ORM y SQL fijo en el `downgrade`.
- [x] P3.5: sin variables nuevas.
- [ ] P4: la migración está incluida y revisada. Los pasos de producción (migración antes del merge y carga tras el CD) quedan para el `doc-keeper` en `docs/deploy-runbook.md`.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MAYOR | `backend/scripts/data/food_catalog.csv:37` | La única fila `manual`, `yuca-cocida`, toma sus valores de **FNDDS** («Cassava, cooked», FDC ID 2709564), que la spec deja fuera de alcance de forma explícita (§3 «Fuera de alcance: … FNDDS»). La propia `reference` dice «con o sin grasa», y los valores lo confirman: 3,03 g de grasa y 191 kcal por 100 g. La yuca cruda de SR Legacy («Cassava, raw», FDC ID 169985) tiene 0,28 g de grasa y 160 kcal, y hervida debería tener menos calorías, porque absorbe agua. Eso incumple la regla de contenido 3 («nada preparado con aceite»). Además, la frase nueva de Términos de servicio («a partir de otras tablas de composición», REQ-012) no describe esta fila, que sale de una base de USDA. Como «Yuca cocida» está en la lista mínima (AC-001.4), la fila no se puede quitar. Hay que sustituir los valores por los de una fuente verificable de yuca hervida sin grasa (por ejemplo, la tabla del INCAP con su código) y poner esa fuente en `reference`. Si no hay una fuente verificable, hay que consultarlo con el usuario (Art. B3.1, datos) en lugar de inventar valores. | implementer |
| F2 | MENOR | `food_catalog.csv:166-167`, `:192-193`, `:24` y `:218` | Hay alimentos con dos versiones, contra la regla 3 («una sola versión por alimento»): «Zanahoria» y «Zanahoria cocida»; «Champiñones» y «Champiñones cocidos»; «Frijoles blancos cocidos» y «Frijoles navy cocidos» (navy es una variedad de frijol blanco). Hay que dejar una versión de cada uno o que el usuario apruebe la excepción de forma explícita. | implementer |
| F3 | MENOR | `food_catalog.csv:15`, `:105` | Hay sinónimos con marcas comerciales, y las marcas están fuera de alcance (§3): «pan bimbo» (Bimbo) en «Pan blanco» y «queso filadelfia» (Philadelphia) en «Queso crema». Hay que quitarlos. | implementer |
| F4 | MENOR | `food_catalog.csv:46`, `:265` | Hay sinónimos que corresponden a otro alimento. «contramuslo de pollo» es el muslo (thigh) y en el CSV está en «Pierna de pollo cocida», que es el drumstick (USDA 331897); debe ir en «Muslo de pollo al horno» (`:45`). «limonada sin azúcar» está en «Jugo de limón» (USDA 167747, «Lemon juice, raw»), pero la limonada es jugo diluido en agua (una combinación, regla 1) y quien la registre recibirá las calorías del jugo puro. Hay que quitarlo. | implementer |
| F5 | MENOR | `food_catalog.csv:183`, `:218`, `:186` | Hay nombres principales que no son español neutro (regla 2). «Vainicas cocidas» es un regionalismo de Costa Rica que debería ser sinónimo de un nombre más general («Ejotes cocidos» o «Judías verdes cocidas»). «Frijoles navy cocidos» y «Calabaza butternut al horno» usan palabras en inglés; hay alternativas en español, como «Calabaza moscada al horno». | implementer |
| F6 | MENOR | `food_catalog.csv:77`, `:75`, `:211` | Hay nombres que no corresponden al alimento de USDA del que salen los valores. «Merluza al horno» es «Fish, pollock, Alaska» (abadejo, no merluza). «Róbalo al horno» es «Fish, bass, striped» (lubina estriada, no róbalo). «Polenta cocida» es «corn grits, white» (sémola de maíz blanco). Los valores son parecidos, pero el nombre engaña. Hay que cambiar el nombre al del alimento real (y dejar el otro como sinónimo, si se acepta) o que lo apruebe el usuario. | implementer |
| F7 | NIT | `food_catalog.csv:119-120` | En Costa Rica, México y Centroamérica, «limón» es la lima verde, y en Costa Rica «lima» es la lima dulce. Con el CSV actual, «limón» da primero el limón amarillo (lemon). La diferencia nutricional es mínima (29 frente a 30 kcal), pero conviene que el usuario lo revise. | implementer |
| F8 | NIT | `food_catalog.csv:74`, `:154`, `:157`, `:158`, `:151` | Sinónimos dudosos, revisados como pedía el backlog. «lampuga» es correcto (Coryphaena en España). «dolfín» no lo puedo verificar y se confunde con «delfín»: conviene quitarlo o cambiarlo por «perico» (Perú). «pinha» es portugués. «tuna» es correcto en México, pero quien escriba «tuna» buscando atún (inglés) encontrará la fruta del nopal. «fruta del pan jaca» mezcla la jaca con la fruta del pan (otra fruta). «zapote» para mamey es correcto en Costa Rica (*Pouteria sapota*), aunque en México es ambiguo. «anona» coincide con el alimento de USDA (sugar-apple). | implementer |
| F9 | NIT | `food_catalog.csv:195`, `:34` | Hay alimentos crudos que normalmente se comen cocidos (regla 3): «Puerro» (USDA crudo) y «Tempeh» (USDA 174272, sin cocinar). | implementer |
| F10 | NIT | `frontend/src/features/diary/types.ts:34` | Falta un espacio: `export type UsdaItemPayload ={ … }`. | implementer |
| F11 | NIT | `backend/migrations/versions/d4f6a8c0e2b5_create_catalog_foods_and_catalog_meal_items.py:95` | El mensaje no concuerda en singular: «Hay 1 alimentos del catálogo…». Si se cambia, hay que actualizar `DOWNGRADE_MESSAGE` en `test_catalog_migration.py`, que ahora espera ese texto. | implementer |
| F12 | NIT | `frontend/src/app/diaryRoute.test.tsx:2` | El comentario de cabecera sigue diciendo que «`/foods` sigue mostrando "Alimentos"», ya falso tras REQ-011 (ya anotado en el backlog de tests). | test-author |

## 6. Decisión
**CHANGES_REQUESTED.** El código de backend y de frontend, la migración y los tests están listos. Falta corregir el
hallazgo MAYOR F1 (la fila `yuca-cocida` sale de FNDDS, fuera de alcance, y tiene grasa añadida) antes de aprobar. Los
hallazgos MENORES F2 a F6 son de contenido del CSV, que la spec deja a la revisión del usuario (Q10): el `implementer`
puede corregirlos en la misma pasada, o el usuario puede aceptarlos de forma explícita en el gate de `review`.

## Comentarios del usuario
