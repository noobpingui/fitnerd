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
| **B. Migración aditiva** (tabla o columna nueva, restricción que el código nuevo necesita) | 006 (`c6a1f0d2e9b4`), 008 (`d8e4b2a7c1f5`), 021 (`c8e2a4f6b9d3`, con importación de datos; ver su sección en el paso 5) | Backup y migración **antes** del merge (*expand*): el código viejo sigue funcionando con el esquema nuevo. |
| **B'. Migración de datos no reversible** (reescribe valores existentes, p. ej. pasar columnas a minúsculas) | 014 (`a7d3f9c1e5b2`), 019 (`e5b7d9f1a3c6`) | Como el caso B: backup completo y migración **antes** del merge. La 014 pasa los correos a minúsculas porque el código nuevo los busca así; la 019 los deja en forma canónica y crea las restricciones `CHECK`. Su `downgrade()` no restaura datos: los valores originales solo vuelven del backup. |
| **C. Migración destructiva** (borrar tablas o columnas, renombrar, `NOT NULL` sobre datos existentes) | 012 (`f2c4e6a8b0d1`) | Backup completo, merge y **después** del CD la migración (*contract*): el código que ya no usa esas tablas tiene que estar desplegado antes de borrarlas. |

Si una migración mezcla las dos cosas, sepárala en dos despliegues: primero la parte aditiva, después la destructiva.

---

## 2. Comprobaciones previas (todos los casos)

1. **PR abierto contra `main` con el CI en verde:** `gh pr checks N --watch`. Deben pasar los dos `test` (backend y frontend) y el preview de Vercel. El job `deploy` sale como *skipping* en un PR, y es lo normal.
2. **Variables nuevas:** si la feature añade alguna, ya tiene que estar en el `backend/.env` de EC2 (o en Vercel, si es del frontend) **antes** del merge.
   - **`FRONTEND_BASE_URL` (desde la 020, ADR-0028):** en producción es obligatoria y debe empezar por `https://`. Comprueba que el `backend/.env` de EC2 tiene `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev` **antes del merge**. Si falta o no empieza por `https://`, `ProductionConfig` lanza un error al arrancar: el contenedor no levanta tras el CD y la comprobación de `/api/health` falla. Antes de la 020 la ausencia pasaba sin avisar y los correos llevaban enlaces a `localhost`.
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
   **Desde local, `backend/.env` no trae `FRONTEND_BASE_URL`** y `ProductionConfig` exige que exista y empiece por `https://` (spec 020): pásala solo para el comando, `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev FLASK_ENV=production .venv/Scripts/python.exe -m flask db upgrade`; si no, la app no arranca y el error sale antes de tocar la base. La migración no la usa.
   Antes del merge, la instancia aún no tiene el archivo de la migración, así que `exec backend flask db upgrade` allí solo sirve después del CD (como en la 022).
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

### Caso B (aditiva) con importación de datos: 021, base de alimentos de USDA

Migración `c8e2a4f6b9d3` (ADR-0029): crea `public.foods` (con su `CHECK`, la columna generada `search_vector` y el índice GIN). No toca datos existentes. La tabla se llena después con un script manual, que usa el código ya desplegado y la API de Voyage. Orden: backup, migración, merge y CD, importación, medición.

