# fitnerd

<!-- sdd-beto:proyecto:start -->
## Proyecto

App de fitness full-stack con un **coach de IA basado en contenido real**: responde solo con transcripciones de vídeos de entrenamiento y, si la respuesta no está ahí, dice "no lo sé". Es un proyecto de portfolio personal. En producción está en https://fitnerd.betofallas.dev. El "por qué" de cada decisión está en `README.md`, que está en inglés.

**Áreas funcionales:**

| Área | Backend (`routes/`) | Frontend (`src/features/`) |
|---|---|---|
| Autenticación (email/contraseña, Google Sign-In, JWT RS256, recuperación de contraseña por correo con Resend) | `auth_routes` | `auth` |
| Métricas corporales, gráficas y análisis con IA; una medición por usuario y día, peso del perfil sincronizado con la última medición, indicadores de progreso en el frontend y análisis con sugerencia de calorías (detalle bajo la tabla) | `body_metric_routes` | `body-metrics` |
| Perfil y onboarding (datos físicos, fecha de nacimiento de la cuenta, nivel de actividad y meta guardados por usuario; `GET`/`PUT /api/profile`; la edad se calcula desde `users.date_of_birth`, ADR-0019; las calorías y macros se calculan en el frontend con Mifflin-St Jeor, suelo calórico de 1200 kcal en mujeres y 1500 en hombres, proteína con tope en el peso de IMC 27 y mínimo de 100 g de carbohidratos, spec 007) | `profile_routes` | `onboarding`, `profile`, `macros` |
| Coach de IA con RAG (pgvector, Voyage y Claude, con rate limit en Redis y trazas en Langfuse Cloud, ADR-0017; valoración 👍/👎 de cada respuesta como score `user_feedback`, con `feedback_id` firmado con HMAC, ADR-0018) | `coach_routes` | `coach` |
| Feedback, home, páginas legales y tienda (solo estructura) | `feedback_routes` | `feedback`, `home`, `legal`, `store` |
| Salud del servicio (`GET /api/health`) | `health_routes` | — |

