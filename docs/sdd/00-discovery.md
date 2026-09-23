# 00 — Descubrimiento del repositorio (Fase 0 del harness SDD)

> Fecha: 2026-09-22 · Rama: `chore/sdd-harness` · Base: `main` @ `8bfff1d`
> Documento de solo lectura: describe el estado del repo **antes** de instalar el harness SDD.

## 1. Stack y estructura

**Monorepo** con dos aplicaciones independientes:

| Parte | Stack | Gestor |
|---|---|---|
| `backend/` | Python 3.13 · Flask 3.1 · SQLAlchemy 2.0 · Flask-Migrate/Alembic · Postgres + pgvector · Redis · gunicorn | `pip` + `requirements.txt` (sin versiones fijadas) |
| `frontend/` | React 19 · Vite 8 · TypeScript ~6.0 · Tailwind 4 · shadcn/radix · TanStack Query 5 · react-hook-form + zod · react-router 7 | `npm` (`package-lock.json`) |

**Backend — arquitectura en capas:**

```
backend/
  app.py            create_app(config_name) — factory
  wsgi.py           entrypoint gunicorn
  config.py         Development / Production / Testing
  extensions.py     singletons: db, migrate, cors, jwt_manager, embedding_client, rate_limiter
  routes/           9 blueprints (construyen sus servicios vía _build_*_service() → DI manual)
  services/         11 servicios (lógica de negocio)
  repositories/     base_repository.py (CRUD genérico, nunca hace commit) + 11 repos
  unit_of_work/     commit / rollback
  models/           11 modelos SQLAlchemy
  decorators/       require_auth, require_admin
  exceptions/       excepciones base/custom + error_handlers
  utils/            jwt_utils (RS256), llm_client (Anthropic), embeddings (Voyage), rate_limiter (Redis), chunking
  scripts/          pipeline RAG (yt-dlp + faster-whisper + S3), migración de catálogo, generación de claves JWT
  migrations/       Alembic (12 revisiones)
  tests/            conftest.py, fakes.py, test_routes/, test_services/
```

Flujo: `route → service → repository → model`, con `UnitOfWork` controlando el commit.

**Frontend — organizado por feature:**

```
frontend/src/
  app/              AppLayout, router, providers, ProtectedRoute, PageTransition
  components/
    layout/         Navbar, BottomTabBar, Footer, UserMenu, AppBreadcrumbs, Logo
    ui/             componentes shadcn
  features/<name>/  api.ts, hooks.ts, types.ts, schemas.ts (zod), components/, pages/
                    (auth, body-metrics, coach, exercises, feedback, home, legal, store, weekly-plan)
  lib/              apiClient.ts, authToken.ts, utils.ts
  test/setup.ts
```

**Infraestructura:**
- `docker-compose.yml` (local): postgres (pgvector pg18, puerto 5433), redis, backend (5000), frontend (5173→nginx).
- `docker-compose.prod.yml` (EC2): redis, backend, caddy (HTTPS para `api.fitnerd.betofallas.dev`).
- Frontend en Vercel (`frontend/vercel.json`); Postgres de producción en Supabase.

## 2. Comandos exactos y línea base

| Ámbito | Acción | Comando | Línea base (2026-09-22) |
|---|---|---|---|
| frontend | test | `cd frontend && npm test` (`vitest run`) | ✅ 2 archivos, 9 tests, todos pasan |
| frontend | lint | `cd frontend && npm run lint` (oxlint, `.oxlintrc.json`) | ✅ exit 0 con 3 warnings (`button.tsx`, `form.tsx`: only-export-components; `HomeSlideshowBox.tsx`: set-state-in-effect) |
| frontend | typecheck | `cd frontend && npx tsc -b` (no hay script dedicado) | ✅ exit 0 |
| frontend | build | `cd frontend && npm run build` (`tsc -b && vite build`) | no ejecutado (el typecheck, que es su parte que puede fallar, pasa) |
| backend | test | `cd backend && python -m pytest -v` | ⚠️ no verificable localmente: las 28 pruebas dan `ERROR` por `OperationalError: connection refused` en `localhost:5433` (el contenedor Postgres no estaba levantado). CI es la referencia actual |
| backend | lint | — | ❌ **no existe** (sin ruff/flake8/black) |
| backend | typecheck | — | ❌ **no existe** (sin mypy/pyright) |
| backend | build | `docker build backend` | no ejecutado |
| backend | migraciones | `flask db migrate` / `flask db upgrade` | — |
| backend | cobertura | `python -m pytest --cov=.` (pytest-cov instalado, sin `.coveragerc`) | — |

