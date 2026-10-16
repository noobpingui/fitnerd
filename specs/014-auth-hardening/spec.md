# Spec 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

- **Feature:** `014-auth-hardening` · **Tipo:** feature
- **Ámbitos:** `backend`, `frontend`

## 1. Contexto y problema

La autenticación (registro, login, Google Sign-In y recuperación de contraseña, spec 002) funciona en producción, pero arrastra varios puntos débiles detectados en revisiones anteriores o en el uso:

- **Token de restablecimiento no atómico (002 F3):** si llegan a la vez dos peticiones con el mismo enlace de restablecimiento, las dos pueden cambiar la contraseña. El "uso único" del enlace (spec 002, AC-007.3) solo se cumple si las peticiones llegan una detrás de otra.
- **Aviso persistente en `/login` (002 F7):** el aviso "Contraseña actualizada. Ya puedes iniciar sesión." vuelve a aparecer si el usuario recarga `/login` o vuelve a esa página con el historial del navegador.
- **Correos sensibles a mayúsculas:** `Ana@Example.com` y `ana@example.com` se tratan como cuentas distintas. Quien se registró con mayúsculas no puede entrar si escribe el correo en minúsculas, se pueden crear dos cuentas para la misma persona, y el límite de 2 minutos entre solicitudes de restablecimiento se puede esquivar cambiando mayúsculas.
- **Reglas de contraseña distintas en el registro:** el restablecimiento exige al menos 8 caracteres y como máximo 72 bytes UTF-8, en el formulario y en el servidor. El registro solo exige 8 caracteres en el formulario, no limita el máximo y el servidor no valida nada.
- **Registro de errores de Resend (003 F1):** el fragmento del cuerpo de error que se escribe en el log se copia tal cual. Un salto de línea o un carácter de control en ese cuerpo parte la entrada en varias líneas y permite falsificar entradas de log.

## 2. Historia de usuario

Como **usuario de fitnerd**, quiero **entrar con mi correo sin preocuparme por las mayúsculas, que mi contraseña cumpla las mismas reglas en el registro y en el restablecimiento, y que un enlace de restablecimiento solo sirva una vez** para **usar la app con una cuenta segura y sin sorpresas**.

Como **responsable del servicio**, quiero **que el log de errores del proveedor de correo no se pueda falsificar** para **poder fiarme de él al investigar incidencias**.

## 3. Alcance

**Incluye:**
- Uso único del enlace de restablecimiento también ante peticiones simultáneas.
- Que el aviso de contraseña actualizada en `/login` se muestre una sola vez.
- Normalizar el correo (sin espacios al principio ni al final, y en minúsculas) en el registro, el login, la solicitud de restablecimiento y Google Sign-In.
- Convertir a minúsculas los correos guardados de las cuentas existentes con una actualización de datos al desplegar, que falla sin modificar nada si encuentra correos que solo se diferencian en mayúsculas.
- Las reglas de contraseña del restablecimiento (mínimo 8 caracteres, máximo 72 bytes UTF-8) en el registro, en el formulario y en el servidor.
- Validar el formato del correo en el servidor al registrarse.
- Que el login nunca responda con un error interno ante una contraseña demasiado larga o un campo ausente o que no sea texto.
- Escapar los caracteres de control del fragmento de error de Resend que se escribe en el log.

**Fuera de alcance:**
- Traducir al español los mensajes de error actuales del registro y el login (`Wrong Credentials`, `Email already registered`).
- Validar en el servidor el resto de campos del registro (nombre, apellido y fecha de nacimiento) o un cuerpo de petición que no sea JSON.
- Cambiar la duración del token de sesión, la caducidad del enlace de restablecimiento (5 minutos) o los límites de solicitudes (2 minutos por correo, 3 cada 10 minutos por IP).
- Exigir contraseñas más complejas (mayúsculas, números o símbolos) u obligar a cambiar las contraseñas existentes que no cumplan las reglas nuevas.
- Validar el mínimo de 8 caracteres en el login (bloquearía contraseñas antiguas).
- Fusionar o borrar automáticamente cuentas cuyos correos solo se diferencian en mayúsculas: si existen, se resuelven a mano.
- Cambiar el comportamiento del resto del sistema de log o de otros proveedores externos.

