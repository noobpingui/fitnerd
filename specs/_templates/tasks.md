# Tareas NNN — <Título de la feature>

- **Plan:** [plan.md](plan.md) (aprobado el <fecha>)

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
<!-- Solo si los tests importarán símbolos que todavía no existen (módulos, funciones, clases nuevas).
     No hace falta para rutas HTTP nuevas: un 404 ya es rojo legítimo. Si no aplica, escribe "No aplica". -->
- [ ] T-000 [REQ-001] (scaffold) Crear `<símbolo>` exportado con su firma, que lance "not implemented" — `frontend/src/lib/<x>.ts`

## Fase A — Tests (test-author)
- [ ] T-001 [REQ-001, AC-001.1] (test) <qué comportamiento verifica> — `backend/tests/test_services/test_<x>.py`
- [ ] T-002 [REQ-001, AC-001.2] (test) … — `…`

## Fase B — Implementación (implementer)
- [ ] T-010 [REQ-001] (migration) … — `backend/migrations/versions/…`
- [ ] T-011 [REQ-001] (impl) … — `backend/services/<x>_service.py`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-001 | T-011 |