1. **Volcado completo** (paso 3) **verificado** en `C:/Users/alber/fitnerd-backups`. Aunque la migración es aditiva, sigue la regla del proyecto.
2. **Migración antes del merge** (caso B): `cd backend && FLASK_ENV=production .venv/Scripts/python.exe -m flask db upgrade`, con `FLASK_ENV` escrito a propósito (sin él, `flask` usa producción igualmente, pero así se ve que es intencionado; en local se usa `development`). Comprobación de solo lectura posterior: `alembic_version` = `c8e2a4f6b9d3`, existe `public.foods` (`to_regclass`) y está vacía.
3. **Merge y CD** (paso 6). El script de importación va en la imagen del backend, así que hasta que el CD termine no se puede ejecutar en la instancia.
4. **Descarga de los CSV** desde la página de FoodData Central de USDA (https://fdc.nal.usda.gov/download-datasets): los conjuntos **Foundation Foods** y **SR Legacy**, en formato CSV. Cada ZIP trae una **carpeta anidada** (`FoodData_Central_..._csv_AAAA-MM-DD/`): el script tiene que apuntar a esa carpeta interior, no a la que sale de descomprimir. Los archivos están fuera del repositorio.
5. **Copia a EC2** de las dos carpetas (por ejemplo con SSM o `scp`) a una ruta de la instancia, digamos `/home/ec2-user/usda`, con una subcarpeta por conjunto.
6. **Importación**, en la instancia y de forma **interactiva** (sin `-T`, con terminal):
   ```bash
   cd /home/ec2-user/fitnerd
   docker compose -f docker-compose.prod.yml run --rm -v /home/ec2-user/usda:/data/usda:ro backend \
     python -m scripts.import_usda_foods \
     --foundation /data/usda/<carpeta-foundation> --sr-legacy /data/usda/<carpeta-sr-legacy>
   ```
   - El script imprime el entorno y la base de datos (sin la contraseña). Como la base de Supabase no es local, **pregunta `[s/N]`** antes de escribir: comprueba que el entorno es `production` y responde `s`. Cualquier otra respuesta, o un fin de entrada sin respuesta, cancela sin escribir nada (código 1).
   - `--yes` omite la pregunta: úsalo **solo en ejecuciones no interactivas**. Si copias el comando a otro entorno con `--yes`, ya no hay confirmación.
   - **Aviso (F8):** el script decide «local» por el nombre del host. Un túnel SSH a Supabase que escuche en `localhost` se tomaría por base local y **no preguntaría**. No lo uses para importar; mira siempre la línea «Base de datos» que imprime.
   - La importación se hace en dos fases (inserta los alimentos y luego calcula los vectores con Voyage por lotes) y se puede repetir: reanuda donde se quedó, no duplica alimentos y no vuelve a llamar a Voyage por los que ya tienen vector. Se espera un total de **8.262 alimentos** (469 de Foundation y 7.793 de SR Legacy en los CSV de octubre de 2026), todos con vector. El resumen final lo dice por conjunto.
   - **En Windows** (si se ejecuta en local), la consola rompe los acentos de los mensajes: define `PYTHONIOENCODING=utf-8`.
7. **Medición del tamaño** (solo lectura): `SELECT pg_size_pretty(pg_total_relation_size('public.foods'));`. Referencia medida en local con los mismos CSV: **48 MB** con 8.262 alimentos (tabla 2,8 MB, índices 2,1 MB, el resto son los vectores en TOAST). Cabe de sobra en los 500 MB de Supabase; anota el valor real en la tabla de la sección 8 y compáralo con la referencia. Sirve de dato para decidir en la 023 si se añade FNDDS.
8. **Comprobación manual:** con una cuenta real, abre `/foods` (no hay enlace en la navegación, se entra por la URL) y busca «pechuga de pollo» y «banana». Debe haber resultados y la atribución a USDA.
9. **Marcha atrás:** revertir el merge basta para el código. `flask db downgrade` a `e5b7d9f1a3c6` borra `public.foods`; los datos importados se recuperan volviendo a ejecutar el script. Vaciar la tabla no afecta a nada más: aún no hay otra tabla que la referencie.

### Caso B (aditiva): 022, diario de comidas

Migración `b3d5f7a9c1e4` (ADR-0030): crea las tablas `meals` y `meal_items` (con sus restricciones e índices). Es aditiva, no toca datos existentes y no se aplica sola. El diario (`/diary`, `/api/meals`) no necesita variables nuevas ni importar datos. Orden: backup, migración, merge y CD.

1. **Volcado completo** (paso 3) **verificado** en `C:/Users/alber/fitnerd-backups`.
2. **Migración antes del merge** (caso B): `cd backend && FLASK_ENV=production .venv/Scripts/python.exe -m flask db upgrade`, con `FLASK_ENV` escrito a propósito (sin él, `flask` usa producción igualmente; en local se usa `development`). Comprobación de solo lectura posterior: `alembic_version` = `b3d5f7a9c1e4` y existen `public.meals` y `public.meal_items` (`to_regclass`), vacías.
3. **Merge y CD** (paso 6).
4. **Comprobación manual:** con una cuenta real, abre `/diary` (enlace «Diario» en la navegación), añade un alimento de USDA a una comida y uno personalizado, cambia sus gramos y quítalo; comprueba que los totales del día se comparan con el objetivo de Macros. Recarga forzada de las pestañas abiertas.
5. **Marcha atrás:** revertir el merge basta para el código. `flask db downgrade` a `c8e2a4f6b9d3` **borra las dos tablas con sus datos** (las comidas registradas se pierden); úsalo solo si la migración estorba de verdad y con el volcado a mano.

### Caso B (aditiva) con carga de datos: 023, catálogo genérico de alimentos

Migración `d4f6a8c0e2b5` (ADR-0031): crea `public.catalog_foods` y cambia las `CHECK` de `meal_items` (añade el origen `catalog` y la columna `catalog_id`). Es aditiva y no se aplica sola. El catálogo se llena después con un script manual que lee `backend/scripts/data/food_catalog.csv`. No hay variables nuevas ni llamadas a Voyage. Orden: backup, migración, merge y CD, carga.

1. **Volcado completo** (paso 3) **verificado** en `C:/Users/alber/fitnerd-backups`.
2. **Migración antes del merge** (caso B): `cd backend && FLASK_ENV=production .venv/Scripts/python.exe -m flask db upgrade`, con `FLASK_ENV` escrito a propósito (en local se usa `development`). Comprobación de solo lectura posterior: `alembic_version` = `d4f6a8c0e2b5` y existe `public.catalog_foods` (`to_regclass`), vacía.
3. **Merge y CD** (paso 6). **Aviso:** entre el CD y la carga, la búsqueda del diario está vacía (responde 200 sin resultados). Haz la carga enseguida.
4. **Carga del catálogo**, en la instancia y de forma **interactiva** (sin `-T`, con terminal):
   ```bash
   cd /home/ec2-user/fitnerd
   docker compose -f docker-compose.prod.yml run --rm backend python -m scripts.load_food_catalog
   ```
   - El script imprime el entorno y la base de datos (sin la contraseña). Como la base de Supabase no es local, **pregunta `[s/N]`**: comprueba que el entorno es `production` y responde `s`. Cualquier otra respuesta cancela sin escribir nada (código 1).
   - `--yes` omite la pregunta: úsalo **solo en ejecuciones no interactivas**.
   - **Sin túnel SSH:** un túnel a `localhost` se tomaría por base local y no preguntaría. Mira siempre la línea «Base de datos».
   - La carga sincroniza desde el CSV (añade, actualiza y borra) y se puede repetir. Resultado esperado en la primera carga: **261 añadidos**.
5. **Comprobación manual:** con una cuenta real, abre `/diary`, pulsa para añadir un alimento y busca «huevos», «banano» y «guineo»; debe haber resultados. Añade uno a una comida y comprueba los totales. Recarga forzada de las pestañas abiertas. `/foods` ahora redirige a `/diary`.
6. **Marcha atrás:** revertir el merge basta para el código. `flask db downgrade` a `b3d5f7a9c1e4` **se niega** (`RuntimeError`) si hay alimentos del catálogo registrados en comidas: quítalos antes. Si no los hay, borra `catalog_foods` y la columna `catalog_id`; el catálogo se recarga desde el CSV.

### Caso A (sin migraciones) con configuración de AWS: 024, análisis de foto con Bedrock

`POST /api/meals/analyze` (ADR-0032) llama a Amazon Bedrock (`converse`) con la foto de una comida. No hay migración, ni datos que cargar, ni cambios en Caddy. Lo que sí hay es configuración manual en AWS y en la instancia, que debe estar **antes del merge**; sin ella el endpoint responde 503 (el resto de la app no se ve afectado).

1. **Acceso al modelo:** en la consola de Bedrock de la región elegida, activa el acceso al modelo de visión que vayas a usar.
2. **Permisos IAM:** añade al rol de la instancia EC2 el permiso `bedrock:InvokeModel` sobre ese modelo. Las credenciales no son variables de la app: boto3 las toma del rol por IMDS.
3. **IMDS y Docker:** el backend corre en un contenedor, así que el límite de saltos de IMDS de la instancia debe permitir llegar desde él (2 o más; con 1 el contenedor no obtiene credenciales). Compruébalo desde el contenedor tras el CD, o antes con `aws ec2 describe-instances` (`MetadataOptions.HttpPutResponseHopLimit`).
4. **Variables en el `backend/.env` de EC2:**
   - `BEDROCK_VISION_MODEL_ID`: **sin valor por defecto**. Si falta, el endpoint responde 503.
   - `BEDROCK_REGION`: por defecto `us-east-1`; solo hace falta si el modelo está en otra región.
5. **Merge y CD** (paso 6). El CD reconstruye la imagen, y con ella el cambio de `backend/Dockerfile`.
6. **Comprobaciones tras el CD:**
   - `docker compose -f docker-compose.prod.yml logs backend --tail 50` (o `ps`) debe mostrar que gunicorn arrancó con `--timeout 90` (un análisis puede tardar más de los 30 s por defecto).
   - Con una cuenta real, sube una foto de una comida a `POST /api/meals/analyze` (JPEG, PNG o WebP de hasta 3 MB) y comprueba que devuelve alimentos del catálogo. Si da 503, revisa el modelo, el permiso IAM, el acceso al modelo y las credenciales por IMDS en el log del backend.
   - Un Bedrock lento debe dar **503 con JSON**, no un 502 del proxy. Es una comprobación manual: el test solo verifica la configuración de gunicorn.
7. **Revisión manual de precisión (Q9 de la spec):** pendiente del gate de review; unas 10 fotos reales contra Bedrock, incluida alguna en Display P3, para confirmar que quitar el perfil ICC no empeora el reconocimiento.
8. **Marcha atrás:** revertir el merge basta. No hay migración que deshacer. La foto no se guarda en ningún sitio.

### Caso A (sin migraciones) solo frontend: 025, registro de una comida con foto

El botón «Cargar imagen» del diario (ADR-0033) usa el `POST /api/meals/analyze` de la 024 y `POST /api/meals`, sin cambios en el backend: no hay migración, ni variables nuevas, ni pasos en AWS más allá de los de la 024 (que ya deben estar hechos). Basta el merge; Vercel despliega el frontend solo.

1. **Comprobación manual en navegadores reales** (jsdom no decodifica imágenes ni usa `canvas`):
   - Una foto vertical de móvil (orientación EXIF 6) se envía derecha y el análisis la reconoce.
   - Una foto HEIC en Safari se analiza; en Chrome de Windows aparece «No se pudo leer la foto. Prueba con otra foto en JPEG, PNG o WebP.».
   - A 375 px el diálogo ocupa toda la pantalla y a 1024 px se centra.
2. **Flujo completo con una cuenta real:** «Cargar imagen» en una tarjeta, analizar, corregir gramos, guardar y comprobar que los alimentos se suman a los que ya tenía la comida. Cada análisis cuenta para el límite de 10 por hora.
3. **Privacidad:** la Política de privacidad muestra el punto de Amazon Web Services (Amazon Bedrock) y la fecha del 22 de octubre de 2026.
4. **Marcha atrás:** revertir el merge basta.

### Caso A (sin migraciones) con backend y frontend: 026, días del diario y edición

La 026 (ADR-0035) deja navegar entre días del diario, editar días pasados, borrar una comida y deshacer «Quitar». No hay migración ni variables nuevas, pero sí un endpoint nuevo y un orden de despliegue que conviene conocer.

1. **Endpoints:**
   - `POST /api/meals/restore` (nuevo, con sesión): recibe `{"restore_token": "…"}` y recrea el alimento quitado en su comida, día y posición.
   - `DELETE /api/meals/{id}/items/{item_id}?undo=1`: con `undo=1` responde 200 con `{"restore_token": "…"}`; sin él sigue respondiendo 204.
   - `POST /api/meals` acepta ahora fechas de 366 días atrás hasta mañana (reloj del servidor).
2. **Orden de despliegue (frontend y backend no salen a la vez):** Vercel suele terminar antes que el CD. Un backend antiguo responde 204 al `DELETE …?undo=1`, así que el frontend nuevo no ofrece «Deshacer» (sin error) hasta que el CD termine. Un frontend antiguo con el backend nuevo no envía `undo=1` y todo sigue igual. No hace falta coordinar nada: espera al CD en verde y recarga las pestañas abiertas.
3. **`SECRET_KEY` propia en EC2:** firma el `restore_token` (además del `feedback_id` del coach). Su valor por defecto es `DEFAULT SECRET` y `ProductionConfig` no exige otro, así que comprueba antes del merge que el `backend/.env` de EC2 tiene una `SECRET_KEY` propia y larga; con la de por defecto cualquiera podría fabricar tokens para su propia cuenta (hallazgo F2 de la review, en el backlog). Si la cambias, los `restore_token` pendientes (120 s) y los votos de respuestas ya emitidas dejan de valer (404); no rompe nada más.
4. **Comprobaciones manuales en un navegador real** (jsdom no calcula posiciones ni colores). Con una cuenta real, tras el CD:
   - **Confirmación al descartar (AC-009.1, AC-009.3, AC-009.4):** «Cargar imagen», analiza una foto, desplaza la lista de la propuesta hasta abajo y pulsa «Cancelar». La confirmación «¿Descartar la propuesta?» debe verse centrada en la ventana, no fuera de la vista. «Seguir revisando» conserva lo editado; «Descartar» cierra; Escape y clic fuera piden la misma confirmación. Prueba a 375 px (pantalla completa) y a 1024 px (diálogo pegado arriba, con scroll interno).
   - **Barras en ámbar (AC-008.1 a AC-008.3):** supera el objetivo de calorías o de un macro y comprueba que la barra pasa a ámbar (sin rojo ni alerta); con el valor igual al objetivo sigue con el color normal.
   - **Cambio de día a medianoche (AC-005.2):** con la pestaña en segundo plano pasada la medianoche, al volver el diario pasa al día nuevo (o comprueba que, con un diálogo abierto, no cambia hasta cerrarlo).
   - **Selector de fecha (AC-002.6):** el selector nativo no deja elegir días futuros ni de hace más de 365 días.
   - **«Deshacer» (AC-007.6):** quita un alimento, el aviso «Quitaste …» con «Deshacer» desaparece a los 10 s; pulsa «Deshacer» antes y el alimento vuelve a su sitio; quita el único alimento de una comida y deshaz: la comida vuelve a existir.
   - **Borrar comida:** «Borrar comida» pide confirmación y quita todos los alimentos de esa comida.
5. **Marcha atrás:** revertir el merge basta. No hay migración que deshacer; los alimentos quitados no se pueden restaurar tras la reversión, pero no se pierde nada más.

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
| `/api/health` no da 200 tras el CD | Mira los logs del job `deploy` y, en la instancia, `docker compose -f docker-compose.prod.yml logs backend --tail 100`. Si el error dice «FRONTEND_BASE_URL es obligatoria en producción», añade `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev` al `backend/.env` de la instancia y reinicia el backend (`docker compose -f docker-compose.prod.yml up -d`). |

---

## 8. Historial de despliegues

| Fecha | Feature | PR / merge | Migraciones | Backup |
|---|---|---|---|---|
| 2026-10-13 | 006–010, rediseño | #3, `a60ca15` | `c6a1f0d2e9b4` y `d8e4b2a7c1f5`, aplicadas antes del merge (0 duplicados) | `prod-2026-10-13.dump` |
| 2026-10-14 | 011, ritmo poco realista | #4, `863ec4b` | — | — |
| 2026-10-14 | 012, retirada del catálogo | #6, `ebb3003` | `f2c4e6a8b0d1`, aplicada después del CD (5 tablas borradas) | `prod-2026-10-14.dump` |
| 2026-10-15 | 013, pulido de 006–010 | #7, `0596d9e` | — | — |
| 2026-10-15 | 014, endurecimiento de la autenticación | #13, `8f21df4` | `a7d3f9c1e5b2`, aplicada antes del merge (sin cambios de datos: 0 correos con mayúsculas) | `prod-2026-10-15.dump` |
| 2026-10-18 | 019, correo canónico con restricción CHECK | #22, `650fac9` | `e5b7d9f1a3c6`, aplicada antes del merge (sin cambios de datos: 0 correos no canónicos, 0 conflictos; solo creó las dos CHECK) | `prod-2026-10-18.dump` |
| 2026-10-20 | 021, base de alimentos de USDA | #26, `e0d3c1e` | `c8e2a4f6b9d3` (`foods`), aplicada hoy junto con la de la 022 (ver la fila siguiente); importación de 8.262 alimentos, `public.foods` ocupa 50 MB | `prod-2026-10-20.dump` |
| 2026-10-20 | 022, diario de comidas | #27, `c4be21e` | `b3d5f7a9c1e4` (`meals`, `meal_items`), aplicada después del merge, a continuación de la `c8e2a4f6b9d3` | `prod-2026-10-20.dump` |
| 2026-10-21 | 023, catálogo genérico de alimentos | #30, `fb72991` | `d4f6a8c0e2b5` (`catalog_foods`, `meal_items.catalog_id`), aplicada antes del merge desde local; carga del catálogo en EC2 después del CD: 261 alimentos | `prod-2026-10-21.dump` |
| 2026-10-22 | 024, análisis de foto con Bedrock | #32, `10920a2` | — (configuración de AWS hecha a mano antes del merge; el primer CD falló por falta de disco en la instancia y se relanzó tras `docker image prune -f`) | — |
| 2026-10-22 | 025, foto desde el diario | #34, `3e436d9` | — (solo frontend) | — |
| 2026-10-26 | 026, días y edición del diario | #37, `ca909bb` | — (`SECRET_KEY` propia confirmada en EC2; comprobaciones manuales en navegador hechas) | — |

Añade una fila en cada despliegue.
