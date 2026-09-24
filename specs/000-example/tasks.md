# Tareas 000 — Utilidad clamp(value, min, max) en el frontend (prueba en seco del harness)

- **Plan:** [plan.md](plan.md) (aprobado el 2026-09-24)
- **Estado:** borrador

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos.
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: primero las tareas (scaffold), que las ejecuta el implementer en modo scaffold (solo firmas que lanzan
  "not implemented", ADR-0012); después todas las tareas (test), que las ejecuta el test-author;
  después las tareas impl, migration y config en orden de dependencia, que las ejecuta el implementer.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
<!-- Necesario (ADR-0012, plan §5 y §6): `clamp.ts` todavía no existe. Sin este esqueleto, el test fallaría
     por un error de import (rojo no legítimo) en vez de por comportamiento ausente. -->
- [ ] T-000 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007] (scaffold) Crear `clamp` exportado con la firma `clamp(value: number, min: number, max: number): number` cuyo cuerpo lanza `new Error("clamp: no implementado")`, sin devolver `value` ni ningún otro resultado — `frontend/src/lib/clamp.ts`

## Fase A — Tests (test-author)
<!-- Un `it` por AC, todos en el mismo archivo, con `describe` por REQ y marcador `// SDD: REQ-00X AC-00X.Y`
     en español, siguiendo plan §5. -->
- [ ] T-001 [REQ-001, AC-001.1] (test) `clamp(5, 0, 10)` devuelve `5` (valor dentro del rango) — `frontend/src/lib/clamp.test.ts`
- [ ] T-002 [REQ-001, AC-001.2] (test) `clamp(0, 0, 10)` devuelve `0` (límite inferior inclusivo) — `frontend/src/lib/clamp.test.ts`
- [ ] T-003 [REQ-001, AC-001.3] (test) `clamp(10, 0, 10)` devuelve `10` (límite superior inclusivo) — `frontend/src/lib/clamp.test.ts`
- [ ] T-004 [REQ-001, AC-001.4] (test) `clamp(-0.25, -1.5, 2.5)` devuelve `-0.25` (rango con decimales y negativos) — `frontend/src/lib/clamp.test.ts`
- [ ] T-005 [REQ-002, AC-002.1] (test) `clamp(-5, 0, 10)` devuelve `0` (valor por debajo del rango) — `frontend/src/lib/clamp.test.ts`
- [ ] T-006 [REQ-002, AC-002.2] (test) `clamp(-Infinity, 0, 10)` devuelve `0` (valor `-Infinity` por debajo del rango) — `frontend/src/lib/clamp.test.ts`
- [ ] T-007 [REQ-003, AC-003.1] (test) `clamp(15, 0, 10)` devuelve `10` (valor por encima del rango) — `frontend/src/lib/clamp.test.ts`
- [ ] T-008 [REQ-003, AC-003.2] (test) `clamp(Infinity, 0, 10)` devuelve `10` (valor `Infinity` por encima del rango) — `frontend/src/lib/clamp.test.ts`
- [ ] T-009 [REQ-004, AC-004.1] (test) `clamp(1, 3, 3)` devuelve `3` (rango degenerado, `value` por debajo) — `frontend/src/lib/clamp.test.ts`
- [ ] T-010 [REQ-004, AC-004.2] (test) `clamp(7, 3, 3)` devuelve `3` (rango degenerado, `value` por encima) — `frontend/src/lib/clamp.test.ts`
- [ ] T-011 [REQ-005, AC-005.1] (test) `clamp(5, 10, 0)` lanza `RangeError` (rango inválido, `min > max`) — `frontend/src/lib/clamp.test.ts`
- [ ] T-012 [REQ-005, AC-005.2] (test) capturar el error de `clamp(5, 10, 0)` y comprobar con `toBe` que el mensaje es exactamente `clamp: min (10) no puede ser mayor que max (0)` — `frontend/src/lib/clamp.test.ts`
- [ ] T-013 [REQ-005, AC-005.3] (test) `clamp(10, 10, 0)` lanza `RangeError` aunque `value` coincida con un límite (la validación del rango va primero) — `frontend/src/lib/clamp.test.ts`
- [ ] T-014 [REQ-006, AC-006.1] (test) `clamp(NaN, 0, 10)` devuelve `NaN` con rango válido — `frontend/src/lib/clamp.test.ts`
- [ ] T-015 [REQ-006, AC-006.2] (test) `clamp(5, NaN, 10)` lanza `RangeError` (límite `min` inválido) — `frontend/src/lib/clamp.test.ts`
- [ ] T-016 [REQ-006, AC-006.3] (test) `clamp(5, 0, NaN)` lanza `RangeError` (límite `max` inválido) — `frontend/src/lib/clamp.test.ts`
- [ ] T-017 [REQ-006, AC-006.4] (test) capturar el error de `clamp(5, NaN, 10)` y comprobar con `toBe` que el mensaje es exactamente `clamp: min y max deben ser números válidos` — `frontend/src/lib/clamp.test.ts`
- [ ] T-018 [REQ-006, AC-006.5] (test) `clamp(NaN, 3, 3)` devuelve `NaN`, prevaleciendo sobre el rango degenerado — `frontend/src/lib/clamp.test.ts`
- [ ] T-019 [REQ-007, AC-007.1] (test) `clamp(-1000, -Infinity, 10)` devuelve `-1000` (límite inferior `-Infinity`) — `frontend/src/lib/clamp.test.ts`
- [ ] T-020 [REQ-007, AC-007.2] (test) `clamp(1000, 0, Infinity)` devuelve `1000` (límite superior `Infinity`) — `frontend/src/lib/clamp.test.ts`

## Fase B — Implementación (implementer)
- [ ] T-021 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007] (impl) Implementar el cuerpo completo de `clamp` según el orden de evaluación del plan §3.3 (1. `RangeError` si `min` o `max` es `NaN`; 2. `RangeError` si `min > max`; 3. devolver `NaN` si `value` es `NaN`; 4. devolver `Math.min(Math.max(value, min), max)`), con JSDoc en español que documente límites inclusivos, errores y trato de `NaN` — `frontend/src/lib/clamp.ts`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-001 | T-021 |
| REQ-001 | AC-001.2 | T-002 | T-021 |
| REQ-001 | AC-001.3 | T-003 | T-021 |
| REQ-001 | AC-001.4 | T-004 | T-021 |
| REQ-002 | AC-002.1 | T-005 | T-021 |
| REQ-002 | AC-002.2 | T-006 | T-021 |
| REQ-003 | AC-003.1 | T-007 | T-021 |
| REQ-003 | AC-003.2 | T-008 | T-021 |
| REQ-004 | AC-004.1 | T-009 | T-021 |
| REQ-004 | AC-004.2 | T-010 | T-021 |
| REQ-005 | AC-005.1 | T-011 | T-021 |
| REQ-005 | AC-005.2 | T-012 | T-021 |
| REQ-005 | AC-005.3 | T-013 | T-021 |
| REQ-006 | AC-006.1 | T-014 | T-021 |
| REQ-006 | AC-006.2 | T-015 | T-021 |
| REQ-006 | AC-006.3 | T-016 | T-021 |
| REQ-006 | AC-006.4 | T-017 | T-021 |
| REQ-006 | AC-006.5 | T-018 | T-021 |
| REQ-007 | AC-007.1 | T-019 | T-021 |
| REQ-007 | AC-007.2 | T-020 | T-021 |

**NFR:** no aplica (spec §5, plan §4). No hay filas de NFR en la matriz.