## 4. Requisitos funcionales

### REQ-001 — Correo normalizado en el registro
WHEN alguien se registra con correo y contraseña THE SYSTEM SHALL quitar los espacios del principio y del final del correo, convertirlo a minúsculas, guardarlo así y comprobar si ya existe una cuenta con ese correo sin distinguir mayúsculas.

- **AC-001.1:** Given que no existe ninguna cuenta con ese correo, When se hace `POST /api/auth/register` con el correo `"  Ana@Example.COM "` y el resto de datos válidos, Then la respuesta es `201` y `GET /api/auth/me` con el token devuelto responde `email` igual a `"ana@example.com"`.
- **AC-001.2:** Given una cuenta existente con el correo `ana@example.com`, When se hace `POST /api/auth/register` con el correo `"ANA@example.com"` y el resto de datos válidos, Then la respuesta es `409` con `{"error": "Email already registered"}` y no se crea ninguna cuenta nueva.

### REQ-002 — Correo normalizado en el login
WHEN alguien inicia sesión con correo y contraseña THE SYSTEM SHALL buscar la cuenta con el correo sin espacios al principio ni al final y sin distinguir mayúsculas.

- **AC-002.1:** Given una cuenta `ana@example.com` con la contraseña `Clave123`, When se hace `POST /api/auth/login` con el correo `"ANA@Example.com"` y la contraseña `Clave123`, Then la respuesta es `200` con un token.
- **AC-002.2:** Given la misma cuenta, When se hace `POST /api/auth/login` con el correo `" ana@example.com  "` y la contraseña `Clave123`, Then la respuesta es `200` con un token.
- **AC-002.3:** Given la misma cuenta, When se hace `POST /api/auth/login` con el correo `"ANA@example.com"` y la contraseña `Otra1234`, Then la respuesta es `401` con `{"error": "Wrong Credentials"}`.

### REQ-003 — Correo normalizado en la solicitud de restablecimiento
WHEN alguien solicita un enlace de restablecimiento THE SYSTEM SHALL buscar la cuenta y aplicar el límite de 2 minutos por correo con el correo sin espacios al principio ni al final y sin distinguir mayúsculas.

- **AC-003.1:** Given una cuenta con contraseña `ana@example.com`, When se hace `POST /api/auth/forgot-password` con `{"email": "Ana@Example.com"}`, Then la respuesta es `200` con el mensaje genérico de siempre y se envía un correo con el enlace a `ana@example.com`.
- **AC-003.2:** Given una solicitud con éxito para `ana@example.com` hace 30 segundos, When se hace `POST /api/auth/forgot-password` con `{"email": "ANA@EXAMPLE.COM"}`, Then la respuesta es `429` con `{"error": "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde."}` y no se envía ningún correo.
- **AC-003.3:** Given el enlace recibido en AC-003.1, When se usa con una contraseña válida, Then la respuesta es `200` y el login con `ana@example.com` y esa contraseña tiene éxito.

### REQ-004 — Correo normalizado en Google Sign-In
WHEN alguien entra con Google THE SYSTEM SHALL buscar la cuenta con el correo que verifica Google convertido a minúsculas y, si crea una cuenta nueva, guardarlo en minúsculas.

- **AC-004.1:** Given una cuenta con contraseña `ana@example.com` sin vincular a Google, When se hace `POST /api/auth/google` con un token verificado de Google cuyo correo es `Ana@Example.com`, Then la respuesta es `200`, la cuenta existente queda vinculada a Google y el número de cuentas no cambia.
- **AC-004.2:** Given que no existe ninguna cuenta con ese correo, When se hace `POST /api/auth/google` con un token verificado cuyo correo es `Nuevo@Example.com`, Then se crea una cuenta y `GET /api/auth/me` con el token devuelto responde `email` igual a `"nuevo@example.com"`.

