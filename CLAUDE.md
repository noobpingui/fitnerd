# fitnerd

Monorepo. `backend/` es Flask 3, SQLAlchemy 2, Alembic, Postgres con pgvector y Redis, en Python 3.13. `frontend/` es React 19, Vite, TypeScript, Tailwind, TanStack Query y zod, gestionado con npm. El detalle está en `docs/sdd/00-discovery.md`.

| | Backend (`cd backend`) | Frontend (`cd frontend`) |
|---|---|---|
| Tests | `.venv/Scripts/python.exe -m pytest -q` (requiere `docker compose up -d postgres`) | `npm test` |
| Lint | `node .claude/sdd/scripts/ruff-new.mjs` (desde la raíz, solo violaciones nuevas) | `npm run lint` |
| Typecheck / build | — | `npx tsc -b` / `npm run build` |

## Desarrollo guiado por specs (SDD): obligatorio

**Ningún cambio funcional entra sin spec.** Todo cambio de comportamiento sigue el flujo:

`spec → plan → tasks → tests (rojo) → implement → verify → review → docs → close`

- **Cómo arrancar:** `/sdd-new <slug> <idea>` y después `/sdd-run [NNN-slug]`. El orquestador delega cada etapa en su subagente de `.claude/agents/`.
- **Comandos por etapa:** `/sdd-spec`, `/sdd-plan`, `/sdd-tasks`, `/sdd-test`, `/sdd-implement`, `/sdd-verify`, `/sdd-review`, `/sdd-docs` y `/sdd-close`. Para ver el estado, `/sdd-status`.
- **Artefactos:** en `specs/NNN-slug/`. Los principios no negociables están en `specs/constitution.md`, y la guía completa en `docs/sdd/README.md`.
- **Roles separados:** la sesión principal orquesta y **no** escribe spec, plan, tests ni código. Esos los escribe cada subagente, y los hooks (`docs/sdd/hooks.md`) bloquean que alguien escriba fuera de su rol.
- **Excepciones sin spec completa** (constitución, Art. 1.2): typos, cambios de copy o estilos, y bumps de dependencias. Los hotfixes se hacen con `SDD_BYPASS=1` y llevan una spec retroactiva.

## Aprobación humana: obligatoria

- **Al cerrar cada etapa**, detente, muestra el resumen (qué se produjo, decisiones, siguiente etapa y preguntas) y espera un "aprobado" explícito. El silencio no aprueba, y nunca se agrupan varias etapas en una sola aprobación.
- **Antes de cada `git commit`**, muestra los archivos (`git status --short` y `git diff --stat`), un resumen en lenguaje claro y el mensaje propuesto. Espera aprobación.
- **Antes de cada `git push`**, muestra la rama de origen y de destino y la lista de commits. Espera aprobación.
- **Solo la sesión principal** hace commit y push, nunca un subagente. Nada de `git add -A`, `--no-verify` ni `push --force` a `main`.

## Convenciones

- **Ramas:** `feat/NNN-slug` o `fix/NNN-slug`. Nunca trabajes directamente en `main`.
- **Commits:** en inglés e imperativo, sin prefijos convencionales.
- **Idioma:** comentarios, docstrings y textos de la UI en español correcto, sin voseo. Los nombres de tests del backend van en inglés.
- **Arquitectura:**
  - Backend: capas `routes → services → repositories → models`, dependencias inyectadas por constructor y `UnitOfWork` para los commits.
  - Frontend: organizado por feature en `src/features/<x>/`, con las llamadas HTTP a través de `apiFetch`.
- **Tests:** fakes escritos a mano en lugar de mocks, y cada test lleva un marcador de trazabilidad `SDD: REQ-… AC-…`.
- **`README.md`:** comprueba su codificación con `file README.md` después de editarlo. Históricamente dio problemas de UTF-16.
