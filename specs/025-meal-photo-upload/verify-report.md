# Verify report 025 — Registro de una comida con foto desde el diario

- **Modo:** full (etapa verify, tras la corrección N1 a N3 de la 2.ª review)
- **Fecha:** 2026-10-22T19:26:44.414Z · **Rama:** `feat/025-meal-photo-upload` @ `356157f` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npm test` (`frontend`) | ✅ | 81 archivos, 1242/1242 tests en verde en la segunda ejecución. En la primera hubo 2 timeouts de 5 s (`router.test.tsx` y `lazyRoutes.test.tsx`, ruta `/body-metrics`) con la suite cargada (87 s); ambos archivos pasan al ejecutarlos solos (26/26) y en la repetición completa. ⚠️ Posible flakiness de tiempo, ver backlog |
| frontend | `npm run lint` (`frontend`) | ✅ | 0 errores. 1 warning: `src/features/diary/components/PhotoReview.tsx:57` (`react(incompatible-library)`, por el uso de `useFieldArray` con React Compiler; admitido por P2.5) |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto; chunk de entrada `index` 384,63 kB (≤ 500 kB, NFR-003); `DiaryPage` y `BodyMetricsPage` en chunks propios |
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 2000 passed (sin cambios de backend en la feature, ver Q8) |
| backend | ratchet ruff (`lint-ratchet.mjs backend`) | ✅ | Sin archivos del ámbito cambiados respecto a `main`; 0 violaciones nuevas |

Comprobaciones de tests nuevos (modo full, suite completa):
- Los 61 AC tienen al menos un test con marcador `SDD: 025` y pasan en la suite.
- El test de N1 (`si se eligen dos fotos seguidas mientras se comprueba la primera, la URL de vista previa de la primera se libera`, `MealPhotoDialog.test.tsx`, marcador `NFR-001 AC-N001.2`) pasa.
- Ningún `skip`, `xfail`, `.only`, `.skip`, `it.todo` ni equivalente nuevo en el diff (`main...HEAD` y worktree).

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` (archivos) | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1, AC-001.2, AC-001.3, AC-001.4 | T-019, T-026 | `MealPhotoDialog.test.tsx`, `DiaryPage.test.tsx` | ✅ |
| REQ-002 | AC-002.1, AC-002.2, AC-002.3 | T-019 | `MealPhotoDialog.test.tsx` | ✅ (AC-002.1 también manual) |
| REQ-003 | AC-003.1, AC-003.2, AC-003.3, AC-003.4 | T-012, T-020 | `photo.test.ts`, `MealPhotoDialog.test.tsx` | ✅ (AC-003.3 también manual) |
| REQ-004 | AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5 | T-010, T-013, T-018, T-020 | `apiClient.test.ts`, `photo.test.ts`, `api.test.ts`, `MealPhotoDialog.test.tsx` | ✅ (AC-004.3 y AC-004.4 también manual) |
| REQ-005 | AC-005.1, AC-005.2 | T-021, T-026 | `MealPhotoDialog.test.tsx`, `DiaryPage.test.tsx` | ✅ |
| REQ-006 | AC-006.1 a AC-006.5 | T-014, T-016, T-022 | `proposal.test.ts`, `schemas.test.ts`, `MealPhotoDialog.test.tsx` | ✅ |
| REQ-007 | AC-007.1, AC-007.2, AC-007.3 | T-014, T-015, T-016, T-022, T-024 | `proposal.test.ts`, `schemas.test.ts`, `MealPhotoDialog.test.tsx` | ✅ |
| REQ-008 | AC-008.1, AC-008.2 | T-014, T-022 | `proposal.test.ts`, `MealPhotoDialog.test.tsx` | ✅ |
| REQ-009 | AC-009.1 a AC-009.4 | T-015, T-023 | `proposal.test.ts`, `MealPhotoDialog.test.tsx` | ✅ |
| REQ-010 | AC-010.1 a AC-010.5 | T-014, T-023 | `proposal.test.ts`, `MealPhotoDialog.test.tsx` | ✅ |
| REQ-011 | AC-011.1 a AC-011.6 | T-015, T-024, T-026 | `proposal.test.ts`, `MealPhotoDialog.test.tsx`, `DiaryPage.test.tsx` | ✅ |
| REQ-012 | AC-012.1 a AC-012.8 | T-017, T-021, T-026 | `errors.test.ts`, `MealPhotoDialog.test.tsx`, `DiaryPage.test.tsx` | ✅ |
| REQ-013 | AC-013.1, AC-013.2 | T-024, T-026 | `MealPhotoDialog.test.tsx`, `DiaryPage.test.tsx` | ✅ |
| REQ-014 | AC-014.1, AC-014.2, AC-014.3 | T-027 | `PrivacyPolicyPage.test.tsx` | ✅ |
| NFR-001 | AC-N001.1, AC-N001.2 | T-015, T-025 | `proposal.test.ts`, `MealPhotoDialog.test.tsx` | ✅ |
| NFR-002 | AC-N002.1, AC-N002.2 | T-025 | `MealPhotoDialog.test.tsx` | ✅ |
| NFR-003 | AC-N003.1 | T-028 | `mealPhotoRoute.test.tsx` | ✅ |

- AC sin test: ninguno (61/61 AC con marcador `SDD: 025` en `frontend/src`).
- REQ/NFR sin tarea: ninguno (14 REQ y 3 NFR referenciados en `tasks.md`).
- Tareas sin marcar `[x]`: ninguna (40/40).
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno.

## 3. Criterios de aceptación manuales
<!-- AC que no se pueden comprobar de forma automática (visuales, UX): se listan para que los pruebe el usuario en el gate. -->
- **AC-001.3:** en una pantalla de 375 px, el diálogo ocupa todo el ancho y alto; en 1024 px, es un diálogo centrado.
- **AC-002.1:** los dos selectores no admiten varios archivos, aceptan JPEG, PNG, WebP, HEIC y HEIF, y «Hacer una foto» pide la cámara trasera en un móvil.
- **AC-003.3:** una foto HEIC real, en un navegador que no la lee, muestra «No se pudo leer la foto. Prueba con otra foto en JPEG, PNG o WebP.».
- **AC-004.3:** una foto JPEG con orientación EXIF 6 se envía derecha (1200 × 1600 px), como en la vista previa.
- **AC-004.4:** una foto HEIC que el navegador sabe leer (Safari) se envía como JPEG.
- **N3 (memoria, no AC):** liberar la caché de decodificación tras `toJpeg` depende de la memoria del navegador; no se prueba en jsdom.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno bloqueante | — | — |
| F-1 (no bloqueante, ⚠️) | En la primera ejecución de `npm test` con la suite cargada, 2 tests de rutas superaron el timeout de 5 s | `Error: Test timed out in 5000ms.` en `src/app/router.test.tsx` (`/body-metrics`) y `src/app/lazyRoutes.test.tsx` (`/body-metrics`) | entorno (carga de la máquina; no reproducible: pasan solos 26/26 y en la segunda suite completa 1242/1242) |
