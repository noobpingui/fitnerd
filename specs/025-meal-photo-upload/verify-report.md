# Verify report 025 — Registro de una comida con foto desde el diario

- **Modo:** red (tras la etapa tests, vuelta de corrección de la review, F1 a F4)
- **Fecha:** 2026-10-22T19:06:20.915Z · **Rama:** `feat/025-meal-photo-upload` @ `fcf9f0a` (con cambios de tests sin commit en `MealPhotoDialog.test.tsx`) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Modo red: se ejecutan los 7 tests nuevos de la corrección (marcadores `SDD: 025` de F1 a F4, en `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`) con `commands.test_files` del ámbito `frontend`. Además, como comprobación de regresión, se ejecuta la suite completa del ámbito (`commands.test`) para confirmar que los tests existentes siguen en verde. Ámbito `backend`: sin archivos tocados en esta vuelta; no se ejecuta en red.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run src/features/diary/components/MealPhotoDialog.test.tsx` (`frontend`) | ✅ en cuanto a rojo | 90 tests: 7 fallidos (los 7 nuevos), 83 pasados (existentes) |
| frontend | `npm test` (`frontend`), regresión | ✅ en cuanto a verde de los existentes | 1241 tests: 1234 pasados, 7 fallidos (exactamente los 7 nuevos). Ningún test existente falla |
| frontend | `npm run lint`, `npx tsc -b`, `npm run build` | — | No se ejecutan en modo red |
| backend | — | — | Sin archivos tocados en esta vuelta; no se ejecuta en red |

Clasificación de los 7 fallos (todos legítimos, comportamiento ausente, ninguno de sintaxis, configuración, fixture o import):
- F1 «si se cierra el diálogo mientras se prepara el JPEG, la foto no se envía al analizar»: `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times` (la foto sí se envía tras cerrar).
- F1 «si se cierra el diálogo mientras se comprueba la foto, la URL de vista previa no queda sin liberar»: `AssertionError: expected [] to include 'blob:preview-1'` (la URL no se revoca).
- F2 «ante un 429 no se ofrece «Cambiar foto»» y «ante un 503 no se ofrece «Cambiar foto»» (`it.each`): `expected document not to contain element`, el botón «Cambiar foto» sí aparece.
- F2 «ante un fallo de red no se ofrece «Cambiar foto»»: mismo fallo, el botón aparece.
- F3 «con el error de 3 MB no se muestra «Analizar foto» y sí «Cambiar foto»»: el botón «Analizar foto» sigue visible con el error de 3 MB.
- F4 «la región de estado ya existe antes de analizar y es la misma que anuncia «Analizando la foto…»»: `TestingLibraryElementError: Unable to find an accessible element with the role "status"` (no hay región persistente antes de analizar).

Los 83 tests del archivo que pasan son existentes y siguen en verde. En la suite completa, los 1234 tests existentes pasan. No hay `skip`, `xfail`, `.only`, `.skip` ni `it.todo` nuevos en el diff de `frontend/src`.

## 2. Trazabilidad
Solo se comprueban los AC que llevan los 7 tests nuevos de la corrección. La trazabilidad completa de la feature (61 AC) ya se comprobó en la etapa de tests y en `verify`.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-005 | AC-005.2 | T-042 (impl) | `MealPhotoDialog.test.tsx::si se cierra el diálogo mientras se prepara el JPEG, la foto no se envía al analizar` | ❌ rojo legítimo |
| NFR-001 | AC-N001.2 | T-042 (impl) | `MealPhotoDialog.test.tsx::si se cierra el diálogo mientras se comprueba la foto, la URL de vista previa no queda sin liberar` | ❌ rojo legítimo |
| REQ-012 | AC-012.3 | T-032, T-042 | `MealPhotoDialog.test.tsx::ante un 429 no se ofrece «Cambiar foto»` y `::ante un 503 no se ofrece «Cambiar foto»` | ❌ rojo legítimo |
| REQ-012 | AC-012.4 | T-032, T-042 | `MealPhotoDialog.test.tsx::ante un fallo de red no se ofrece «Cambiar foto»` | ❌ rojo legítimo |
| REQ-004 | AC-004.5 | T-034, T-042 | `MealPhotoDialog.test.tsx::con el error de 3 MB no se muestra «Analizar foto» y sí «Cambiar foto»` | ❌ rojo legítimo |
| NFR-002 | AC-N002.2 | T-042 | `MealPhotoDialog.test.tsx::la región de estado ya existe antes de analizar y es la misma que anuncia «Analizando la foto…»` | ❌ rojo legítimo |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: —
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: —

Nota: el snapshot de `state.json.tests_snapshot` (18:53) no recoge la edición de `MealPhotoDialog.test.tsx` de esta vuelta; el orquestador debe registrarla antes de la etapa de implementación.

## 3. Criterios de aceptación manuales
Sin cambios respecto a la verificación completa: AC-001.3, AC-002.1, AC-003.3, AC-004.3 y AC-004.4 requieren comprobación manual en navegador real.

## 4. Fallos (si los hay)
Ninguno. Los 7 fallos de los tests nuevos son rojo legítimo (comportamiento ausente).