**Métricas corporales, en detalle:**
- **Mediciones y peso del perfil:** una sola medición por usuario y día (`POST` actualiza si ya existe, `PUT`/`DELETE /api/body-metrics/{id}`), historial con corregir y borrar, y el peso del perfil sigue a la última medición de peso (spec 008, ADR-0020; la migración consolida duplicados antes de crear la restricción única).
- **Indicadores de progreso (spec 009):** calculados en el frontend: cambio en 30 días, ritmo semanal frente a la meta, que se oculta con "Sin registros recientes" si la última medición de peso tiene más de 28 días, tendencia de 7 días, composición corporal y racha.
- **Análisis con IA (specs 010 y 011, ADR-0021):** recibe además el perfil, esos indicadores y las calorías de Macros, y devuelve una sugerencia de ajuste de calorías calculada en el servidor; sin perfil responde 409; `POST /api/body-metrics/analysis` exige cuerpo con el contexto del cliente; ritmo >2 % del peso por semana = «poco realista» (spec 011): se marca la medición sospechosa y el análisis responde 200 sin sugerencia de calorías.

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
- **Procedimiento paso a paso** (tipos de despliegue, backup, migraciones, comprobaciones y marcha atrás): `docs/deploy-runbook.md`.
- Frontend en **Vercel**: cada push a `main` despliega automáticamente.
- Backend en **AWS EC2**, detrás de Caddy con HTTPS en `api.fitnerd.betofallas.dev`. **CD (ADR-0016):** el job `deploy` de `backend-tests.yml` se ejecuta tras pasar los tests en un push a `main` (o a mano con *Run workflow*). Se autentica en AWS por OIDC, ejecuta por SSM `git pull --ff-only` y `docker compose -f docker-compose.prod.yml up -d --build` como `ec2-user` en `/home/ec2-user/fitnerd`, y comprueba `/api/health`. Las variables `AWS_ROLE_ARN`, `AWS_REGION`, `EC2_INSTANCE_ID` y `DEPLOY_PATH` están en el environment `production` de GitHub. **Las migraciones no se aplican solas:** si el resumen del job lo avisa, ejecuta `docker compose -f docker-compose.prod.yml exec backend flask db upgrade` en la instancia.
- Redis corre en la misma instancia.
- **Paso previo al despliegue (retirada del catálogo, spec 012):** el catálogo de ejercicios, los favoritos y el plan semanal se eliminaron (sus endpoints responden 404). La migración `f2c4e6a8b0d1` borra las cinco tablas con sus datos y su downgrade las recrea vacías. Antes de desplegar, haz un volcado **completo** de la base de producción (esquema y datos de todas las tablas) y guárdalo fuera del repositorio en `C:/Users/alber/fitnerd-backups`; después del CD, ejecuta `flask db upgrade` en la instancia. El rol `admin` y `require_admin` se conservan aunque ya no haya endpoints de administración.
- **Paso previo al despliegue (recuperación de contraseña, ADR-0014):** crea la cuenta de Resend y verifica el dominio `fitnerd.betofallas.dev` (registros SPF y DKIM) antes de desplegar; sin eso los correos no se entregan.
- **Variables nuevas en el `backend/.env` de EC2 (recuperación de contraseña, ADR-0014 y ADR-0015):** `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev` (obligatoria: si falta, los correos llevan enlaces a `localhost` sin avisar), `RESEND_API_KEY` y `MAIL_FROM`. `MAIL_BACKEND` y `PROXY_FIX_X_FOR` ya valen `resend` y `1` en producción. Tras desplegar, aplica la migración y haz una prueba manual con una cuenta real.
- **Variables opcionales de observabilidad del coach (ADR-0017):** `LANGFUSE_PUBLIC_KEY` y `LANGFUSE_SECRET_KEY` en el `backend/.env` de EC2 (sin las dos no se envía nada; en tests siempre inactiva); `LANGFUSE_BASE_URL` es opcional (por defecto `https://us.cloud.langfuse.com`). Si el modelo de Claude no está en la tabla de precios de Langfuse, añade su precio a mano en el proyecto; mientras falte, las trazas no llevan coste.
- Postgres de producción en **Supabase**.
- CI (GitHub Actions): `backend-tests.yml` ejecuta pytest (y despliega, ver arriba) y `frontend-tests.yml` ejecuta `npm test`. Se disparan en push o PR a `main`; el del backend también con *Run workflow*.

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
| Lint | ratchet de ruff del plugin `sdd-beto` (`lint_ratchet` en `.sdd/config.json`; solo cuenta violaciones nuevas) | `npm run lint` |
| Typecheck / build | — | `npx tsc -b` / `npm run build` |
| Migraciones | `flask db migrate -m "…"` / `flask db upgrade` | — |

**Puntos delicados:**
- **`flask` sin `FLASK_ENV` usa producción:** `backend/wsgi.py` carga `ProductionConfig` por defecto, así que `flask run` o `flask db …` apuntan a Supabase. Usa siempre `FLASK_ENV=development` en local (ya causó una migración en producción).
- **Windows:** hay Git Bash y PowerShell, y el Python del venv está en `.venv/Scripts/python.exe`.
- **`backend/.env.example` está incompleto:** la lista real de variables está en `config.py`. Faltan las de JWT, Voyage, `ANTHROPIC_MODEL` y `CORS_ORIGINS`. `SECRET_KEY` sí está (ejemplo `change-me`): firma el `feedback_id` del coach, así que en producción debe ser un valor propio y, si cambia, los votos de respuestas ya emitidas dejan de ser válidos (404).
- **Nunca ejecutes `docker compose config`:** imprime los secretos en claro. Ya causó una rotación de contraseña. Para validar un YAML, usa un parser.
- **Migraciones sin detectar:** los tests crean las tablas con `create_all()`, no con las migraciones, así que una migración olvidada no la detecta ningún test. Revísalo a mano.
- **Dependencias:** `requirements.txt` no fija versiones y mezcla las del runtime con las del pipeline RAG.
- **Codificación de `README.md`:** fue UTF-16 en el pasado. Comprueba con `file README.md` después de editarlo.
- **Resend rechaza el User-Agent por defecto de Python (403, Cloudflare 1010):** `ResendTransport` envía `fitnerd/1.0 (+https://fitnerd.betofallas.dev)`; si vuelven los 503 al recuperar contraseña, mira en el log del backend el cuerpo del error de Resend (recortado a 200 caracteres, sin la API key).
- **Código existente sin lint:** tiene unas 145 violaciones de ruff previas; no las arregles fuera de una tarea que lo pida.
- **Antes de tocar un área, mira su estado real:** la cobertura de tests es baja (ver `docs/sdd/00-discovery.md`, que es una foto de septiembre de 2026).
<!-- sdd-beto:proyecto:end -->

