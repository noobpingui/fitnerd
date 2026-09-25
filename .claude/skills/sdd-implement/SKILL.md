---
description: SDD stage "implement" for fitnerd. Delegate the implement stage to the implementer subagent, then present the human approval gate (and proposed commit). Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *) Bash(git rev-parse *)
---

# /sdd-implement: etapa `implement` (implementer)

Ejecuta **una sola etapa** del flujo SDD para la feature `$ARGUMENTS` (si está vacío, se deduce de la rama).
Rama actual: !`git branch --show-current`

1. Lee **completos** `.claude/sdd/protocol.md` y `.claude/sdd/stages.md`, y síguelos al pie de la letra.
2. Resuelve la feature (protocolo §1) y lee su `state.json`.
   - Si `stage` no es `implement`, avisa. Ejecutar una etapa fuera de orden solo es válido si se cumple su precondición.
   - Repetir una etapa ya aprobada **la reabre**, junto con todas las posteriores (protocolo §5). Pide confirmación antes.
3. **Etapa `implement`:** Precondición: `approvals.tests` **y** `red_check.result == "PASS"`. Delega en `implementer`. Si devuelve `NEEDS_INPUT` porque cree que un test es incorrecto, **no** le permitas cambiarlo: muestra el caso al usuario y, si procede, devuélvelo al `test-author` (protocolo §5).
4. Presenta el gate (protocolo §3) y **termina tu turno**.
5. Cuando el usuario apruebe, registra la aprobación, haz commit solo si también lo aprobó, avanza `stage` y indica el siguiente comando (`/sdd-verify NNN-slug`) o `/sdd-run NNN-slug`. **No** ejecutes la siguiente etapa desde este comando.
