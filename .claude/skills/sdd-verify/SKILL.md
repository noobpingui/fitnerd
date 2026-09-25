---
description: SDD stage "verify" for fitnerd. Run the verify stage - verifier runs tests, lint, typecheck, build and traceability checks, then present the human approval gate (and proposed commit). Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *) Bash(git rev-parse *)
---

# /sdd-verify: etapa `verify` (verifier (full))

Ejecuta **una sola etapa** del flujo SDD para la feature `$ARGUMENTS` (si está vacío, se deduce de la rama).
Rama actual: !`git branch --show-current`

1. Lee **completos** `.claude/sdd/protocol.md` y `.claude/sdd/stages.md`, y síguelos al pie de la letra.
2. Resuelve la feature (protocolo §1) y lee su `state.json`.
   - Si `stage` no es `verify`, avisa. Ejecutar una etapa fuera de orden solo es válido si se cumple su precondición.
   - Repetir una etapa ya aprobada **la reabre**, junto con todas las posteriores (protocolo §5). Pide confirmación antes.
3. **Etapa `verify`:** Precondición: `approvals.implement`. Delega en `verifier` con **modo `full`**. Si da `FAIL`, reparte según `verify-report.md` (código → `implementer`; tests → `test-author`) y vuelve a verificar, siguiendo el protocolo §5. En el gate, destaca los AC marcados como "manual" para que el usuario los pruebe. Esta etapa no hace commit.
4. Presenta el gate (protocolo §3) y **termina tu turno**.
5. Cuando el usuario apruebe, registra la aprobación, haz commit solo si también lo aprobó, avanza `stage` y indica el siguiente comando (`/sdd-review NNN-slug`) o `/sdd-run NNN-slug`. **No** ejecutes la siguiente etapa desde este comando.
