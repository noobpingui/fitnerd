# specs/

Artefactos del flujo SDD de fitnerd. La visión general del harness está en [`docs/sdd/`](../docs/sdd/).

- [`constitution.md`](constitution.md): principios no negociables que todos los agentes respetan.
- [`_templates/`](_templates/): plantillas que se copian a cada feature nueva (`/sdd:new`).
- `NNN-slug/`: una carpeta por feature, con `spec.md`, `plan.md`, `tasks.md`, `verify-report.md`, `review.md` y `state.json`.

## Trazabilidad

La cadena es REQ → tarea → test.

| Artefacto | Cómo se referencia |
|---|---|
| Requisito | `### REQ-001 — …` en `spec.md` |
| Criterio de aceptación | `**AC-001.1:**` debajo de su REQ |
| Tarea | `- [ ] T-001 [REQ-001, AC-001.1] (test) … — \`ruta\`` en `tasks.md` |
| Test (Python) | `# SDD: REQ-001 AC-001.1` en la línea anterior a `def test_…` |
| Test (TypeScript) | `// SDD: REQ-001 AC-001.1` en la línea anterior a `it(…)` |

Con esos marcadores, el `verifier` puede comprobar mediante grep que cada AC tiene un test y cada REQ tiene una tarea.

## Cómo se vincula una feature a su rama

La rama `feat/NNN-slug` (o `fix/NNN-slug`) corresponde a la carpeta `specs/NNN-slug/`. Los hooks usan esa correspondencia para encontrar el `state.json` activo.
