# ADR-0007 — Integración con git: rama por feature y un commit por etapa

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario (granularidad) + Claude (convenciones)

## Contexto
Hasta ahora todo el trabajo se ha hecho directamente en `main`, sin ramas ni PRs. Cada commit y cada push requieren la aprobación del usuario (Reglas B y C), así que la granularidad de los commits determina cuánta fricción tiene el flujo.

## Decisión
- **Rama por feature:**
  - Nombre: `feat/NNN-slug`, o `fix/NNN-slug` para bugfixes.
  - Se crea desde `main` en `/sdd-new`, con aprobación del usuario.
- **Un commit por etapa que produce artefactos:**

  | Etapa | Mensaje de commit |
  |---|---|
  | spec | `Add spec for NNN-slug` |
  | plan | `Add plan for NNN-slug` |
  | tasks | `Add tasks for NNN-slug` |
  | tests | `Add failing tests for NNN-slug (REQ-…)` |
  | implement | `Implement NNN-slug` |
  | review | `Add review for NNN-slug` |

  - Se mantiene el estilo actual del repo: inglés, imperativo, sin prefijos convencionales.
  - El cuerpo del mensaje lista los REQ cubiertos y termina con la línea `Co-Authored-By` de Claude.
- **Quién hace los commits y pushes:**
  - **Solo el orquestador** (la sesión principal), y siempre tras mostrar el resumen de la Regla B y recibir aprobación explícita.
  - Ningún subagente ejecuta `git commit` ni `git push`.
- **Merge:** al cerrar, el orquestador propone hacer merge a `main` (o abrir un PR) y hacer push. Cada una de esas acciones requiere su propia aprobación (Regla C).

## Consecuencias
- (+) Unas 6 aprobaciones de commit por feature, una historia de git legible y puntos de retorno por etapa.
- (+) Al abrir PRs hacia `main` se dispara el CI existente.
- (−) Commits de solo documentación (spec, plan) en la rama. Si se prefiere una historia limpia en `main`, se puede usar squash merge.
