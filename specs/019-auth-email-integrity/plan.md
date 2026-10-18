# Plan 019 — Integridad de los correos guardados: recorte de espacios y garantía en la base

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-18)
- **Ámbitos:** backend

## 1. Resumen de la solución
Una migración Alembic nueva (`e5b7d9f1a3c6`, después de `a7d3f9c1e5b2`) convierte a la forma canónica de ADR-0025 los correos de `users` y de `password_reset_requests` con una sola expresión SQL (quitar blancos al principio y al final y pasar a minúsculas). Antes de escribir nada, comprueba si hay cuentas que coincidirían y, si las hay, falla con el mensaje de la spec. Después crea dos restricciones `CHECK` que hacen que Postgres rechace cualquier correo no canónico (ADR-0027). Las mismas restricciones se declaran en los modelos `User` y `PasswordResetRequest`, así que `create_all()` las crea en la base de tests y toda la suite de integración corre con la garantía activa. No cambia ningún servicio, repositorio ni ruta: el registro, el login, Google Sign-In y el restablecimiento ya escriben y buscan el correo canónico desde la 014 (`services/credential_rules.py`).

## 2. Impacto en la arquitectura
| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | models | — | `backend/models/user.py` | `__table_args__` con `CheckConstraint` `ck_users_email_canonical` (REQ-004). |
| backend | models | — | `backend/models/password_reset_request.py` | `CheckConstraint` `ck_password_reset_requests_email_canonical` añadido a la tupla `__table_args__` existente (REQ-004). |
| backend | migrations | `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py` | — | Conversión de datos, detección de conflictos, creación y retirada de las restricciones (REQ-001, REQ-002, REQ-003, REQ-004, REQ-006). |
| backend | tests (los escribe el `test-author`) | `backend/tests/migration_helpers.py`, `backend/tests/test_services/test_canonical_emails_migration.py`, `backend/tests/test_services/test_canonical_email_google.py`, `backend/tests/test_routes/test_canonical_email_routes.py` | `backend/tests/conftest.py`, `backend/tests/test_services/test_lowercase_emails_migration.py`, `backend/tests/test_routes/test_auth_routes.py` | Tests nuevos de la 019 y adaptación de la preparación de los tests de la 014 que simulan cuentas antiguas (sección 5.3). |
| docs (etapa docs) | runbook | — | `docs/deploy-runbook.md`, `CLAUDE.md` | Paso manual de producción (caso B'), sección 3.1.4. Lo hace el `doc-keeper`, no el `implementer`. |

Ningún cambio en `services/`, `repositories/`, `routes/`, `utils/` ni en el frontend.

## 3. Diseño
### 3.1 Datos y migraciones

#### 3.1.1 Expresión canónica en SQL
Una única expresión, idéntica en el modelo y en la migración:

```sql
lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
```

- `[[:space:]]` cubre los blancos ASCII que quita `str.strip()` (espacio, `\t`, `\n`, `\r`, `\v`, `\f`), así que una cuenta guardada con un tabulador al final también queda accesible.
- Condición de las dos restricciones `CHECK`: `email = lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g'))`.
- `regexp_replace` y `lower` son funciones inmutables de Postgres y no necesitan extensiones (Supabase incluido).

#### 3.1.2 Modelos
- `backend/models/user.py`: `User` no tiene hoy `__table_args__` propio (hereda `{"schema": "public"}` de `Base`). Se añade:
  ```python
  __table_args__ = (
      CheckConstraint(CANONICAL_EMAIL_CONDITION, name="ck_users_email_canonical"),
      {"schema": "public"},
  )
  ```
- `backend/models/password_reset_request.py`: se añade `CheckConstraint(CANONICAL_EMAIL_CONDITION, name="ck_password_reset_requests_email_canonical")` al principio de la tupla existente, antes del `Index` y del diccionario de esquema.
- `CANONICAL_EMAIL_CONDITION` es una constante de módulo `str` en `backend/models/user.py` con la condición de 3.1.1; `password_reset_request.py` la importa de ahí. No se toca la columna `email` (sigue `unique=True, index=True` en `users`).

#### 3.1.3 Migración `e5b7d9f1a3c6_canonical_email_check_constraints.py`
- `revision = 'e5b7d9f1a3c6'`, `down_revision = 'a7d3f9c1e5b2'`. Se escribe a mano: el autogenerado de Alembic no detecta restricciones `CHECK` ni hace conversiones de datos (ADR-0027). No importa modelos ni utilidades de la app: la expresión SQL va como constante del propio archivo, para que la migración no cambie si cambia el modelo en el futuro.
- Constantes de módulo: `CANONICAL_EMAIL_SQL` (la expresión de 3.1.1), `USERS_CHECK = "ck_users_email_canonical"`, `RESET_REQUESTS_CHECK = "ck_password_reset_requests_email_canonical"` y `CONFLICT_MESSAGE_PREFIX = "Hay cuentas cuyos correos coinciden al quitar espacios y mayúsculas; resuélvelas a mano antes de migrar: "`.
- `upgrade()`, en este orden (todo en la transacción de Alembic, `env.py` usa `context.begin_transaction()`; el DDL de Postgres es transaccional):
  1. **Conflictos** (REQ-002), solo lectura:
     ```sql
     SELECT <canónica> AS canonical, array_agg(email ORDER BY email COLLATE "C") AS emails
     FROM public.users GROUP BY <canónica> HAVING count(*) > 1 ORDER BY canonical COLLATE "C"
     ```
     Si devuelve filas, lanza `RuntimeError(CONFLICT_MESSAGE_PREFIX + "; ".join(", ".join(f'"{e}"' for e in row.emails) for row in conflicts))`, antes de cualquier escritura. Cada correo va entre comillas dobles y tal como está guardado (con sus espacios); los grupos, separados por `; `. `COLLATE "C"` hace el orden determinista con cualquier collation de la base.
  2. **Cuentas** (REQ-001): `UPDATE public.users SET email = <canónica> WHERE email <> <canónica>`. Solo toca las filas no canónicas; el SQL directo no dispara el `onupdate` del ORM, así que `updated_at` y el resto de columnas quedan iguales (AC-001.3).
  3. **Solicitudes** (REQ-003): `UPDATE public.password_reset_requests SET email = <canónica> WHERE email <> <canónica>`. Sin comprobación de conflictos (la tabla no exige unicidad, Q1).
  4. **Garantía** (REQ-004): `op.create_check_constraint(USERS_CHECK, 'users', <condición>, schema='public')` y lo mismo con `RESET_REQUESTS_CHECK` sobre `password_reset_requests`.
  - El SQL se construye solo con constantes del propio archivo, sin datos de usuario (Art. P3.4).
- `downgrade()` (REQ-006): `op.drop_constraint(RESET_REQUESTS_CHECK, 'password_reset_requests', type_='check', schema='public')` y lo mismo con `USERS_CHECK`. No toca ningún correo; el docstring dice que los originales solo se recuperan desde el volcado previo.
- Volver a aplicar `upgrade()` tras un `downgrade()` sobre datos ya canónicos no encuentra conflictos, no actualiza filas y vuelve a crear las restricciones (AC-006.2).
- Si la 014 no se hubiera aplicado en algún entorno (Q3), Alembic aplica primero `a7d3f9c1e5b2` y después esta; esta trata igualmente mayúsculas y espacios.

#### 3.1.4 Paso manual de producción (lo documenta la etapa docs, Art. P4)
Caso **B'** de `docs/deploy-runbook.md` (migración de datos no reversible, **antes** del merge). Es seguro aplicarla con el código de `main` en marcha porque ese código ya escribe siempre el correo canónico (014), así que la restricción no rechaza nada que hoy se guarde.
1. **Volcado completo verificado** (paso 3 del runbook) en `C:/Users/alber/fitnerd-backups/prod-<fecha>.dump`, con `pg_restore --list` listando todas las tablas. Es la única vía para recuperar los correos originales.
2. **Comprobación de solo lectura** (paso 4 del runbook, `SET TRANSACTION READ ONLY`):
   - `alembic_version` = `a7d3f9c1e5b2`; si no, parar.
   - Recuento de `users` y de `password_reset_requests`.
   - Correos no canónicos: `SELECT count(*) FROM public.users WHERE email <> lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g'))` y lo mismo en `password_reset_requests`.
   - Conflictos: `SELECT lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g')), array_agg(email) FROM public.users GROUP BY 1 HAVING count(*) > 1`. Si hay filas, resolverlas a mano antes de migrar (no se fusionan ni se borran solas).
3. **Aplicar la migración desde local:** `cd backend && FLASK_ENV=production .venv/Scripts/python.exe -m flask db upgrade` (alternativa en la instancia: `docker compose -f docker-compose.prod.yml exec backend flask db upgrade`). Si hay conflictos, falla sin modificar nada y lista los correos: resolver y repetir.
4. **Comprobación posterior de solo lectura:** revisión `e5b7d9f1a3c6`; 0 correos no canónicos en las dos tablas; las dos restricciones existen (`SELECT conname FROM pg_constraint WHERE conname IN ('ck_users_email_canonical', 'ck_password_reset_requests_email_canonical')` devuelve 2 filas); los recuentos de filas, iguales que antes.
5. **Merge del PR** y CD (paso 6 del runbook); prueba manual de login y de "¿Olvidaste tu contraseña?" con una cuenta real.
6. **Marcha atrás:** el código de esta rama no depende de la restricción, así que revertir el merge basta para el código. `flask db downgrade` a `a7d3f9c1e5b2` solo quita las restricciones; los correos convertidos solo vuelven desde el volcado.
7. Añadir la fila del despliegue en el historial del runbook y la 019 como ejemplo del caso B'.

### 3.2 Contratos e interfaces
- **API HTTP:** sin cambios. Mismos códigos y mensajes en `/api/auth/register`, `/login`, `/google`, `/forgot-password` y `/reset-password`.
- **Símbolos nuevos que importarán los tests** (el `implementer` crea sus esqueletos):
  - `backend/models/user.py`:
    ```python
    CANONICAL_EMAIL_CONDITION: str  # "email = lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g'))"
    ```
    Es una constante, no lleva esqueleto con `NotImplementedError`: en el andamiaje se crea con su valor final. Las restricciones `CheckConstraint` del modelo se añaden en la implementación, no en el andamiaje (si no, el rojo de los tests de integración desaparecería antes de tiempo).
  - `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py` (se carga por ruta, como la de la 014):
    ```python
    revision = 'e5b7d9f1a3c6'
    down_revision = 'a7d3f9c1e5b2'
    branch_labels = None
    depends_on = None

    CANONICAL_EMAIL_SQL: str
    USERS_CHECK: str = "ck_users_email_canonical"
    RESET_REQUESTS_CHECK: str = "ck_password_reset_requests_email_canonical"
    CONFLICT_MESSAGE_PREFIX: str

    def upgrade() -> None: ...
    def downgrade() -> None: ...
    ```
    Esqueleto (Art. P1 backend 5): las constantes con su valor final y `upgrade()` y `downgrade()` con `raise NotImplementedError("not implemented")`.
- **Mensaje de fallo de la migración** (spec, sección 6): `Hay cuentas cuyos correos coinciden al quitar espacios y mayúsculas; resuélvelas a mano antes de migrar: "<correo 1>", "<correo 2>"; "<correo 3>", "<correo 4>"`, lanzado como `RuntimeError`.
- **Errores de la base:** una escritura no canónica lanza `sqlalchemy.exc.IntegrityError` (violación de `CHECK`, SQLSTATE 23514) cuyo texto incluye el nombre de la restricción.

### 3.3 Lógica
- Toda la lógica nueva vive en la migración (SQL con constantes) y en la definición del esquema (modelos). No hay reglas de negocio nuevas en `services/`.
- Se reutiliza sin cambios `services/credential_rules.py` (`normalize_email`, `validate_email`), que ya produce `strip().lower()` en todos los caminos de escritura del correo: `AuthService.register`, `AuthService.login_with_google` y `PasswordResetService.request_reset` (comprobado en el código). Por eso REQ-005 no necesita cambios de producción: los tests lo demuestran con la garantía activa.
- `UserRepository.get_by_email` sigue comparando `lower(email)` con el correo recibido. Con la garantía activa el resultado es el mismo que una igualdad exacta; simplificarlo para usar el índice de `email` queda en el backlog (fuera del alcance de la spec).
- La estructura de la migración sigue los precedentes `a7d3f9c1e5b2` (comprobar conflictos y lanzar `RuntimeError` antes de escribir) y `d8e4b2a7c1f5` (preparar datos y después crear la restricción; `downgrade` que solo la quita).

### 3.4 Interfaz de usuario
No aplica.

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | Migración `e5b7d9f1a3c6`, `upgrade()` paso 2: `UPDATE public.users … WHERE email <> <canónica>` (3.1.3). |
| REQ-002 | Migración `e5b7d9f1a3c6`, `upgrade()` paso 1: consulta de conflictos y `RuntimeError` con el mensaje de la spec antes de cualquier escritura; transacción de Alembic (3.1.3). |
| REQ-003 | Migración `e5b7d9f1a3c6`, `upgrade()` paso 3: `UPDATE public.password_reset_requests …` sin comprobación de conflictos (3.1.3). |
| REQ-004 | Restricciones `ck_users_email_canonical` y `ck_password_reset_requests_email_canonical`: creadas en `upgrade()` paso 4 y declaradas en `backend/models/user.py` y `backend/models/password_reset_request.py` (3.1.2, ADR-0027). |
| REQ-005 | Sin cambios de producción: `services/credential_rules.py` ya normaliza en todos los caminos de escritura; se demuestra con tests de integración que corren con las restricciones del modelo (3.3, 5.2). |
| REQ-006 | Migración `e5b7d9f1a3c6`, `downgrade()`: quita las dos restricciones sin tocar correos; `upgrade()` idempotente sobre datos canónicos (3.1.3). |
| NFR | La spec no define NFR. El paso manual de producción (Art. P4) está en 3.1.4 y lo documenta la etapa docs. |

## 5. Estrategia de pruebas
Ámbito único: **backend**. Todos los tests usan el Postgres de prueba (`TEST_DATABASE_URL`); ninguno llama a Google, Resend ni Redis reales (Art. P1 backend 4). Marcadores con número de spec: `# SDD: 019 REQ-00X AC-00X.Y` (Art. P1 general 1). Nombres en inglés y docstrings en español.

Entorno: `docker compose up -d postgres redis` (puerto 5433) y `backend/.venv` con las dependencias; sin servicios nuevos.

### 5.1 Utilidades de test nuevas: `backend/tests/migration_helpers.py`
Las escribe el `test-author` (no son código de producción):
- `load_migration(filename: str) -> ModuleType`: carga un archivo de `backend/migrations/versions/` por ruta (como `test_lowercase_emails_migration.py`).
- `run_upgrade(connection, filename: str) -> None` y `run_downgrade(connection, filename: str) -> None`: ejecutan `upgrade()` o `downgrade()` con `MigrationContext.configure(connection)` y `Operations.context(...)`, sobre la conexión de la transacción del test.
- `CANONICAL_EMAILS_MIGRATION = "e5b7d9f1a3c6_canonical_email_check_constraints.py"`.
- `drop_canonical_email_checks(connection) -> list[str]`: `ALTER TABLE … DROP CONSTRAINT IF EXISTS` de las dos restricciones y devuelve los nombres que existían (consulta a `pg_constraint`). Con `IF EXISTS` funciona igual antes y después de la implementación. Ejecuta antes `SET LOCAL lock_timeout = '5s'`, para que un bloqueo inesperado falle en lugar de colgar la suite.
- `restore_canonical_email_checks(connection, names: list[str]) -> None`: vuelve a crear, desde los `CheckConstraint` de `User.__table__` y `PasswordResetRequest.__table__` (`sqlalchemy.schema.AddConstraint`), las restricciones cuyo nombre esté en `names`.

Patrón ya usado en el proyecto: `test_body_metric_consolidation.py` quita la restricción única dentro de la transacción del test y el `rollback` la restaura (DDL transaccional).

### 5.2 Tests nuevos
**Migración, `backend/tests/test_services/test_canonical_emails_migration.py`** (con `db_session`; cada test termina con `db_session.rollback()` en un `finally`, así que no deja cambios). Preparación común: `drop_canonical_email_checks(db_session.connection())` para reproducir la base anterior a la 019, insertar los datos "sucios" (ORM o `text()` con parámetros enlazados) y `flush()`.

| AC | Qué prueba |
|---|---|
| AC-001.1 | `"  ana@example.com "` pasa a `"ana@example.com"` tras `run_upgrade`. |
| AC-001.2 | `" Ana@Example.COM"` pasa a `"ana@example.com"`. |
| AC-001.3 | Una cuenta canónica con todos sus campos rellenos (incluidos `google_id`, `password_hash`, `created_at` y `updated_at` fijados) conserva la fila entera idéntica: comparar `SELECT *` antes y después. Una segunda cuenta no canónica conserva todo salvo `email`. |
| AC-001.4 | **Integración** en `backend/tests/test_routes/test_canonical_email_routes.py` (ver abajo). |
| AC-002.1 | Cuentas `"ana@example.com"`, `" ana@example.com"` y una tercera no canónica `"Otro@Example.com"`: `run_upgrade` lanza `RuntimeError`; el mensaje empieza por el prefijo de la spec y contiene `"\"ana@example.com\""` y `"\" ana@example.com\""`; los tres correos siguen como estaban. |
| AC-002.2 | `"Ana@Example.com "` y `"ana@example.com"`: falla, nada cambia y, al partir el texto tras el prefijo por `"; "`, los dos correos (entre comillas) están en el mismo grupo. No se depende del orden dentro del grupo. |
| AC-002.3 | Mismo escenario de conflicto más una solicitud `" Ana@Example.com"`: tras el fallo, la solicitud conserva su correo, las restricciones no existen (`pg_constraint`) y un `INSERT` de una cuenta `"Bea@Example.com"` se acepta. |
| AC-003.1 | Solicitud `" Ana@Example.com"` con `token_hash`, `created_at`, `used_at` e `invalidated_at` fijados: solo cambia `email`, a `"ana@example.com"`. |
| AC-003.2 | Solicitudes `"ANA@example.com"` y `"ana@example.com"`: `run_upgrade` no falla y quedan dos filas con `"ana@example.com"`. |
| AC-004.1–AC-004.4 | Tras `drop_canonical_email_checks` y `run_upgrade` (la garantía la crea la migración, no `create_all()`), cada escritura no canónica se intenta dentro de un `SAVEPOINT` (`db_session.begin_nested()`) y lanza `sqlalchemy.exc.IntegrityError` cuyo texto contiene el nombre de la restricción. En AC-004.3 (`UPDATE` a `"ANA@example.com"`), tras revertir el savepoint el correo sigue siendo `"ana@example.com"`; en AC-004.1, la cuenta no existe. |
| AC-004.5 | Tras `run_upgrade`, `INSERT` de `"ana@example.com"` se acepta. |
| AC-006.1 | Cuenta `" Ana@example.com"` → `run_upgrade` → `run_downgrade`: el correo sigue siendo `"ana@example.com"` y un `INSERT` de `"Bea@example.com"` se acepta. |
| AC-006.2 | Con datos canónicos: `run_upgrade`, `run_downgrade` y `run_upgrade` otra vez terminan sin error, los correos no cambian y una escritura no canónica vuelve a fallar con `IntegrityError`. |

**Integración HTTP, `backend/tests/test_routes/test_canonical_email_routes.py`** (fixture `client`; las restricciones existen porque `create_all()` las crea desde el modelo; cada test REQ-005 comprueba como precondición, en `pg_constraint`, que `ck_users_email_canonical` existe):

| AC | Qué prueba |
|---|---|
| AC-001.4 | En una sola transacción (`app.app_context()` y `db.session`): `drop_canonical_email_checks`, insertar una cuenta `" ana@example.com"` con hash bcrypt (`gensalt(rounds=4)`), `run_upgrade` y `commit` (el esquema queda igual que con `create_all()`). Después `POST /api/auth/login` con `ana@example.com` da 200 y el token es de esa cuenta (`/api/auth/me` devuelve su `id`). |
| AC-005.1 | Registro con `" Ana@Example.com "` da 201 y la fila guardada tiene `"ana@example.com"` (consulta directa). |
| AC-005.2 | Cuenta registrada con `ana@example.com`; login con `" ANA@example.com"` da 200 y `/api/auth/me` devuelve el `id` de esa cuenta. |
| AC-005.3 | Registro con `"Ana@Example.com"` sobre `ana@example.com` da 409 con `{"error": "Ya existe una cuenta con este correo"}` y sigue habiendo una cuenta. |
| AC-005.5 | `POST /api/auth/forgot-password` con `" ANA@example.com "` responde como hoy (mismo código y cuerpo que los tests de la 014), `email_sender.transport.outbox` tiene un correo para `ana@example.com` y la fila de `password_reset_requests` guarda `"ana@example.com"`. |

**Google con base real, `backend/tests/test_services/test_canonical_email_google.py`** (AC-005.4): la ruta `/api/auth/google` usa el verificador real de Google y no admite inyección sin `monkeypatch`, así que el test construye `AuthService(UserRepository(db_session), UnitOfWork(db_session), <FakeJWTManager del propio test>, "client-id", google_token_verifier=<FakeGoogleVerifier del propio test>)` con claims `{"email": "Ana@Example.com", "email_verified": True, "sub": "g-1"}`, con las restricciones del modelo activas (precondición en `pg_constraint`), y comprueba que la cuenta queda guardada con `"ana@example.com"`. Es un test con Postgres real y fakes escritos a mano inyectados por constructor (Art. P1 backend 3), como `test_body_metric_consolidation.py`; `UnitOfWork` hace commit y `_clean_database` limpia después.

### 5.3 Adaptación de tests existentes de la 014 (sin debilitarlos)
Con las restricciones declaradas en el modelo, cinco tests de la 014 que simulan datos anteriores a la 014 (correos con mayúsculas) fallarían al insertar. Solo cambia su preparación; sus aserciones y marcadores quedan iguales (Art. B5.3):
- `backend/tests/test_services/test_lowercase_emails_migration.py` (tres tests): antes de insertar, `drop_canonical_email_checks(db_session.connection())`. El `rollback` del `finally` restaura las restricciones.
- `backend/tests/test_routes/test_auth_routes.py`: `test_register_rejects_an_email_matching_a_legacy_account_with_uppercase` y `test_login_finds_a_legacy_account_stored_with_uppercase` piden un fixture nuevo `legacy_email_schema` (en `backend/tests/conftest.py`), porque `insert_legacy_user` hace commit para que el `client` vea la cuenta:
  - preparación: en un `app.app_context()`, `names = drop_canonical_email_checks(...)` y `commit`;
  - limpieza: `rollback`, borrar las filas de todas las tablas (mismo bucle que `_clean_database`) y `restore_canonical_email_checks(..., names)` y `commit`, de modo que el resto de la suite vuelve a tener la garantía aunque el test falle.
- Como `drop_canonical_email_checks` usa `IF EXISTS`, estos cinco tests siguen en verde antes y después de la implementación; no forman parte del rojo.

### 5.4 Rojo esperado
Con el andamiaje (`upgrade()`/`downgrade()` lanzan `NotImplementedError("not implemented")` y los modelos aún sin `CheckConstraint`):
- los tests de migración fallan en `run_upgrade`/`run_downgrade` con `not implemented`;
- AC-001.4 falla en `run_upgrade`;
- los tests REQ-005 (rutas y Google) fallan en la precondición de `pg_constraint` (la garantía todavía no existe en el esquema de tests): comportamiento ausente, no un error del test.

Cobertura: los 23 AC de la spec (AC-001.1 a AC-006.2) tienen al menos un test en 5.2.

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| La conversión de datos en producción no es reversible. | Segura (por diseño) | Alto | Volcado completo verificado antes de migrar y comprobación previa de solo lectura (3.1.4); `downgrade()` documentado como "solo quita las restricciones". |
| Conflictos en producción que impiden migrar. | Baja (en la 014 había 0 correos con mayúsculas) | Medio | La migración falla sin escribir nada y lista los correos; consulta previa de conflictos en el runbook; resolución manual. |
| Un camino de escritura futuro, o un correo con letras no ASCII o blancos Unicode, choca con la restricción y produce un 500. | Baja | Medio | Riesgo aceptado en la spec (Q2); la suite completa corre con la restricción activa y detectaría un camino que no normalice; anotado en el backlog. |
| La expresión canónica del modelo y la de la migración divergen. | Baja | Medio | Constantes con nombre en ambos sitios; tests de migración (prueban la copia de la migración, AC-004 con `run_upgrade`) y de integración (prueban la del modelo); el `reviewer` compara las dos cadenas. |
| Los fixtures que quitan restricciones con `commit` dejan la base de tests sin la garantía o se bloquean con otra conexión. | Baja | Medio | Limpieza en el `teardown` del fixture que borra filas y restaura las restricciones siempre; `SET LOCAL lock_timeout = '5s'` en el helper. |
| `ALTER TABLE … ADD CONSTRAINT` bloquea `users` durante la validación en producción. | Baja | Bajo | Tablas pequeñas; validación de milisegundos. Se aplica fuera de horas de uso si se quiere. |

## 7. Cumplimiento de la constitución
- **Art. B1:** cambio con spec aprobada; el plan no amplía el alcance (no se tocan servicios, mensajes ni validación).
- **Art. B4:** todos los REQ están mapeados (sección 4) y los 23 AC tienen test con marcador `SDD: 019 …` (5.2).
- **Art. B5.1–B5.3 y B5.6:** tests antes de la implementación; los tests de la 014 solo cambian su preparación, sin borrar, saltar ni relajar aserciones (5.3); esqueletos con `NotImplementedError("not implemented")` (3.2).
- **Art. B5.4 y P1 backend 4:** sin servicios externos; Google se sustituye por un fake inyectado por constructor.
- **Art. B5.7:** el ratchet de ruff solo cuenta violaciones nuevas en los archivos tocados.
- **Art. P1 backend 1–3:** tests en `test_services/` y `test_routes/`; fakes escritos a mano; sin `unittest.mock` ni `monkeypatch`. `tests/migration_helpers.py` es un utilitario compartido de tests, en la línea de `tests/fakes.py`.
- **Art. P2 backend 1–3, 5:** sin cambios en capas, servicios ni rutas; se reutiliza `services/credential_rules.py`.
- **Art. P2 backend 4:** el cambio de modelo (restricciones `CHECK`) incluye su migración. La migración se escribe a mano en lugar de con `flask db migrate`, porque el autogenerado de Alembic no detecta restricciones `CHECK` ni sabe convertir datos; el `reviewer` la revisa a mano contra el modelo.
- **Art. P3.4:** el SQL de la migración solo usa constantes del archivo; los tests usan parámetros enlazados.
- **Art. P3.5:** sin variables de entorno nuevas.
- **Art. P4:** paso manual de producción descrito en 3.1.4; la etapa docs lo lleva a `docs/deploy-runbook.md` (caso B') y a `CLAUDE.md`.
- No se incumple ningún "DEBERÍA".

## 8. ADRs
- [ADR-0027](../../docs/sdd/decisions/ADR-0027-garantia-de-correo-canonico-con-check.md): restricciones `CHECK` declaradas en el modelo y en la migración en lugar de un índice único funcional, trigger o `citext` (Propuesta).
