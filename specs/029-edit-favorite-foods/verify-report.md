# Verify report 029 — Editar alimentos propios en el buscador de «Añadir alimento»

- **Modo:** red (tras la etapa tests, iteración 4: tests nuevos de T-046 a T-049, correcciones F2, F3 y F4 de `review.md`)
- **Fecha:** 2026-10-28T17:44:08.741Z · **Rama:** `feat/029-edit-favorite-foods` @ `45309f2` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run` sobre `CustomFoodEditForm.test.tsx`, `FoodSearchPanel.test.tsx` y `MealPhotoDialog.test.tsx` con `-t "F[234]"` (`frontend`) | ✅ | 12 tests nuevos de T-046 a T-049 ejecutados: 5 fallan por comportamiento ausente (rojo legítimo) y 7 pasan con el código actual, todos ellos excepciones aceptadas por el orquestador (ver sección 4). Los 5 tests del bloque «acciones según el error (F2, F3, F4)» de `MealPhotoDialog` son existentes y no cuentan. |
| backend | — | — | No se ejecuta: T-046 a T-049 son solo de frontend. |

Los tests existentes no se ejecutaron en este modo (alcance de la red: solo los tests nuevos). No se ejecutó lint ni typecheck, que no son comprobaciones de este modo.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-010 | AC-010.4 | T-046 | `FoodSearchPanel.test.tsx` › «un 404 al editar llama una vez a `onCustomFoodDeleted` con el id 12» | ✅ rojo legítimo (`expected "vi.fn()" to be called 1 times, but got 0 times`) |
| REQ-010 | AC-010.4 | T-046 | `FoodSearchPanel.test.tsx` › «un 409 / 400 / 500 al editar no llama a `onCustomFoodDeleted`» (3 casos) | ⚠️ pasa con el código actual (excepción 1) |
| REQ-010 | AC-010.4 | T-046 | `FoodSearchPanel.test.tsx` › «un 200 solo llama a `onCustomFoodEdited`, no a `onCustomFoodDeleted`» | ⚠️ pasa con el código actual (excepción 1) |
| REQ-011 | AC-010.4 | T-047 | `MealPhotoDialog.test.tsx` › «tras un 404 al editar, la fila pasa a «Personalizado» con sus valores anteriores y se guarda sin `custom_food_id`» | ✅ rojo legítimo (la petición lleva `custom_food_id: 12` donde se espera `name`, `per_100g`) |
| NFR-001 | AC-N001.1 | T-048 | `CustomFoodEditForm.test.tsx` › «con `isSaving` y el foco en otro elemento, al pasar a `isSaving: false` el foco vuelve a «Nombre»» | ⚠️ pasa con el código actual (excepción 3) |
| REQ-009 | AC-010.6 | T-049 | `CustomFoodEditForm.test.tsx` › «Intro con la comprobación en curso no envía y la región de estado muestra «Comprobando el nombre…»…» | ✅ rojo legítimo (la región `role="status"` está vacía) |
| REQ-009 | AC-009.1 | T-049 | `CustomFoodEditForm.test.tsx` › «con nombre repetido al terminar muestra el aviso de nombre repetido en lugar del texto de comprobación» | ✅ rojo legítimo (`expect(element).toHaveTextContent()`, la región no muestra el texto) |
| REQ-009 | AC-010.6 | T-049 | `CustomFoodEditForm.test.tsx` › «cambiar el nombre después de Intro quita el texto de comprobación» | ✅ rojo legítimo (`expect(element).toHaveTextContent()`, la región no muestra el texto) |
| REQ-009 | AC-010.6 | T-049 | `CustomFoodEditForm.test.tsx` › «Intro sin cambios no muestra el texto de comprobación» | ⚠️ pasa con el código actual (excepción 2) |
| REQ-009 | AC-010.6 | T-049 | `CustomFoodEditForm.test.tsx` › «Intro con `isSaving` no muestra el texto de comprobación» | ⚠️ pasa con el código actual (excepción 2) |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (T-046 a T-049 están marcadas `[x]`; T-071 a T-075 siguen sin hacer, como corresponde a la fase de implementación)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: — (revisado en el diff de los tres archivos de test)

## 3. Criterios de aceptación manuales
Ninguno en esta comprobación.

## 4. Fallos (si los hay)
Ningún test nuevo pasa sin implementación fuera de las excepciones aceptadas por el orquestador (nota de `state.json`, evento «note» de 2026-10-28T17:44:04). Los 7 tests que pasan con el código actual son:

| # | Qué pasa | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| E1 | Excepción 1, `FoodSearchPanel` (F2): «un 409», «un 400», «un 500» y «un 200» no llaman a `onCustomFoodDeleted` (4 tests) | Pasan. Son guardas negativas: `onCustomFoodDeleted` no se llama en ningún caso hoy. | — (excepción aceptada) |
| E2 | Excepción 2, `CustomFoodEditForm` (F4): «Intro sin cambios» e «Intro con `isSaving`» no muestran el texto de comprobación (2 tests) | Pasan. Guardas negativas: la región está vacía hoy. | — (excepción aceptada) |
| E3 | Excepción 3, `CustomFoodEditForm` (F3): «al pasar a `isSaving: false` el foco vuelve a «Nombre»» (1 test) | Pasa: el mecanismo `nameFocusTick` del panel ya da el foco. F3 elimina un duplicado sin cambio observable. | — (excepción aceptada) |

Tests con rojo legítimo (no son fallos, se listan para trazabilidad):
- `FoodSearchPanel` (F2): «un 404 al editar llama una vez a `onCustomFoodDeleted` con el id 12». Fallo: `expected "vi.fn()" to be called 1 times, but got 0 times`. Comportamiento ausente.
- `MealPhotoDialog` (F2): «tras un 404 al editar…». Fallo: `expected [ … ] to deeply equal [ … ]`; la petición de `POST /api/meals` lleva `custom_food_id: 12` donde se espera `name` y `per_100g` sin `custom_food_id`. Comportamiento ausente.
- `CustomFoodEditForm` (F4): «Intro con la comprobación en curso…», «con nombre repetido al terminar…» y «cambiar el nombre después de Intro…». Fallo: `expect(element).toHaveTextContent()`; la región `role="status"` no muestra «Comprobando el nombre…». Comportamiento ausente.

Ningún test nuevo falla por sintaxis, configuración, fixture ni imports fuera del plan.