**Requisitos para los tests de backend:**
- `FLASK_ENV=testing`
- `TEST_DATABASE_URL` apuntando a un Postgres con la extensión `vector`. Localmente: `docker compose up -d postgres`, puerto 5433.
- Claves JWT generadas con `python scripts/generate_jwt_keys.py`, en `JWT_PRIVATE_KEY_PATH`/`JWT_PUBLIC_KEY_PATH`.
- `VOYAGE_API_KEY` y `VOYAGE_EMBEDDING_MODEL` con cualquier valor: el cliente se construye al arrancar.
- Localmente estas variables vienen de `backend/.env`. En Windows se usa `backend/.venv/Scripts/python.exe`.

## 3. Testing y cobertura aproximada

### Backend: pytest, 6 archivos, 28 tests

| Archivo | Tests | Estilo |
|---|---|---|
| `tests/test_routes/test_auth_routes.py` | 6 | integración (client + BD real) |
| `tests/test_routes/test_exercise_routes.py` | 3 | integración |
| `tests/test_services/test_body_metric_service.py` | 4 | unitario con fakes |
| `tests/test_services/test_coach_service.py` | 5 | unitario (`FakeLLMClient`, `FakeRateLimiter`) |
| `tests/test_services/test_progress_analysis_service.py` | 4 | unitario con fakes |
| `tests/test_services/test_weekly_plan_service.py` | 6 | unitario |

- **Fixtures** (`tests/conftest.py`): `app` (session, `create_all()`/`drop_all()`), `client`, `db_session`, `_clean_database` (autouse, borra filas tras cada test), `registered_user`, `admin_headers`.
- **Aislamiento:** fakes escritos a mano en `tests/fakes.py` e inyectados en los constructores de los servicios. No se usa `unittest.mock` ni `monkeypatch`.
- **Cobertura aproximada:**
  - Servicios: 4/11.
  - Rutas: 2/9.
  - Sin tests directos: repositorios (incluida la consulta pgvector), `utils/`, `auth_service` (incluido Google), rutas de coach, feedback, favoritos, weekly-plan y body-metric.

### Frontend: Vitest 4 + jsdom + Testing Library, 2 archivos, 9 tests

- **Configuración:** bloque `test` dentro de `frontend/vite.config.ts`, con `environment: jsdom`, `setupFiles: src/test/setup.ts` y `globals: false`.
- **Tests existentes:**
  - `features/auth/components/LoginForm.test.tsx` (4)
  - `features/body-metrics/dateUtils.test.ts` (5)
- **Sin tests:** todas las páginas, hooks, módulos `api.ts`, `apiClient`, `authToken`, `ProtectedRoute`/router, weekly-plan (drag and drop), coach, feedback y `chartData.ts`.

### Convenciones
- **Ubicación de los tests:** en el frontend van junto al archivo que prueban (`*.test.ts(x)`). En el backend van en `backend/tests/test_{routes,services}/`.
- **Idioma:** los nombres de los tests y los comentarios están en español.

## 4. CI/CD, convenciones y configuración previa

### CI (GitHub Actions)

