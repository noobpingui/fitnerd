# Constitución de fitnerd

> Principios **no negociables** del desarrollo de fitnerd. Todos los agentes SDD la leen antes de actuar,
> y el `reviewer` la usa como checklist. Solo el usuario puede cambiarla, siempre a través de un ADR
> (`docs/sdd/decisions/`).
>
> Palabras clave: **DEBE** (obligatorio) · **NO DEBE** (prohibido) · **DEBERÍA** (salvo justificación escrita en `plan.md`).

## Art. 1 — Ningún cambio funcional sin spec

1. Todo cambio de comportamiento **DEBE** pasar por el flujo SDD:
   `spec → plan → tasks → tests → implement → verify → review → close`.
   Los artefactos van en `specs/NNN-slug/`.
2. Excepciones (sin spec completa, pero con commit aprobado por el usuario):
   - typos;
   - cambios solo de copy o estilos sin lógica;
   - actualizar dependencias sin cambios de API;
   - hotfixes con `SDD_BYPASS=1`, que **DEBEN** documentarse después en una spec retroactiva.
3. Una spec aprobada no se modifica en silencio. Cambiarla reabre el gate de spec y todo lo que venga después.

## Art. 2 — Separación de roles

1. Cada etapa la ejecuta **un solo agente** y solo dentro de su rol:
   - el que especifica no planifica;
   - el que implementa no escribe ni modifica tests;
   - el que verifica no corrige;
   - el que revisa no participa en la implementación.
2. Los agentes se comunican **solo a través de artefactos en disco**.
3. Ningún subagente ejecuta `git commit`, `git push`, `git merge` ni `git rebase`. Esas operaciones son exclusivas del orquestador.

## Art. 3 — Aprobación humana

1. El orquestador **DEBE** detenerse al cerrar cada etapa y esperar la aprobación explícita del usuario ("aprobado", "sí" o equivalente).
2. Antes de **cualquier** `git commit` **DEBE** mostrar:
   - los archivos incluidos (`git status` y `git diff --stat`);
   - un resumen claro de los cambios;
   - el mensaje propuesto.
3. Antes de **cualquier** `git push` **DEBE** mostrar la rama de origen y de destino, y la lista de commits que se van a subir.
4. El silencio o una respuesta ambigua **no** son aprobación.
5. Varias etapas nunca se agrupan en una sola aprobación.

## Art. 4 — Trazabilidad

1. Cada requisito tiene un ID:
   - `REQ-NNN` para los funcionales;
   - `NFR-NNN` para los no funcionales;
   - `AC-NNN.M` para cada criterio de aceptación de un REQ, y `AC-NNNN.M` con el prefijo `N` (ej. `AC-N001.1`) para los de un NFR.
2. Cada tarea de `tasks.md` referencia al menos un REQ o NFR.
3. Cada AC **DEBE** estar cubierto por al menos un test que lleve el marcador `SDD: <IDs>`:
   - Python: `# SDD: REQ-001 AC-001.1` en la línea anterior a `def test_...`;
   - TypeScript: `// SDD: REQ-001 AC-001.1` en la línea anterior a `it(...)`.
4. Un AC sin test, o un REQ sin tarea, bloquea la verificación.

## Art. 5 — Testing (TDD estricto)

1. Los tests del código nuevo o modificado se escriben **antes** de la implementación, a partir de la spec y no del código.
2. El `verifier` **DEBE** confirmar que los tests nuevos fallan por **comportamiento ausente** (rojo legítimo) antes de pasar a implementar. No cuentan como rojo legítimo los errores de sintaxis, de import o de fixture.
3. La implementación termina cuando **todos** los tests pasan, tanto los nuevos como los existentes. No se permite borrar, saltar (`skip` o `xfail`) ni debilitar tests existentes.
4. Backend (pytest):
   - los tests van en `backend/tests/test_services/` (unitarios) o `backend/tests/test_routes/` (integración);
   - los unitarios aíslan dependencias con **fakes escritos a mano e inyectados por constructor** (`tests/fakes.py` o clases `Fake*` en el propio test). **NO DEBE** usarse `unittest.mock` ni `monkeypatch` salvo justificación en `plan.md`;
   - ningún test llama a servicios externos reales (Anthropic, Voyage, Google, S3 o Redis).
5. Frontend (Vitest y Testing Library):
   - los tests van junto al archivo que prueban (`Foo.test.tsx` al lado de `Foo.tsx`);
   - `globals: false`, así que cada test importa `describe`, `it` y `expect` desde `vitest`;
   - la red se simula en la capa `api.ts` o `apiClient`, nunca con llamadas reales.
