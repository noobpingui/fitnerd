# ADR-0027: Garantía del correo canónico en la base con restricciones CHECK declaradas en el modelo

- **Estado:** Aceptada · 2026-10-18 (feature `019-auth-email-integrity`)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate de `review` (modo `flow`).

## Contexto
La spec 019 pide que la propia base rechace guardar en `users.email` y en `password_reset_requests.email` un correo que no esté en forma canónica (sin espacios al principio ni al final y en minúsculas, ADR-0025), y que una migración de datos convierta antes los correos existentes, fallando sin tocar nada si dos cuentas coinciden tras la conversión.

Opciones consideradas:
1. **Índice único funcional** sobre `lower(btrim(email))` en `users`. Solo impide duplicados: una cuenta suelta guardada como `"Ana@example.com"` se aceptaría (incumple AC-004.1 y AC-004.2) y no aplica a `password_reset_requests`, que no exige unicidad. Además, Alembic no lo declara bien en el modelo y `create_all()` de los tests no lo crearía sin trucos.
2. **Trigger** que normalice el correo al escribir. Corrige en silencio en lugar de rechazar (la spec pide rechazo) y esconde errores de la aplicación.
3. Tipo `citext` o un dominio. `citext` es una extensión nueva en Supabase y no trata los espacios; un dominio obliga a cambiar el tipo de la columna con una migración más invasiva.
4. **Restricción `CHECK` por tabla** que exige `email = <forma canónica de email>`. Rechaza cualquier escritura no canónica, venga de donde venga; combinada con la restricción única existente sobre `users.email`, también impide de hecho los duplicados por mayúsculas o espacios, así que el índice funcional sobra.

## Decisión
1. Dos restricciones `CHECK`:
   - `ck_users_email_canonical` en `public.users`;
   - `ck_password_reset_requests_email_canonical` en `public.password_reset_requests`;

   ambas con la condición `email = lower(regexp_replace(email, '^[[:space:]]+|[[:space:]]+$', '', 'g'))`. `[[:space:]]` cubre los blancos ASCII que también quita `str.strip()` de Python (espacio, tabulador, saltos de línea, `\v`, `\f`).
2. **Se declaran en el modelo** (`__table_args__` de `User` y de `PasswordResetRequest`) además de en la migración, para que `create_all()` las cree en la base de tests y toda la suite de integración corra con la garantía activa. Los tests que necesitan datos anteriores a la 019 (cuentas "antiguas" de la 014) quitan las restricciones dentro de su transacción o con un fixture que las restaura, igual que ya hace el test de consolidación de la 008 con su restricción única.
3. **Migración `e5b7d9f1a3c6_canonical_email_check_constraints`** (después de `a7d3f9c1e5b2`), escrita a mano porque el autogenerado de Alembic no detecta restricciones `CHECK` ni hace conversiones de datos. En `upgrade()`: primero busca conflictos de `users` agrupando por la forma canónica y, si hay, lanza `RuntimeError` antes de escribir nada; si no, convierte `users` y `password_reset_requests` con la misma expresión SQL y crea las dos restricciones. Todo corre en la transacción de Alembic, así que cualquier fallo deja la base como estaba. `downgrade()` solo quita las restricciones; los correos convertidos no se restauran (solo desde el volcado previo).
4. `UserRepository.get_by_email` no cambia en esta feature (sigue comparando con `lower(email)`); simplificarlo a igualdad exacta queda en el backlog.

## Consecuencias
- (+) La forma canónica la garantiza Postgres en las dos tablas, aunque la escritura no pase por la aplicación.
- (+) La suite de tests detecta cualquier camino futuro que escriba un correo no canónico (fallaría con `IntegrityError`).
- (+) Sin extensiones, tipos ni dependencias nuevas.
- (−) La expresión canónica vive en dos sitios (modelo y migración); el `reviewer` comprueba que coinciden y los tests de la migración y los de integración prueban cada copia.
- (−) Una escritura no canónica que se le escape a la aplicación acaba en un 500 en lugar de guardarse. Incluye el riesgo aceptado en la spec (Q2) de letras no ASCII que `str.lower()` y `lower()` de Postgres pasan a minúsculas de forma distinta, y blancos Unicode que `str.strip()` quita y `[[:space:]]` puede no cubrir.
- (−) La conversión de datos no se puede deshacer: hace falta un volcado completo antes de aplicarla en producción (caso B' del runbook).
- (−) Los tests de la 014 que simulan cuentas antiguas necesitan quitar la restricción en su preparación.
