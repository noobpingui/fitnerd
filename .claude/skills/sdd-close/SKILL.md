---
description: SDD stage "close" for fitnerd. Close an SDD feature - definition-of-done checklist, final state commit, then PR or merge and push, each with its own approval, then present the human approval gate (and proposed commit). Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *) Bash(git rev-parse *)
---

# /sdd-close: etapa `close` (orquestador)

Ejecuta **una sola etapa** del flujo SDD para la feature `$ARGUMENTS` (si está vacío, se deduce de la rama).
Rama actual: !`git branch --show-current`

1. Lee **completos** `.claude/sdd/protocol.md` y `.claude/sdd/stages.md`, y síguelos al pie de la letra.
2. Resuelve la feature (protocolo §1) y lee su `state.json`.
   - Si `stage` no es `close`, avisa. Ejecutar una etapa fuera de orden solo es válido si se cumple su precondición.
   - Repetir una etapa ya aprobada **la reabre**, junto con todas las posteriores (protocolo §5). Pide confirmación antes.
3. **Etapa `close`:** La ejecutas **tú**, sin subagente, siguiendo la sección "Etapa close" de `stages.md`: checklist de "hecho" de la constitución (Art. 9), commit `Close NNN-slug`, elección entre PR y merge, y cada push con su propia aprobación (Regla C). Lee también `specs/constitution.md`.
4. Presenta el gate (protocolo §3) y **termina tu turno**.
5. Cuando el usuario apruebe, registra la aprobación, haz commit solo si también lo aprobó, avanza `stage` y informa de que la feature está cerrada. **No** ejecutes la siguiente etapa desde este comando.
