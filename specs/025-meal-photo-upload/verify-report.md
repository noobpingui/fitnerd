# Verify report 025 — Registro de una comida con foto desde el diario

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-22T18:25:46.701Z · **Rama:** `feat/025-meal-photo-upload` @ `562e568` (con cambios de tests sin commit) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Modo red: solo los tests nuevos de la feature (10 archivos con marcador `SDD: 025`), con `commands.test_files` del ámbito `frontend`. Ámbito `backend` (en `state.json.scope`, sin archivos de la feature en `changed`): sin archivos de test nuevos y sin código tocado; no se ejecuta en red.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run <10 archivos de test nuevos>` (`frontend`) | ✅ en cuanto a rojo | 279 tests: 187 fallidos, 92 pasados. Los 92 pasados son tests existentes (comprobados contra `HEAD`); ningún test nuevo pasa. |
| frontend | `npm run lint`, `npx tsc -b`, `npm run build` | — | No se ejecutan en modo red. |
| backend | — | — | Sin tests nuevos ni archivos tocados; no se ejecuta en red. |

Archivos de test nuevos ejecutados: `src/app/mealPhotoRoute.test.tsx`, `src/lib/apiClient.test.ts`, `src/features/diary/schemas.test.ts`, `src/features/legal/pages/PrivacyPolicyPage.test.tsx`, `src/features/diary/api.test.ts`, `src/features/diary/pages/DiaryPage.test.tsx`, `src/features/diary/proposal.test.ts`, `src/features/diary/errors.test.ts`, `src/features/diary/photo.test.ts`, `src/features/diary/components/MealPhotoDialog.test.tsx`.

Clasificación de los 187 fallos (todos legítimos):
- Esqueletos de la fase A0 que lanzan `not implemented`: 300 apariciones en la salida, de los tests de `photo.ts`, `proposal.ts`, `errors.ts`, `schemas.ts`, `api.ts`, `hooks.ts` y `MealPhotoDialog.tsx`.
- Elementos de UI inexistentes (`Unable to find role="button"`, «Cargar imagen en Cena», etc.).
- Aserciones sobre comportamiento ausente (`AssertionError`).
- Ningún error de import, sintaxis, configuración, fixture ni tipos (`Cannot find module`, `SyntaxError`, `TypeError`, `is not a function`: 0 apariciones).

Verificación de los esqueletos (Art. B5.6): `photo.ts`, `proposal.ts`, `errors.ts` (`analysisErrorView`), `api.ts` (`analyzeMealPhoto`), `hooks.ts` (`useAnalyzeMealPhoto`), `schemas.ts` (`mealPhotoAnalysisSchema`, `proposalFormSchema`) y `MealPhotoDialog.tsx` solo lanzan `not implemented`, sin lógica ni valores de retorno. Las constantes, los tipos y las clases de error vacías son los del plan.

Comprobación de los tests que pasaban (F4, F5 y F6 de la iteración 2): los tres se han quitado. Ahora la suite nueva tiene 279 tests frente a 282 y, de los 92 que pasan, cada título figura en la versión de `HEAD` del mismo archivo (o es un `it.each` existente), así que son tests previos.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| todos | 61 AC de la spec (REQ-001 a REQ-014, NFR-001 a NFR-003) | — | 61 de 61 con marcador `SDD: 025` | ✅ Cada AC tiene al menos un test nuevo y ninguno pasa |
| REQ-004 | AC-004.1 | T-010, T-018 | `frontend/src/lib/apiClient.test.ts` (3 tests de FormData), `frontend/src/features/diary/api.test.ts` | ✅ en rojo (3 de `apiClient`, 2 de `api`) |
| REQ-014 | AC-014.3 | T-027 | `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx::la última actualización es la del 22 de octubre de 2026` | ✅ en rojo |
| NFR-003 | AC-N003.1 | T-028 | `frontend/src/app/mealPhotoRoute.test.tsx::el código del diálogo viaja con la pantalla «Diario»` | ✅ en rojo |

- AC sin test: — (comprobado: los 61 AC de `spec.md` aparecen en al menos un marcador `SDD: 025`)
- REQ sin tarea: no se comprueba en modo red (es de `full`).
- Tareas sin marcar `[x]`: no se comprueba en modo red (es de `full`). Las tareas T-001 a T-028 están marcadas.
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: ninguno.
- Tests existentes modificados: `PrivacyPolicyPage.test.tsx` sustituye «la última actualización es la del 21 de octubre de 2026» por la del 22 de octubre (exigido por AC-014.3, actualiza el test de la 023 AC-012.3). `errors.test.ts` quita la importación de `SAVE_FAILED_MESSAGE` sin borrar ningún test existente. `schemas.test.ts` solo añade líneas. Ningún otro test existente se borra ni se debilita.

## 3. Criterios de aceptación manuales
Los AC que dependen del navegador real se prueban en jsdom con el doble `FakePhotoProcessor`. Hay que comprobarlos a mano en `verify` o `review`:
- AC-001.3: diálogo a pantalla completa a 375 px y centrado a 1024 px.
- AC-002.1: el selector de «Hacer una foto» pide la cámara trasera (`capture="environment"`); en escritorio abre el selector de archivos.
- AC-003.3: una foto HEIC en un navegador que no la lee muestra el mensaje de no leer la foto.
- AC-004.3: la orientación EXIF 6 sale derecha en la imagen enviada, como en la vista previa.
- AC-004.4: una foto HEIC que el navegador sí lee se envía como JPEG.

## 4. Fallos (si los hay)
Ninguno en modo red. Las iteraciones anteriores tenían F1 a F6; F1, F2 y F3 se resolvieron en la iteración 2 y F4, F5 y F6 se resolvieron en la iteración 3 al quitar los tests que pasaban sin implementación.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | ninguno | — | — |

Nota de estado: `state.json.scope` lista `backend` (Q8 lo quita en la spec, pero `sdd-state` no permite quitarlo); la feature no toca ningún archivo de backend ni tiene tests nuevos en él.
