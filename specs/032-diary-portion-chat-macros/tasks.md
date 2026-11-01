# Tareas 032 — Valores por 100 g en el chat de porciones y «Añadir alimento» precargado

- **Plan:** [plan.md](plan.md) (aprobado el 2026-11-01)

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-001 [REQ-001, REQ-002] (scaffold) Crear en `portion_estimate_rules.py` el dataclass `PortionPer100g`, los campos `name` y `per_100g` (por defecto `None`) de `PortionEstimate`, y `round_to_tenth(value)` y `parse_per_100g(value)` con la firma del plan que lancen `NotImplementedError("not implemented")` — `backend/services/portion_estimate_rules.py`
- [x] T-002 [REQ-005, REQ-011] (scaffold) Añadir a `types.ts` `PortionPer100g`, las claves opcionales `name`/`per_100g` en `PortionEstimate`, `name`/`per100g` opcionales en la rama `estimate` de `PortionChatAnswer` y el tipo `PortionEstimateAnswer` — `frontend/src/features/diary/types.ts`
- [x] T-003 [REQ-005, REQ-006, REQ-007] (scaffold) Crear `formatPer100gLine(_per100g)`, `latestEstimateAnswer(_turns)` y `portionFoodFormDefaults(_answer)` que lancen `Error("not implemented")` — `frontend/src/features/diary/portionChat.ts`
- [x] T-004 [REQ-007, REQ-008] (scaffold) Añadir las constantes `PORTION_ADD_FOOD_TITLE`, `PORTION_ADD_FOOD_DESCRIPTION` y `PORTION_MEAL_REQUIRED_MESSAGE` con los textos del plan — `frontend/src/features/diary/constants.ts`
- [x] T-005 [REQ-007, REQ-008, REQ-009, NFR-003] (scaffold) Crear `PortionAddFoodDialog({ answer, date, onClose })` que lance `Error("not implemented")`, con parámetros prefijados con `_` — `frontend/src/features/diary/components/PortionAddFoodDialog.tsx`
- [x] T-006 [REQ-006, REQ-009] (scaffold) Ampliar las props de `PortionChat` con `date: string` y `onDialogOpenChange?` sin usarlas, y las props opcionales `defaultNutrients` y `onSubmitAttempt` de `CustomFoodForm` sin usarlas — `frontend/src/features/diary/components/PortionChat.tsx`, `frontend/src/features/diary/components/CustomFoodForm.tsx`

## Fase A — Tests (test-author)
- [x] T-010 [REQ-001, AC-001.1, AC-001.2, AC-001.3] (test) `build_estimate` incluye `name` y `per_100g` en una estimación completa, sin ellos, y con solo uno de los dos — `backend/tests/test_services/test_portion_estimate_rules.py`
- [x] T-011 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4] (test) Redondeo half-up a un decimal, extremos válidos, casos inválidos parametrizados (rangos, tipos, falta de clave, suma > 100, no objeto, entero gigantesco) con `per_100g` `None` y el resto de la estimación intacto — `backend/tests/test_services/test_portion_estimate_rules.py`
- [x] T-012 [REQ-003, AC-003.1, AC-003.2, AC-003.3] (test) Limpieza del nombre: espacios, recorte a 100 sin espacio final, y `""`, `"   "`, `5`, `None` dan `None` — `backend/tests/test_services/test_portion_estimate_rules.py`
- [x] T-013 [REQ-004, AC-004.1, AC-004.2] (test) `not_food` y 0 gramos con nombre y valores dan `name` y `per_100g` `None` — `backend/tests/test_services/test_portion_estimate_rules.py`
- [x] T-014 [NFR-001, AC-N001.1] (test) Una sola llamada al modelo con `max_tokens` 250 (actualiza el test de la 030 de 150 tokens) — `backend/tests/test_services/test_portion_estimate_service.py`
- [x] T-015 [NFR-002, AC-N002.1] (test) Instrucciones idénticas en dos preguntas y herramienta con `name` y `per_100g` con sus cuatro claves — `backend/tests/test_services/test_portion_estimate_service.py`
- [x] T-016 [REQ-001, REQ-002, REQ-004, AC-001.1, AC-004.1, AC-002.3] (test) Ruta: JSON exacto de siete claves en `estimated` y `not_food`, `per_100g` `null` ante valores inválidos, y actualización de los JSON exactos de la 030 con `name` y `per_100g` `None` — `backend/tests/test_routes/test_portion_estimate_routes.py`
- [x] T-017 [REQ-011, AC-011.1, AC-011.2] (test) El esquema zod rellena `null` si faltan las claves, acepta la respuesta completa y lanza ante `per_100g` `"143"`, sin `fat_g` o `name` 5 — `frontend/src/features/diary/schemas.test.ts`
- [x] T-018 [REQ-005, REQ-006, REQ-007, AC-005.1, AC-005.3, AC-006.1, AC-006.3, AC-006.4, AC-006.5, AC-007.1, AC-007.3, AC-007.5] (test) Lógica pura: `formatPer100gLine`, `latestEstimateAnswer`, `portionFoodFormDefaults` y `portionAnswerFromEstimate` con las claves nuevas — `frontend/src/features/diary/portionChat.test.ts`
- [x] T-019 [REQ-005, REQ-006, REQ-011] (test) Ampliar los fixtures con `EGGS_ESTIMATE_WITH_PER_100G` y `makePortionEstimate` con `name`/`per_100g` — `frontend/src/test/portionEstimateFixtures.ts`
- [x] T-020 [REQ-005, REQ-006, REQ-007, REQ-010, REQ-011, NFR-003, AC-005.1, AC-005.2, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-007.1, AC-007.5, AC-010.3, AC-011.1, AC-011.2, AC-N003.2] (test) Chat: línea «Por 100 g», botón «Añadir alimento» justo antes de «Preguntar», apertura del diálogo con la última estimación, cancelar/Escape y foco de vuelta; adapta el arnés con `date` — `frontend/src/features/diary/components/PortionChat.test.tsx`
- [x] T-021 [REQ-007, REQ-008, REQ-009, REQ-010, NFR-003, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.6, AC-008.1, AC-008.2, AC-009.1, AC-009.2, AC-009.4, AC-010.1, AC-010.2, AC-010.3, AC-N003.1] (test) Diálogo: precarga, comida obligatoria, payload de `POST /api/meals`, doble clic, errores 400/500, cancelar y rol `dialog` — `frontend/src/features/diary/components/PortionAddFoodDialog.test.tsx`
- [x] T-022 [REQ-007, REQ-009, AC-007.7, AC-009.2, AC-009.3] (test) Página: guardar cierra el diálogo, muestra el alimento y conserva la conversación; fecha de `?date=`; «hoy» no cambia con el diálogo abierto — `frontend/src/features/diary/pages/DiaryPage.test.tsx`

