# Verify report 022 — Diario de comidas con totales del día frente al objetivo de Macros

- **Modo:** full (etapa verify)
- **Fecha:** 2026-10-20T20:29:40.784Z · **Rama:** `feat/022-meal-diary` @ `ad914df` · **Base:** `main`
- **Resultado:** FAIL

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 1487 passed, 0 failed (94,5 s) |
| backend | ratchet: `node …/lint-ratchet.mjs backend` (raíz del repo) | ❌ | 3 violaciones E501 nuevas (base 0) en `backend/tests/test_services/test_meal_service.py`: L49 (101 > 100), L605 (105 > 100), L765 (102 > 100). Resto de archivos de la feature: OK. |
| backend | `typecheck` / `build` | — | `null` en la config; no se ejecutan |
| frontend | `npm test` (`frontend`) | ✅ | 73 archivos, 1004 passed, 0 failed |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores (exit 0) |
| frontend | `npx tsc -b` (`frontend`) | ✅ | sin errores (exit 0) |
| frontend | `npm run build` (`frontend`) | ✅ | build correcto; chunk de entrada `index` 384,82 kB (≤ 500 kB, ADR-0026); `DiaryPage` en chunk aparte (15,28 kB) |

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.6 | T-023, T-024, T-026, T-050, T-053, T-055, T-057 | `backend/tests/test_routes/test_meal_routes.py`, `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_meal_service.py` | ✅ |
| REQ-002 | AC-002.1 a AC-002.3 | T-022, T-023, T-026, T-052, T-053, T-055 | `backend/tests/test_routes/test_meal_routes.py`, `backend/tests/test_services/test_meal_rules.py` | ✅ |
| REQ-003 | AC-003.1 a AC-003.14 | T-021, T-022, T-024, T-027, T-051, T-052, T-055 | `backend/tests/test_routes/test_meal_routes.py`, `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_meal_service.py` | ✅ |
| REQ-004 | AC-004.1 a AC-004.3 | T-021, T-024, T-027, T-051, T-055 | `backend/tests/test_routes/test_meal_routes.py`, `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_meal_service.py` | ✅ |
| REQ-005 | AC-005.1 a AC-005.7 | T-021, T-023, T-025, T-028, T-053, T-054, T-055 | `backend/tests/test_routes/test_meal_routes.py`, `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_meal_service.py` | ✅ |
| REQ-006 | AC-006.1 a AC-006.5 | T-023, T-025, T-028, T-053, T-056, T-057 | `backend/tests/test_routes/test_meal_routes.py`, `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_meal_service.py` | ✅ |
| REQ-007 | AC-007.1 a AC-007.5 | T-025, T-029, T-056, T-057 | `backend/tests/test_routes/test_meal_routes.py`, `backend/tests/test_services/test_meal_service.py` | ✅ |
| REQ-008 | AC-008.1 a AC-008.3 | T-025, T-029, T-050, T-055, T-056 | `backend/tests/test_routes/test_meal_routes.py`, `backend/tests/test_services/test_meal_service.py` | ✅ |
| REQ-009 | AC-009.1 a AC-009.6 | T-025, T-030, T-054, T-056, T-057 | `backend/tests/test_routes/test_meal_routes.py`, `backend/tests/test_services/test_meal_rules.py`, `backend/tests/test_services/test_meal_service.py` | ✅ |
| REQ-010 | AC-010.1 a AC-010.6 | T-033, T-036, T-061, T-064 a T-068 | `frontend/src/features/diary/format.test.ts`, `frontend/src/features/diary/pages/DiaryPage.test.tsx` | ✅ |
| REQ-011 | AC-011.1 a AC-011.10 | T-032, T-034, T-035, T-038, T-039, T-060 a T-065, T-069, T-070, T-072 | `frontend/src/features/diary/components/AddFoodDialog.test.tsx`, `frontend/src/features/diary/errors.test.ts`, `frontend/src/features/diary/format.test.ts`, `frontend/src/features/diary/nutrition.test.ts`, `frontend/src/features/diary/pages/DiaryPage.test.tsx`, `frontend/src/features/diary/schemas.test.ts` | ✅ |
| REQ-012 | AC-012.1 a AC-012.6 | T-032, T-034, T-038, T-040, T-063, T-069, T-071, T-072 | `frontend/src/features/diary/components/AddFoodDialog.test.tsx`, `frontend/src/features/diary/format.test.ts`, `frontend/src/features/diary/nutrition.test.ts`, `frontend/src/features/diary/pages/DiaryPage.test.tsx`, `frontend/src/features/diary/schemas.test.ts` | ✅ |
| REQ-013 | AC-013.1 a AC-013.6 | T-035, T-038, T-041, T-062, T-063, T-065, T-067, T-073 | `frontend/src/features/diary/components/EditGramsDialog.test.tsx`, `frontend/src/features/diary/pages/DiaryPage.test.tsx` | ✅ |
| REQ-014 | AC-014.1 a AC-014.6 | T-032, T-037, T-038, T-060, T-065, T-066, T-068 | `frontend/src/features/diary/nutrition.test.ts`, `frontend/src/features/diary/pages/DiaryPage.test.tsx` | ✅ |
| REQ-015 | AC-015.1 a AC-015.4 | T-042 a T-044, T-074, T-075 | `frontend/src/app/diaryRoute.test.tsx`, `frontend/src/components/layout/BottomTabBar.test.tsx`, `frontend/src/components/layout/Navbar.test.tsx` | ✅ |
| REQ-016 | AC-016.1, AC-016.2 | T-045, T-046, T-076 | `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`, `frontend/src/features/legal/pages/TermsOfServicePage.test.tsx` | ✅ |
| NFR-001 | AC-N001.1 | T-044, T-075 | `frontend/src/app/diaryRoute.test.tsx` | ✅ |
| NFR-002 | AC-N002.1 a AC-N002.3 | T-036, T-037, T-039, T-066, T-068, T-072 | `frontend/src/features/diary/components/AddFoodDialog.test.tsx`, `frontend/src/features/diary/pages/DiaryPage.test.tsx` | ✅ |

