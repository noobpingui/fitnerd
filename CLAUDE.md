# fitnerd

<!-- sdd-beto:proyecto:start -->
## Proyecto

App de fitness full-stack con un **coach de IA basado en contenido real**: responde solo con transcripciones de vídeos de entrenamiento y, si la respuesta no está ahí, dice "no lo sé". Es un proyecto de portfolio personal. En producción está en https://fitnerd.betofallas.dev. El "por qué" de cada decisión está en `README.md`, que está en inglés.

**Áreas funcionales:**

| Área | Backend (`routes/`) | Frontend (`src/features/`) |
|---|---|---|
| Autenticación (email/contraseña, Google Sign-In, JWT RS256, recuperación de contraseña por correo con Resend; correo normalizado en minúsculas y sin espacios, ADR-0025; contraseña de 8 caracteres a 72 bytes UTF-8 en registro y restablecimiento; enlace de restablecimiento de un solo uso también ante peticiones simultáneas, spec 014; `/register` y `/login` responden 400 «La petición no es válida» si el cuerpo no es un objeto JSON, y el registro valida en el servidor nombre y apellido, de 1 a 100 caracteres guardados sin espacios de los extremos, y fecha de nacimiento, de 14 a 100 años, con las reglas del perfil; los errores salen en español, spec 018; los correos de `users` y `password_reset_requests` llevan una restricción CHECK en la base que exige la forma canónica, sin espacios en los extremos y en minúsculas, spec 019, ADR-0027) | `auth_routes` | `auth` |
| Métricas corporales, gráficas y análisis con IA; una medición por usuario y día, peso del perfil sincronizado con la última medición, indicadores de progreso en el frontend y análisis con sugerencia de calorías (detalle bajo la tabla) | `body_metric_routes` | `body-metrics` |
| Perfil y onboarding (datos físicos, fecha de nacimiento de la cuenta, nivel de actividad y meta guardados por usuario; `GET`/`PUT /api/profile`; la edad se calcula desde `users.date_of_birth`, ADR-0019; las calorías y macros se calculan en el frontend con Mifflin-St Jeor, suelo calórico de 1200 kcal en mujeres y 1500 en hombres, proteína con tope en el peso de IMC 27 y mínimo de 100 g de carbohidratos, spec 007; onboarding y datos físicos usan react-hook-form con un único esquema zod en `onboarding/schemas.ts`, y pies y pulgadas solo admiten enteros, spec 015; en el perfil, con pies válidos y pulgadas no válidas, el aviso es «Entre 0 y 11 in», spec 017) | `profile_routes` | `onboarding`, `profile`, `macros` |
| Coach de IA con RAG (pgvector, Voyage y Claude, con rate limit en Redis y trazas en Langfuse Cloud, ADR-0017; valoración 👍/👎 de cada respuesta como score `user_feedback`, con `feedback_id` firmado con HMAC, ADR-0018) | `coach_routes` | `coach` |
| Feedback, home, páginas legales y tienda (solo estructura) | `feedback_routes` | `feedback`, `home`, `legal`, `store` |
| Alimentos de USDA (Foundation y SR Legacy, unos 8.262, spec 021, ADR-0029; tabla `public.foods`, importada a mano con `scripts/import_usda_foods.py`; `GET /api/foods/search?q=` con sesión, hasta 20 resultados, 30 búsquedas por minuto y usuario; búsqueda híbrida de texto y vectores de Voyage con fusión RRF; la tabla de USDA y `GET /api/foods/search` se conservan como fuente de datos, pero desde la 023 la pantalla `/foods` redirige a `/diary` y el diario busca en el catálogo propio; la atribución también está en la sección «Datos nutricionales» de Términos de servicio y la entrada «Diario» de la navegación es de la 022) | `food_routes` | `foods` |
| Diario de comidas (spec 022, ADR-0030): comidas por usuario, día y tipo (desayuno, almuerzo, cena, meriendas) con alimentos del catálogo propio (spec 023, ADR-0031: tabla `catalog_foods`, `GET /api/catalog/search`, CSV en `backend/scripts/data/food_catalog.csv`, carga manual con `scripts/load_food_catalog.py`) o personalizados; `GET`/`POST /api/meals`, `PATCH`/`DELETE /api/meals/{id}/items/{item_id}` y `DELETE /api/meals/{id}`; cada alimento guarda copia de descripción y valores por 100 g, sin clave foránea a `foods`; el cliente envía el día (ventana de ±1 día del reloj del servidor); pantalla `/diary` («Diario» en la navegación) con totales del día frente al objetivo de Macros; `POST /api/meals/analyze` (spec 024, ADR-0032): analiza una foto de comida (JPEG, PNG o WebP de hasta 3 MB) con Amazon Bedrock `converse`, devuelve alimentos propuestos usando el catálogo de la 023 como lista cerrada, no guarda la foto ni escribe en la base y admite 10 análisis por hora y usuario; **foto desde el diario (spec 025, ADR-0033, solo frontend, sin migraciones, variables ni cambios en el backend):** botón «Cargar imagen» en cada tarjeta que abre `MealPhotoDialog` (hacer o elegir una foto, vista previa, análisis, revisión de la propuesta con gramos editables, quitar, añadir del catálogo y resolver los alimentos sin coincidencia buscándolos o creándolos como personalizados); la foto se valida en el dispositivo (JPEG, PNG, WebP y HEIC/HEIF si el navegador los lee; hasta 20 MB) y se reduce en el navegador a JPEG de lado mayor ≤ 1600 px con la orientación aplicada, tras el puerto `PhotoProcessor` de `features/diary/photo.ts`, sin dependencias nuevas; `apiFetch` acepta `FormData`; toda la propuesta se guarda en una sola petición a `POST /api/meals`; si el análisis falla, se alcanza el límite o no reconoce nada, «Registrar a mano» abre «Añadir a {sección}»; la Política de privacidad menciona Amazon Bedrock; **días y edición (spec 026, ADR-0035):** el día se elige con `?date=` en `/diary` (anterior, siguiente, «Hoy» y selector, de 365 días atrás a hoy; `replace`, sin llenar el historial), «hoy» se actualiza a medianoche (pausado con un diálogo abierto), `POST /api/meals` admite fechas de −366 a +1 día, «Borrar comida» con confirmación (`DeleteMealDialog`), barras en ámbar al superar el objetivo, confirmación al descartar la propuesta de foto, y «Deshacer» de 10 s al quitar un alimento: `DELETE …/items/{id}?undo=1` devuelve un `restore_token` firmado con HMAC (`SECRET_KEY`, 120 s, ligado al usuario) y `POST /api/meals/restore` recrea el alimento en su sitio; sin `undo=1` sigue el 204; **endurecimiento (spec 027):** el contenido del `restore_token` ya verificado se valida de forma estricta (versión entera `1`, posición de 0 a 2.147.483.647 e id de USDA de 1 a 2.147.483.647) y, si no cumple, responde 404 como un token no válido, no 500 | `meal_routes` | `diary` |
| Salud del servicio (`GET /api/health`) | `health_routes` | — |

