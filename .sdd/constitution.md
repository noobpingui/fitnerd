# Constitución SDD · Parte II: fitnerd

> Reglas **propias de este proyecto**. Complementan la Parte I (base), que vive en el plugin `sdd-beto` y que
> todos los agentes leen junto con esta. Esta parte puede **endurecer** la base, nunca relajarla.
>
> - La propuso `/sdd-beto:init` a partir del código existente y de la constitución anterior
>   (`specs/constitution.md`), y la aprobó el usuario (ADR-0024).
> - Solo cambia mediante un ADR del proyecto (en `docs/sdd/decisions/`).
> - Palabras clave: **DEBE** · **NO DEBE** · **DEBERÍA** (salvo justificación escrita en `plan.md`).
> - Cita cada regla como `Art. P<n>.<m>`.

## Art. P1 — Convenciones de tests

### General

1. El marcador de trazabilidad **DEBE** llevar el número de la spec delante de los IDs (ADR-0022):
   `# SDD: 014 REQ-001 AC-001.1` en Python y `// SDD: 014 REQ-001 AC-001.1` en TypeScript. Los marcadores sin
   número de las specs 001–010 siguen siendo válidos.
2. Docstrings y comentarios de los tests van en español.

### backend

1. Los tests van en `backend/tests/test_services/` (unitarios) o `backend/tests/test_routes/` (integración, con el
   fixture `client` de `tests/conftest.py`), en archivos `test_<área>.py`.
2. Los nombres de los tests van en inglés y describen el comportamiento: `test_<comportamiento>`.
3. Los unitarios aíslan dependencias con **fakes escritos a mano e inyectados por constructor** (`tests/fakes.py`,
   `tests/fakes_observability.py` o clases `Fake*` en el propio test). **NO DEBE** usarse `unittest.mock` ni
   `monkeypatch` salvo justificación en `plan.md`.
4. Los tests usan el Postgres de prueba (`TEST_DATABASE_URL`, con pgvector) y nunca llaman a Anthropic, Voyage,
   Google, S3, Resend, Langfuse ni Redis reales.
5. Esqueletos (Art. B5.6): `raise NotImplementedError("not implemented")`; los `__init__` guardan sus dependencias
   sin lanzar.

### frontend

1. Los tests van junto al archivo que prueban (`Foo.test.tsx` al lado de `Foo.tsx`); los utilitarios compartidos de
   test van en `src/test/`.
2. Vitest corre con `globals: false`: cada test importa `describe`, `it`, `expect` y `vi` desde `vitest`.
3. Los nombres de los tests (`it("…")`) van en español y describen el comportamiento.
4. La red se simula en la capa `api.ts` de la feature (`vi.mock("@/features/<feature>/api", …)`) o en `apiClient`,
   nunca con llamadas reales.
5. Esqueletos (Art. B5.6): `throw new Error("not implemented");`, con los parámetros prefijados con `_` (que
   `noUnusedParameters` de `tsconfig.app.json` ignora).

## Art. P2 — Arquitectura y convenciones

### backend

1. **DEBE** respetar las capas `routes → services → repositories → models`:
   - las rutas solo parsean la request, llaman al servicio y serializan la respuesta;
   - la lógica de negocio vive en `services/`; el acceso a datos, en `repositories/`;
   - **solo** `UnitOfWork` hace `commit` o `rollback`.
2. Los servicios reciben sus dependencias (repositorios, UnitOfWork, clientes externos, reloj) **por constructor**;
   las rutas las construyen con una función `_build_*_service()`. Los singletons viven en `extensions.py`.
3. Los errores se expresan con las excepciones de `exceptions/custom_exceptions.py`, y `exceptions/error_handlers.py`
   las traduce a `{"error": "mensaje"}` con su código HTTP. **NO DEBE** devolverse un error construido a mano desde
   una ruta.
4. Todo cambio de modelo **DEBE** incluir su migración Alembic (`flask db migrate` con `FLASK_ENV=development`),
   revisada a mano. Los tests usan `create_all()` y no detectan migraciones faltantes: el `reviewer` **DEBE**
   comprobarlo.
5. Las utilidades existentes de `utils/` (JWT, rate limiting, correo, embeddings, cliente LLM, trazas, token de
   feedback) **DEBEN** reutilizarse en lugar de duplicarse.

### frontend

1. **DEBE** mantener la organización por feature: `src/features/<feature>/` con `api.ts`, `hooks.ts`, `types.ts`,
   `schemas.ts` (zod), `components/` y `pages/`.
2. Las llamadas HTTP pasan **solo** por `apiFetch` (`src/lib/apiClient.ts`).
3. El estado de servidor se maneja con TanStack Query (claves en `hooks.ts`) y los formularios con react-hook-form
   y zod.
4. Los componentes de UI reutilizables van en `src/components/ui/` (shadcn); el alias de imports es `@/`.
5. `npm run lint` (oxlint) admite los warnings ya existentes, pero **NO DEBE** introducir errores.

### General

1. Los textos visibles para el usuario, comentarios y docstrings van en español correcto, con tildes y sin voseo.

## Art. P3 — Seguridad

1. Todo endpoint nuevo que exponga datos de usuario **DEBE** usar `@require_auth` y filtrar por el `user_id` del
   token, nunca por uno recibido del cliente. Los endpoints de administración **DEBEN** usar `@require_admin`.
2. Todo input externo se valida: en el servicio en el backend (`ValidationError`) y con zod en el frontend.
3. Los endpoints que llamen a proveedores de IA **DEBEN** tener rate limiting (Redis, `utils/rate_limiter.py`), y los
   fallos del proveedor se traducen a `ServiceUnavailableError` (503).
4. Nada de SQL construido concatenando strings: se usa el ORM o parámetros enlazados.
5. **NO DEBEN** commitearse `backend/keys/*.pem` ni ningún `.env`. Las variables nuevas se documentan en el
   `.env.example` que corresponda y, si `backend/.env.example` no las recoge, en `config.py`.

## Art. P4 — Añadidos a la definición de "hecho"

- [ ] Si hubo cambios de modelo, la migración Alembic está incluida y revisada.
- [ ] Si la feature necesita un paso manual en producción (migración, variable nueva en EC2, configuración
      externa), está documentado en `docs/deploy-runbook.md` o en el `docs-report.md`.
