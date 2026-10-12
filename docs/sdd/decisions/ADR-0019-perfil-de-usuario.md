# ADR-0019: Perfil de usuario en `user_profiles`, onboarding en `users` y caché vaciada al cambiar de sesión

- **Estado:** Aceptada · 2026-10-12 (aprobada por el usuario con el plan de la feature `006-user-profile`)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate de plan.

## Contexto
La spec 006 pide guardar en el servidor, por usuario, el perfil (género, altura y peso en la unidad que eligió el usuario, nivel de actividad y meta) y el estado del onboarding, y usar como dato del perfil la fecha de nacimiento que ya tiene la cuenta (`users.date_of_birth`) en lugar de una edad fija. El cálculo de calorías sigue en el frontend. Además, si dos cuentas usan el mismo navegador sin recargar, ninguna debe ver el perfil de la otra (NFR-002), y hoy TanStack Query conserva en memoria las queries de la sesión anterior al cerrar sesión desde `UserMenu` o desde el perfil.

Opciones para el almacenamiento:
1. Columnas nuevas en `users`. Mezcla datos de cuenta con datos físicos y llena `users` de columnas nulas.
2. Tabla `user_profiles` 1:1, con el estado del onboarding derivado de que exista la fila.
3. Tabla `user_profiles` 1:1 más `users.onboarding_completed_at`.

## Decisión
1. **Tabla `user_profiles`** con `user_id` como clave primaria y FK a `users.id` (1:1). Guarda los valores **tal como los escribió el usuario, en su unidad** (`height_cm` o `height_ft` + `height_in`; `weight` con `weight_unit`), redondeados a 1 decimal; los enumerados van como `String`, validados en el servicio, sin tipos `ENUM` de Postgres.
2. **`users.onboarding_completed_at`** (`DateTime` UTC, nullable): `NULL` = pendiente. Se fija en el primer guardado válido y no cambia después. Vive en `users` porque es un estado de la cuenta, independiente del contenido del perfil.
3. **Edad derivada:** no se guarda; se calcula en años cumplidos a partir de `users.date_of_birth` (en el servidor con la fecha UTC, en la app con la del dispositivo). Guardar el perfil actualiza `users.date_of_birth`.
4. **Guardado atómico y serializado por usuario:** el servicio valida todo antes de escribir y bloquea la fila del usuario (`SELECT … FOR UPDATE`) para que dos primeros guardados simultáneos no choquen.
5. **Caché por sesión en el frontend:** `queryClient.clear()` al cerrar sesión (`useLogout`) y al iniciarla (login, Google y registro). Ninguna query con datos de usuario sobrevive a un cambio de cuenta.

## Consecuencias
- (+) Lectura y escritura sin pérdidas por conversión de unidades; la conversión a kg y cm sigue en un único sitio del frontend.
- (+) La edad nunca queda desactualizada y hay una sola fecha de nacimiento por cuenta.
- (+) Un único `GET /api/profile` resuelve el guard del onboarding, el prerrelleno de la fecha y los datos de home, Macros y Métricas.
- (+) Vaciar la caché al cambiar de sesión protege también `["auth","me"]` y cualquier query futura.
- (−) Todos los usuarios existentes repiten el onboarding una vez tras el despliegue (aceptado en la spec).
- (−) La migración debe aplicarse a mano en producción antes de que el frontend nuevo empiece a pedir `/api/profile`.
- (−) Si en el futuro el cálculo de calorías pasa al servidor, tendrá que convertir unidades en el backend.