- AC definidos en `spec.md`: 96. AC con marcador `SDD: 022` en algún test: 96. AC sin test: —
- REQ / NFR sin tarea en `tasks.md`: —
- Tareas sin marcar `[x]`: — (65 de 65 marcadas)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff (`git diff main...HEAD`, tests): —
- Tests sin cambios desde el red check: sí. Los 17 archivos de test coinciden con el `tests_snapshot` de `state.json` (sha256 tras normalizar fin de línea CRLF, que git aplica en el árbol de trabajo de Windows).
- Nota: el número «86 AC» que figura en `spec.md` (sección 7 y estado de la fase spec) no coincide con los 96 AC definidos. No bloquea la verificación.

## 3. Criterios de aceptación manuales
Comprobados en jsdom, pero su aspecto final depende de la maquetación y no lo verifica ningún test automático. El usuario los revisará en el navegador:
- **AC-014.2:** la barra de calorías se ve llena al superar el objetivo.
- **AC-015.2:** la barra inferior del móvil, con 6 entradas, cabe y se ve bien en pantalla estrecha.
- **AC-015.3:** la entrada «Diario» se ve activa de forma visual en `/diary` (estado de la navegación).

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | Ratchet de lint del backend: 3 violaciones E501 nuevas (no existían en `main`) | `NUEVO backend/tests/test_services/test_meal_service.py E501 +3 (base 0 -> ahora 3)`; `L49: Line too long (101 > 100)`, `L605: Line too long (105 > 100)`, `L765: Line too long (102 > 100)` | test-author (el archivo lo escribió el test-author; el `sha256` del archivo coincide con el snapshot del red check, así que el implementer no lo modificó) |

Los tests de backend y frontend pasan todos. El fallo es solo de lint en un archivo de tests, según Art. B5.7.
