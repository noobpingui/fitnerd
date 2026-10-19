# Verify report 020 — Seguimiento de métricas corporales y configuración de producción

- **Modo:** full (etapa verify, tras las correcciones de review F1, F2 y F3)
- **Fecha:** 2026-10-19T02:26:57.927Z · **Rama:** `feat/020-metrics-followups-prod-config` @ `c8232eb` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 1075 passed en 75.42 s |
| backend | `lint_ratchet` (`node lint-ratchet.mjs backend`, raíz del repo) | ✅ | Exit 0: sin violaciones nuevas respecto a main en los 15 archivos tocados |
| frontend | `npm test` (`frontend`) | ✅ | 59 archivos, 794 tests passed |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint, exit 0, sin errores ni warnings |
| frontend | `npx tsc -b` (`frontend`) | ✅ | Exit 0, sin errores de tipos |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto (`built in 699ms`), exit 0 |

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.9 (9) | T-004, T-006, T-007, T-022, T-023, T-024, T-047, T-049, T-050, T-052 | `BodyMetricsPage.refresh.test.tsx`, `RefreshFailedNotice.test.tsx`, `BodyMetricsPage.refresh.test.tsx` (AC-001.9) | ✅ |
| REQ-002 | AC-002.1 a AC-002.10 (10) | T-004, T-006, T-022, T-027, T-028, T-047, T-049, T-053, T-054 | `PhysicalDataForm.refresh.test.tsx`, `PhysicalDataForm.refresh-edge.test.tsx` (AC-002.5 y AC-002.6, marcadores aproximados, ver nota) | ✅ |
| REQ-003 | AC-003.1 a AC-003.5 (5) | T-005, T-007, T-008, T-021, T-025, T-026, T-048, T-050, T-051, T-052 | `historyReveal.test.ts`, `MetricsHistory.test.tsx`, `BodyMetricsPage.refresh.test.tsx` | ✅ |
| REQ-004 | AC-004.1 a AC-004.4 (4) | T-017, T-029, T-030, T-044, T-047 | `BodyMetricsPage.sync.test.tsx`, `test_body_metric_routes.py` (AC-004.4) | ✅ |
| REQ-005 | AC-005.1 a AC-005.9 (9) | T-001, T-003, T-010, T-011, T-013, T-014, T-016, T-018, T-040, T-042, T-043, T-044, T-045 | `test_fixed_clock_routes.py`, `test_clock.py` | ✅ |
| REQ-006 | AC-006.1 a AC-006.6 (6) | T-002, T-003, T-010, T-012, T-041, T-042, T-046 | `test_production_config.py` | ✅ |
| REQ-007 | AC-007.1 a AC-007.8 (8) | T-003, T-010, T-019, T-020, T-042 | `test_resend_email_routes.py` | ✅ |
| NFR-001 | AC-N001.1, AC-N001.2 (2) | T-001, T-011, T-015, T-040 | `test_fixed_clock_routes.py`, `test_clock.py` | ✅ |
| NFR-002 | AC-N002.1 (1) | T-020, T-029, T-030 | `test_resend_email_routes.py` | ✅ |

Los 54 AC de `spec.md` tienen al menos un marcador `SDD:` en los tests y todos los tests que los llevan pasan.

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (44 de 44 marcadas)
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff: — (ninguno en las líneas añadidas de `backend/` y `frontend/`)
- Nota: `REQ-008` y `REQ-009` aparecen en `spec.md` solo como referencias a la spec 016, no como requisitos de esta feature. Los marcadores `SDD: 020 REQ-002 AC-002.5` y `AC-002.6` de los tests de F1 y F2 son aproximados, según el acuerdo del usuario y el backlog de la feature: no se cuentan como fallo.

## 3. Criterios de aceptación manuales
- AC-001.9 y AC-002.1 (posición del aviso de relectura: tras el botón de Métricas y en el lugar de «Cambios guardados» en «Datos físicos»). Están cubiertos por tests automáticos de orden en el DOM, pero conviene una revisión visual del usuario antes del cierre.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno | — | — |

## Comentarios del usuario

- Excepción al Art. B5.2 (red check, 31 tests que pasan sin implementación): "A"
  (Opción A: aceptarlos como tests de caracterización de comportamiento ya existente y dejar la excepción documentada.)
