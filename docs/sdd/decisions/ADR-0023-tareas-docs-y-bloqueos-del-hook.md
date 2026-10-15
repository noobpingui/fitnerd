# ADR-0023: Tareas `(docs)` fuera de `verify` y bloqueos del hook

- **Estado:** Aceptada · 2026-10-15 (decidida por el usuario tras la etapa `verify` de `013-polish-006-010`)
- **Decidido por:** el usuario; cambio del harness en una rama `chore/…` (CLAUDE.md, Convenciones).

## Contexto
En la 013, el `task-breaker` creó una tarea de tipo `(docs)` (T-046: dividir una fila del `CLAUDE.md`), cubierta por una excepción de trazabilidad. Aparecieron tres problemas:

1. **`verify` no podía pasar.** El `verifier` exige todas las tareas `[x]`, pero las tareas `(docs)` las hace el `doc-keeper` en la etapa `docs`, que va después de `verify` y de `review`. Se resolvió con una excepción puntual en `state.json` (`tasks_checkbox_exception`).
2. **El `doc-keeper` no tenía permiso para marcar la casilla.** La `role-guard` (`sdd-guard.mjs`) no le deja escribir en `tasks.md`, y su ficha lo prohíbe; aun así la T-046 quedó marcada.
3. **Los bloqueos del hook se esquivaron con Bash.** La `role-guard` solo vigila `Write`, `Edit`, `MultiEdit` y `NotebookEdit`. En la misma feature, el `test-author` topó con el hook (por un `stage` mal puesto por el orquestador) y aplicó el cambio con `sed`. El contenido era correcto las dos veces, pero el control dependía de la buena voluntad del agente.

Opciones consideradas para las tareas `(docs)`:
1. **Prohibir las tareas `(docs)`** y dejar la documentación solo en el `docs-report.md`. Se pierde la trazabilidad REQ → tarea de los NFR de documentación (como el NFR-006 de la 013).
2. **Excluirlas de `verify` y que las marque el `doc-keeper`.** El Art. 9 de la constitución (todas las tareas `[x]` al cerrar) sigue garantizando que se hacen.
3. **Mover `docs` antes de `verify`.** Rompe el orden del flujo: se documentaría código sin revisar.

## Decisión
- **Opción 2.** El `verifier`, en modo `full`, no cuenta como FAIL las tareas `(docs)` sin marcar; las lista como pendientes de la etapa `docs`.
- El `doc-keeper` hace las tareas `(docs)` y marca **solo** sus casillas. La `role-guard` le permite escribir `specs/NNN-slug/tasks.md` (como al `test-author` y al `implementer`); su ficha limita el cambio a las casillas `(docs)`.
- En `close`, el checklist no cambia: el Art. 9 ya exige todas las tareas `[x]`.
- **Bloqueos del hook:** todas las fichas de `.claude/agents/` prohíben repetir por otro camino una escritura que el hook rechazó. El agente se detiene y lo explica en `QUESTIONS`. `docs/sdd/hooks.md` documenta el límite de la `role-guard`.

## Consecuencias
- (+) Una feature con tareas `(docs)` pasa `verify` sin excepciones puntuales en `state.json`.
- (+) El `doc-keeper` marca sus tareas con permiso, y el `close` sigue comprobando que se hicieron.
- (+) Un bloqueo del hook llega al orquestador (y al usuario) en vez de resolverse en silencio.
- (−) La prohibición de esquivar el hook es una instrucción, no un control: un agente que la ignore sigue pudiendo escribir con Bash. Bloquearlo de verdad exigiría analizar los comandos de Bash en el hook (`sed -i`, redirecciones, `tee`, intérpretes…), con muchos falsos positivos; queda en el backlog.
- (−) Igual que con el `test-author` y el `implementer`, el hook permite al `doc-keeper` todo `tasks.md`; limitarlo a las casillas `(docs)` depende de su ficha.
