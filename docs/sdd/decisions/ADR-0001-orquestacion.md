# ADR-0001 — Orquestación en la sesión principal mediante skills, sin anidamiento de subagentes

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario (formato skills) + Claude (resto), tras consultar la documentación vigente

## Contexto
- El harness necesita un orquestador que delegue en agentes especializados, aplique gates humanos y mantenga el estado.
- La documentación actual de Claude Code (https://code.claude.com/docs/en/sub-agents.md) indica que, **por defecto, un subagente puede lanzar otros subagentes hasta 3 niveles de profundidad**. Esto contradice la premisa original de que "los subagentes no pueden invocar a otros".
- Un subagente no puede detenerse a pedir aprobación al usuario a mitad de su ejecución: solo la sesión principal puede.
- `.claude/commands/` sigue soportado, pero la documentación recomienda las skills (https://code.claude.com/docs/en/skills.md). Ambos formatos generan `/sdd:run` mediante subdirectorios.

## Decisión
- **Orquestador:** es la sesión principal, guiada por la skill `/sdd:run`, y no un subagente. Los gates humanos solo se pueden aplicar desde ahí.
- **Sin anidamiento de subagentes**, con dos medidas:
  - `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` en `.claude/settings.json`.
  - Ningún agente del harness incluye la herramienta `Agent` en `tools`.

  Así cada rol hace su trabajo él mismo y no puede delegarlo en otro.
- **Formato de los comandos:** skills en `.claude/skills/sdd/<etapa>/SKILL.md`, que se invocan como `/sdd:<etapa>`.
- **Comunicación entre agentes:** solo mediante artefactos en disco (`specs/NNN-slug/`). Cada agente recibe rutas, no contexto conversacional.

## Consecuencias
- (+) El control y los gates viven donde el usuario puede responder, y los roles no se pueden saltar por delegación.
- (+) Las skills permiten archivos de apoyo compartidos, por ejemplo el protocolo de gates en un solo archivo.
- (−) La sesión principal acumula los resúmenes de cada etapa. Se mitiga pidiendo a los agentes informes breves y guardando el detalle en disco.
- (−) Si una versión futura cambia la semántica de profundidad, hay que revisar esta ADR.