<!-- sdd-beto:sdd:start -->
## SDD

Este proyecto usa el plugin `sdd-beto` (Spec-Driven Development). Todo cambio funcional pasa por:

`spec → plan → tasks → tests (rojo) → implement → verify → review → docs → close`

- Cada etapa la hace un subagente `sdd-beto:<rol>`; la sesión principal orquesta y no hace el trabajo de los roles.
- Comandos: `/sdd-beto:new <slug> <idea>` crea una feature, `/sdd-beto:run [NNN-slug]` recorre el flujo, `/sdd-beto:status` muestra el estado y `/sdd-beto:<etapa>` ejecuta una sola etapa.
- Artefactos de cada feature: `specs/NNN-slug/`. Su estado vive en `state.json` y solo se cambia con la CLI `sdd-state` del plugin, nunca a mano.
- Configuración: `.sdd/config.json`. Constitución: la base del plugin más `.sdd/constitution.md` (Parte II, propia de este proyecto). Si chocan, gana la base.
- Decisiones del proyecto: `docs/sdd/decisions/`. Backlog del proyecto: `docs/backlog.md`.
- Los hooks del plugin impiden editar código de producción fuera de una feature con spec y plan aprobados. Solo un hotfix o una excepción del Art. B1.2 justifica reiniciar con `SDD_BYPASS=1`.
<!-- sdd-beto:sdd:end -->

<!-- sdd-beto:aprobacion:start -->
## Aprobación humana

- En un gate, solo un "aprobado" o "sí" explícito del usuario cuenta como aprobación. El silencio, una pregunta o un "luego vemos" no.
- Modo de gates: `flow` (ADR-0029 del plugin). El flujo se detiene en tres gates: `spec`, `review` y `close`.
- Entre gates, el flujo solo se detiene por una decisión mayor: cambiar el alcance de la spec; incumplir la constitución; una dependencia nueva, una migración destructiva o romper una API; algo que afecte a la seguridad o a los datos; una ambigüedad con resultados distintos; o el límite de iteraciones. Lo menor se decide y se anota en el backlog de la feature.
- Los commits de cada etapa se hacen sin pedir aprobación, solo en local y en la rama de la feature. Nada se sube antes del gate de `close`.
- El gate de `close` aprueba de una vez el último commit, el push, el PR y su merge.
- Los subagentes nunca hacen commit, push ni cambian de rama.
<!-- sdd-beto:aprobacion:end -->

<!-- sdd-beto:convenciones:start -->
## Convenciones

- **Idioma de los artefactos y de los mensajes al usuario:** `es`.
- **Ramas:** se parte de `main`; `feat/NNN-slug`, `fix/NNN-slug` y `fix/NNN-slug`.
- **Commits:** idioma `en`, estilo "imperative, no conventional prefixes". Un commit por etapa. Nunca `--no-verify`, `git add -A` ni `push --force` a `main`.
- **Iteraciones de corrección** antes de escalar al usuario: 3.
- **Ámbitos** (`scopes` de `.sdd/config.json`):

| Ámbito | Raíz | Test | Lint | Typecheck | Build |
|---|---|---|---|---|---|
| `backend` | `backend` | `".venv/Scripts/python.exe" -m pytest -q` | ratchet (ruff) | — | — |
| `frontend` | `frontend` | `npm test` | `npm run lint` | `npx tsc -b` | `npm run build` |
<!-- sdd-beto:convenciones:end -->

## Ramas `chore/…`

- `chore/…` solo para cambios del harness, de documentación o de CI/CD: sin SDD completo y con ADR si introducen una decisión nueva (ADR-0016). Nunca se trabaja directamente en `main`.