**Métricas corporales, en detalle:**
- **Mediciones y peso del perfil:** una sola medición por usuario y día (`POST` actualiza si ya existe, `PUT`/`DELETE /api/body-metrics/{id}`), historial con corregir y borrar, y el peso del perfil sigue a la última medición de peso (spec 008, ADR-0020; la migración consolida duplicados antes de crear la restricción única).
- **Mediciones con fecha pasada (spec 016):** el botón «Registrar medición» de Métricas abre un diálogo (`RegisterMetricDialog`) con fecha (de hoy a 365 días atrás); el servidor rechaza con 400 fechas de más de 366 días. El peso del perfil sigue a la medición de peso de **fecha** más reciente, no a la última guardada. Tras cualquier registro, el frontend vuelve a leer perfil y mediciones; si al guardar desde el perfil hay una medición posterior a hoy, avisa. Desde el perfil se sigue registrando solo la de hoy.
- **Seguimiento tras registrar (spec 020):** si la relectura de perfil y mediciones falla tras registrar una medición (desde Métricas y desde «Datos físicos» del perfil), se muestra un aviso con «Reintentar» (`RefreshFailedNotice`); corregir y borrar no lo llevan (en el backlog); en el perfil, «Reintentar» conserva lo que el usuario editó sin guardar. El Historial se despliega hasta mostrar la medición recién registrada. El reloj de la app (`backend/utils/clock.py`) solo se puede fijar con `TESTING`; en producción es el real.
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
  - Cada pantalla se carga bajo demanda por ruta (`src/app/router.tsx`, `lazyNamed` y `RouteSuspense`, con «Cargando…» y un error con «Recargar»; chunk de entrada ≤ 500 kB, ADR-0026). La regla de rango `inRange` es compartida en `src/lib/inRange.ts`.
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
- **Paso previo al despliegue (spec 020, ADR-0028):** `FRONTEND_BASE_URL` es ahora obligatoria en producción y debe empezar por `https://`. Antes del merge, comprueba que el `backend/.env` de EC2 tiene `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev`; si falta, `ProductionConfig` falla al arrancar, el contenedor no levanta tras el CD y falla la comprobación de `/api/health` (`docs/deploy-runbook.md`, sección 2). La 020 no trae migraciones.
- **Paso previo al despliegue (retirada del catálogo, spec 012):** el catálogo de ejercicios, los favoritos y el plan semanal se eliminaron (sus endpoints responden 404). La migración `f2c4e6a8b0d1` borra las cinco tablas con sus datos y su downgrade las recrea vacías. Antes de desplegar, haz un volcado **completo** de la base de producción (esquema y datos de todas las tablas) y guárdalo fuera del repositorio en `C:/Users/alber/fitnerd-backups`; después del CD, ejecuta `flask db upgrade` en la instancia. El rol `admin` y `require_admin` se conservan aunque ya no haya endpoints de administración.
- **Paso previo al despliegue (recuperación de contraseña, ADR-0014):** crea la cuenta de Resend y verifica el dominio `fitnerd.betofallas.dev` (registros SPF y DKIM) antes de desplegar; sin eso los correos no se entregan.
- **Variables nuevas en el `backend/.env` de EC2 (recuperación de contraseña, ADR-0014 y ADR-0015):** `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev` (obligatoria: si falta, los correos llevan enlaces a `localhost` sin avisar), `RESEND_API_KEY` y `MAIL_FROM`. `MAIL_BACKEND` y `PROXY_FIX_X_FOR` ya valen `resend` y `1` en producción. Tras desplegar, aplica la migración y haz una prueba manual con una cuenta real.
- **Variables opcionales de observabilidad del coach (ADR-0017):** `LANGFUSE_PUBLIC_KEY` y `LANGFUSE_SECRET_KEY` en el `backend/.env` de EC2 (sin las dos no se envía nada; en tests siempre inactiva); `LANGFUSE_BASE_URL` es opcional (por defecto `https://us.cloud.langfuse.com`). Si el modelo de Claude no está en la tabla de precios de Langfuse, añade su precio a mano en el proyecto; mientras falte, las trazas no llevan coste.
- **Paso previo al despliegue (correos en minúsculas, spec 014, ADR-0025):** la migración `a7d3f9c1e5b2` pasa a minúsculas los correos guardados y no se aplica sola. Haz un volcado completo antes y aplícala **antes del merge** (`docs/deploy-runbook.md`, caso B'). Si hay correos que solo se diferencian en mayúsculas, falla sin modificar nada y lista los conflictos: resuélvelos a mano. Su downgrade no restaura las mayúsculas.
- **Paso previo al despliegue (correo canónico con CHECK, spec 019, ADR-0027):** la migración `e5b7d9f1a3c6` convierte los correos de `users` y `password_reset_requests` a la forma canónica y crea las dos restricciones CHECK; no se aplica sola. Haz un volcado completo verificado en `C:/Users/alber/fitnerd-backups`, una comprobación de solo lectura (revisión `a7d3f9c1e5b2`, correos no canónicos y conflictos) y aplícala **antes del merge** (`docs/deploy-runbook.md`, caso B'). Si hay correos que solo se diferencian en espacios o mayúsculas, falla sin modificar nada y los lista: resuélvelos a mano. Después, comprueba en `pg_constraint` que existen `ck_users_email_canonical` y `ck_password_reset_requests_email_canonical`. Su downgrade solo quita las restricciones. Las consultas con `[[:space:]]` se ejecutan con `exec_driver_sql`, no con `text()`.
- **Paso previo al despliegue (base de alimentos de USDA, spec 021, ADR-0029):** la migración `c8e2a4f6b9d3` crea `public.foods` (aditiva, no se aplica sola) y los datos se cargan después con un script manual. Haz un volcado completo verificado en `C:/Users/alber/fitnerd-backups`, aplica la migración **antes del merge** con `FLASK_ENV` bien puesto, y tras el CD descarga los CSV de Foundation y SR Legacy (los ZIP traen una carpeta anidada y el script debe apuntar a ella), cópialos a EC2 y ejecuta de forma interactiva `docker compose -f docker-compose.prod.yml run --rm -v <carpeta>:/data/usda:ro backend python -m scripts.import_usda_foods --foundation … --sr-legacy …`. Pregunta `[s/N]` porque la base no es local; `--yes` solo para ejecuciones no interactivas. Un túnel SSH a `localhost` se tomaría por base local y no preguntaría. En Windows, `PYTHONIOENCODING=utf-8`. Después mide `public.foods`: en local ocupa 48 MB con 8.262 alimentos (límite de Supabase, 500 MB). No hay variables nuevas. Detalle en `docs/deploy-runbook.md`, sección 5.
- **Paso previo al despliegue (diario de comidas, spec 022, ADR-0030):** la migración `b3d5f7a9c1e4` crea `meals` y `meal_items`; es aditiva y no se aplica sola. Haz un volcado completo verificado en `C:/Users/alber/fitnerd-backups` y aplícala **antes del merge** con `FLASK_ENV` bien puesto (`docs/deploy-runbook.md`, caso B). Su downgrade borra las dos tablas con sus datos. No hay variables nuevas.
- **Paso previo al despliegue (catálogo genérico de alimentos, spec 023, ADR-0031):** la migración `d4f6a8c0e2b5` crea `catalog_foods` y cambia las CHECK de `meal_items`; es aditiva y no se aplica sola. Haz un volcado completo verificado en `C:/Users/alber/fitnerd-backups` y aplícala **antes del merge** con `FLASK_ENV` bien puesto (`docs/deploy-runbook.md`, caso B de la 023). Tras el CD, carga el catálogo de forma interactiva con `docker compose -f docker-compose.prod.yml run --rm backend python -m scripts.load_food_catalog` (pregunta `[s/N]`; sin túnel SSH; se esperan 261 añadidos). Entre el CD y la carga la búsqueda del diario está vacía. Su downgrade se niega si hay alimentos del catálogo en comidas. No hay variables nuevas.
- **Paso previo al despliegue (análisis de foto con Bedrock, spec 024, ADR-0032):** no hay migración ni cambios en Caddy. Antes del merge: da al rol de la instancia EC2 el permiso `bedrock:InvokeModel`, activa el acceso al modelo en la consola de Bedrock y añade al `backend/.env` de EC2 `BEDROCK_VISION_MODEL_ID` (sin valor por defecto: sin ella `POST /api/meals/analyze` responde 503) y, si no es `us-east-1`, `BEDROCK_REGION`. Las credenciales salen del rol por IMDS (con Docker, el límite de saltos de IMDS debe ser 2 o más; con 1 el contenedor no las obtiene). Tras el CD, comprueba que gunicorn arrancó con `--timeout 90` (cambio de `backend/Dockerfile`) y que un Bedrock lento da 503 con JSON y no 502. Detalle en `docs/deploy-runbook.md`, caso A de la 024.
- **Paso previo al despliegue (días y edición del diario, spec 026, ADR-0035):** sin migración ni variables nuevas, pero `SECRET_KEY` firma el `restore_token` y debe ser propia en el `backend/.env` de EC2 (desde la 027 es obligatoria, ver el paso previo siguiente; si cambia, los tokens pendientes de 120 s y los votos del coach dejan de valer). Con un backend antiguo el `DELETE …?undo=1` responde 204 y la interfaz no ofrece «Deshacer». Comprobaciones manuales en navegador en `docs/deploy-runbook.md`, caso A de la 026.
- **Paso previo al despliegue (SECRET_KEY obligatoria, spec 027):** sin migración ni variables nuevas, pero `ProductionConfig` falla al arrancar («SECRET_KEY es obligatoria en producción y no puede ser un valor por defecto») si `SECRET_KEY` falta, está vacía o vale `DEFAULT SECRET` o `change-me` (con o sin espacios en los extremos). Antes del merge, comprueba que el `backend/.env` de EC2 tiene una propia **sin imprimirla** (comando en `docs/deploy-runbook.md`, sección 2); si no, el contenedor no levanta tras el CD. Se confirmó en EC2 el 2026-10-27. Los comandos locales con `FLASK_ENV=production` (p. ej. `flask db upgrade`) necesitan también una clave válida: si tu `.env` local trae `change-me`, expórtala solo para ese comando. En CI los tests de producción reciben una clave de pruebas desde `make_app`.
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
- **`backend/.env.example` está incompleto:** la lista real de variables está en `config.py`. Faltan las de JWT, Voyage, `ANTHROPIC_MODEL` y `CORS_ORIGINS`. `SECRET_KEY` sí está (ejemplo `change-me`, que desde la 027 `ProductionConfig` rechaza): firma el `feedback_id` del coach y el `restore_token` del diario, así que en producción debe ser un valor propio y, si cambia, los votos de respuestas ya emitidas dejan de ser válidos (404).
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
- Una ADR pasa a «Aceptada» solo con la aprobación explícita del usuario y la edita la sesión principal, no un subagente (Art. P5, ADR-0034). Los archivos de datos (`backend/scripts/data/**`) también los edita la sesión principal, con autorización del usuario.
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
