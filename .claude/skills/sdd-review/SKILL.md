---
description: SDD stage "review" for fitnerd. Delegate the review stage to the reviewer subagent, then present the human approval gate (and proposed commit). Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *) Bash(git rev-parse *)
---

# /sdd-review: etapa `review` (reviewer)

Ejecuta **una sola etapa** del flujo SDD para la feature `$ARGUMENTS` (si está vacío, se deduce de la rama).
Rama actual: !`git branch --show-current`

1. Lee **completos** `.claude/sdd/protocol.md` y `.claude/sdd/stages.md`, y síguelos al pie de la letra.
2. Resuelve la feature (protocolo §1) y lee su `state.json`.
   - Si `stage` no es `review`, avisa. Ejecutar una etapa fuera de orden solo es válido si se cumple su precondición.
   - Repetir una etapa ya aprobada **la reabre**, junto con todas las posteriores (protocolo §5). Pide confirmación antes.
3. **Etapa `review`:** Precondición: `approvals.verify` **y** `verify.result == "PASS"`. Delega en `reviewer`. Si el veredicto es `CHANGES_REQUESTED`, reparte los hallazgos BLOQUEANTE/MAYOR por responsable y después ejecuta `verify full` y `review` de nuevo (`iterations.review`, máximo 3). En el gate, pregunta qué hacer con los hallazgos MENOR/NIT. El commit incluye `verify-report.md` y `review.md`.
4. Presenta el gate (protocolo §3) y **termina tu turno**.
5. Cuando el usuario apruebe, registra la aprobación, haz commit solo si también lo aprobó, avanza `stage` y indica el siguiente comando (`/sdd-docs NNN-slug`) o `/sdd-run NNN-slug`. **No** ejecutes la siguiente etapa desde este comando.
