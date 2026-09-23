---
description: SDD stage "tests" for fitnerd. Run the tests stage - test-author writes failing tests from the spec, then verifier checks the red state, then present the human approval gate (and proposed commit). Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *) Bash(git rev-parse *)
---

# /sdd-test: etapa `tests` (test-author + verifier (red))

Ejecuta **una sola etapa** del flujo SDD para la feature `$ARGUMENTS` (si está vacío, se deduce de la rama).
Rama actual: !`git branch --show-current`

1. Lee **completos** `.claude/sdd/protocol.md` y `.claude/sdd/stages.md`, y síguelos al pie de la letra.
2. Resuelve la feature (protocolo §1) y lee su `state.json`.
   - Si `stage` no es `tests`, avisa. Ejecutar una etapa fuera de orden solo es válido si se cumple su precondición.
   - Repetir una etapa ya aprobada **la reabre**, junto con todas las posteriores (protocolo §5). Pide confirmación antes.
3. **Etapa `tests`:** Primero delega en `test-author`. Después delega en `verifier` con **modo `red`**. Si el red check da `FAIL`, devuelve el caso al `test-author` con `verify-report.md` (`iterations.tests`, máximo 3). Si da `BLOCKED` por entorno, pide al usuario que lo resuelva. Presenta el gate solo con el red check en `PASS`.
4. Presenta el gate (protocolo §3) y **termina tu turno**.
5. Cuando el usuario apruebe, registra la aprobación, haz commit solo si también lo aprobó, avanza `stage` y indica el siguiente comando (`/sdd-implement NNN-slug`) o `/sdd-run NNN-slug`. **No** ejecutes la siguiente etapa desde este comando.
