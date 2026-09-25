# fitnerd

## Proyecto

App de fitness full-stack con un **coach de IA basado en contenido real**: responde solo con transcripciones de vídeos de entrenamiento y, si la respuesta no está ahí, dice "no lo sé". Es un proyecto de portfolio personal. En producción está en https://fitnerd.betofallas.dev. El "por qué" de cada decisión está en `README.md`, que está en inglés.

**Áreas funcionales:**

| Área | Backend (`routes/`) | Frontend (`src/features/`) |
|---|---|---|
| Autenticación (email/contraseña, Google Sign-In, JWT RS256) | `auth_routes` | `auth` |
| Catálogo de ejercicios (región → categoría → ejercicio) | `body_region_routes`, `exercise_category_routes`, `exercise_routes` | `exercises` |
| Favoritos y plan semanal (drag and drop) | `exercise_favorite_routes`, `weekly_plan_routes` | `weekly-plan` |
| Métricas corporales, gráficas y análisis con IA | `body_metric_routes` | `body-metrics` |
| Coach de IA con RAG (pgvector, Voyage y Claude, con rate limit en Redis) | `coach_routes` | `coach` |
| Feedback, home, páginas legales y tienda (solo estructura) | `feedback_routes` | `feedback`, `home`, `legal`, `store` |
| Salud del servicio (`GET /api/health`) | `health_routes` | — |

**Arquitectura:**
- **Backend** (Flask 3, SQLAlchemy 2, Alembic, Python 3.13):
  - `create_app()` como factory.
  - Capas `routes → services → repositories → models`; solo `UnitOfWork` hace commit.
  - Las dependencias se inyectan por constructor desde `_build_*_service()`.
  - Los errores se lanzan como excepciones de `exceptions/custom_exceptions.py` y salen como `{"error": …}`.
  - Los singletons están en `extensions.py`.
- **Frontend** (React 19, Vite, TypeScript, Tailwind, shadcn, TanStack Query, react-hook-form con zod):
  - Organizado por feature.
  - Toda llamada HTTP pasa por `src/lib/apiClient.ts` (`apiFetch`).
- **Pipeline RAG** (`backend/scripts/`, se ejecuta fuera de la app):
  1. Descarga el audio con yt-dlp y lo transcribe con faster-whisper.
  2. Sube la transcripción a S3.
  3. La divide en fragmentos y calcula sus embeddings con Voyage.
  4. Guarda los embeddings en pgvector.

**Despliegue:**
- Frontend en **Vercel**: cada push a `main` despliega automáticamente.
- Backend en **AWS EC2**, detrás de Caddy con HTTPS en `api.fitnerd.betofallas.dev`. Se despliega a mano: `git pull` y después `docker compose -f docker-compose.prod.yml up -d --build`.
- Redis corre en la misma instancia.
- Postgres de producción en **Supabase**.
- CI (GitHub Actions): `backend-tests.yml` ejecuta pytest y `frontend-tests.yml` ejecuta `npm test`. Solo se disparan en push o PR a `main`.

**Entorno local:**
- Copia los tres `.env.example` (raíz, `backend/` y `frontend/`) a `.env`.
- Genera las claves JWT: `cd backend && python -m scripts.generate_jwt_keys`.
- Levanta los servicios: `docker compose up -d postgres redis`. Postgres usa el puerto **5433**.
- Instala las dependencias:
  - backend: `backend/.venv` con `pip install -r requirements.txt -r requirements-dev.txt`;
  - frontend: `npm ci`.

| | Backend (`cd backend`) | Frontend (`cd frontend`) |
|---|---|---|
| Tests | `.venv/Scripts/python.exe -m pytest -q` (requiere Postgres) | `npm test` |
| Lint | `node .claude/sdd/scripts/ruff-new.mjs` (desde la raíz; solo cuenta violaciones nuevas) | `npm run lint` |
| Typecheck / build | — | `npx tsc -b` / `npm run build` |
| Migraciones | `flask db migrate -m "…"` / `flask db upgrade` | — |

