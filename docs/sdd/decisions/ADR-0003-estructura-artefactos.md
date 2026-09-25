# ADR-0003 — Estructura de artefactos por feature

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** Claude (sin trade-offs relevantes)

## Contexto
Los agentes se comunican solo a través de archivos en disco, así que cada feature necesita un lugar fijo y predecible para sus artefactos y su estado.

## Decisión
```
specs/
  constitution.md            principios no negociables (todos los agentes la leen)
  _templates/                plantillas de spec, plan, tasks, state, review
  NNN-slug/                  una carpeta por feature, NNN correlativo de 3 dígitos
    idea.md                  orquestador (idea original del usuario, literal)
    spec.md                  spec-writer
    plan.md                  planner
    tasks.md                 task-breaker
    verify-report.md         verifier (se sobrescribe en cada ejecución)
    review.md                reviewer
    docs-report.md           doc-keeper
    state.json               etapa actual, aprobaciones, iteraciones, rama e historial
```
- `state.json` es la **única fuente de verdad** del flujo. Solo lo escriben el orquestador y el `verifier`.
- Las decisiones de arquitectura que tome una feature se registran como ADR en `docs/sdd/decisions/`.

## Consecuencias
- (+) `/sdd-status` y cualquier sesión nueva pueden retomar el trabajo leyendo solo el disco.
- (+) Los hooks pueden decidir qué se permite según `state.json`.
- (−) Si `state.json` se edita a mano y queda inconsistente, el flujo puede bloquearse. La guía de uso documentará cómo repararlo.
