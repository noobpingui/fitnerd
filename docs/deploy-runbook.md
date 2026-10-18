# Runbook de despliegue a producción

Guía paso a paso para llevar una rama a producción sin sustos. Recoge lo que se hizo en los despliegues del rediseño (006–010, 13-oct-2026), de la 011, de la retirada del catálogo (012, 14-oct-2026), del pulido 013 (15-oct-2026) y del endurecimiento de la autenticación (014).

**Piezas que intervienen:**

| Pieza | Dónde | Cómo se despliega |
|---|---|---|
| Frontend | Vercel (`fitnerd.betofallas.dev`) | Solo, con cada push a `main` |
| Backend | EC2 detrás de Caddy (`api.fitnerd.betofallas.dev`) | Job `deploy` de `backend-tests.yml` tras pasar los tests en `main` (ADR-0016) |
| Base de datos | Supabase (Postgres) | **A mano**: las migraciones nunca se aplican solas |
| Redis | La misma instancia EC2 | Con el backend (`docker-compose.prod.yml`) |

---

## 0. Reglas que no se saltan

- **Nunca imprimas `PROD_DATABASE_URL`** (ni en la terminal ni en un log). Los scripts de abajo la leen de `backend/.env` y se la pasan al proceso sin mostrarla.
- **Nunca ejecutes `docker compose config`**: imprime todos los secretos en claro.
- **`flask` sin `FLASK_ENV` apunta a producción** (`backend/wsgi.py` usa `ProductionConfig` por defecto). Para trabajar en local, siempre `FLASK_ENV=development`. Para producción, escríbelo explícitamente (`FLASK_ENV=production`) para que se vea que es a propósito.
- **Las comprobaciones contra producción son de solo lectura:** abren la transacción con `SET TRANSACTION READ ONLY`, así que cualquier escritura fallaría.
- **El merge a `main` lo hace el usuario** (`gh pr merge N --merge`). Cada commit, push y merge lleva su aprobación.

---

## 1. ¿Qué tipo de despliegue es?

Lista las migraciones que trae la rama:

```bash
git fetch origin
git diff --name-only origin/main...HEAD -- backend/migrations/versions/
```

| Caso | Ejemplo | Qué cambia en el procedimiento |
|---|---|---|
| **A. Sin migraciones** | 011, 013 | Solo PR, merge y comprobaciones (pasos 2, 5 y 6). |
| **B. Migración aditiva** (tabla o columna nueva, restricción que el código nuevo necesita) | 006 (`c6a1f0d2e9b4`), 008 (`d8e4b2a7c1f5`) | Backup y migración **antes** del merge (*expand*): el código viejo sigue funcionando con el esquema nuevo. |
| **B'. Migración de datos no reversible** (reescribe valores existentes, p. ej. pasar columnas a minúsculas) | 014 (`a7d3f9c1e5b2`), 019 (`e5b7d9f1a3c6`) | Como el caso B: backup completo y migración **antes** del merge. La 014 pasa los correos a minúsculas porque el código nuevo los busca así; la 019 los deja en forma canónica y crea las restricciones `CHECK`. Su `downgrade()` no restaura datos: los valores originales solo vuelven del backup. |
| **C. Migración destructiva** (borrar tablas o columnas, renombrar, `NOT NULL` sobre datos existentes) | 012 (`f2c4e6a8b0d1`) | Backup completo, merge y **después** del CD la migración (*contract*): el código que ya no usa esas tablas tiene que estar desplegado antes de borrarlas. |

Si una migración mezcla las dos cosas, sepárala en dos despliegues: primero la parte aditiva, después la destructiva.

---

## 2. Comprobaciones previas (todos los casos)

1. **PR abierto contra `main` con el CI en verde:** `gh pr checks N --watch`. Deben pasar los dos `test` (backend y frontend) y el preview de Vercel. El job `deploy` sale como *skipping* en un PR, y es lo normal.
2. **Variables nuevas:** si la feature añade alguna, ya tiene que estar en el `backend/.env` de EC2 (o en Vercel, si es del frontend) **antes** del merge.
3. **Avisos del despliegue:** lee la sección de despliegue del `CLAUDE.md` y el PR por si hay pasos específicos de la feature.