**Puntos delicados:**
- **Windows:** hay Git Bash y PowerShell, y el Python del venv está en `.venv/Scripts/python.exe`.
- **`backend/.env.example` está incompleto:** la lista real de variables está en `config.py`. Faltan las de JWT, Voyage, `ANTHROPIC_MODEL`, `CORS_ORIGINS` y `SECRET_KEY`.
- **Nunca ejecutes `docker compose config`:** imprime los secretos en claro. Ya causó una rotación de contraseña. Para validar un YAML, usa un parser.
- **Migraciones sin detectar:** los tests crean las tablas con `create_all()`, no con las migraciones, así que una migración olvidada no la detecta ningún test. Revísalo a mano.
- **Dependencias:** `requirements.txt` no fija versiones y mezcla las del runtime con las del pipeline RAG.
- **Codificación de `README.md`:** fue UTF-16 en el pasado. Comprueba con `file README.md` después de editarlo.
- **Código existente sin lint:** tiene unas 145 violaciones de ruff previas; no las arregles fuera de una tarea que lo pida.
- **Antes de tocar un área, mira su estado real:** la cobertura de tests es baja (ver `docs/sdd/00-discovery.md`, que es una foto de septiembre de 2026).

## Desarrollo guiado por specs (SDD): obligatorio

**Ningún cambio funcional entra sin spec.** Todo cambio de comportamiento sigue el flujo:

`spec → plan → tasks → tests (rojo) → implement → verify → review → docs → close`

- **Cómo arrancar:** `/sdd-new <slug> <idea>` y después `/sdd-run [NNN-slug]`. El orquestador delega cada etapa en su subagente de `.claude/agents/`. Estos comandos solo los puede escribir el usuario.
- **Comandos por etapa:** `/sdd-spec`, `/sdd-plan`, `/sdd-tasks`, `/sdd-test`, `/sdd-implement`, `/sdd-verify`, `/sdd-review`, `/sdd-docs` y `/sdd-close`. Para ver el estado, `/sdd-status`.
- **Artefactos:** en `specs/NNN-slug/`. Los principios no negociables están en `specs/constitution.md`; la guía práctica en `docs/sdd/GUIA-DE-USO.md` y la visión general en `docs/sdd/README.md`.
- **Roles separados:** la sesión principal orquesta y **no** escribe spec, plan, tests ni código. Esos los escribe cada subagente, y los hooks (`docs/sdd/hooks.md`) bloquean que alguien escriba fuera de su rol.
- **Excepciones sin spec completa** (constitución, Art. 1.2): typos, cambios de copy o estilos, y bumps de dependencias. Los hotfixes se hacen con `SDD_BYPASS=1` y llevan una spec retroactiva.

## Aprobación humana: obligatoria

- **Al cerrar cada etapa**, detente, muestra el resumen (qué se produjo, decisiones, siguiente etapa y preguntas) y espera un "aprobado" explícito. El silencio no aprueba, y nunca se agrupan varias etapas en una sola aprobación.
- **Antes de cada `git commit`**, muestra los archivos (`git status --short` y `git diff --stat`), un resumen en lenguaje claro y el mensaje propuesto. Espera aprobación.
- **Antes de cada `git push`**, muestra la rama de origen y de destino y la lista de commits. Espera aprobación.
- **Solo la sesión principal** hace commit y push, nunca un subagente. Nada de `git add -A`, `--no-verify` ni `push --force` a `main`.

## Convenciones

- **Ramas:** `feat/NNN-slug` o `fix/NNN-slug`; `chore/…` solo para cambios del harness o de documentación. Nunca trabajes directamente en `main`.
- **Commits:** en inglés e imperativo, sin prefijos convencionales.
- **Idioma:** comentarios, docstrings y textos de la UI en español correcto, sin voseo. Los nombres de tests del backend van en inglés.
- **Tests:** fakes escritos a mano en lugar de mocks, y cada test lleva un marcador de trazabilidad `SDD: REQ-… AC-…`.
- **Mantenimiento de este archivo:** la sección **Proyecto** la actualiza el `doc-keeper` en la etapa `docs` cuando una feature la deja desactualizada (ADR-0013). Las demás secciones solo cambian mediante un ADR.
