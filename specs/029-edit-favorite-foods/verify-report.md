# Verify report 029 — Editar alimentos propios en el buscador de «Añadir alimento»

- **Modo:** red (tras la etapa tests, corrección R1-R2 de `review.md`, iteración 3 de tests: T-076 y T-077)
- **Fecha:** 2026-10-28T18:33:04.767Z · **Rama:** `feat/029-edit-favorite-foods` @ `9ed91d6` (con los tests de T-076 y T-077 sin commitear) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Alcance: solo los tests nuevos de T-076 y T-077 (archivo `frontend/src/features/diary/components/CustomFoodEditForm.test.tsx`). El resto de tests de la feature pasó el red check anterior y no se vuelve a ejecutar.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run src/features/diary/components/CustomFoodEditForm.test.tsx` (`frontend`) | ⚠️ 2 rojos legítimos esperados, 2 guardas aceptadas que pasan | 38 tests en el archivo: 36 pasan y 2 fallan. Los dos fallos son el caso sin error de T-076 y T-077. Los dos casos con `serverError` y `nameTakenKey` de T-076 pasan (guardas aceptadas, ver sección 4). |

No se ejecutan lint ni ratchet, typecheck ni build: en modo red no se piden.

<!--
Modo red: solo se ejecutan los tests nuevos (los que llevan el marcador SDD:). PASS significa que TODOS fallan
por comportamiento ausente, no por errores de sintaxis, configuración, fixture o imports fuera del plan.
-->

## 2. Trazabilidad
Solo las filas de los tests de esta corrección. Las demás filas de la feature se comprobaron en el red check anterior y en verify.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| NFR-001 | AC-N001.1 | T-076 | `CustomFoodEditForm.test.tsx` :: «de `isSaving` a no sin `serverError` ni `nameTakenKey` el foco sigue en «Calorías»» | Rojo legítimo (aserción: el foco pasa a «Nombre» con el código actual) |
| NFR-001 | AC-N001.1 | T-076 | `CustomFoodEditForm.test.tsx` :: «de `isSaving` a no con `serverError` el foco va a «Nombre»» | Pasa hoy: guarda de regresión aceptada por el orquestador |
| NFR-001 | AC-N001.1 | T-076 | `CustomFoodEditForm.test.tsx` :: «de `isSaving` a no con `nameTakenKey` (409) el foco va a «Nombre»» | Pasa hoy: guarda de regresión aceptada por el orquestador |
| REQ-009 | AC-010.6 | T-077 | `CustomFoodEditForm.test.tsx` :: «volver al mismo nombre con la comprobación en curso no muestra el texto antiguo ni envía» | Rojo legítimo (aserción: «Comprobando el nombre…» sigue visible tras volver al mismo nombre) |

- AC sin test: — (en esta corrección, AC-N001.1 y AC-010.6 tienen al menos un test nuevo cada uno)
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (T-076 y T-077 están marcadas `[x]`; T-078 y T-079 son de implementación y no entran en esta etapa)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: — (revisado en el diff del archivo de test: ninguno)

## 3. Criterios de aceptación manuales
Ninguno en esta corrección. AC-N001.1 y AC-010.6 se comprueban con tests automáticos.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno. Los dos tests en rojo son rojos legítimos esperados y no cuentan como fallo de la etapa | — | — |

Clasificación de los tests nuevos:
- **Rojo legítimo (aserción fallida, comportamiento ausente):**
  - T-076, caso «sin `serverError` ni `nameTakenKey`»: el foco va a «Nombre» tras `isSaving` a `false`, cuando el plan pide que siga en «Calorías». El código actual tiene el efecto `wasSaving` que R1 quita.
  - T-077: tras escribir « 2» y borrarlo, «Comprobando el nombre…» sigue visible, porque `checkingNoticeFor` no se limpia en `onChange` (R2, apartado b).
- **Guardas aceptadas que pasan hoy (excepciones del orquestador, ver `state.json` → `history`, evento `note` de 18:32:43):**
  - T-076, caso «con `serverError`»: el foco va a «Nombre». Es regresión de comportamiento existente y no puede estar en rojo.
  - T-076, caso «con `nameTakenKey`»: igual que el anterior.
- **Rojo ilegítimo:** ninguno. El archivo carga, el import `UPDATE_CUSTOM_FOOD_FAILED_MESSAGE` desde `../errors` resuelve, no hay errores de sintaxis ni de fixture, y los 36 tests restantes del archivo pasan.

Nota para el orquestador: el `tests_snapshot` de `state.json` (hash de `CustomFoodEditForm.test.tsx`) quedó desactualizado por diseño al cambiar este archivo en T-076 y T-077. Hay que refrescarlo al aceptar este red check.

Notas (no son fallos): ninguna adicional.