---

## 3. Backup de producción (casos B y C)

Volcado completo (esquema y datos de todas las tablas) en formato *custom* de `pg_dump`, guardado **fuera del repositorio** en `C:/Users/alber/fitnerd-backups`. Se usa la imagen `postgres:17` para no depender de un `pg_dump` local.

```bash
#!/usr/bin/env bash
# Lee PROD_DATABASE_URL de backend/.env sin imprimirla y se la pasa a pg_dump
# por variable de entorno (no aparece en la línea de comandos).
set -euo pipefail
OUT="/c/Users/alber/fitnerd-backups/prod-$(date +%F).dump"
[ -e "$OUT" ] && { echo "Ya existe $OUT; no se sobrescribe."; exit 1; }
PGURL="$(grep -m1 '^PROD_DATABASE_URL=' /c/Users/alber/source/repos/fitnerd/backend/.env \
  | cut -d= -f2- | tr -d '\r"' | sed 's#^postgresql+[a-z0-9]*://#postgresql://#')"
export PGURL
docker run --rm -e PGURL postgres:17 sh -c 'pg_dump --format=custom --no-owner "$PGURL"' > "$OUT"
unset PGURL
ls -l "$OUT"

# Comprueba que el archivo se puede leer y cuenta lo que contiene.
docker run --rm -i postgres:17 pg_restore --list < "$OUT" > /tmp/toc.txt
echo "tablas: $(grep -c ' TABLE public ' /tmp/toc.txt)"
echo "bloques de datos: $(grep -c ' TABLE DATA public ' /tmp/toc.txt)"
```

- El `sed` quita el sufijo del driver de SQLAlchemy (`postgresql+psycopg://` → `postgresql://`), que `pg_dump` no entiende.
- **Un backup que no se ha leído no cuenta:** el `pg_restore --list` tiene que listar todas las tablas. En la 012 eran 14 tablas, y además se contaron las filas de las cinco que se iban a borrar.

---

## 4. Comprobación de solo lectura de la base

Antes de migrar, confirma en qué revisión está Supabase y que los datos están como esperas. Plantilla (ajusta las consultas a la feature):

```python
"""Comprobación de solo lectura de producción.

Uso: cd backend && .venv/Scripts/python.exe <script>.py .env
"""
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv(sys.argv[1])
engine = create_engine(os.environ["PROD_DATABASE_URL"])

with engine.connect() as conn:
    # exec_driver_sql y no text(): text() toma ":space" de "[[:space:]]" como
    # parámetro enlazado y la consulta falla (019).
    conn.exec_driver_sql("SET TRANSACTION READ ONLY")
    q = lambda sql: conn.exec_driver_sql(sql).scalar()
    print("alembic_version:", q("SELECT version_num FROM alembic_version"))
    print("users:", q("SELECT count(*) FROM users"))
    print("body_metrics:", q("SELECT count(*) FROM body_metrics"))
    # Ejemplos de comprobaciones específicas usadas en despliegues anteriores:
    # - ¿existe una tabla?  q("SELECT to_regclass('public.user_profiles')") is not None
    # - duplicados que una restricción única rechazaría (008):
    #   SELECT user_id, recorded_at, count(*) FROM body_metrics
    #   GROUP BY user_id, recorded_at HAVING count(*) > 1
    conn.rollback()
```

La revisión que devuelve tiene que ser la `down_revision` de la primera migración nueva. Si no coincide, **para**: alguien migró producción por otro camino.

**Consultas con `[[:space:]]`:** ejecútalas con `conn.exec_driver_sql(...)`, como en la plantilla. Con `text()` fallan con «A value is required for bind parameter 'spac'». Si necesitas `text()`, escapa los dos puntos (`[[\:space:]]`). Las consultas no llevan `%`, así que `exec_driver_sql` no necesita más escapes.

