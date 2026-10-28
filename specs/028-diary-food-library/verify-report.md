# Verify report 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Modo:** full (etapa verify, iteración 2)
- **Fecha:** 2026-10-27T23:05:47.913Z · **Rama:** `feat/028-diary-food-library` @ `9c8e7fd` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 2580 passed, 0 failed (145,75 s) |
| backend | ratchet de ruff: `lint-ratchet.mjs backend` (raíz del repo) | ✅ | Sin violaciones nuevas respecto a main (exit 0) |
| frontend | `npm test` (`frontend`) | ✅ | 87 archivos, 1562 passed, 0 failed |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores ni avisos (exit 0) |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores de tipos (exit 0) |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto; chunk de entrada `index` 384,64 kB (límite 500 kB, ADR-0026) |

- Sin tests marcados como flaky en esta ejecución: la suite completa del frontend (87 archivos) y la del backend pasaron a la primera.
- Integridad de los tests: `sdd-state snapshot --check` → `identical: true`, sin archivos cambiados, añadidos ni ausentes respecto al snapshot de la etapa tests (22:58:12Z).

## 2. Trazabilidad
La columna «Tests con SDD» cuenta las líneas con marcador `SDD: 028` que citan el ID (un test puede citar varios IDs). Todas las tareas que citan el REQ/NFR están marcadas `[x]` (106 de 106).

| REQ / NFR | AC | Tareas | Marcadores `SDD:` | Estado |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.10 | T-001, T-003, T-004, T-005, T-008, T-030, T-031, T-037, T-046, T-047, T-050, T-063, T-100, T-101, T-103, T-106, T-109 | 33 | ✅ |
| REQ-002 | AC-002.1 a AC-002.3 | T-001, T-037, T-047, T-103, T-106 | 9 | ✅ |
| REQ-003 | AC-003.1 a AC-003.5 | T-001, T-004, T-007, T-008, T-031, T-038, T-040, T-048, T-063, T-101, T-105, T-106, T-109 | 26 | ✅ |
| REQ-004 | AC-004.1 a AC-004.4 | T-001, T-004, T-005, T-009, T-021, T-030, T-036, T-044, T-061, T-100, T-101, T-103, T-108, T-110, T-120 | 14 | ✅ |
| REQ-005 | AC-005.1 a AC-005.3 | T-041, T-100 | 10 | ✅ |
| REQ-006 | AC-006.1 a AC-006.12 | T-002, T-032, T-042, T-049, T-102 | 37 | ✅ |
| REQ-007 | AC-007.1 a AC-007.7 | T-001, T-002, T-009, T-020, T-021, T-033, T-034, T-042, T-061, T-101, T-102, T-108, T-110, T-120 | 34 | ✅ |
| REQ-008 | AC-008.1 a AC-008.8 | T-006, T-009, T-030, T-035, T-043, T-104, T-108, T-110 | 22 | ✅ |
| REQ-009 (it. 2) | AC-009.1 a AC-009.8 | T-001, T-003, T-005, T-009, T-021, T-030, T-036, T-044, T-061, T-100, T-101, T-103, T-108, T-110, T-120, T-133, T-137, T-139, T-140, T-141, T-142, T-161 | 41 | ✅ |
| REQ-010 | AC-010.1 a AC-010.3 | T-009, T-035, T-043, T-103, T-108, T-110 | 10 | ✅ |
| REQ-011 | AC-011.1 | T-045, T-110 | 4 | ✅ |
| REQ-012 | AC-012.1, AC-012.2 | T-007, T-008, T-030, T-039, T-040, T-048, T-104, T-105, T-107, T-109 | 16 | ✅ |
| REQ-013 | AC-013.1 a AC-013.9 | T-022, T-023, T-060, T-064, T-067, T-068, T-073, T-121, T-125, T-127 | 46 | ✅ |
| REQ-014 | AC-014.1 a AC-014.6 | T-020, T-021, T-023, T-025, T-061, T-065, T-067, T-073, T-120, T-122, T-125, T-127 | 20 | ✅ |
| REQ-015 | AC-015.1 a AC-015.5 | T-020, T-021, T-023, T-025, T-061, T-065, T-120, T-122, T-124, T-125 | 14 | ✅ |
| REQ-016 | AC-016.1 a AC-016.3 | T-025, T-067, T-122, T-126, T-127 | 6 | ✅ |
| REQ-017 (it. 2) | AC-017.1 a AC-017.7 | T-021, T-023, T-025, T-061, T-066, T-120, T-122, T-124, T-125, T-134, T-136, T-144, T-145, T-146, T-147, T-149, T-162, T-163, T-164, T-166 | 18 | ✅ |
| REQ-018 (it. 2) | AC-018.1 a AC-018.8 | T-024, T-062, T-068, T-123, T-128, T-129, T-135, T-146, T-149, T-150, T-151, T-165, T-166 | 37 | ✅ |
| REQ-019 | AC-019.1 a AC-019.4 | T-024, T-062, T-069, T-123, T-128, T-129 | 28 | ✅ |
| REQ-020 (it. 2) | AC-020.1 | T-072, T-130, T-147, T-148, T-150, T-153, T-154, T-155, T-165, T-167, T-168 | 7 | ✅ |
| REQ-021 | AC-021.1 | T-071, T-131 | 2 | ✅ |
| NFR-001 | AC-N001.1, AC-N001.2 | T-009, T-034, T-045, T-108 | 3 | ✅ |
| NFR-002 (it. 2) | AC-N002.1 a AC-N002.5 | T-066, T-124, T-125, T-145, T-146, T-163, T-164 | 15 | ✅ (AC-N002.2, ver sección 3) |
| NFR-003 (it. 2) | AC-N003.1 | T-070, T-128, T-152, T-166 | 8 | ✅ |
| NFR-004 (it. 2) | AC-N004.1 a AC-N004.3 | T-132, T-133, T-138, T-140, T-142, T-143, T-160, T-161 | 13 | ✅ |