### REQ-005 — Cuentas existentes con mayúsculas
THE SYSTEM SHALL tratar las cuentas creadas antes de este cambio, cuyo correo puede tener mayúsculas, igual que las nuevas: se encuentran sin distinguir mayúsculas y, con la actualización de datos de esta versión, su correo pasa a guardarse en minúsculas. IF al aplicar esa actualización existen cuentas cuyos correos solo se diferencian en mayúsculas THEN THE SYSTEM SHALL fallar sin modificar ninguna cuenta e indicar los correos en conflicto.

- **AC-005.1:** Given una cuenta existente cuyo correo guardado es `Ana@Example.com`, con la contraseña `Clave123`, When se hace `POST /api/auth/login` con el correo `"ana@example.com"` y la contraseña `Clave123`, Then la respuesta es `200` con un token.
- **AC-005.2:** Given una cuenta existente cuyo correo guardado es `Ana@Example.com`, When se hace `POST /api/auth/register` con el correo `"ana@example.com"` y el resto de datos válidos, Then la respuesta es `409` y no se crea ninguna cuenta nueva.
- **AC-005.3:** Given una base de datos con una cuenta cuyo correo guardado es `Ana@Example.com`, When se aplica la actualización de datos de esta versión, Then el correo guardado de esa cuenta es `ana@example.com` y el resto de sus datos (contraseña, vínculo con Google, perfil y mediciones) no cambia.
- **AC-005.4:** Given una base de datos con dos cuentas cuyos correos solo se diferencian en mayúsculas (`Ana@Example.com` y `ana@example.com`), When se intenta aplicar la actualización de datos de esta versión, Then la actualización falla, ninguna cuenta se modifica, fusiona ni borra, y el mensaje de error incluye los correos en conflicto.

### REQ-006 — Reglas de contraseña en el registro (servidor)
IF la contraseña de un registro tiene menos de 8 caracteres, más de 72 bytes en UTF-8, falta o no es un texto THEN THE SYSTEM SHALL rechazar el registro con `400` y el mensaje correspondiente, sin crear la cuenta.

- **AC-006.1:** Given un registro con datos válidos salvo la contraseña `"corta"` (5 caracteres), When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "La contraseña debe tener al menos 8 caracteres"}` y no se crea la cuenta (un login posterior con ese correo responde `401`).
- **AC-006.2:** Given un registro con datos válidos y sin el campo `password`, When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "La contraseña debe tener al menos 8 caracteres"}`.
- **AC-006.3:** Given un registro con datos válidos y `"password": 12345678` (un número, no un texto), When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "La contraseña debe tener al menos 8 caracteres"}`.
- **AC-006.4:** Given un registro con la contraseña `Clave123` (exactamente 8 caracteres), When se hace `POST /api/auth/register`, Then la respuesta es `201` y el login con esa contraseña tiene éxito.
- **AC-006.5:** Given un registro con una contraseña formada por `"a"` repetida 73 veces (73 bytes), When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "La contraseña es demasiado larga"}` y no se crea la cuenta.
- **AC-006.6:** Given un registro con una contraseña formada por `"a"` repetida 72 veces (72 bytes), When se hace `POST /api/auth/register`, Then la respuesta es `201` y el login con esa contraseña tiene éxito.
- **AC-006.7:** Given un registro con una contraseña formada por `"ñ"` repetida 37 veces (37 caracteres, 74 bytes), When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "La contraseña es demasiado larga"}`, nunca `5xx`, y no se crea la cuenta.
- **AC-006.8:** Given un registro con una contraseña formada por `"ñ"` repetida 36 veces (36 caracteres, exactamente 72 bytes), When se hace `POST /api/auth/register`, Then la respuesta es `201` y el login con esa contraseña tiene éxito.
- **AC-006.9:** Given un registro con una contraseña formada por `"😀"` repetido 7 veces (7 caracteres, 28 bytes), When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "La contraseña debe tener al menos 8 caracteres"}`.
- **AC-006.10:** Given una cuenta existente `ana@example.com`, When se hace `POST /api/auth/register` con ese correo y la contraseña `"corta"`, Then la respuesta es `400` con `{"error": "La contraseña debe tener al menos 8 caracteres"}` (la validación de la contraseña va antes que la comprobación de duplicados).

