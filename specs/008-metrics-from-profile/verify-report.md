# Verify report 008 — Mediciones de Métricas coherentes con el perfil

- **Modo:** full (tras la etapa implement), iteración 2
- **Fecha:** 2026-10-13T00:11:30.847Z · **Rama:** `feat/008-metrics-from-profile` @ `d69bbb5` (HEAD; incluye los cambios sin commit de formato en tests, ver §2)
- **Resultado:** PASS

## 1. Comandos ejecutados

Base de comparación: `chore/frontend-redesign` (`state.json.base_branch`).

| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `backend/.venv/Scripts/python.exe -m pytest -q` | ✅ | 596 passed |
| backend | `node .claude/sdd/scripts/ruff-new.mjs chore/frontend-redesign` | ✅ | "ruff-new: sin violaciones nuevas. OK" (9 archivos .py del diff; violaciones previas toleradas) |
| frontend | `npm test` | ✅ | 24 files, 220 tests passed |
| frontend | `npm run lint` | ✅ | 0 errores. 2 warnings preexistentes fuera del diff (`src/components/ui/form.tsx:159`, `src/components/ui/button.tsx:64`) |
| frontend | `npx tsc -b` | ✅ | Sin errores (exit 0) |
| frontend | `npm run build` | ✅ | Build correcto. Aviso preexistente de chunk > 500 kB |

## 2. Trazabilidad

- **ACs de `spec.md`:** 69 ACs reales (líneas `- **AC-…`), REQ-001 a REQ-011 y NFR-001. Todos aparecen en al menos un marcador `SDD:` de los tests nuevos de 008 (`test_body_metric_routes.py`, `test_body_metric_service.py`, `test_body_metric_consolidation.py`, `schemas.test.ts`, `MetricsHistory.test.tsx`, `BodyMetricsPage.test.tsx`, `ProfilePage.test.tsx`). ACs sin test: ninguno. Todos esos tests pasan (backend 596 OK, frontend 220 OK).
- **Marcadores ambiguos (⚠️, no bloquean):** `ProfilePage.test.tsx` contiene `SDD: REQ-011 AC-011.5/6/7` y `BodyMetricsPage.test.tsx` contiene `SDD: REQ-012 AC-012.3`. Son líneas ya presentes en la base (`chore/frontend-redesign`), de otras features, y su ID coincide con IDs de esta spec o de la spec del bloque B. Pasan. Conviene renumerarlas en una tarea aparte, pero no las toca esta feature.
- **Referencias fuera de alcance:** `AC-014.3`, `REQ-012` y `REQ-016` aparecen solo en la tabla de preguntas (Q8, Q10, Q14) y en "Fuera de alcance" (bloque B, feature aparte). No son ACs ni REQs de esta feature.
- **REQs/NFR sin tarea:** ninguno dentro del alcance (REQ-001 a REQ-011 y NFR-001 aparecen en `tasks.md`).
- **Tareas sin marcar `[x]`:** ninguna (44 de 44 marcadas).
- **Skips:** no hay `skip`, `xfail`, `.only`, `.skip`, `fit(` ni `xit(` en los tests ni en el código del diff.
- **Mocks en tests backend de 008:** ninguno (`unittest`, `mock`, `monkeypatch`).
- **Snapshot de tests:** los 8 hashes SHA-256 de `state.json.tests_snapshot` coinciden con los archivos actuales. Los cambios sin commit de `backend/tests/` son solo de formato (partir líneas E501, 8 líneas en 3 archivos) y están autorizados en el historial de `state.json`.
- **Migración:** `backend/migrations/versions/d8e4b2a7c1f5_one_body_metric_per_user_and_day.py` existe, con `down_revision = 'c6a1f0d2e9b4'`. La revisión manual de su contenido corresponde al reviewer.
- **Pendiente de git (no es fallo de verify):** los cambios de formato de `backend/tests/` (3 archivos) y `specs/008-metrics-from-profile/*` no están commiteados. Antes del commit de verify hay que incluirlos.

## 3. Criterios de aceptación

No hay AC que requiera revisión manual en esta etapa. Los AC de UX (textos, orden de secciones, estados de botones, "Guardando…", diálogo) tienen tests automáticos en `MetricsHistory.test.tsx`, `BodyMetricsPage.test.tsx` y `ProfilePage.test.tsx`, que pasan.

## 4. Fallos (si los hay)

Ninguno en esta iteración.

La iteración 1 (FAIL) era la de 8 violaciones E501 nuevas en tests del ratchet de ruff. Se corrigieron en la iteración 3 de la etapa tests, solo con cambios de formato y sin tocar aserciones, y `ruff-new.mjs` ya da OK.