| Workflow | Disparadores | Qué ejecuta | Qué NO ejecuta |
|---|---|---|---|
| `.github/workflows/backend-tests.yml` | push/PR a `main` que toque `backend/**` | Python 3.13, servicio `pgvector/pgvector:pg16`, `CREATE EXTENSION vector`, genera las claves JWT, `python -m pytest -v` | lint, typecheck, cobertura, Redis, build Docker |
| `.github/workflows/frontend-tests.yml` | push/PR a `main` que toque `frontend/**` | Node 22, `npm ci`, `npm test` | lint, typecheck, build |

### CD
- Frontend: Vercel despliega al hacer push a `main`.
- Backend: despliegue manual en EC2 con `docker-compose.prod.yml`.

### Git
- **Ramas:** 39 commits, todos directos en `main`. No hay ramas de feature, PRs ni merges.
- **Mensajes:** en inglés, en imperativo y con mayúscula inicial ("Add …", "Fix …", "Make …"). No usan prefijos convencionales (`feat:`/`fix:`) y con frecuencia agrupan varios cambios en un mismo commit. Los 3 últimos usan "To …".
- **Idioma del código:** comentarios de código y pasos de CI en español; commits en inglés.

### Configuración previa
- No existen `CLAUDE.md`, `.claude/`, `.editorconfig`, pre-commit, husky, lint-staged, Prettier ni ESLint.
- La única configuración de lint es `frontend/.oxlintrc.json`.

### Secretos
- `.env` (raíz, `backend/`, `frontend/`), `backend/keys/*.pem` y `personal_notes.md` están ignorados.
- Verificado que ninguno está rastreado. Solo se versionan los `.env.example`.

## 5. Deuda y riesgos que afectan al flujo SDD

1. **Backend sin lint ni typecheck.**
   - Consecuencia: el `verifier` no tendría gates estáticos en backend.
   - Decisión para la Fase 1: añadir `ruff` (y quizá `mypy`) como prerrequisito, o aceptar solo tests.
2. **Frontend: lint, typecheck y build no están en CI.** Además, `tsconfig.app.json` no tiene `strict`. Esos comandos existen solo en local.
3. **Cobertura baja en ambos lados.**
   - El TDD estricto es viable para código nuevo.
   - La trazabilidad REQ → test aplicará hacia adelante, no de forma retroactiva al código existente.
4. **Los tests del backend dependen de un Postgres real con pgvector**, así que `test-author`, `implementer` y `verifier` lo necesitan levantado (`docker compose up -d postgres`).
   - La línea base de hoy lo confirma: sin el contenedor, las 28 pruebas dan error.
   - Los hooks que ejecuten tests de backend deben tolerar o detectar esta situación.
5. **Deriva de esquema:** los tests crean las tablas con `create_all()` y no con Alembic, así que una migración olvidada no se detecta. Conviene incluirlo en el checklist del `verifier` y del `reviewer`.
6. **Dependencias sin versión fijada** y dependencias pesadas de `scripts/` (yt-dlp, faster-whisper, boto3) mezcladas con las del runtime. Esto hace los builds poco reproducibles.
7. **Acoplamiento por singletons** (`extensions.py`) y `LLMClient` instanciado dentro de las rutas (`routes/coach_routes.py`, `routes/body_metric_routes.py`).
   - Esto dificulta testear las rutas que usan IA.
   - El patrón testeable ya establecido son los fakes inyectados en los servicios; conviene fijarlo en la constitución.
8. **Sin flujo de ramas ni PR.**
   - El SDD introduce una rama por feature, lo que supone un cambio de hábito.
   - Los workflows solo se disparan para push y PR hacia `main`: las ramas de feature tendrán CI solo al abrir un PR.
9. **Entorno Windows** (PowerShell y Git Bash). Los hooks deben ser portables: preferiblemente scripts Node (Node ya es dependencia del proyecto) o Python, no bash puro.
10. **Warnings de lint preexistentes** en el frontend (3). Un gate de "lint limpio" debe distinguir los warnings de los errores, o fijar esta línea base.
