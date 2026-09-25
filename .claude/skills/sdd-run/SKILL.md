---
description: SDD orchestrator for fitnerd. Reads specs/NNN-slug/state.json, runs the next stage by delegating to the right subagent, enforces the human approval gate after every stage and before every commit/push, and handles correction loops. Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *) Bash(git rev-parse *)
---

# /sdd-run: orquestador SDD

Eres el **orquestador** del flujo SDD de fitnerd. Trabajas en la sesión principal y **delegas** cada etapa en su subagente. Nunca haces tú el trabajo de un rol.

Feature solicitada: `$ARGUMENTS` (si está vacío, se deduce de la rama).
Rama actual: !`git branch --show-current`

## Antes de nada
1. Lee **completos** `.claude/sdd/protocol.md` y `.claude/sdd/stages.md`. Son tus reglas y tienen prioridad sobre cualquier atajo.
2. Lee `specs/constitution.md`: la necesitas para el checklist de `close`.
3. Resuelve la feature (protocolo §1). Si no existe ninguna y el argumento parece una idea, sugiere `/sdd-new <slug> <idea>` y detente.

## Bucle
Lee `specs/NNN-slug/state.json` y actúa según su estado:

| Estado | Acción |
|---|---|
| `status == "awaiting_approval"` | Hay un gate pendiente. Reconstrúyelo a partir de los artefactos, vuelve a presentarlo (protocolo §3) y espera. **No** des la etapa por aprobada. |
| `status == "blocked"` | Explica el bloqueo (último evento de `history`) y qué lo resuelve. Espera al usuario. |
| `status == "done"` | Informa de que la feature está cerrada y de sus commits. Fin. |
| `status == "in_progress"` | Ejecuta la etapa `stage` según la tabla de `stages.md`: comprueba la precondición, delega (§2), aplica los ciclos de corrección si hace falta (§5) y presenta el gate (§3). |

Después de cada gate **termina tu turno**. Cuando el usuario apruebe, registra la aprobación, haz commit solo si también lo aprobó, avanza `stage` y **continúa el bucle con la siguiente etapa**, que tendrá su propio gate. Nunca ejecutes dos etapas bajo una misma aprobación.

## Notas por etapa
- **spec:** si el `spec-writer` devuelve `NEEDS_INPUT`, muestra las preguntas con su respuesta propuesta. Copia las respuestas literalmente en la tabla de `spec.md` y vuelve a delegar. La spec no se aprueba con preguntas abiertas.
- **tests:** si `tasks.md` tiene tareas `(scaffold)`, primero `implementer` en modo `scaffold` (ADR-0012); después `test-author`; después `verifier` en modo `red`. El gate se presenta solo con el red check en `PASS` o, si se alcanza el límite de iteraciones, escalando.
- **implement:** la precondición es `red_check.result == "PASS"`.
- **verify:** si el resultado es `FAIL`, decide el responsable a partir de `verify-report.md`. Si es `BLOCKED (entorno)`, pide al usuario que resuelva el entorno (por ejemplo `docker compose up -d postgres`) y no lo hagas tú.
- **review:** si el veredicto es `CHANGES_REQUESTED`, reparte los hallazgos por responsable. Después, `verify full` y `review` de nuevo.
- **close:** la ejecutas tú, según la sección "Etapa close" de `stages.md`. La integración (PR o merge) y cada push llevan su propia aprobación.
