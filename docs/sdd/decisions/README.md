# Decisiones (ADRs) del harness SDD

Formato breve: contexto, decisión y consecuencias. Las ADRs que generen futuras features siguen la misma numeración.

| ADR | Decisión |
|---|---|
| [0001](ADR-0001-orquestacion.md) | Orquestador en la sesión principal (skills `/sdd-*`), sin anidamiento de subagentes |
| [0002](ADR-0002-formato-requisitos.md) | Requisitos híbridos: historia de usuario, REQ en EARS y AC en Given/When/Then |
| [0003](ADR-0003-estructura-artefactos.md) | `specs/NNN-slug/` con spec, plan, tasks, verify-report, review y state.json |
| [0004](ADR-0004-gates-humanos.md) | Gate humano en cada etapa; 3 iteraciones de corrección antes de escalar |
| [0005](ADR-0005-tdd-estricto.md) | TDD estricto con verificación del rojo |
| [0006](ADR-0006-modelos-por-agente.md) | opus: spec, plan y review · sonnet: tasks, tests e impl · haiku: verifier |
| [0007](ADR-0007-integracion-git.md) | Rama `feat/NNN-slug` y un commit por etapa, solo desde el orquestador |
| [0008](ADR-0008-enforcement-hooks.md) | Hooks Node: guardia de rol y ruta, guardia de etapa y `ask` en commit/push |
| [0009](ADR-0009-ruff-backend.md) | ruff para el backend, solo sobre archivos cambiados |
| [0010](ADR-0010-harness-propio.md) | Harness propio con ideas de Spec Kit y Kiro |
| [0011](ADR-0011-doc-keeper.md) | Agente `doc-keeper` y etapa `docs` entre review y close |
| [0012](ADR-0012-scaffold.md) | Paso de andamiaje (`implementer` en modo scaffold) antes del red check |
| [0013](ADR-0013-claude-md-proyecto.md) | `CLAUDE.md` con sección Proyecto, mantenida por el `doc-keeper` |
