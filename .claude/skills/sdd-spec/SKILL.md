---
description: SDD stage "spec" for fitnerd. Delegate the spec stage to the spec-writer subagent, then present the human approval gate (and proposed commit). Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch *) Bash(git rev-parse *)
---

# /sdd-spec: etapa `spec` (spec-writer)

Ejecuta **una sola etapa** del flujo SDD para la feature `$ARGUMENTS` (si está vacío, se deduce de la rama).
Rama actual: !`git branch --show-current`

1. Lee **completos** `.claude/sdd/protocol.md` y `.claude/sdd/stages.md`, y síguelos al pie de la letra.
2. Resuelve la feature (protocolo §1) y lee su `state.json`.
   - Si `stage` no es `spec`, avisa. Ejecutar una etapa fuera de orden solo es válido si se cumple su precondición.
   - Repetir una etapa ya aprobada **la reabre**, junto con todas las posteriores (protocolo §5). Pide confirmación antes.
3. **Etapa `spec`:** Delega en `spec-writer`. Si devuelve `NEEDS_INPUT`, muestra las preguntas con su respuesta propuesta, copia literalmente las respuestas del usuario en la tabla "Preguntas abiertas" de `spec.md` y vuelve a delegar. No presentes el gate con preguntas sin resolver.
4. Presenta el gate (protocolo §3) y **termina tu turno**.
5. Cuando el usuario apruebe, registra la aprobación, haz commit solo si también lo aprobó, avanza `stage` y indica el siguiente comando (`/sdd-plan NNN-slug`) o `/sdd-run NNN-slug`. **No** ejecutes la siguiente etapa desde este comando.
