---
description: Read-only status of SDD features in fitnerd - stage, approvals, iterations, branch - plus consistency checks of state.json and the next suggested command. Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git branch *) Bash(git log *) Bash(git rev-parse *)
---

# /sdd-status: estado del flujo SDD

Este comando es **de solo lectura**: no modifiques ningún archivo ni ejecutes git con escritura.

Feature: `$ARGUMENTS` (si está vacío, se muestran todas).
Rama actual: !`git branch --show-current`

## Pasos
1. Busca con Glob `specs/[0-9][0-9][0-9]-*/state.json`. Si no hay ninguno, indícalo y sugiere `/sdd-new`.
2. Muestra una tabla con una fila por feature:
   `Feature | Tipo | Rama | Etapa | Estado | Aprobadas (n/9) | Iteraciones (tests/impl/review) | Último evento`
3. Para la feature indicada, o la de la rama actual, añade el detalle:
   - las aprobaciones con fecha;
   - los commits por etapa;
   - el resultado del red check, de verify y de review;
   - los últimos 5 eventos de `history`.
4. **Chequeos de consistencia.** Reporta cada problema con la corrección que propones, pero **no la apliques**:
   - `state.json` es JSON válido.
   - La rama `branch` existe (`git branch --list <rama>`).
   - Todas las etapas anteriores a `stage` tienen su aprobación, y ninguna posterior la tiene.
   - Existen los artefactos esperados para las etapas aprobadas: `spec.md` tras spec, `plan.md` tras plan, etc.
   - Los shas de `commits` existen: `git rev-parse --verify <sha>^{commit}`.
   - `stage == "implement"` exige `red_check.result == "PASS"`; `stage == "review"` exige `verify.result == "PASS"`.
   - Si hay cambios sin commitear (`git status --short`), indícalo.
5. **Siguiente paso sugerido:**
   - si `status == "awaiting_approval"`, "responde al gate pendiente o ejecuta `/sdd-run` para verlo de nuevo";
   - si `status == "blocked"`, qué lo desbloquea;
   - en otro caso, `/sdd-run NNN-slug` o `/sdd-<etapa> NNN-slug`.

Si hay inconsistencias, la reparación de `state.json` la hace la sesión principal **solo con la aprobación del usuario**, siguiendo la guía de uso (sección "Resolución de problemas").