### REQ-007 — Formato del correo en el registro (servidor)
IF el correo de un registro falta, no es un texto o no tiene formato de correo THEN THE SYSTEM SHALL rechazar el registro con `400` y `{"error": "Email inválido"}`, con la misma regla de formato que la solicitud de restablecimiento, sin crear la cuenta.

- **AC-007.1:** Given un registro con datos válidos y sin el campo `email`, When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "Email inválido"}`.
- **AC-007.2:** Given un registro con datos válidos y el correo `"no-es-un-correo"`, When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "Email inválido"}` y no se crea ninguna cuenta.
- **AC-007.3:** Given un registro con el correo `"no-es-un-correo"` y la contraseña `"corta"`, When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "Email inválido"}` (el correo se valida antes que la contraseña).
- **AC-007.4:** Given un registro con datos válidos y `"email": 123` (un número, no un texto), When se hace `POST /api/auth/register`, Then la respuesta es `400` con `{"error": "Email inválido"}`, nunca `5xx`.

### REQ-008 — Reglas de contraseña en el formulario de registro
WHEN el usuario envía el formulario de registro THE SYSTEM SHALL aplicar a la contraseña las mismas reglas y mensajes que el formulario de restablecimiento, y no enviar la petición si no las cumple.

- **AC-008.1:** Given el formulario de registro con los demás campos válidos y la contraseña `Clave12` (7 caracteres), When el usuario lo envía, Then se muestra "Mínimo 8 caracteres" junto al campo y no se envía ninguna petición.
- **AC-008.2:** Given el formulario con una contraseña formada por `"a"` repetida 73 veces, When el usuario lo envía, Then se muestra "Contraseña demasiado larga" junto al campo y no se envía ninguna petición.
- **AC-008.3:** Given el formulario con una contraseña formada por `"ñ"` repetida 37 veces (74 bytes), When el usuario lo envía, Then se muestra "Contraseña demasiado larga" junto al campo y no se envía ninguna petición.
- **AC-008.4:** Given el formulario con una contraseña formada por `"ñ"` repetida 36 veces (72 bytes) y los demás campos válidos, When el usuario lo envía, Then se envía la petición de registro con esa contraseña.
- **AC-008.5:** Given el formulario con una contraseña formada por `"😀"` repetido 7 veces (7 caracteres), When el usuario lo envía, Then se muestra "Mínimo 8 caracteres" junto al campo y no se envía ninguna petición.
- **AC-008.6:** Given el formulario válido, When el servidor responde `400` con `{"error": "La contraseña es demasiado larga"}`, Then se muestra ese texto en el formulario.

### REQ-009 — Login sin errores internos ante datos anómalos
IF un login llega sin correo, sin contraseña, con alguno de ellos que no sea un texto o con una contraseña de más de 72 bytes en UTF-8 THEN THE SYSTEM SHALL responder `401` con `{"error": "Wrong Credentials"}`, igual que cualquier login fallido y sin revelar el motivo, nunca `5xx`.

- **AC-009.1:** Given una cuenta `ana@example.com`, When se hace `POST /api/auth/login` con ese correo y una contraseña formada por `"a"` repetida 73 veces, Then la respuesta es `401` con `{"error": "Wrong Credentials"}`.
- **AC-009.2:** Given una cuenta `ana@example.com`, When se hace `POST /api/auth/login` con ese correo y sin el campo `password`, Then la respuesta es `401` con `{"error": "Wrong Credentials"}`.
- **AC-009.3:** When se hace `POST /api/auth/login` sin el campo `email` y con la contraseña `Clave123`, Then la respuesta es `401` con `{"error": "Wrong Credentials"}`.
- **AC-009.4:** Given una cuenta `ana@example.com`, When se hace `POST /api/auth/login` con `"email": 123` y la contraseña `Clave123`, Then la respuesta es `401` con `{"error": "Wrong Credentials"}`.
- **AC-009.5:** Given una cuenta `ana@example.com` con la contraseña `Clave123`, When se hace `POST /api/auth/login` con ese correo y `"password": 12345678` (un número, no un texto), Then la respuesta es `401` con `{"error": "Wrong Credentials"}`.

### REQ-010 — Uso único del enlace de restablecimiento ante peticiones simultáneas
WHEN llegan a la vez varias peticiones de restablecimiento con el mismo enlace vigente y contraseñas válidas THE SYSTEM SHALL aceptar solo una y rechazar las demás como enlace no válido.

- **AC-010.1:** Given un enlace vigente para `ana@example.com`, When se hacen dos `POST /api/auth/reset-password` simultáneos con ese token, uno con `ClaveUno123` y otro con `ClaveDos123`, Then exactamente una respuesta es `200` con `{"message": "Contraseña actualizada"}` y la otra es `400` con `{"error": "El enlace no es válido o ha caducado. Solicita uno nuevo."}`.
- **AC-010.2:** Given el resultado de AC-010.1, When se hace login con `ana@example.com` y la contraseña de la petición que recibió `200`, Then tiene éxito; y When se hace login con la contraseña de la petición que recibió `400`, Then falla con `401`.
- **AC-010.3:** Given un enlace vigente, When se hacen dos peticiones simultáneas con ese token, una con la contraseña `"corta"` y otra con `ClaveDos123`, Then la de `"corta"` responde `400` con `{"error": "La contraseña debe tener al menos 8 caracteres"}`, la otra responde `200` y el login con `ClaveDos123` tiene éxito (un intento con contraseña inválida sigue sin consumir el enlace).
- **AC-010.4:** Given un enlace usado con éxito, When se vuelve a usar con otra contraseña válida, Then la respuesta es `400` con el mensaje de enlace no válido y la contraseña no cambia (se mantiene AC-007.3 de la spec 002).

### REQ-011 — Aviso de contraseña actualizada una sola vez
WHEN el usuario llega a `/login` tras restablecer su contraseña THE SYSTEM SHALL mostrar el aviso "Contraseña actualizada. Ya puedes iniciar sesión." durante esa visita y no volver a mostrarlo si la página se recarga o se vuelve a ella con el historial del navegador.

- **AC-011.1:** Given un restablecimiento con éxito, When el usuario llega a `/login`, Then ve el aviso "Contraseña actualizada. Ya puedes iniciar sesión."
- **AC-011.2:** Given el aviso de AC-011.1 visible, When el usuario escribe en los campos o un intento de login falla con `401`, Then el aviso sigue visible.
- **AC-011.3:** Given el aviso de AC-011.1 ya mostrado, When se consulta la entrada actual del historial del navegador, Then ya no indica que haya que mostrar el aviso, de modo que al recargar `/login` el aviso no aparece.
- **AC-011.4:** Given el aviso de AC-011.1 ya mostrado, When el usuario va a `/register` y vuelve a `/login` con el botón "atrás" del navegador, Then el aviso no aparece.
- **AC-011.5:** Given una visita a `/login` sin venir de un restablecimiento, When se carga la página, Then el aviso no aparece.

### REQ-012 — Caracteres de control escapados en el log de errores de Resend
WHEN Resend responde con un error HTTP y se escribe en el log el fragmento de su cuerpo THE SYSTEM SHALL escapar en ese fragmento los caracteres de control y los separadores de línea, de forma que la entrada ocupe una sola línea.

- **AC-012.1:** Given que Resend responde `403` con el cuerpo `"x\nFAKE LOG LINE"`, When se intenta enviar un correo, Then la entrada del log no contiene ningún salto de línea real y contiene el texto `x\nFAKE LOG LINE` con la barra invertida y la `n` como dos caracteres.
- **AC-012.2:** Given que Resend responde `500` con un cuerpo que contiene un retorno de carro, un tabulador y el carácter ESC (U+001B), When se intenta enviar un correo, Then la entrada del log contiene `\r`, `\t` y `\x1b` escritos como texto y ninguno de esos caracteres reales.
- **AC-012.3:** Given que Resend responde `400` con un cuerpo que contiene los separadores U+2028 y U+2029 y el carácter U+0085, When se intenta enviar un correo, Then la entrada del log contiene ` `, ` ` y `\x85` escritos como texto y ninguno de esos caracteres reales.
- **AC-012.4:** Given que Resend responde `422` con el cuerpo `{"message": "Dominio no verificado: ñandú"}`, When se intenta enviar un correo, Then la entrada del log contiene ese texto sin cambios (las letras con tilde y la `ñ` no se escapan).
- **AC-012.5:** Given que Resend responde `403` con un cuerpo de 200 saltos de línea seguidos de 300 letras `b`, When se intenta enviar un correo, Then la entrada del log contiene los 200 saltos de línea escapados como `\n` y ninguna letra `b` (el recorte a 200 caracteres se aplica sobre el texto original, antes de escapar).
- **AC-012.6:** Given que Resend responde `401` con un cuerpo que contiene la API key seguida de un salto de línea, When se intenta enviar un correo, Then la entrada del log no contiene la API key y la excepción y la respuesta al usuario no cambian (`503` con "No se pudo enviar el correo. Inténtalo de nuevo más tarde.").

## 5. Requisitos no funcionales

### NFR-001 — Sin regresiones en la autenticación existente
THE SYSTEM SHALL mantener el comportamiento de la autenticación definido en las specs 002 y 003 en todo lo que esta spec no cambia.

- **AC-N001.1:** Given la suite de tests existente de autenticación, recuperación de contraseña y envío de correo, When se ejecuta tras el cambio, Then todos sus tests pasan sin haberse borrado, saltado ni debilitado.

## 6. Datos y contratos visibles

**Correo (registro, login, solicitud de restablecimiento y Google Sign-In):**
- Se quitan los espacios del principio y del final y se convierte entero a minúsculas, incluida la parte anterior a la `@`.
- Se guarda y se devuelve (`GET /api/auth/me`, campo `email`) en minúsculas.
- El correo de restablecimiento se envía a la dirección guardada, en minúsculas.
- En el registro, el formato se valida con la misma regla que ya usa la solicitud de restablecimiento.

**Contraseña (registro y restablecimiento):**
- Mínimo 8 caracteres, contados como puntos de código Unicode (un emoji cuenta como uno).
- Máximo 72 bytes en UTF-8.
- No se recortan los espacios: forman parte de la contraseña.
- Las contraseñas existentes no se revalidan: el login sigue aceptando las que ya funcionaban y no exige el mínimo de 8 caracteres.

**Mensajes de error del servidor (`{"error": …}`):**

| Endpoint | Caso | Código | Mensaje |
|---|---|---|---|
| `POST /api/auth/register` | Correo ausente, no texto o con formato inválido | 400 | `Email inválido` |
| `POST /api/auth/register` | Contraseña ausente, no texto o con menos de 8 caracteres | 400 | `La contraseña debe tener al menos 8 caracteres` |
| `POST /api/auth/register` | Contraseña de más de 72 bytes | 400 | `La contraseña es demasiado larga` |
| `POST /api/auth/register` | Correo ya registrado (sin distinguir mayúsculas) | 409 | `Email already registered` (sin cambios) |
| `POST /api/auth/login` | Credenciales incorrectas, campos ausentes o no texto, contraseña de más de 72 bytes | 401 | `Wrong Credentials` (sin cambios) |
| `POST /api/auth/reset-password` | La otra petición simultánea ya usó el enlace | 400 | `El enlace no es válido o ha caducado. Solicita uno nuevo.` |

Orden de comprobación en el registro: primero el correo, después la contraseña y por último si el correo ya existe.

**Mensajes del formulario de registro** (iguales que los del formulario de restablecimiento): "Mínimo 8 caracteres" y "Contraseña demasiado larga".

**Aviso en `/login`:** "Contraseña actualizada. Ya puedes iniciar sesión." (texto sin cambios), solo en la primera visita tras el restablecimiento.

**Log de errores de Resend** (lo ve el responsable del servicio):
- El fragmento se obtiene así: se quita la API key, se recorta a 200 caracteres y después se escapan los caracteres.
- Se escapan los caracteres de control (U+0000–U+001F y U+007F–U+009F) y los separadores U+2028 y U+2029: `\n`, `\r` y `\t` con esa forma, y el resto como `\xNN` o `\uNNNN`.
- El resto de caracteres, incluidas las letras con tilde, la `ñ` y la barra invertida, se escriben tal cual.

**Actualización de datos al desplegar (REQ-005):**
- Los correos guardados de las cuentas existentes pasan a minúsculas con la migración de esta versión, que se aplica a mano en producción.
- Antes de aplicarla, se hace un volcado completo de la base de producción y se guarda fuera del repositorio, como en la spec 012.
- Si hay cuentas cuyos correos solo se diferencian en mayúsculas, la actualización falla sin modificar nada e indica los correos en conflicto; el responsable del servicio los resuelve a mano y vuelve a aplicarla. No se fusionan ni se borran cuentas automáticamente.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | (Resuelta: se aplica la propuesta en REQ-005, AC-005.3 y sección 6) ¿Se convierten a minúsculas los correos ya guardados de las cuentas existentes, o solo se comparan sin distinguir mayúsculas y se conservan como están? | Convertirlos a minúsculas con una actualización de datos al desplegar (REQ-005, AC-005.3). Así todos los correos quedan en una sola forma y la restricción de correo único también protege frente a variantes en mayúsculas. Antes, volcado de la base como en la spec 012. | acepto las propuestas |
| Q2 | (Resuelta: se aplica la propuesta en REQ-005, AC-005.4 y sección 6) Si en producción hay dos cuentas cuyos correos solo se diferencian en mayúsculas, ¿qué hace la actualización de datos? | Fallar sin modificar nada e indicar los correos en conflicto, para que los resuelvas a mano antes de volver a aplicarla (AC-005.4). No se fusionan ni se borran cuentas automáticamente. | acepto las propuestas |
| Q3 | (Resuelta: se aplica la propuesta en REQ-004) ¿Se normaliza también el correo que llega de Google Sign-In? La idea solo menciona registro, login y restablecimiento. | Sí (REQ-004). Si no, una cuenta guardada en minúsculas no se vincularía con un correo de Google en mayúsculas y se crearía una cuenta duplicada. | acepto las propuestas |
| Q4 | (Resuelta: se aplica la propuesta en REQ-007) ¿El servidor valida también el formato del correo en el registro? Hoy no valida nada y, sin esa validación, un correo ausente provocaría un error interno al normalizarlo. | Sí, con la misma regla y el mismo mensaje que la solicitud de restablecimiento: `400` con "Email inválido" (REQ-007). | acepto las propuestas |
| Q5 | (Resuelta: se aplica la propuesta en REQ-009) ¿Se endurece también el login para que una contraseña de más de 72 bytes, un campo ausente o un valor que no sea texto respondan `401` en lugar de un posible error interno? | Sí, con el mismo `401` "Wrong Credentials" de cualquier login fallido, sin revelar el motivo (REQ-009). No se valida el mínimo de 8 caracteres en el login, para no bloquear contraseñas antiguas. | acepto las propuestas |

## 8. Glosario

- **Correo normalizado:** el correo sin espacios al principio ni al final y en minúsculas.
- **Enlace vigente:** enlace de restablecimiento emitido hace menos de 5 minutos, no usado y no sustituido por otro más reciente (spec 002).
- **Carácter de control:** carácter no imprimible de los rangos U+0000–U+001F y U+007F–U+009F, como el salto de línea, el retorno de carro, el tabulador o ESC.
- **Separador de línea Unicode:** U+2028 (separador de línea) y U+2029 (separador de párrafo); algunos visores de log los muestran como saltos de línea.
