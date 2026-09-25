# Etapas del flujo SDD

Orden: `spec → plan → tasks → tests → implement → verify → review → docs → close → done`. Cada etapa termina en un gate humano ([protocol.md §3](protocol.md)).

| Etapa | Agente(s) | Precondición en `state.json` | Produce | Commit (si se aprueba) |
|---|---|---|---|---|
| `spec` | `spec-writer` | la carpeta y `idea.md` existen | `spec.md` | `Add spec for NNN-slug` |
| `plan` | `planner` | `approvals.spec` | `plan.md` (+ ADRs) | `Add plan for NNN-slug` |
| `tasks` | `task-breaker` | `approvals.plan` | `tasks.md` | `Add tasks for NNN-slug` |
| `tests` | `implementer` (modo `scaffold`, solo si hay tareas `(scaffold)`) → `test-author` → `verifier` (modo `red`) | `approvals.tasks` | esqueletos, tests, casillas de `tasks.md`, `verify-report.md` (red) | `Add failing tests for NNN-slug` |
| `implement` | `implementer` | `approvals.tests` **y** `red_check.result == "PASS"` | código de producción, casillas de `tasks.md` | `Implement NNN-slug` |
| `verify` | `verifier` (modo `full`) | `approvals.implement` | `verify-report.md` (full) | — (se incluye en el commit de review) |
| `review` | `reviewer` | `approvals.verify` **y** `verify.result == "PASS"` | `review.md` | `Add review for NNN-slug` |
| `docs` | `doc-keeper` | `approvals.review` **y** `review.verdict == "APPROVED"` | docs actualizados, `docs-report.md` | `Update docs for NNN-slug` |
| `close` | orquestador | `approvals.docs` | checklist de "hecho", merge o PR, push | `Close NNN-slug` (solo `state.json`) |

Comando de cada etapa: `/sdd-spec`, `/sdd-plan`, `/sdd-tasks`, `/sdd-test` (etapa `tests`), `/sdd-implement`, `/sdd-verify`, `/sdd-review`, `/sdd-docs` y `/sdd-close`. `/sdd-run` las encadena, con un gate entre cada una.

En las correcciones, los commits usan `Fix <qué> for NNN-slug (iteration N)`. Todos los mensajes terminan con la línea `Co-Authored-By` indicada por el entorno.

## Qué debe revisar el usuario en cada gate
| Etapa | Revisa sobre todo |
|---|---|
| `spec` | ¿Es lo que quieres? ¿Falta algún caso límite o error? ¿Cada AC es comprobable? ¿Está claro lo que queda fuera de alcance? |
| `plan` | ¿Encaja con la arquitectura? ¿Hay migración? ¿Riesgos razonables? ¿Reutiliza lo existente? ¿Algún ADR nuevo? |
| `tasks` | ¿Cada AC tiene una tarea de test? ¿Tareas pequeñas y en orden lógico? ¿Nada fuera del plan? |
| `tests` | ¿Los tests prueban los AC (lee 2 o 3)? ¿El red check es legítimo? ¿Fakes en lugar de mocks? ¿Los esqueletos solo tienen firmas que lanzan "not implemented"? |
| `implement` | ¿El diff se limita a lo planeado? ¿Tests en verde según el implementer? |
| `verify` | ¿Todo en verde? ¿Trazabilidad completa? ¿Hay AC "manuales" que debas probar tú en la app? |
| `review` | Veredicto y hallazgos MENOR/NIT: ¿se aceptan o se crea una tarea futura? |
| `docs` | ¿La documentación describe bien el cambio? ¿Hay valores reales en `.env.example`? |
| `close` | Checklist de "hecho" (constitución, Art. 9) y modo de integración |

## Etapa `close`: la ejecuta el orquestador
1. Recorre la **definición de "hecho"** (constitución, Art. 9) y muestra cada punto con ✅ o ❌. Si hay algún ❌, detente.
2. Con la aprobación del gate, pon `approvals.close`, `stage="done"` y `status="done"`, y propón el commit `Close NNN-slug` (solo `state.json`), mediante la Regla B. Así el estado final queda versionado en la rama.
3. Propón la integración y **pregunta cuál prefiere el usuario**:
   - **(a) PR (recomendado):** push de la rama (Regla C) y `gh pr create --base <base_branch>` con la spec enlazada. El CI se dispara en el PR.
   - **(b) Merge local:** `git checkout <base_branch> && git merge --no-ff feat/NNN-slug`, y después push de `<base_branch>` (Regla C). El PR de la opción (a) también se abre contra `<base_branch>` (`--base <base_branch>`).
4. Cada push se aprueba por separado. El push y el PR o merge no se anotan en `state.json`, que ya está commiteado como `done`; se informan en el chat con el enlace al PR o el sha del merge.