---

## 5. Migrar, hacer merge y desplegar

### Caso B (aditiva): migración antes del merge

1. Backup (paso 3) y comprobación (paso 4).
2. Aplica las migraciones desde local, contra producción:
   ```bash
   cd backend
   FLASK_ENV=production .venv/Scripts/python.exe -m flask db upgrade
   ```
   Alternativa en la instancia: `docker compose -f docker-compose.prod.yml exec backend flask db upgrade`.
3. Repite la comprobación de solo lectura: revisión nueva, tablas o restricciones creadas, recuento de filas sin cambios.
4. Merge del PR (`gh pr merge N --merge`) y paso 6.

### Caso B' (datos no reversible): 014, correos en minúsculas

Igual que el caso B, con estas diferencias:

1. Backup completo (paso 3) **verificado**. Es la única vía para recuperar las mayúsculas originales.
2. Antes de migrar, puedes buscar los conflictos a mano (solo lectura): `SELECT lower(email), array_agg(email) FROM public.users GROUP BY lower(email) HAVING count(*) > 1;`
3. Aplica `flask db upgrade`. Si hay cuentas cuyos correos solo se diferencian en mayúsculas, la migración **falla sin modificar nada** y el error lista los correos en conflicto. Resuélvelos a mano (no se fusionan ni se borran solos) y vuelve a aplicarla.
4. Comprobación de solo lectura: revisión nueva y ningún correo con mayúsculas (`SELECT count(*) FROM public.users WHERE email <> lower(email);` devuelve 0); el número de usuarios, igual que antes.

### Caso B' (datos no reversible): 019, correo canónico con restricción CHECK

Migración `e5b7d9f1a3c6` (ADR-0027). Convierte los correos de `users` y `password_reset_requests` a la forma canónica (sin espacios en los extremos y en minúsculas) y crea `ck_users_email_canonical` y `ck_password_reset_requests_email_canonical`. Se aplica **antes del merge**: el código de `main` ya escribe siempre el correo canónico (014), así que la restricción no rechaza nada de lo que hoy se guarda.

1. Backup completo (paso 3) **verificado** en `C:/Users/alber/fitnerd-backups`: `pg_restore --list` tiene que listar todas las tablas. Es la única vía para recuperar los correos originales.
2. Comprobación de solo lectura (paso 4, con `exec_driver_sql`):
   - `alembic_version` = `a7d3f9c1e5b2`; si no, **para**.
   - Recuento de `users` y de `password_reset_requests`.
   - Correos no canónicos, en las dos tablas: `SELECT count(*) FROM public.users WHERE email <> lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g'));`
   - Conflictos (solo en `users`): `SELECT lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g')), array_agg(email) FROM public.users GROUP BY 1 HAVING count(*) > 1;` Si devuelve filas, resuélvelas a mano antes de migrar (no se fusionan ni se borran solas).
3. Aplica `flask db upgrade` (`cd backend && FLASK_ENV=production .venv/Scripts/python.exe -m flask db upgrade`, o por `exec` en la instancia). Si hay conflictos, **falla sin modificar nada** y lista los correos: resuélvelos y repite. En `password_reset_requests` no hay conflictos posibles: se convierten sin más.
4. Comprobación de solo lectura posterior:
   - `alembic_version` = `e5b7d9f1a3c6`.
   - 0 correos no canónicos en las dos tablas (las mismas consultas del punto 2).
   - Las dos restricciones existen: `SELECT conname FROM pg_constraint WHERE conname IN ('ck_users_email_canonical', 'ck_password_reset_requests_email_canonical');` devuelve 2 filas.
   - Los recuentos de filas, iguales que antes.
5. Merge del PR y paso 6; prueba manual de login y de «¿Olvidaste tu contraseña?» con una cuenta real.
6. Marcha atrás: revertir el merge basta para el código (no depende de la restricción). `flask db downgrade` a `a7d3f9c1e5b2` solo quita las restricciones; los correos convertidos solo vuelven del volcado.

