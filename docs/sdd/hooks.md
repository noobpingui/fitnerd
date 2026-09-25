# Hooks de enforcement del harness SDD

La configuración está en [`.claude/settings.json`](../../.claude/settings.json) y el código en [`.claude/hooks/sdd-guard.mjs`](../../.claude/hooks/sdd-guard.mjs). El diseño se explica en la [ADR-0008](decisions/ADR-0008-enforcement-hooks.md).

Todos los hooks son `PreToolUse`: se ejecutan **antes** de que Claude use la herramienta y pueden bloquearla (`deny`) o pedirte confirmación (`ask`). Cuando bloquean, el motivo le llega a Claude, que puede reaccionar, y aparece prefijado con `[SDD …]`.

## 1. `role-guard`: cada agente escribe solo en lo suyo
- **Se activa con:** `Write`, `Edit`, `MultiEdit` y `NotebookEdit` hechos por un subagente SDD. Lo identifica por el campo `agent_type` que Claude Code pasa al hook.
- **Qué comprueba:**
  1. Estás en una rama `feat/NNN-slug` o `fix/NNN-slug`, y existe `specs/NNN-slug/state.json`.
  2. La etapa de `state.json` es la del agente. Por ejemplo, el `implementer` solo puede escribir en `tests` (modo scaffold, ADR-0012) e `implement`.
  3. La ruta pertenece a su rol:

| Agente | Puede escribir en |
|---|---|
| `spec-writer` | `specs/NNN/spec.md` |
| `planner` | `specs/NNN/plan.md`, `docs/sdd/decisions/ADR-*.md` y su `README.md` |
| `task-breaker` | `specs/NNN/tasks.md` |
| `test-author` | `backend/tests/**`, `frontend/src/**/*.test.ts(x)`, `frontend/src/test/**` y las casillas de `tasks.md` |
| `implementer` | `backend/**` y `frontend/**` (sin tests), los `.env.example` y las casillas de `tasks.md` |
| `verifier` | `specs/NNN/verify-report.md`, `specs/NNN/state.json` |
| `reviewer` | `specs/NNN/review.md` |
| `doc-keeper` | `README.md`, `frontend/README.md`, `CLAUDE.md` (el hook permite el archivo; su prompt lo limita a la sección Proyecto, ADR-0013), los `.env.example`, `docs/**` (salvo `docs/sdd/decisions/`) y `specs/NNN/docs-report.md` |

  4. Ningún subagente edita un `.env` real.
- Si el hook falla internamente, el agente queda bloqueado (*fail-closed*).

## 2. `stage-guard`: sin spec ni plan no hay código de producción
- **Se activa con:** escrituras de la **sesión principal** o de subagentes que no son del harness (Explore, general-purpose…) en código de producción, es decir, `backend/**` y `frontend/**` menos los tests, los `README.md` y los `.env.example`.
- **Qué comprueba:** que estés en una rama de feature cuyo `state.json` tenga `approvals.spec` y `approvals.plan`.
- **Bypass:** arranca Claude Code con la variable `SDD_BYPASS=1`. Úsalo solo en hotfixes y en las excepciones del Art. 1.2 de la constitución:
  - PowerShell: `$env:SDD_BYPASS=1; claude`
  - Git Bash: `SDD_BYPASS=1 claude`

  El bypass **no** desactiva la `role-guard`. Al terminar, cierra y vuelve a abrir Claude Code sin la variable.

## 3. `git-guard`: commits y pushes con confirmación
- **Se activa con:** los comandos `Bash` y `PowerShell` que contienen `git <subcomando>`.
- **Sesión principal:** `git commit` y `git push` devuelven `ask`, así que Claude Code te muestra la confirmación nativa **aunque tengas permisos amplios**. Es la segunda barrera de las Reglas B y C: el orquestador ya te mostró antes el resumen y esperó tu "aprobado".
- **Cualquier subagente:** solo puede usar git de lectura (`status`, `diff`, `log`, `show`, `rev-parse`, `ls-files`, `blame`, `grep`, `merge-base`, `describe`, `cat-file`, `rev-list`, `shortlog` y `branch --show-current`/`--list`). Todo lo demás (`commit`, `push`, `checkout`, `stash`, `reset`…) se bloquea.

## Qué NO cubren los hooks
Las escrituras hechas **desde la shell** (`sed -i`, `echo >`, `Set-Content`…) no pasan por `Write` ni `Edit`, así que la `role-guard` no las ve. Hay dos mitigaciones: cada prompt de rol lo prohíbe, y el `reviewer` comprueba con git que los tests no cambiaron desde el commit de la etapa `tests`. Detectar escrituras por shell de forma fiable requeriría analizar comandos arbitrarios, y eso queda como mejora para una segunda iteración.

## Desactivarlos temporalmente
| Qué quieres | Cómo |
|---|---|
| Editar código de producción fuera del flujo (hotfix) | `SDD_BYPASS=1` al arrancar Claude Code (ver arriba) |
| Desactivar **todos** los hooks en tu máquina | En `.claude/settings.local.json` (ignorado por git) pon `{ "disableAllHooks": true }`. Bórralo al terminar. |
| Desactivarlos para una sola ejecución | `claude --settings '{"disableAllHooks": true}'` |

Claude Code detecta los cambios en los archivos de settings sin reiniciar. Aun así, `SDD_BYPASS` sí exige reiniciar, porque es una variable de entorno.

## Probar los hooks
```bash
node --test .claude/hooks/        # 15 tests: rutas por rol, etapas, bypass, git y protocolo stdin/stdout
```
Para probar un caso concreto a mano:
```bash
echo '{"agent_type":"implementer","tool_input":{"file_path":"backend/tests/test_x.py"}}' | node .claude/hooks/sdd-guard.mjs write
```
