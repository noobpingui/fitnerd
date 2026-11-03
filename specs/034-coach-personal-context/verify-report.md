# Verify report 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Modo:** full (etapa verify)
- **Fecha:** 2026-11-03T03:54:05.769Z · **Rama:** `feat/034-coach-personal-context` @ `56b4019` · **Base:** `main`
- **Resultado:** FAIL

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 3048 passed, exit 0 |
| backend | lint_ratchet: `node …/lint-ratchet.mjs backend` (raíz del repo) | ❌ | 9 violaciones E501 nuevas (base 0) en archivos de test: `test_coach_routes.py` (6), `test_coach_personal_context.py` (1), `test_coach_service.py` (2). Los archivos de producción del ámbito cumplen (solo violaciones previas toleradas). |
| frontend | `npm test` (`frontend`) | ✅ | 97 archivos, 1946 passed, exit 0 |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores ni warnings, exit 0 |
| frontend | `npx tsc -b` (`frontend`) | ✅ | exit 0, sin errores de tipos |
| frontend | `npm run build` (`frontend`) | ✅ | build correcto, exit 0 |

Detalle del ratchet (backend, violaciones nuevas):
- `backend/tests/test_routes/test_coach_routes.py`: L565 (111 > 100), L574 (104), L591 (102), L653 (106), L678 (102), L693 (106).
- `backend/tests/test_services/test_coach_personal_context.py`: L448 (101 > 100).
- `backend/tests/test_services/test_coach_service.py`: L249 (105 > 100), L258 (102).

Nota: el implementer indicó 18 líneas E501; la medición del ratchet da 9 violaciones nuevas, todas en archivos de test (no en producción).

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD: 034` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5 | T-009, T-010, T-013, T-019, T-030 | `backend/tests/test_services/test_coach_personal_context.py`, `backend/tests/test_routes/test_coach_routes.py` | ✅ pasan |
| REQ-002 | AC-002.1, AC-002.2 | T-010, T-021, T-028, T-036 | `test_coach_personal_context.py`, `frontend/src/features/coach/personalContext.test.ts` | ✅ pasan |
| REQ-003 | AC-003.1 a AC-003.6 | T-011, T-021, T-026, T-028, T-036 | `test_coach_personal_context.py`, `personalContext.test.ts` | ✅ pasan |
| REQ-004 | AC-004.1, AC-004.2 | T-014, T-019, T-024, T-030, T-032, T-040 | `test_coach_service.py`, `test_coach_routes.py`, `frontend/src/features/coach/pages/CoachPage.personalContext.test.tsx` | ✅ pasan |
| REQ-005 | AC-005.1 a AC-005.4 | T-010, T-013, T-016, T-020, T-028, T-030, T-032 | `test_coach_personal_context.py`, `test_coach_service.py`, `test_coach_routes.py` | ✅ pasan |
| REQ-006 | AC-006.1, AC-006.2, AC-006.3 | T-009, T-010, T-020, T-024, T-026, T-027, T-034, T-040 | `test_coach_personal_context.py`, `test_coach_routes.py`, `CoachPage.personalContext.test.tsx` | ✅ pasan |
| REQ-007 | AC-007.1, AC-007.2, AC-007.3 | T-021, T-024, T-036, T-040 | `personalContext.test.ts`, `CoachPage.personalContext.test.tsx` | ✅ pasan |
| REQ-008 | AC-008.1, AC-008.2 | T-015, T-031, T-032 | `backend/tests/test_services/test_coach_service.py` | ✅ pasan |
| REQ-009 | AC-009.1 a AC-009.6 | T-017, T-031 | `test_coach_service.py` | ✅ pasan |
| REQ-010 | AC-010.1, AC-010.2, AC-010.3, AC-010.4, AC-010.5, AC-010.6 | T-009, T-014, T-019, T-022, T-023, T-024, T-027, T-034, T-037, T-038, T-039, T-040 | `test_coach_personal_context.py`, `test_coach_service.py`, `test_coach_routes.py`, `personalContextPreference.test.ts`, `CoachPage.personalContext.test.tsx` | ✅ pasan |
| REQ-011 | AC-011.1, AC-011.2, AC-011.3 | T-025, T-041 | `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx` | ✅ pasan |
| REQ-012 | AC-012.1 a AC-012.5 | T-016, T-020, T-032, T-034 | `test_coach_routes.py`, `test_coach_service.py` | ✅ pasan |
| NFR-001 | AC-N001.1 | T-013, T-020, T-030 | `test_coach_personal_context.py`, `test_coach_routes.py` | ✅ pasan |
| NFR-002 | AC-N002.1, AC-N002.2 | T-015, T-032 | `test_coach_service.py` | ✅ pasan |
| NFR-003 | AC-N003.1, AC-N003.2, AC-N003.3 | T-012, T-018, T-029, T-033 | `test_coach_observability.py`, `test_coach_personal_context.py` | ✅ pasan |
| NFR-004 | AC-N004.1 | T-013, T-020, T-030 | `test_coach_personal_context.py`, `test_coach_routes.py` | ✅ pasan |
| NFR-005 | AC-N005.1 | T-015, T-032 | `test_coach_service.py` | ✅ pasan |

Cruce de AC: los 55 AC de `spec.md` aparecen en al menos un marcador `SDD: 034`, y todos los tests marcados pasan en la suite completa.

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (41 de 41 marcadas)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff (`main...HEAD`, `backend/tests` y `frontend/src`): ninguno

## 3. Criterios de aceptación manuales
Estos AC tienen cobertura automática del texto y del comportamiento, pero el aspecto y la persistencia en un navegador real no se comprueban con los tests. Los revisa el usuario en el gate:
- AC-010.1 y AC-010.2: el interruptor «Usar mis datos para personalizar las respuestas» se ve bajo la descripción de `/coach`, activado por defecto, y el texto de ayuda cambia al desactivarlo sin borrar la conversación.
- AC-010.5: tras recargar `/coach` en el mismo navegador, el interruptor sigue desactivado (la prueba automática usa un almacenamiento simulado).
- AC-011.1, AC-011.2 y AC-011.3: el texto de la Política de privacidad se ve correcto en la página.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | Lint ratchet del ámbito backend: 9 violaciones E501 nuevas (base 0), todas en archivos de test. Impide cumplir B5.7 y el resultado PASS. | `NUEVO backend/tests/test_routes/test_coach_routes.py E501 +6` (L565, L574, L591, L653, L678, L693); `NUEVO backend/tests/test_services/test_coach_personal_context.py E501 +1` (L448); `NUEVO backend/tests/test_services/test_coach_service.py E501 +2` (L249, L258). `lint-ratchet [backend]: 9 violación(es) nueva(s) respecto a main. FAIL` | test-author (las líneas son de archivos de test escritos en la etapa tests; el número real es 9, no 18) |

Ningún otro comando falló. Pytest (3048), Vitest (1946), oxlint, `tsc -b` y `npm run build` están en verde.

Iteración de verify: 1 de 5. La corrección la hace el test-author (solo reformatear las líneas de test indicadas, sin cambiar aserciones ni marcadores `SDD:`). Después hay que repetir la verificación.