### Caso C (destructiva): migración después del CD

1. Backup completo (paso 3) **verificado**, con el recuento de filas de lo que se va a borrar.
2. Merge del PR y espera a que el CD termine en verde (paso 6). Desde ese momento el backend ya no usa las tablas.
3. Aplica la migración (mismo comando que en el caso B).
4. Comprobación de solo lectura: revisión nueva y las tablas ya no existen (`to_regclass` devuelve `NULL`); el resto de recuentos, igual que antes.

### Caso A (sin migraciones)

Merge del PR y paso 6.

---

## 6. Después del merge

1. **CD del backend:**
   ```bash
   gh run list --branch main --limit 3
   gh run watch <id-del-run-de-Backend-tests> --exit-status
   ```
   Tienen que pasar `test` y `deploy`. Si el resumen del job avisa de migraciones nuevas sin aplicar y no estabas en el caso B o C, aplícalas ahora.
2. **Frontend:** el workflow `Frontend tests` en verde y el despliegue de Vercel completado.
3. **Salud:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://api.fitnerd.betofallas.dev/api/health      # 200
   curl -s -o /dev/null -w "%{http_code}\n" https://api.fitnerd.betofallas.dev/api/profile     # 401 sin token
   ```
4. **Prueba manual con una cuenta real:** las pantallas que toca la feature, y un vistazo rápido a Macros, Métricas, Coach y Perfil.
5. **Recarga las pestañas abiertas** (recarga forzada): un bundle viejo puede llamar a rutas que ya no existen (012) o enviar cuerpos que el backend nuevo rechaza (010).
6. **Limpieza:** borra la rama en local y en `origin`, y `git pull --ff-only` en `main`.

---

## 7. Marcha atrás

| Qué falló | Qué hacer |
|---|---|
| El código desplegado (backend o frontend) | `git revert -m 1 <merge-commit>` en una rama, PR y merge. El CD redespliega la versión anterior. El commit de merge de cada despliegue está en la tabla de la sección 8. |
| Migración aditiva | Normalmente nada: el código anterior funciona con el esquema nuevo, así que basta con revertir el código. `flask db downgrade` solo si la migración estorba de verdad, y después de revisar qué hace su `downgrade()`. |
| Migración destructiva | El `downgrade()` de la 012 recrea las tablas **vacías**. Los datos solo vuelven desde el backup: `pg_restore --data-only --table=<tabla>` desde el `.dump`, en un orden que respete las claves foráneas. Pruébalo antes contra la base local. |
| `/api/health` no da 200 tras el CD | Mira los logs del job `deploy` y, en la instancia, `docker compose -f docker-compose.prod.yml logs backend --tail 100`. |

---

## 8. Historial de despliegues

| Fecha | Feature | PR / merge | Migraciones | Backup |
|---|---|---|---|---|
| 2026-10-13 | 006–010, rediseño | #3, `a60ca15` | `c6a1f0d2e9b4` y `d8e4b2a7c1f5`, aplicadas antes del merge (0 duplicados) | `prod-2026-10-13.dump` |
| 2026-10-14 | 011, ritmo poco realista | #4, `863ec4b` | — | — |
| 2026-10-14 | 012, retirada del catálogo | #6, `ebb3003` | `f2c4e6a8b0d1`, aplicada después del CD (5 tablas borradas) | `prod-2026-10-14.dump` |
| 2026-10-15 | 013, pulido de 006–010 | #7, `0596d9e` | — | — |
| 2026-10-15 | 014, endurecimiento de la autenticación | #13, `8f21df4` | `a7d3f9c1e5b2`, aplicada antes del merge (sin cambios de datos: 0 correos con mayúsculas) | `prod-2026-10-15.dump` |
| pendiente | 019, correo canónico con restricción CHECK | pendiente | `e5b7d9f1a3c6`, antes del merge (pendiente) | pendiente |

Añade una fila en cada despliegue.
