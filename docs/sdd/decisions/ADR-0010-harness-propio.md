# ADR-0010 — Harness propio, inspirado en GitHub Spec Kit y Kiro

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** Claude (sin trade-offs relevantes para el usuario)

## Contexto
Ya existen herramientas de SDD:
- **GitHub Spec Kit:** constitución, `/specify`, `/plan` y `/tasks`, con plantillas.
- **Kiro:** requirements en EARS, design y tasks.

Adoptarlas tal cual traería convenciones y scripts genéricos que no encajan con los requisitos de fitnerd:
- Roles aislados por agente.
- Hooks por `agent_type`.
- Gates en cada etapa.
- Windows.
- Un monorepo Flask/React.

## Decisión
Se construye un harness propio y ligero que toma ideas concretas de ambas:
- **De Spec Kit:** la constitución como documento no negociable, las plantillas con secciones obligatorias, la numeración `NNN-slug` y el paso explícito de clarificación de ambigüedades en la spec.
- **De Kiro:** los requisitos en EARS y la secuencia requirements → design → tasks con trazabilidad.
- **Añadido propio:**
  - Un agente por rol con permisos aislados.
  - `state.json` como máquina de estados.
  - Hooks de enforcement.
  - Verificación del rojo en TDD.
  - Reglas de aprobación antes de commit y push.

No se instala ninguna dependencia externa para el harness: todo son archivos Markdown, JSON y scripts Node.

## Consecuencias
- (+) El harness está adaptado al repo, se entiende completo y no depende de herramientas de terceros.
- (−) El mantenimiento es propio: si Spec Kit o Kiro evolucionan, las mejoras hay que incorporarlas a mano.
