# Review 032 — Macros por 100 g en el chat de porciones y botón «Añadir alimento» precargado

- **Iteración:** 1 de 5
- **Diff revisado:** `git diff main...feat/032-diary-portion-chat-macros` @ `2d51faf` (+ cambios sin commitear: solo `backlog.md`, `state.json` y `verify-report.md` de la feature)
- **Veredicto:** APPROVED

## 1. Resumen
El backend amplía la herramienta forzada `report_portion` con `name` y `per_100g`, valida los valores por 100 g con
los rangos de `meal_rules` tras redondear half-up y sube el máximo de tokens a 250; la ruta serializa siempre las
siete claves. El frontend acepta las claves nuevas en zod, muestra «Por 100 g: …», añade el botón «Añadir alimento»
junto a «Preguntar» y un diálogo nuevo que reutiliza `CustomFoodForm` y `useAddMealItems`. El cambio es pequeño,
sigue el plan casi literalmente y reutiliza utilidades existentes. No encuentro defectos funcionales.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `backend/services/portion_estimate_rules.py:186-187`, `backend/routes/meal_routes.py:71-76`; `test_valid_question_returns_the_name_and_the_values_per_100g` |
| AC-001.2, AC-001.3 | Sí | `portion_estimate_rules.py:186-187` (nombre y valores independientes); tests de reglas AC-001.2/001.3 |
| AC-002.1 | Sí | `round_to_tenth` en `portion_estimate_rules.py:102-104` (`Decimal(repr())` + `ROUND_HALF_UP`) |
| AC-002.2 | Sí | `portion_estimate_rules.py:119-125` (comparaciones inclusivas) |
| AC-002.3 | Sí | `is_number` rechaza bool, None, texto, infinitos y enteros enormes; rangos y suma con `Decimal` en `:119-127`; `InvalidOperation` capturado en `:115-118`; test de ruta `test_invalid_values_per_100g_are_returned_as_null` |
| AC-002.4 | Sí | `portion_estimate_rules.py:108-109` (`isinstance(value, dict)`) |
| AC-003.1 a AC-003.3 | Sí | `clean_text(..., MAX_NAME_CHARS)` en `:186`; `clean_text` en `:162-166` hace strip, recorte y rstrip |
| AC-004.1, AC-004.2 | Sí | `not_food_estimate`/`unknown_estimate` (`:191`, `:195`) dejan los campos en `None` por defecto; `test_not_food_ignores_the_name_and_values_of_the_model` |
| AC-005.1 a AC-005.3 | Sí | `frontend/src/features/diary/components/PortionChat.tsx:22` y `portionChat.ts:29-31` (reutiliza `formatPortionPreview`) |
| AC-006.1 a AC-006.5 | Sí | `portionChat.ts:33-36` (solo el último turno, `estimate`, no en curso); `PortionChat.tsx:133-147` (botón justo antes de «Preguntar») |
| AC-007.1 a AC-007.3 | Sí | `portionChat.ts:38-48` (`gramsText` da «143», «12,6»; vacío sin `per100g`); `CustomFoodForm.tsx:58-61` |
| AC-007.4 | Sí | gramos precargados tal cual; `customFoodFormSchema` sin cambios rechaza 3000 |
| AC-007.5 | Sí | `latestEstimateAnswer` + copia en `setAdding({ ...latest })`, `PortionChat.tsx:138` |
| AC-007.6 | Sí | el payload sale de `customItemPayload(submitted)` del formulario editado |
| AC-007.7 | Sí | `DiaryPage.tsx:18-19` y aviso `onDialogOpenChange` en `PortionChat.tsx:50-59` |
| AC-008.1, AC-008.2 | Sí | radios en orden de `MEAL_SECTIONS`, ninguno marcado, `PortionAddFoodDialog.tsx:74-105`; `onSubmitAttempt` en `CustomFoodForm.tsx:94-100` bloquea el envío y deja salir a la vez los errores de campo |
| AC-009.1, AC-009.2 | Sí | `PortionAddFoodDialog.tsx:45-53` (`date` de la página, `meal_type` elegido, `items: [item]`) |
| AC-009.3 | Sí | la conversación vive en `usePortionChat()` en `DiaryPage`; `diary.isPending` no vuelve a `true` al invalidar, así que `PortionChat` no se desmonta al guardar |
| AC-009.4 | Sí | guarda de `add.isPending` en `save` y en `CustomFoodForm.handleSubmit`; botón «Guardando…» |
| AC-010.1, AC-010.2 | Sí | `PortionAddFoodDialog.tsx:68-72` (`saveErrorMessage`, igual que `AddFoodDialog`); el diálogo no se cierra si `mutateAsync` lanza |
| AC-010.3 | Sí | «Cancelar» (`:121`) y Escape (`:59`) llaman a `onClose` sin enviar |
| AC-011.1, AC-011.2 | Sí | `schemas.ts:288-289` (`.nullable().default(null)`, forma estricta del `per100g` existente) |
| AC-N001.1 | Sí | `MAX_OUTPUT_TOKENS = 250`, `portion_estimate_rules.py:21` |
| AC-N002.1 | Sí | `SYSTEM_PROMPT` constante ampliado (`:73-77`) y `PORTION_TOOL` (`:47-57`) |
| AC-N003.1, AC-N003.2 | Sí | `DialogTitle` en `PortionAddFoodDialog.tsx:64`; foco explícito en `PortionChat.tsx:61-64` |

