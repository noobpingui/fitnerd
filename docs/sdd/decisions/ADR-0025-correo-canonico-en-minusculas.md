# ADR-0025: Correo canónico en minúsculas, migración de datos que falla ante conflictos y enlace de restablecimiento consumido con bloqueo de fila

- **Estado:** Aceptada · 2026-10-15 (aprobada por el usuario en el gate de `review` de `014-auth-hardening`)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate de `review` (modo `flow`).

## Contexto
La spec 014 pide que el correo no distinga mayúsculas en el registro, el login, la solicitud de restablecimiento y Google Sign-In, que los correos ya guardados pasen a minúsculas con una actualización de datos que falle sin tocar nada si hay cuentas que solo se diferencian en mayúsculas, y que el enlace de restablecimiento sea de un solo uso también ante peticiones simultáneas.

Opciones consideradas para el correo:
1. Guardar el correo tal como llega y comparar siempre con `lower(email)` (o con `citext`). Deja dos formas del mismo dato, y `citext` es una extensión nueva en Supabase.
2. **Forma canónica en minúsculas** (sin espacios al principio ni al final) al escribir, búsqueda con `lower(email) = :correo_normalizado` y migración de datos que convierte los correos existentes.
3. Además de la 2, un índice único funcional sobre `lower(email)`. Tras la migración todos los correos están en minúsculas y la restricción única actual sobre `email` ya protege; el índice obligaría a rehacer la base de tests y a esquivarlo en el test de la migración.

Opciones para el uso único del enlace:
1. `UPDATE … SET used_at = :ahora WHERE id = :id AND used_at IS NULL` condicional y comprobar el número de filas.
2. **`SELECT … FOR UPDATE`** de la fila del token al leerla, el mismo patrón de bloqueo de fila que ADR-0020.

## Decisión
1. **El correo canónico es `email.strip().lower()`.** Lo calcula `services/credential_rules.py` (`normalize_email`, `validate_email`), que usan `AuthService` y `PasswordResetService`. Se guarda así en `users.email` y en `password_reset_requests.email`, y también se usa en la clave del advisory lock del límite por correo.
2. **`UserRepository.get_by_email` compara `lower(users.email)` con el correo recibido en minúsculas**, para encontrar también las cuentas antiguas mientras no se aplique la migración. Sin índice funcional nuevo.
3. **Migración de datos `a7d3f9c1e5b2_lowercase_user_emails`**: primero busca grupos de `lower(email)` con más de una cuenta y, si hay alguno, lanza `RuntimeError` con los correos en conflicto antes de escribir nada (la migración corre en una transacción de Postgres). Si no hay conflictos, `UPDATE users SET email = lower(email) WHERE email <> lower(email)`. El `downgrade` no hace nada: las mayúsculas originales no se pueden recuperar (solo desde el volcado previo). No se tocan las filas antiguas de `password_reset_requests`.
4. **El enlace se consume con una relectura bloqueante.** `reset_password` lee el token sin bloqueo (`get_by_token_hash`), valida el enlace y la contraseña y, solo si los dos son válidos, vuelve a leer la fila con `PasswordResetRepository.get_by_token_hash_for_update` (`SELECT … FOR UPDATE` con `populate_existing`, para refrescar el objeto que ya está en la sesión) y revalida el enlace antes de cambiar la contraseña. La segunda petición simultánea con contraseña válida espera al commit de la primera y recibe la fila con `used_at` ya fijado, así que responde "enlace no válido"; una petición con contraseña inválida nunca toma el bloqueo y siempre recibe su error de contraseña, sin depender del orden de llegada. Todo lo que va desde la primera lectura hasta el commit queda dentro del `try` con `rollback`. (Revisado en la iteración 2 de la feature: la primera versión bloqueaba ya en la primera lectura y hacía que el mensaje de una contraseña inválida dependiera del orden de llegada, hallazgo F1 de la review.)
5. `AuthService` recibe por constructor el verificador del token de Google (`google_token_verifier`, por defecto el de `google-auth`), para probar la normalización del correo de Google con un fake, sin `monkeypatch`.

## Consecuencias
- (+) Una sola forma del correo en la base; la restricción única existente sobre `email` evita duplicados por mayúsculas en cuanto se aplica la migración.
- (+) El uso único del enlace lo garantiza Postgres, sin tablas ni Redis nuevos.
- (−) Hasta aplicar la migración en producción (a mano, ADR-0016), `get_by_email` no usa el índice de `email` (la tabla es pequeña) y dos cuentas antiguas que solo difieran en mayúsculas devolverían la más antigua.
- (−) La migración no se puede deshacer: antes de aplicarla hace falta el volcado completo de la base, como en la spec 012.
- (−) `lower()` de Postgres y `str.lower()` de Python pueden diferir en letras no ASCII poco habituales; los correos reales son ASCII.
- (−) Una petición de restablecimiento válida lee la fila del token dos veces (sin bloqueo y con bloqueo); el coste es despreciable. El bcrypt se calcula antes de bloquear, para no retener la fila durante el hash.
