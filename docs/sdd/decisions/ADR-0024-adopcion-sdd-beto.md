# ADR-0024: Adopción del plugin `sdd-beto` en modo `flow`

- **Estado:** Aceptada · 2026-10-15 (decidida por el usuario durante `/sdd-beto:init`)
- **Decidido por:** el usuario; cambio del harness en una rama `chore/…` (CLAUDE.md, Convenciones).

## Contexto
fitnerd desarrolla con SDD desde la spec 001 mediante un harness propio versionado en el repo: agentes en `.claude/agents/`, comandos `/sdd-*` en `.claude/skills/`, la `role-guard` `.claude/hooks/sdd-guard.mjs`, el ratchet `.claude/sdd/scripts/ruff-new.mjs` y la constitución `specs/constitution.md` (ADR-0010). Ese harness se extrajo después a un plugin reutilizable, `sdd-beto`, con la misma estructura de etapas, agentes y hooks, configurable por proyecto (`.sdd/config.json`) y con una constitución en dos partes: la base del plugin y una Parte II propia del proyecto (`.sdd/constitution.md`).

Mantener los dos a la vez duplica agentes y hooks, y cada mejora habría que hacerla dos veces. Además, el Art. 3 de la constitución actual exige un gate en cada etapa y en cada commit, lo que en la 013 supuso más de veinte aprobaciones para una sola feature.

Opciones consideradas:
1. **Seguir con el harness propio.** Sin coste de migración, pero sin las mejoras del plugin.
2. **Adoptar el plugin en modo `strict`.** Igual que hoy: gate en cada etapa y en cada commit y push.
3. **Adoptar el plugin en modo `flow`.** El flujo se detiene en `spec`, `review` y `close`, y ante decisiones mayores; los commits de etapa son automáticos y locales; el push se aprueba una vez, en `close`.

## Decisión
- **Opción 3.** `.sdd/config.json` declara dos ámbitos (`backend` y `frontend`), `paths.specs = "specs"` (la numeración sigue en la 014) y `paths.adr = "docs/sdd/decisions"`.
- La constitución vigente pasa a ser la base del plugin más `.sdd/constitution.md` (Parte II), que recoge las reglas propias de fitnerd de la anterior (tests, arquitectura, seguridad) y conserva el marcador con número de spec (ADR-0022).
- `specs/constitution.md` deja de ser la vigente. El Art. 3 (gate en cada etapa y en cada commit) lo sustituye el Art. B3 de la base con `gate_mode: "flow"`.
- El ratchet de ruff del plugin (`lint_ratchet` con formato `ruff`) sustituye a `ruff-new.mjs`.
- Las secciones SDD, Aprobación y Convenciones de `CLAUDE.md` pasan a ser las del plugin (entre marcas `<!-- sdd-beto:… -->`). Proyecto se conserva tal cual dentro de sus marcas, y la regla de las ramas `chore/…` (ADR-0016) queda en una sección propia sin marcas.
- El harness propio (`.claude/agents/`, `.claude/skills/sdd-*`, `.claude/hooks/`, `.claude/sdd/`, `specs/constitution.md` y su registro en `.claude/settings.json`) se retira en un cambio `chore/…` aparte, que actualiza también `docs/sdd/`.

## Consecuencias
- (+) Un solo harness que se mantiene en un sitio y se actualiza con el plugin.
- (+) Menos interrupciones por feature: el usuario aprueba la spec, la revisión y el cierre, más las decisiones mayores.
- (−) Plan, tasks, tests, implement, verify y docs ya no tienen gate propio: el usuario los revisa en el gate de `review` (Art. B7).
- (−) Hasta que se retire el harness propio, sus hooks y los del plugin están activos a la vez y pueden chocar; conviene retirarlo antes de la próxima feature.
- (−) Los `state.json` de las specs 000–013 usan el formato del harness propio (`scope` como objeto); como están cerradas, no se migran.