6. Los nombres de los tests describen el comportamiento: en backend, `test_<comportamiento>` en inglés, como en los tests actuales; en frontend, `it("…")` en español. Docstrings y comentarios en español.

## Art. 6 — Arquitectura y convenciones

### Backend

1. **DEBE** respetar las capas `routes → services → repositories → models`:
   - las rutas solo parsean la request, llaman al servicio y serializan la respuesta;
   - la lógica de negocio vive en `services/`;
   - el acceso a datos vive en `repositories/`;
   - **solo** `UnitOfWork` hace `commit` o `rollback`.
2. Los servicios reciben sus dependencias (repositorios, UnitOfWork, clientes externos) **por constructor**. Las rutas las construyen con una función `_build_*_service()`.
3. Los errores se expresan con las excepciones de `exceptions/custom_exceptions.py`, y `error_handlers.py` las traduce a `{"error": "mensaje"}` con su código HTTP. **NO DEBE** devolverse un error construido a mano desde una ruta.
4. Todo cambio de modelo **DEBE** incluir su migración Alembic (`flask db migrate`), revisada a mano. Los tests usan `create_all()` y no detectan migraciones faltantes, así que el `reviewer` **DEBE** comprobarlo.
5. El código Python nuevo o modificado **DEBE** pasar `ruff check`.

### Frontend

6. **DEBE** mantener la organización por feature: `src/features/<feature>/` con `api.ts`, `hooks.ts`, `types.ts`, `schemas.ts` (zod), `components/` y `pages/`.
7. Las llamadas HTTP pasan **solo** por `apiFetch` (`src/lib/apiClient.ts`).
8. El estado de servidor se maneja con TanStack Query (con claves en `hooks.ts`) y los formularios con react-hook-form y zod.
9. Los componentes de UI reutilizables van en `src/components/ui/` (shadcn), y el alias de imports es `@/`.
10. **DEBE** pasar `npm run lint` sin errores nuevos (los warnings preexistentes se toleran) y `npx tsc -b`.

### General

11. Los textos visibles para el usuario van en español, con ortografía y tildes correctas y sin voseo.

## Art. 7 — Seguridad

1. **NO DEBEN** commitearse secretos: `.env`, `backend/keys/*.pem`, API keys o tokens. Las variables nuevas se documentan en el `.env.example` que corresponda.
2. Todo endpoint nuevo que exponga datos de usuario **DEBE** usar `@require_auth`, y filtrar por el `user_id` del token (nunca por uno recibido del cliente). Los endpoints de administración **DEBEN** usar `@require_admin`.
3. Todo input externo se valida: en el servicio en el backend (`ValidationError`) y con zod en el frontend.
4. Los endpoints que llamen a proveedores de IA **DEBEN** tener rate limiting, y los fallos del proveedor se traducen a `ServiceUnavailableError` (503).
5. Nada de SQL construido concatenando strings. Se usa el ORM o parámetros enlazados.

## Art. 8 — Git

1. Se trabaja en una rama por feature desde `main`: `feat/NNN-slug` o `fix/NNN-slug`. Nunca directamente en `main`.
2. Se hace un commit por etapa que produce artefactos.
3. Los mensajes van en inglés, en imperativo y sin prefijos convencionales. Terminan con la línea `Co-Authored-By` indicada por el entorno.
4. No se usa `--no-verify`, ni `push --force` sobre `main`, ni se reescribe historia ya publicada.

## Art. 9 — Definición de "hecho"

Una feature está **hecha** solo cuando se cumple todo esto:

- [ ] `spec.md`, `plan.md` y `tasks.md` aprobados por el usuario.
- [ ] Todas las tareas de `tasks.md` están marcadas `[x]`.
- [ ] Cada AC tiene al menos un test con el marcador `SDD:` y todos pasan.
- [ ] La suite completa del ámbito tocado pasa: `pytest` en el backend y/o `npm test` en el frontend.
- [ ] Lint (ruff para el backend en los archivos cambiados, oxlint para el frontend), typecheck (`tsc -b`) y build (`npm run build`, si se tocó el frontend) pasan.
- [ ] `verify-report.md` tiene resultado **PASS**.
- [ ] `review.md` tiene veredicto **APPROVED**, sin hallazgos bloqueantes abiertos.
- [ ] Si hubo cambios de modelo, la migración está incluida. Si hubo variables nuevas, `.env.example` está actualizado.
- [ ] El usuario aprobó el cierre y cada commit y push.
