# Verify report 020 — Seguimiento de métricas corporales y configuración de producción

- **Modo:** full (etapa verify, iteración 2)
- **Fecha:** 2026-10-19T02:05:37.655Z · **Rama:** `feat/020-metrics-followups-prod-config` @ `edd5c9c` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 1075 passed |
| backend | `lint_ratchet` (`node scripts/lint-ratchet.mjs backend`, raíz del repo) | ✅ | Sin violaciones nuevas respecto a main. El E501 de `test_fixed_clock_routes.py:73` de la iteración 1 ya no aparece |
| frontend | `npm test` (`frontend`) | ✅ | 58 files, 792 tests passed |
| frontend | `npm run lint` (`frontend`) | ✅ | oxlint sin errores (exit 0) |
| frontend | `npx tsc -b` (`frontend`) | ✅ | exit 0 |
| frontend | `npm run build` (`frontend`) | ✅ | Build correcto. Chunk de entrada `index-CWGCf-oL.js` 384.26 kB (≤ 500 kB, ADR-0026) |

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 a AC-001.9 | T-022, T-023, T-024, T-047, T-049, T-050, T-052 | `RefreshFailedNotice.test.tsx`, `BodyMetricsPage.refresh.test.tsx` | ✅ |
| REQ-002 | AC-002.1 a AC-002.10 | T-022, T-027, T-028, T-047, T-049, T-053, T-054 | `PhysicalDataForm.refresh.test.tsx`, `RefreshFailedNotice.test.tsx` | ✅ |
| REQ-003 | AC-003.1 a AC-003.5 | T-021, T-025, T-026, T-048, T-050, T-051 | `historyReveal.test.ts`, `MetricsHistory.test.tsx`, `BodyMetricsPage.refresh.test.tsx` | ✅ |
| REQ-004 | AC-004.1 a AC-004.4 | T-017, T-029, T-030, T-044, T-047 | `BodyMetricsPage.sync.test.tsx`, `test_body_metric_routes.py` | ✅ |
| REQ-005 | AC-005.1 a AC-005.9 | T-011, T-013, T-014, T-016, T-018, T-040, T-043, T-044, T-045 | `test_clock.py`, `test_fixed_clock_routes.py`, `test_body_metric_routes.py`, `test_auth_routes.py` | ✅ |
| REQ-006 | AC-006.1 a AC-006.6 | T-012, T-041, T-042 | `test_production_config.py` | ✅ |
| REQ-007 | AC-007.1 a AC-007.8 | T-019, T-020, T-042 | `test_resend_email_routes.py` | ✅ |
| NFR-001 | AC-N001.1, AC-N001.2 | T-011, T-015, T-040, T-044 | `test_fixed_clock_routes.py`, `test_clock.py` | ✅ |
| NFR-002 | AC-N002.1 | T-020, T-029 | `test_resend_email_routes.py`, `BodyMetricsPage.sync.test.tsx` | ✅ |

- AC sin test: — (los 54 AC de `spec.md` tienen al menos un marcador `SDD: 020` en un test, y todos los tests de la feature pasan)
- REQ sin tarea: — (REQ-001 a REQ-007, NFR-001 y NFR-002 tienen tarea)
- Tareas sin marcar `[x]`: — (44 de 44 marcadas)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff (`git diff main...HEAD -- backend frontend`): — (sin coincidencias)

## 3. Criterios de aceptación manuales
- Ninguno de los 54 AC exige revisión manual: los textos, el rol `alert`, el orden del documento (AC-001.9) y el comportamiento del Historial están cubiertos por tests automáticos.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno | — | — |

## Comentarios del usuario

- Excepción al Art. B5.2 (red check, 31 tests que pasan sin implementación): "A"
  (Opción A: aceptarlos como tests de caracterización de comportamiento ya existente y dejar la excepción documentada.)
