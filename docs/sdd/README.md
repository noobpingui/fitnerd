# SDD en fitnerd

El desarrollo de fitnerd sigue **Spec-Driven Development** con el plugin [`sdd-beto`](https://github.com/noobpingui/sdd-beto) en modo `flow` (ADR-0024): cada cambio funcional se especifica, se diseña, se descompone en tareas, se prueba (TDD), se implementa, se verifica, se revisa y se documenta antes de integrarse.

`spec → plan → tasks → tests (rojo) → implement → verify → review → docs → close`

- Cada etapa la ejecuta un subagente `sdd-beto:<rol>`; la sesión principal orquesta.
- El flujo se detiene en los gates de `spec`, `review` y `close`, y ante decisiones mayores (ver `CLAUDE.md`, sección Aprobación humana).
- Comandos: `/sdd-beto:new <slug> <idea>`, `/sdd-beto:run [NNN-slug]`, `/sdd-beto:status` y `/sdd-beto:<etapa>`.

La documentación del flujo, los agentes, los hooks y el ratchet de lint vive en el propio plugin.

## Qué hay en este repo

```
CLAUDE.md                 reglas para Claude: proyecto, SDD, aprobación y convenciones
.sdd/
  config.json             configuración del plugin: ámbitos, comandos, rutas y gate_mode
  constitution.md         constitución, Parte II (propia de fitnerd); la Parte I está en el plugin
specs/
  NNN-slug/               una carpeta por feature, con sus artefactos y state.json
docs/sdd/
  README.md               este documento
  00-discovery.md         análisis del repo antes del primer harness (septiembre de 2026)
  decisions/              ADRs del proyecto
```

## Historia

Hasta la spec 013, fitnerd usó un harness propio versionado en el repo (`.claude/agents/`, `.claude/skills/sdd-*`, `.claude/hooks/sdd-guard.mjs`, `.claude/sdd/`, `specs/constitution.md` y `specs/_templates/`; ADR-0010). Ese harness se extrajo al plugin `sdd-beto`, se adoptó con la ADR-0024 y se retiró después en una rama `chore/…`; sigue disponible en el historial de git. Las ADR-0001 a ADR-0013 y la ADR-0023 describen su diseño y citan rutas que ya no existen; la ADR-0022 (marcador con número de spec) sigue vigente.

## Decisiones

Todas las decisiones están en [`decisions/`](decisions/README.md).
