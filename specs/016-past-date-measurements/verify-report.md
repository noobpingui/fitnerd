# Verify report 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Modo:** red (tras la etapa tests, red check de la corrección de review F7)
- **Fecha:** 2026-10-16T22:09:03.208Z · **Rama:** `feat/016-past-date-measurements` @ `46faf15` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Solo tests nuevos (archivos de test con marcador `SDD: 016`). Ámbitos tocados: backend, frontend.

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run` con los 7 archivos de test nuevos (`frontend`) | ❌ (1 rojo esperado) | 1 failed, 160 passed (161). El único fallo es el test F7 de `BodyMetricsPage.register.test.tsx` (AC-001.4) |
| backend | `".venv/Scripts/python.exe" -m pytest -q` sobre `tests/test_routes/test_body_metric_routes.py` y `tests/test_services/test_body_metric_service.py` (`backend`) | ✅ | 176 passed |

Comandos de lint, typecheck y build no se ejecutan en modo red.

Detalle del test en rojo:
- `BodyMetricsPage.register.test.tsx` > "si el perfil falla, el botón se habilita en cuanto falla la primera vez, sin esperar los reintentos" (AC-001.4).
- Clasificación: **rojo legítimo**, por aserción. `expect(element).toBeEnabled()` falla: el botón "Registrar medición" sigue deshabilitado mientras la consulta del perfil reintenta tras el primer fallo.
- Tests del archivo sin cambios: en verde.

## 2. Trazabilidad
Solo el AC del test nuevo de esta iteración. La matriz completa de la verificación anterior (46faf15, 59/59 AC) no se repite aquí.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.4 | T-018 / T-035 | `BodyMetricsPage.register.test.tsx` (test F7) | ❌ rojo legítimo (aserción `toBeEnabled`) |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: —
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: — (revisado sobre el test F7: sin `skip` ni `only`)
- Scaffolds (`(scaffold)`): no se re-comprueban en esta iteración. T-001 a T-005 ya tienen implementación (commits 3527d19 y 46faf15).

## 3. Criterios de aceptación manuales
Ninguno en este modo.

## 4. Fallos (si los hay)
Ninguno en el criterio de PASS. El test F7 está en rojo como se espera en modo red. La implementación de la corrección F7 es la siguiente etapa.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno (rojo esperado: test F7, AC-001.4) | `Error: expect(element).toBeEnabled() Received element is not enabled` | — (rojo legítimo, pendiente de implementer) |
