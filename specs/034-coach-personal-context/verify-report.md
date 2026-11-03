# Verify report 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Modo:** full (etapa verify, iteración 3 de 5: tras las tareas T-042 a T-051 de la review)
- **Fecha:** 2026-11-03T04:27:43.519Z · **Rama:** `feat/034-coach-personal-context` @ `ec5e486` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 3066 passed en 203,66 s, exit 0 (3048 en la verificación anterior; +18 tests nuevos de la corrección) |
| backend | lint ratchet `lint-ratchet.mjs backend` (raíz del repo) | ✅ | Sin violaciones nuevas respecto a `main`. Previas toleradas: `coach_routes.py` 1, `coach_service.py` 4, `test_coach_service.py` 1; resto de ficheros 0 |
| backend | `lint`, `typecheck`, `build` | — | `null` en la config: no aplican |
| frontend | `npm test` (`frontend`) | ✅ | 97 ficheros, 1946 passed, exit 0 |
| frontend | `npm run lint` (`frontend`, oxlint) | ✅ | Sin errores ni warnings en la salida, exit 0 |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Sin errores, exit 0 |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto, exit 0 |

Notas de la corrección de la review (T-042 a T-051), verificadas en el código y en los tests que ya pasan:
- F1: `read_first_name` existe (`backend/services/coach_personal_context.py`, línea 206) y los tests `test_with_the_context_off_*` pasan.
- F2: `updatedAt="3 de noviembre de 2026"` en `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`, línea 5.
- F3: `_TEXT_PATTERN` usa `fullmatch` (`backend/services/progress_analysis_context.py`, línea 132), y el caso del salto de línea final pasa.

## 2. Trazabilidad
Abreviaturas de archivos de test: **R** = `backend/tests/test_routes/test_coach_routes.py`; **P** = `backend/tests/test_services/test_coach_personal_context.py`; **S** = `backend/tests/test_services/test_coach_service.py`; **O** = `backend/tests/test_services/test_coach_observability.py`; **F-CP** = `frontend/src/features/coach/pages/CoachPage.personalContext.test.tsx`; **F-PC** = `frontend/src/features/coach/personalContext.test.ts`; **F-PP** = `frontend/src/features/coach/personalContextPreference.test.ts`; **F-LEG** = `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`. Los números son líneas del marcador `SDD: 034`.

