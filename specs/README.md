# specs/

Artefactos del flujo SDD de fitnerd, gestionados por el plugin `sdd-beto`. La visión general está en [`docs/sdd/`](../docs/sdd/).

- `NNN-slug/`: una carpeta por feature, con `idea.md`, `spec.md`, `plan.md`, `tasks.md`, `verify-report.md`, `review.md`, `docs-report.md` y `state.json`. Las features nuevas se crean con `/sdd-beto:new`.
- La constitución es la base del plugin más [`.sdd/constitution.md`](../.sdd/constitution.md) (Parte II).
- Las specs 000–013 se hicieron con el harness anterior y su `state.json` usa su formato; como están cerradas, no se migran (ADR-0024).

## Trazabilidad

La cadena es REQ → tarea → test.

| Artefacto | Cómo se referencia |
|---|---|
| Requisito | `### REQ-001 — …` en `spec.md` |
| Criterio de aceptación | `**AC-001.1:**` debajo de su REQ |
| Tarea | `- [ ] T-001 [REQ-001, AC-001.1] (test) … — \`ruta\`` en `tasks.md` |
| Test (Python) | `# SDD: 011 REQ-001 AC-001.1` en la línea anterior a `def test_…` (`011` = número de la spec, ADR-0022) |
| Test (TypeScript) | `// SDD: 011 REQ-001 AC-001.1` en la línea anterior a `it(…)` |

Con esos marcadores, el `verifier` puede comprobar mediante grep que cada AC tiene un test y cada REQ tiene una tarea.

## Cómo se vincula una feature a su rama

La rama `feat/NNN-slug` (o `fix/NNN-slug`) corresponde a la carpeta `specs/NNN-slug/`. Los hooks usan esa correspondencia para encontrar el `state.json` activo.