## Fase B — Implementación (implementer)
- [ ] T-030 [REQ-002] (impl) Implementar `round_to_tenth` y `parse_per_100g` con los rangos de `meal_rules` validados tras redondear — `backend/services/portion_estimate_rules.py`
- [ ] T-031 [REQ-001, REQ-003, REQ-004, NFR-001, NFR-002] (impl) `PORTION_TOOL` con `name` y `per_100g`, `SYSTEM_PROMPT` ampliado, `MAX_OUTPUT_TOKENS = 250` y `build_estimate` que rellena nombre y valores solo en `estimated` — `backend/services/portion_estimate_rules.py`
- [ ] T-032 [REQ-001, REQ-004] (impl) `_serialize_portion_estimate` devuelve siempre `name` y `per_100g` — `backend/routes/meal_routes.py`
- [ ] T-033 [REQ-011] (impl) `portionEstimateResponseSchema` con `name` y `per_100g` (`.nullable().default(null)`) — `frontend/src/features/diary/schemas.ts`
- [ ] T-034 [REQ-005, REQ-006, REQ-007] (impl) Implementar `portionAnswerFromEstimate` con las claves nuevas, `formatPer100gLine`, `latestEstimateAnswer` y `portionFoodFormDefaults` — `frontend/src/features/diary/portionChat.ts`
- [ ] T-035 [REQ-007, REQ-008] (impl) `CustomFoodForm` con `defaultNutrients` y `onSubmitAttempt` antes de la validación — `frontend/src/features/diary/components/CustomFoodForm.tsx`
- [ ] T-036 [REQ-007, REQ-008, REQ-009, REQ-010, NFR-003] (impl) Implementar `PortionAddFoodDialog` con radios «Comida», guardado con `useAddMealItems(date)`, errores y cierre — `frontend/src/features/diary/components/PortionAddFoodDialog.tsx`
- [ ] T-037 [REQ-005, REQ-006, REQ-007, NFR-003] (impl) `PortionChat` con línea «Por 100 g», botón «Añadir alimento», diálogo con copia de la respuesta, foco de vuelta y aviso `onDialogOpenChange` — `frontend/src/features/diary/components/PortionChat.tsx`
- [ ] T-038 [REQ-007, REQ-009] (impl) `DiaryPage` pasa `date` y `onDialogOpenChange` al chat y pausa `useToday` con el diálogo abierto — `frontend/src/features/diary/pages/DiaryPage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1, AC-001.2, AC-001.3 | T-010, T-016 | T-031, T-032 |
| REQ-002 | AC-002.1, AC-002.2, AC-002.3, AC-002.4 | T-011, T-016 | T-030 |
| REQ-003 | AC-003.1, AC-003.2, AC-003.3 | T-012 | T-031 |
| REQ-004 | AC-004.1, AC-004.2 | T-013, T-016 | T-031, T-032 |
| REQ-005 | AC-005.1, AC-005.2, AC-005.3 | T-018, T-020 | T-034, T-037 |
| REQ-006 | AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5 | T-018, T-020 | T-034, T-037 |
| REQ-007 | AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-007.6, AC-007.7 | T-018, T-020, T-021, T-022 | T-034, T-035, T-036, T-037, T-038 |
| REQ-008 | AC-008.1, AC-008.2 | T-021 | T-035, T-036 |
| REQ-009 | AC-009.1, AC-009.2, AC-009.3, AC-009.4 | T-021, T-022 | T-036, T-038 |
| REQ-010 | AC-010.1, AC-010.2, AC-010.3 | T-020, T-021 | T-036 |
| REQ-011 | AC-011.1, AC-011.2 | T-017, T-020 | T-033 |
| NFR-001 | AC-N001.1 | T-014 | T-031 |
| NFR-002 | AC-N002.1 | T-015 | T-031 |
| NFR-003 | AC-N003.1, AC-N003.2 | T-020, T-021 | T-036, T-037 |