| REQ / NFR | AC | Tareas | Tests con `SDD: 034` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-028 | R:305, P:281, P:312, P:634 | ✅ |
| REQ-001 | AC-001.2 | T-013, T-030 | P:648, P:660 | ✅ |
| REQ-001 | AC-001.3 | T-010, T-028 | P:290 | ✅ |
| REQ-001 | AC-001.4 | T-009, T-019, T-027, T-034 | R:333, P:224 | ✅ |
| REQ-001 | AC-001.5 | T-019, T-030 | R:359 | ✅ |
| REQ-002 | AC-002.1 | T-010, T-021, T-028, T-036 | R:306, P:282, F-CP:215, F-PC:49 | ✅ |
| REQ-002 | AC-002.2 | T-010, T-021, T-028, T-036 | P:320, F-PC:107 | ✅ |
| REQ-003 | AC-003.1 | T-011, T-021, T-026, T-036 | R:307, P:333, F-CP:216, F-PC:64 | ✅ |
| REQ-003 | AC-003.2 | T-011, T-028 | P:343, F-PC:77 | ✅ |
| REQ-003 | AC-003.3 | T-011, T-028 | P:363, P:377, F-PC:139 | ✅ |
| REQ-003 | AC-003.4 | T-011, T-021, T-028, T-036 | P:387, F-PC:87 | ✅ |
| REQ-003 | AC-003.5 | T-011, T-028 | P:404 | ✅ |
| REQ-003 | AC-003.6 | T-011, T-028 | P:423, F-PC:130 | ✅ |
| REQ-004 | AC-004.1 | T-014, T-024, T-032, T-040 | R:386, S:206, S:295, S:430, F-CP:321 | ✅ |
| REQ-004 | AC-004.2 | T-019, T-030 | R:372, S:240, F-CP:346 | ✅ |
| REQ-005 | AC-005.1 | T-010, T-013, T-028, T-030 | R:405, P:436, P:701 | ✅ |
| REQ-005 | AC-005.2 | T-010, T-028 | R:432, P:134, P:470 | ✅ |
| REQ-005 | AC-005.3 | T-010, T-028 | R:451, P:483, P:492, P:714, P:722 | ✅ |
| REQ-005 | AC-005.4 | T-016, T-020, T-032 | R:406, S:369, S:390 | ✅ |
| REQ-006 | AC-006.1 | T-010, T-020, T-027, T-034 | R:474, P:118, P:217, P:455, P:674 | ✅ |
| REQ-006 | AC-006.2 | T-009, T-020, T-026, T-027, T-046, T-050 | R:514, R:536, P:148, P:207, P:686, P:805, F-PC:149 | ✅ |
| REQ-006 | AC-006.3 | T-024, T-040 | F-CP:301 | ✅ |
| REQ-007 | AC-007.1 | T-021, T-024, T-036, T-040 | F-CP:214, F-PC:48, F-PC:63 | ✅ |
| REQ-007 | AC-007.2 | T-021, T-024, T-036, T-040 | F-CP:245, F-PC:121 | ✅ |
| REQ-007 | AC-007.3 | T-024, T-040 | F-CP:260 | ✅ |
| REQ-008 | AC-008.1 | T-015, T-031, T-032 | S:330, S:343 | ✅ |
| REQ-008 | AC-008.2 | T-015, T-031, T-032 | S:356 | ✅ |
| REQ-009 | AC-009.1 | T-017, T-031 | S:455 | ✅ |
| REQ-009 | AC-009.2 | T-017, T-031 | S:466 | ✅ |
| REQ-009 | AC-009.3 | T-017, T-031 | S:478 | ✅ |
| REQ-009 | AC-009.4 | T-017, T-031 | S:488 | ✅ |
| REQ-009 | AC-009.5 | T-017, T-031 | S:494 | ✅ |
| REQ-009 | AC-009.6 | T-017, T-031 | S:506 | ✅ |
| REQ-010 | AC-010.1 | T-023, T-038, T-039 | F-CP:146, F-CP:155, F-PP:19, F-PP:28, F-PP:51, F-PP:58 | ✅ (manual, ver §3) |
| REQ-010 | AC-010.2 | T-023, T-038, T-039 | F-CP:170 | ✅ (manual, ver §3) |
| REQ-010 | AC-010.3 | T-024, T-040 | F-CP:261, F-CP:276 | ✅ |
| REQ-010 | AC-010.4 | T-009, T-014, T-019, T-027, T-032, T-044, T-045, T-049 | R:549, O:813, P:108, S:260, S:277, S:517 | ✅ |
| REQ-010 | AC-010.5 | T-022, T-023, T-037 | F-CP:185, F-CP:199, F-PP:33, F-PP:41, F-PP:67 | ✅ (manual, ver §3) |
| REQ-010 | AC-010.6 | T-009, T-019, T-027, T-034 | R:574, P:101 | ✅ |
| REQ-011 | AC-011.1 | T-025, T-041 | F-LEG:143, F-LEG:206 | ✅ (manual, ver §3) |
| REQ-011 | AC-011.2 | T-025, T-041 | F-LEG:161 | ✅ (manual, ver §3) |
| REQ-011 | AC-011.3 | T-025, T-041 | F-LEG:181 | ✅ (manual, ver §3) |
| REQ-011 | (sin AC; fecha de la Política) | T-047, T-051 | F-LEG:83 | ✅ |
| REQ-012 | AC-012.1 | T-020, T-034 | R:591 | ✅ |
| REQ-012 | AC-012.2 | T-016, T-032 | S:368, R:650 | ✅ |
| REQ-012 | AC-012.3 | T-016, T-032, T-044, T-049 | S:405, S:538, R:674 | ✅ |
| REQ-012 | AC-012.4 | T-020, T-034 | R:603 | ✅ |
| REQ-012 | AC-012.5 | T-020, T-034 | R:623 | ✅ |
| NFR-001 | AC-N001.1 | T-013, T-020, T-030 | R:693, P:745, P:788 | ✅ |
| NFR-002 | AC-N002.1 | T-015, T-032 | R:713, S:306 | ✅ |
| NFR-002 | AC-N002.2 | T-015, T-032 | S:316 | ✅ |
| NFR-003 | AC-N003.1 | T-018, T-033, T-043, T-045, T-048, T-049 | O:744, O:770, O:812, O:848, P:532, P:553, P:573, P:582, P:732, P:819, P:850, P:859 | ✅ |
| NFR-003 | AC-N003.2 | T-018, T-033 | O:783 | ✅ |
| NFR-003 | AC-N003.3 | T-012, T-029 | O:799, P:504, P:515, P:522, P:540, P:547 | ✅ |
| NFR-004 | AC-N004.1 | T-013, T-020, T-030, T-043, T-048 | R:725, P:760, P:837, P:868 | ✅ |
| NFR-005 | AC-N005.1 | T-015, T-032 | S:418 | ✅ |

- AC sin test: — (55 de 55 AC de `spec.md` tienen marcador `SDD: 034` y todos los tests pasan)
- AC con marcador que no están en la spec: —
- REQ / NFR sin tarea: — (REQ-001 a REQ-012 y NFR-001 a NFR-005 aparecen en `tasks.md`)
- Tareas sin marcar `[x]`: — (51 de 51 tareas marcadas, T-001 a T-051)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: — (búsqueda en `git diff main...HEAD` de `backend/tests` y `frontend/src`: 0 coincidencias)

## 3. Criterios de aceptación manuales
Comprobados de forma automática en sus aspectos de texto y lógica (ver tests en §2), pero su revisión visual o de UX queda para el usuario:
- **AC-010.1:** el interruptor del coach se ve bajo la descripción, con su texto y su ayuda.
- **AC-010.2:** al desactivarlo cambia el texto del interruptor y la conversación sigue.
- **AC-010.5:** el estado del interruptor se recuerda tras recargar o remontar la pantalla.
- **AC-011.1 a AC-011.3:** la redacción de la Política de privacidad (Anthropic, Langfuse y Voyage) es clara y correcta para el usuario.

## 4. Fallos (si los hay)
Ninguno. Todas las comprobaciones automáticas están en verde.

Puntos abiertos de la review que no bloquean esta verificación (ver `review.md`, F4 y F5 son decisiones de spec; F6 y F7 son NIT): F4 (nombres compuestos en la traza), F5 (historial reenviado con el interruptor desactivado), F6 (sangría en `coach_service.py`), F7 (503 si falla el lector, ya recogido en el plan revisado). Se pasan al backlog de la feature.
