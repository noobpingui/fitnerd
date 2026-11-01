# Verify report 032 — Macros por 100 g en el chat de porciones y botón «Añadir alimento» precargado

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-11-01T05:52:49.750Z · **Rama:** `feat/032-diary-portion-chat-macros` @ `f91ff2a` (con cambios de la etapa tests sin commitear) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
<!-- Una fila por comando declarado en `scopes.<ámbito>.commands` de la config, solo de los ámbitos tocados.
     Los comandos a null no se ejecutan ni se listan. -->
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q tests/test_services/test_portion_estimate_rules.py tests/test_services/test_portion_estimate_service.py tests/test_routes/test_portion_estimate_routes.py` (`backend`) | ✅ (red legítimo) | 46 failed, 133 passed. Los 46 fallos son tests nuevos o modificados con rojo legítimo (`NotImplementedError: not implemented` del esqueleto, aserciones, claves ausentes en la respuesta). Ningún test nuevo pasa. |
| backend | `lint_ratchet` | — | No aplica en modo red (corresponde a verify). |
| frontend | `npx vitest run src/features/diary/schemas.test.ts src/features/diary/portionChat.test.ts src/features/diary/components/PortionChat.test.tsx src/features/diary/components/PortionAddFoodDialog.test.tsx src/features/diary/pages/DiaryPage.test.tsx` (`frontend`) | ✅ (red legítimo) | Test Files 5 failed (5); Tests 65 failed, 236 passed (301). Los 65 fallos son tests nuevos con `SDD: 032` o modificados, con rojo legítimo (`not implemented`, botón «Añadir alimento» ausente, texto «Por 100 g:» ausente, aserciones de esquema). Ningún test nuevo pasa. |
| frontend | `lint`, `typecheck`, `build` | — | No aplican en modo red (corresponden a verify). |

Entorno: Postgres de prueba disponible (los tests de rutas se ejecutan). Sin errores de entorno, por lo que el resultado no es BLOCKED.

Comprobaciones de la red:
- Ningún test nuevo falla por sintaxis, configuración, fixture o import fuera del plan. Ningún error de colección, de módulo, de compilación ni de `ReferenceError`/`SyntaxError`.
- Esqueletos `(scaffold)` de T-001 a T-006: solo lanzan `not implemented` (`portion_estimate_rules.py`: `round_to_tenth` y `parse_per_100g` lanzan `NotImplementedError("not implemented")`; `portionChat.ts` (`formatPer100gLine`, `latestEstimateAnswer`, `portionFoodFormDefaults`) y `PortionAddFoodDialog.tsx` lanzan `Error("not implemented")`). Los cambios de `types.ts`, `constants.ts`, `CustomFoodForm.tsx` y `PortionChat.tsx` solo añaden tipos, constantes o props sin usar, sin lógica. Sin incidencias.
- Ningún `skip`, `xfail`, `.only`, `.skip`, `it.todo` ni `test.todo` nuevo en el diff (`git diff` de `backend/tests` y `frontend/src`, más el archivo nuevo `PortionAddFoodDialog.test.tsx`).
- Los hallazgos 1, 2 y 3 del informe anterior están corregidos: ningún test nuevo pasa sin implementación, y `test_build_estimate_truncates_a_long_name_to_100` ahora falla por aserción (`assert None is not None`), no por `TypeError`.

## 2. Trazabilidad
Los 42 AC de `spec.md` tienen al menos un marcador `SDD: 032` en un test, y no hay marcadores sin AC en la spec. Todos los REQ y NFR tienen tarea. Los estados siguientes son los de la red: todos los tests asociados están en rojo legítimo.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1, AC-001.2, AC-001.3 | T-010, T-016 | `test_portion_estimate_rules.py` (build_estimate con name y per_100g, sin valores, sin nombre); `test_portion_estimate_routes.py::test_valid_question_returns_the_name_and_the_values_per_100g` | ❌ rojo legítimo |
| REQ-002 | AC-002.1 a AC-002.4 | T-011, T-016 | `test_portion_estimate_rules.py` (redondeo half-up, extremos, validación tras redondear, valores no válidos, no objeto); `test_portion_estimate_routes.py::test_invalid_values_per_100g_are_returned_as_null` | ❌ rojo legítimo |
| REQ-003 | AC-003.1 a AC-003.3 | T-012 | `test_portion_estimate_rules.py` (strip, truncado a 100, nombre vacío o no texto) | ❌ rojo legítimo |
| REQ-004 | AC-004.1, AC-004.2 | T-013, T-016 | `test_portion_estimate_rules.py` (not_food y gramos a 0 descartan name y values); `test_portion_estimate_routes.py::test_not_food_ignores_the_name_and_values_of_the_model`; `schemas.test.ts` | ❌ rojo legítimo |
| REQ-005 | AC-005.1 a AC-005.3 | T-018, T-020 | `PortionChat.test.tsx` («Por 100 g: …», sin línea con per_100g null, formato con coma y 0,0 g); `portionChat.test.ts` (`formatPer100gLine`) | ❌ rojo legítimo |
| REQ-006 | AC-006.1 a AC-006.5 | T-020 | `PortionChat.test.tsx` (botón «Añadir alimento» tras una estimación, oculto con conversación vacía, en curso, not_food/unknown/429/error) | ❌ rojo legítimo |
| REQ-007 | AC-007.1 a AC-007.7 | T-021, T-022 | `PortionAddFoodDialog.test.tsx` (precarga, vista previa, campos vacíos, 3000 g, valores editados); `PortionChat.test.tsx` (apertura, última estimación); `portionChat.test.ts` (`latestEstimateAnswer`, `portionFoodFormDefaults`); `DiaryPage.test.tsx` (cambio de día a medianoche con el diálogo abierto) | ❌ rojo legítimo |
| REQ-008 | AC-008.1, AC-008.2 | T-021 | `PortionAddFoodDialog.test.tsx` (campo «Comida» con cuatro opciones sin elegir; aviso al añadir sin comida) | ❌ rojo legítimo |
| REQ-009 | AC-009.1 a AC-009.4 | T-021, T-022 | `PortionAddFoodDialog.test.tsx` (una sola petición, fecha y tipo de comida, doble clic); `DiaryPage.test.tsx::guardar cierra el diálogo…` | ❌ rojo legítimo |
| REQ-010 | AC-010.1 a AC-010.3 | T-021 | `PortionAddFoodDialog.test.tsx` (400, 500, fallo de red, Cancelar, Escape); `PortionChat.test.tsx` (fallo al guardar, cancelar y Escape) | ❌ rojo legítimo |
| REQ-011 | AC-011.1, AC-011.2 | T-017, T-020 | `schemas.test.ts` (claves ausentes, valores nulos, per_100g como texto, sin fat_g, name numérico); `portionChat.test.ts`; `PortionChat.test.tsx` (backend anterior, forma inesperada) | ❌ rojo legítimo |
| NFR-001 | AC-N001.1 | T-014 | `test_portion_estimate_service.py::test_the_model_is_called_once_with_250_tokens_and_temperature_0` | ❌ rojo legítimo (`assert 150 == 250`) |
| NFR-002 | AC-N002.1 | T-015 | `test_portion_estimate_service.py::test_the_instructions_are_identical_and_the_tool_asks_for_name_and_values_per_100g` | ❌ rojo legítimo (`'name' not in` la herramienta) |
| NFR-003 | AC-N003.1, AC-N003.2 | T-020, T-021 | `PortionAddFoodDialog.test.tsx` (nombre accesible «Añadir alimento»); `PortionChat.test.tsx` (foco vuelve al botón al cancelar) | ❌ rojo legítimo |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: T-030 a T-038 (fase B, implementación pendiente; esperado en modo red).
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: —

## 3. Criterios de aceptación manuales
<!-- AC que no se pueden comprobar de forma automática (visuales, UX): se listan para que los pruebe el usuario en el gate. -->
No aplica en modo red. Se revisará en la verificación completa.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno: todos los tests nuevos fallan por comportamiento ausente. | — | — |

Observaciones (no bloquean el rojo legítimo):
- Tres tests existentes de `test_portion_estimate_routes.py` (`test_valid_question_returns_the_exact_estimation`, `test_not_food_question_returns_the_fixed_message`, `test_invalid_grams_return_unknown`) ahora esperan las claves `name` y `per_100g` en la respuesta, y fallan por esa ausencia. Es un cambio de contrato de REQ-001 y REQ-004, no un debilitamiento. Conviene que el orquestador confirme que el cambio está cubierto por la spec.
- `test_valid_question_returns_the_name_and_the_values_per_100g` y `test_invalid_values_per_100g_are_returned_as_null` fallan con `KeyError: 'name'` al leer la respuesta. Es ausencia de clave en la respuesta, rojo legítimo.

## 5. Revisión de la red por tests
- Backend: 46 fallos, todos legítimos. 8 son `NotImplementedError: not implemented` de los esqueletos `round_to_tenth` y `parse_per_100g`; el resto son aserciones (`assert None is not None`, `assert None == 'Huevo'`, `assert 150 == 250`, `'name' in` la herramienta) o claves ausentes en la respuesta.
- Frontend: 65 fallos, todos legítimos. 33 son `not implemented` de los esqueletos; 18 son el botón «Añadir alimento» ausente; el resto son textos ausentes («Por 100 g: …») o aserciones de esquema (`expected true to be false` en `rechaza …`).