## 3. Cumplimiento del plan
- Sin desviaciones relevantes: firmas, constantes, textos y estructura coinciden con el plan §3.2–§3.3.
- `save` añade una guarda `mealType === null` además de `add.isPending`. Es redundante con `onSubmitAttempt`, pero
  defensiva y correcta.
- `portion_estimate_service.py` no se tocó, como preveía el plan; la traza sigue con cinco claves (fuera de alcance).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: los tests no cambiaron durante implement (`snapshot --check` idéntico; `git diff 0b38379 HEAD` no toca ningún archivo de test). Ver F1 sobre la forma en que el test-author escribió los archivos.
- [x] B4: los marcadores `SDD: 032 …` corresponden a los AC que prueban (revisados en reglas, ruta, servicio, diálogo, chat y página).
- [x] B5: no hay tests borrados ni saltados; los tests de la 030 modificados solo añaden `name`/`per_100g` o cambian 150 → 250 por el nuevo contrato (REQ-001, REQ-004, NFR-001), sin debilitarse; sin llamadas reales; esqueletos sustituidos.
- [x] B5.7: verify registra lint, ratchet y `tsc -b` limpios; los 4 archivos de test del frontend tocados pasan (209 tests, re-ejecutados en esta review).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: marcadores con número de spec; fakes a mano en el backend y `vi.mock` de `api.ts` en el frontend; nombres en inglés (pytest) y español (vitest).
- [x] P2 backend: la validación vive en `services/`; la ruta solo serializa; reutiliza `meal_rules`, `is_number` y `clean_text`. Sin cambios de modelo, así que no hace falta migración (P2.4 comprobado).
- [x] P2 frontend: organización por feature; HTTP por `api.ts`/`apiFetch`; formulario con react-hook-form y zod (`customFoodFormSchema`); estado de servidor con `useAddMealItems`. El campo «Comida» es estado local justificado en el plan §7.
- [x] P2.General.1: textos nuevos en español con tildes, sin voseo.
- [x] P3: el endpoint mantiene `@require_auth` y rate limit; la salida del modelo se valida en el servicio y con zod; `POST /api/meals` revalida en el servidor.
- [x] P4: sin migración ni pasos manuales en producción.
- [x] P5.1: todos los archivos del diff están en LF en el índice (`git ls-files --eol`: `i/lf`). La observación del verify-report sobre «archivos comprometidos con CRLF» no es correcta: el CRLF solo está en la copia de trabajo de 4 archivos de test (ver F2).
- [x] P5.2/P5.3: no se tocan ADR ni `backend/scripts/data/**`.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `backend/tests/test_services/test_portion_estimate_rules.py:1`, `specs/032-diary-portion-chat-macros/tasks.md` | Según el backlog, el test-author escribió archivos de test con scripts de Python desde Bash y marcó casillas de `tasks.md` con `sed`. Los archivos están dentro de su rol y el contenido es correcto, pero el Art. B2.4 prohíbe modificar archivos desde la shell. Proceso, no defecto del código: conviene que el test-author use solo Write/Edit en adelante. | test-author |
| F2 | NIT | `backend/tests/test_services/test_portion_estimate_rules.py`, `frontend/src/features/diary/components/PortionChat.test.tsx`, `frontend/src/features/diary/portionChat.test.ts`, `frontend/src/features/diary/schemas.test.ts` | Estos 4 archivos están en CRLF en la copia de trabajo (`w/crlf`) aunque en el índice están en LF; es probable que sea un efecto de los scripts de F1. No afecta al commit, pero sí puede afectar a hashes y diffs locales. Basta con volver a escribirlos en LF, o con un checkout del orquestador. | test-author |
| F3 | NIT | `frontend/src/features/diary/components/CustomFoodForm.tsx` (`maxLength={CUSTOM_NAME_MAX_LENGTH}`) | El backend recorta `name` a 100 puntos de código y el formulario cuenta unidades UTF-16: un nombre con emojis o caracteres fuera del BMP cerca del límite se precarga, pero zod lo rechazaría al guardar. Es un caso marginal, porque el usuario puede editarlo. | implementer |
| F4 | NIT | `backend/services/portion_estimate_rules.py:152-159` | Deuda previa de la 030, ya anotada por el planner: `parse_grams` no captura `InvalidOperation`. `is_number` acepta un entero finito como `10**30`, y `quantize` lanzaría la excepción, con lo que la respuesta sería 500 en vez de `unknown`. `parse_per_100g` sí lo captura. Queda fuera del alcance de la 032. | implementer |

## 6. Decisión
APPROVED: no hay hallazgos BLOQUEANTES ni MAYORES. Todos los AC están implementados tal como se especificaron, el
plan se siguió, los tests no cambiaron tras la etapa `tests` y se cumple la constitución en el código. F1 a F4 pueden
pasar al backlog. Antes del cierre sigue siendo recomendable la revisión visual en el navegador que propone el verify
(posición del botón, AC-006.2, y el diálogo en móvil).
