---
description: Start a new SDD feature in fitnerd - allocates NNN, proposes the feat/NNN-slug branch, creates specs/NNN-slug/ with idea.md and state.json. Manual use only.
argument-hint: "<slug> <idea de la feature en lenguaje natural>"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git branch *) Bash(git log *)
---

# /sdd-new: crear una feature SDD

Argumentos: `$ARGUMENTS`. El **primer token** es el slug (kebab-case, en inglés y corto, p. ej. `weekly-plan-notes`); el **resto** es la idea.
Rama actual: !`git branch --show-current`

Lee primero `.claude/sdd/protocol.md` (§0 y §4).

## Pasos
1. **Validar la entrada.**
   - Si falta el slug o la idea, pídelos y detente.
   - Si el slug no está en kebab-case, propón uno.
2. **Comprobar el entorno** con git de solo lectura:
   - El árbol de trabajo está limpio (`git status --porcelain` vacío). Si no, muestra lo pendiente y detente.
   - Estás en `main`. Si no, avisa y pregunta si se debe partir de `main`.
   - No existe ya una carpeta `specs/*-<slug>/`.
3. **Número:** NNN es el siguiente correlativo de tres dígitos entre las carpetas `specs/[0-9][0-9][0-9]-*`. Empieza en `001`; el `000` se reserva para el ejemplo del harness.
4. **Proponer**, sin ejecutar nada todavía:
   - **Tipo:** `feature`, `fix` o `refactor`, según la idea.
   - **Ámbito:** backend, frontend o ambos.
   - **Rama:** `feat/NNN-slug` (o `fix/NNN-slug`).
   - **Carpeta:** `specs/NNN-slug/`.

   Muestra ese resumen y la idea literal, y pregunta: **"¿Apruebas crear la rama y la carpeta?"**. Después termina tu turno.
5. **Con la aprobación explícita del usuario:**
   1. Crea la rama y cámbiate a ella: `git checkout -b <rama>`.
   2. Crea `specs/NNN-slug/idea.md` con la idea **literal** del usuario, precedida de un encabezado `# Idea original · NNN-slug` y la fecha.
   3. Copia `specs/_templates/state.json` a `specs/NNN-slug/state.json` y rellena:
      - `feature`, `title`, `type`, `scope`, `branch` y `created_at`;
      - `stage: "spec"` y `status: "in_progress"`;
      - la primera entrada de `history` con `event: "created"`.

      Después, valida que es JSON válido.
   4. **No hagas commit.** Estos archivos entran en el commit de la etapa `spec`.
6. **Cierre:** muestra lo creado e indica los siguientes pasos:
   - `/sdd-run NNN-slug`, que recorre todo el flujo con un gate en cada etapa;
   - o `/sdd-spec NNN-slug`, que ejecuta solo la etapa spec.
