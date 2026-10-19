# Verify report 020 — Seguimiento de métricas corporales y configuración de producción

- **Modo:** red (tras la etapa tests, correcciones de review F1, F2 y F3)
- **Fecha:** 2026-10-19T02:23:25.382Z · **Rama:** `feat/020-metrics-followups-prod-config` @ `1a1b22b` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run src/features/profile/components/PhysicalDataForm.refresh-edge.test.tsx` (`frontend`) | ✅ rojo legítimo | 2 failed de 2: ambos por aserción de comportamiento ausente (ver sección 4) |
| backend | `".venv/Scripts/python.exe" -m pytest -q` (`backend`) | ✅ | 1075 passed (`conftest.py` normalizado: sin regresiones) |
| backend | `lint_ratchet` (`node "C:/Users/alber/.claude/plugins/cache/sdd-beto/sdd-beto/0.2.0/scripts/lint-ratchet.mjs" backend`, raíz del repo) | ✅ | Sin violaciones nuevas respecto a main |

Comprobaciones de integridad de la fase (sin ejecutar comandos de escritura):
- `PhysicalDataForm.tsx` sin cambios frente a `HEAD` ni frente al índice (`git diff --quiet`, exit 0).
- `backend/tests/conftest.py`: el contenido es idéntico al del `HEAD` y al del snapshot (sha256 `7dbe0361…`); solo cambia la normalización de finales de línea (LF en el índice y en la copia de trabajo).
- Tests de la excepción B5.2 (caracterización) sin cambios: los hashes del snapshot coinciden, salvo tres archivos cuya copia de trabajo está en CRLF (`test_auth_routes.py`, `test_body_metric_routes.py`, `MetricsHistory.test.tsx`). Tras quitar los CR, sus hashes coinciden con el snapshot y con el `HEAD`; `git status` no los muestra como modificados.

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-002 | AC-002.5 (marcador aproximado) | T-022, T-027, T-028, T-047, T-049, T-053, T-054 | `PhysicalDataForm.refresh-edge.test.tsx` («guardar solo la meta…», F1) | ❌ rojo legítimo |
| REQ-002 | AC-002.6 (marcador aproximado) | T-022, T-027, T-028, T-047, T-049, T-053, T-054 | `PhysicalDataForm.refresh-edge.test.tsx` («'Reintentar' solo relee…», F2) | ❌ rojo legítimo |

- AC sin test: — (la comprobación de cobertura de AC no es objeto de esta fase; ver nota)
- REQ sin tarea: —
- Tareas sin marcar `[x]`: — (no aplica en modo red)
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: —
- Nota: los dos casos de F1 y F2 no están cubiertos por ningún AC de `spec.md` (la review lo indica). Los marcadores `SDD: 020 REQ-002 AC-002.5` y `AC-002.6` son aproximados: el primero prueba F1 y el segundo, F2 más la no emisión de registros. Conviene revisarlos en la etapa `docs` o en el backlog.

## 3. Criterios de aceptación manuales
- Ninguno en esta fase.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno. Red legítima en los 2 tests nuevos (no son fallos de la fase) | F1: `expect(notice()).toBeInTheDocument()` recibe `null` tras guardar solo la meta (línea 140). F2: `expect(spinbuttons()[1]).toHaveValue(75)` recibe `79` tras «Reintentar» (línea 160): la edición sin guardar se descarta | — |

Los dos fallos son aserciones de comportamiento aún no implementado (F1 y F2 en `PhysicalDataForm.tsx`). No hay errores de sintaxis, configuración, fixture ni imports. Responsable de la implementación pendiente: implementer.

## Comentarios del usuario

- Excepción al Art. B5.2 (red check, 31 tests que pasan sin implementación): "A"
  (Opción A: aceptarlos como tests de caracterización de comportamiento ya existente y dejar la excepción documentada.)
