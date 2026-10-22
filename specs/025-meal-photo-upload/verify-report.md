# Verify report 025 — Registro de una comida con foto desde el diario

- **Modo:** red (tras la etapa tests, corrección N1 a N3 de la 2.ª review)
- **Fecha:** 2026-10-22T19:21:43.478Z · **Rama:** `feat/025-meal-photo-upload` @ `3e4a4a0` (con cambios sin commitear en `MealPhotoDialog.test.tsx`) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run src/features/diary/components/MealPhotoDialog.test.tsx` (`frontend`) | ❌ solo en el test nuevo de N1 (rojo esperado) | 91 tests: 90 pasan, 1 falla. El fallo es `AssertionError: expected [ 'blob:preview-2' ] to include 'blob:preview-1'` (aserción; la primera vista previa no se libera) |
| frontend | `npm test` (`frontend`) | ❌ solo el test nuevo de N1 | 81 archivos; 1241 tests pasan y 1 falla (el de N1). Los 1241 existentes siguen en verde |

Comprobaciones de tests nuevos (modo red):
- Tests nuevos en el diff de esta corrección: 1 (`si se eligen dos fotos seguidas…`, `// SDD: 025 NFR-001 AC-N001.2`, en `MealPhotoDialog.test.tsx`). Falla por aserción sobre la URL de vista previa, que es comportamiento ausente, rojo legítimo.
- El test de N2 (`si se cierra el diálogo mientras se comprueba la foto…`) ya existía en el commit `5bd5877`. Su cambio solo añade `expect.hasAssertions()` y dos aserciones (`revoked.length` igual a `created.length`); no quita ninguna línea del original. No cuenta como test nuevo. Pasa, y no se ha debilitado.
- Esqueletos `(scaffold)`: sin cambios en esta corrección; no se han revisado de nuevo.
- `skip`, `xfail`, `.only`, `.skip` o `it.todo` nuevos: ninguno en el diff.

## 2. Trazabilidad
Alcance de esta comprobación: solo el AC que cubre el test nuevo. El resto de la trazabilidad de la 025 no cambia, porque esta corrección no añade ni quita otros tests ni tareas.

| REQ / NFR | AC | Tareas | Tests con `SDD:` (archivo) | Estado del test |
|---|---|---|---|---|
| NFR-001 | AC-N001.2 | T-025 | `MealPhotoDialog.test.tsx` (test «si se eligen dos fotos seguidas…») | ❌ rojo legítimo (aserción) |

- AC sin test: — (en esta comprobación no se ha reverificado la cobertura de los 61 AC; el verify full se repetirá)
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (no se ha revisado en esta etapa)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: —

Nota sobre el snapshot de tests: `MealPhotoDialog.test.tsx` cambió en esta corrección (N1 y N2), así que su hash ya no coincide con el registrado en `tests_snapshot` de `state.json`. Hay que refrescar el snapshot tras el commit de tests. Los demás archivos de test de la feature coinciden con su snapshot en el blob de `HEAD`.

## 3. Criterios de aceptación manuales
Sin cambios respecto al verify full anterior. Estos AC dependen del navegador real y los prueba el usuario antes del cierre:
- **AC-001.3:** en una pantalla de 375 px, el diálogo ocupa todo el ancho y alto; en 1024 px, es un diálogo centrado.
- **AC-002.1:** los dos selectores no admiten varios archivos, aceptan JPEG, PNG, WebP, HEIC y HEIF, y «Hacer una foto» pide la cámara trasera en un móvil.
- **AC-003.3:** una foto HEIC real, en un navegador que no la lee, muestra «No se pudo leer la foto. Prueba con otra foto en JPEG, PNG o WebP.».
- **AC-004.3:** una foto JPEG con orientación EXIF 6 se envía derecha (1200 × 1600 px), como en la vista previa.
- **AC-004.4:** una foto HEIC que el navegador sabe leer (Safari) se envía como JPEG.
- **N3 (memoria, manual):** liberar la caché de decodificación tras `toJpeg` depende de la memoria del navegador; no se prueba en jsdom.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno bloqueante. El único test nuevo (N1) falla por aserción, que es el rojo esperado antes de la corrección del implementer | `expected [ 'blob:preview-2' ] to include 'blob:preview-1'` | — (rojo esperado; la corrección la hace el implementer) |

Observaciones no bloqueantes:
- Las comprobaciones de lint, tipos, build y backend no se ejecutan en modo red y se repetirán en el verify full.
