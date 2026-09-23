# ADR-0008 — Enforcement: hooks de rol y ruta, y confirmación obligatoria en git

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario (nivel) + Claude (mecanismo)

## Contexto
- Los subagentes no admiten restricciones de escritura por ruta de forma nativa. Solo se les puede limitar la lista de herramientas.
- La documentación de hooks (https://code.claude.com/docs/en/hooks.md) confirma dos cosas útiles:
  - `PreToolUse` recibe `agent_type` cuando la llamada la hace un subagente, así que se puede aplicar una regla por rol.
  - El hook puede devolver `permissionDecision: "deny" | "ask"`, o salir con código 2 para bloquear.
- El entorno es Windows. Los hooks se ejecutan con Git Bash (o con PowerShell si Git Bash no está instalado).

## Decisión
Se usan hooks `PreToolUse` configurados en `.claude/settings.json` y escritos en **Node.js**, porque ya es dependencia del proyecto y es portable (no depende de bash ni de jq):

1. **Guardia de rol y ruta** (`Write|Edit|NotebookEdit`):
   - Cuando `agent_type` es un agente SDD, bloquea las escrituras fuera de sus rutas permitidas. Por ejemplo, el `implementer` no puede escribir en los tests ni en `specs/`, y el `test-author` no puede escribir código de producción.
   - Además valida la etapa actual en `state.json`.
2. **Guardia de etapa** (`Write|Edit` sobre código de producción):
   - Si ninguna feature activa tiene la spec y el plan aprobados en `state.json`, la edición se bloquea.
   - Se puede omitir de forma explícita con la variable `SDD_BYPASS=1`. Esto está pensado para hotfixes y está documentado en la guía de uso.
3. **Guardia de git** (`Bash`): ante `git commit` o `git push` devuelve `"ask"`, lo que obliga a mostrar la confirmación nativa aunque haya permisos amplios. Si la llamada viene de un subagente, devuelve `"deny"`.
4. **Sin lint automático tras cada edición.** El lint y el typecheck los ejecuta el `verifier`.

Todos los hooks se pueden desactivar temporalmente con `"disableAllHooks": true` en `.claude/settings.local.json`. Ese archivo no se versiona.

## Consecuencias
- (+) Las violaciones de rol se bloquean de forma determinista y no dependen solo de lo que diga el prompt.
- (−) Un hook mal escrito puede bloquear trabajo legítimo. Cada hook tendrá sus propias pruebas en la prueba en seco (Fase 7) y un mensaje de error que explique cómo proceder.
- (−) La sesión principal (`agent_type` ausente) queda restringida solo por la guardia de etapa y la de git. Esto es deliberado, para no bloquear el trabajo fuera del flujo SDD, por ejemplo la propia configuración del harness.