Iteración 2, criterios con marcador y test en verde:
- AC-009.6, AC-009.7, AC-009.8: `test_food_library_service.py` y `test_food_library_routes.py` (límite de 100 que solo cuenta favoritos visibles; `DELETE` de favoritos retirados; 404 de otro usuario).
- AC-017.5: `useEscapeCapture.test.ts`, `FoodSearchPanel.test.tsx`, `AddFoodDialog.test.tsx` (Escape cierra solo la confirmación; el segundo Escape cierra el diálogo).
- AC-017.6: `MealPhotoDialog.test.tsx` (Escape en «Añadir otro alimento» no abre la confirmación de descartar).
- AC-017.7: `FoodSearchPanel.test.tsx` (confirmación dentro del elemento de «Recientes»).
- AC-018.7: `MealPhotoDialog.test.tsx`, `proposal.test.ts`, `schemas.test.ts`, `FoodSearchPanel.test.tsx` (fila de propuesta conservada tras borrar el alimento propio).
- AC-018.8: `MealPhotoDialog.test.tsx` (400 «No encontramos ese alimento.» conserva la propuesta).
- AC-N002.3, AC-N002.4, AC-N002.5: `FoodSearchPanel.test.tsx` (foco en «Cancelar», foco de vuelta al botón «Borrar», foco en la caja tras un 204).
- AC-N004.1 a AC-N004.3: `test_catalog_search_service.py`, `test_food_library_service.py`, `test_food_library_routes.py`, `test_catalog_routes.py` (cota F × P de comparaciones; sin comparaciones en la primera búsqueda).
- REQ-020 / AC-020.1: `foodsRoute.test.tsx` (`/foods` termina en `/diary`; código retirado ausente).

Comprobaciones de la trazabilidad:
- AC sin test: ninguno. Los 121 AC definidos en `spec.md` tienen al menos un marcador `SDD: 028` y todos los tests marcados pasan. `AC-004.16` aparece en la spec solo como referencia a la 023 (sustituido por AC-006.2), no es un AC de esta feature.
- REQ/NFR sin tarea: ninguno (los 21 REQ y los 4 NFR aparecen en `tasks.md`).
- Tareas sin marcar `[x]`: ninguna (T-001 a T-168 marcadas). La línea 9 de `tasks.md` es la plantilla dentro de un comentario HTML.
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff (`git diff main...HEAD -- backend frontend`): ninguno. Las coincidencias con «skips» son nombres de tests («…skips_a_word_too_short…»), no marcadores.
- Código retirado (REQ-020): no existen `frontend/src/features/catalog/`, `features/foods/pages/`, `ProposalSearchStep.tsx`, `FoodResultList.tsx` ni `FoodSearchForm.tsx`. `features/foods/api.ts` tampoco existe.
- Migración `e6a8c0d2f4b7`: presente, con sus tests de relleno, base vacía y downgrade (`test_food_library_migration.py`, en verde).
- CRLF en los archivos cambiados: ninguno (Art. P5.1).

## 3. Criterios de aceptación manuales
- **AC-N002.2** (NFR-002): los estados «Buscando…», sin resultados, error y error de carga de tus alimentos están dentro de una región que se anuncia. Los tests comprueban la región y su atributo, pero no el anuncio real. Pendiente de revisión manual con un lector de pantalla.
- Recomendado, aunque ya está cubierto en jsdom: AC-017.7 y AC-N002.3 a AC-N002.5 (posición de la confirmación de borrado y foco tras cancelar, confirmar o fallar). Conviene una comprobación rápida en el navegador.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno | — | — |

Observaciones (no bloquean el PASS):
- `tasks.md` (T-134) escribe la firma de `useEscapeCapture` como `(active, onEscape)`. El código y el test usan `useEscapeCapture(onEscape, active)`, que es la firma que se mantiene. Corregir la descripción de la tarea en la etapa de documentación.
- El tipo `FoodSearchFormValues` sigue en `frontend/src/features/foods/schemas.ts` y lo usa el `FoodSearchPanel` compartido. No es código de la pantalla retirada, pero vive en la carpeta de la 021. Candidato a mover a `features/diary`.
- Producción: la migración `e6a8c0d2f4b7` es aditiva y no se aplica sola (Art. P4). El paso debe quedar documentado en `docs/deploy-runbook.md` durante la etapa docs.
