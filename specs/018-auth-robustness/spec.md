# Spec 018 — Endurecer /register y /login: 400 ante entradas inválidas, validación del registro y mensajes en español

- **Feature:** `018-auth-robustness` · **Tipo:** fix
- **Ámbitos:** backend

## 1. Contexto y problema

El registro (`POST /api/auth/register`) y el inicio de sesión (`POST /api/auth/login`) ya validan el correo y la
contraseña (spec 014), pero quedan huecos que vienen del backlog del proyecto:

- Un cuerpo que no es JSON, que es JSON malformado, que es `null` o que no es un objeto produce hoy respuestas
  incoherentes: un 500 genérico, o un 400/415 con un texto en inglés del framework.
- En el registro, si falta `date_of_birth` o no tiene formato de fecha, la respuesta es 500.
- El servidor no valida el nombre, el apellido ni la fecha de nacimiento del registro: acepta nombres vacíos o de
  solo espacios, fechas futuras o edades imposibles, y un nombre muy largo acaba en un 500.
- Dos mensajes que el usuario ve en el formulario salen en inglés: «Wrong Credentials» (login) y «Email already
  registered» (registro). El frontend muestra tal cual el texto del error del servidor.
- En el restablecimiento de contraseña, el instante con el que se comprueba la caducidad del enlace y el que se
  registra como momento de uso se leen por separado del reloj (NIT de la review de la spec 014).

Afecta a quien se registra o inicia sesión con correo y contraseña, y a cualquier cliente que llame a estos
endpoints directamente.

## 2. Historia de usuario

Como **persona que se registra o inicia sesión en fitnerd**, quiero **que el servidor rechace los datos incorrectos
con un mensaje claro en español** para **saber qué corregir y no encontrarme con errores internos**.

## 3. Alcance

**Incluye:**
- Respuesta 400 con un mensaje en español en `/register` y `/login` cuando el cuerpo no es un objeto JSON válido.
- Validación en el servidor del nombre, el apellido y la fecha de nacimiento del registro, con mensajes en español.
- Nombre y apellido guardados sin los espacios de los extremos.
- Traducción al español de «Wrong Credentials» y «Email already registered».
- Un único instante por petición en la comprobación de caducidad y el registro de uso del enlace de
  restablecimiento de contraseña.

**Fuera de alcance:**
- El inicio de sesión con Google (`/api/auth/google`), su manejo de cuerpos no JSON y sus mensajes en inglés
  («Invalid Google token», «Google email not verified»); se anota en el backlog (Q5, resuelta).
- Otros mensajes en inglés de autenticación (`/me`, token ausente o caducado).
- Cambios en el formulario del frontend (por ejemplo, validar en el cliente la edad o los nombres en blanco): el
  frontend ya muestra el mensaje que devuelve el servidor.
- Las reglas de correo y contraseña de la spec 014, que no cambian; y el comportamiento de `/login` con un objeto
  JSON al que le faltan campos o los trae con otro tipo, que sigue siendo 401 (spec 014, REQ-009).
- Cambiar los datos de cuentas existentes: las cuentas con nombre, apellido o fecha de nacimiento vacíos (por
  ejemplo, las de Google) no se tocan y siguen pudiendo entrar.
- El NIT de la review de la spec 014 sobre comprobar que el usuario del enlace existe antes de bloquearlo para el
  restablecimiento: no cambia ningún comportamiento observable y se anota en el backlog (Q6, resuelta).

## 4. Requisitos funcionales

### REQ-001 — Cuerpo no válido en el registro
IF el cuerpo de `POST /api/auth/register` no es un objeto JSON (no es JSON, es JSON malformado, se envía sin tipo
de contenido JSON, es `null`, una lista, un texto o un número) THEN THE SYSTEM SHALL responder 400 con
`{"error": "La petición no es válida"}` y no crear ninguna cuenta.

- **AC-001.1:** Given ninguna cuenta, When se envía al registro un cuerpo de texto plano `hola` con tipo de
  contenido `text/plain`, Then la respuesta es 400 con `{"error": "La petición no es válida"}` y no existe ninguna
  cuenta.
- **AC-001.2:** Given ninguna cuenta, When se envía al registro el texto `{"email": ` con tipo de contenido
  `application/json` (JSON malformado), Then la respuesta es 400 con `{"error": "La petición no es válida"}`.
- **AC-001.3:** Given ninguna cuenta, When se envía al registro el JSON `null`, Then la respuesta es 400 con
  `{"error": "La petición no es válida"}`.
- **AC-001.4:** Given ninguna cuenta, When se envía al registro una lista JSON con un objeto de registro válido
  dentro, Then la respuesta es 400 con `{"error": "La petición no es válida"}` y no existe ninguna cuenta.
- **AC-001.5:** Given ninguna cuenta, When se envía al registro una petición sin cuerpo, Then la respuesta es 400
  con `{"error": "La petición no es válida"}`.

### REQ-002 — Cuerpo no válido en el login
IF el cuerpo de `POST /api/auth/login` no es un objeto JSON (en los mismos casos que REQ-001) THEN THE SYSTEM SHALL
responder 400 con `{"error": "La petición no es válida"}` sin emitir ningún token.

- **AC-002.1:** Given una cuenta `ana@example.com` con contraseña `Clave123`, When se envía al login un cuerpo de
  texto plano con tipo de contenido `text/plain`, Then la respuesta es 400 con
  `{"error": "La petición no es válida"}` y no contiene `token`.
- **AC-002.2:** Given cualquier estado, When se envía al login JSON malformado con tipo de contenido
  `application/json`, Then la respuesta es 400 con `{"error": "La petición no es válida"}`.
- **AC-002.3:** Given cualquier estado, When se envía al login el JSON `null`, Then la respuesta es 400 con
  `{"error": "La petición no es válida"}`.
- **AC-002.4:** Given cualquier estado, When se envía al login una lista JSON, Then la respuesta es 400 con
  `{"error": "La petición no es válida"}`.
- **AC-002.5:** Given cualquier estado, When se envía al login el objeto JSON vacío `{}`, Then la respuesta sigue
  siendo 401 con `{"error": "Correo o contraseña incorrectos"}` (no 400).

### REQ-003 — Nombre obligatorio en el registro
WHEN se envía un registro THE SYSTEM SHALL exigir un `first_name` de texto que, sin los espacios de los extremos,
tenga entre 1 y 100 caracteres, y guardarlo sin esos espacios. IF no se cumple THEN THE SYSTEM SHALL responder 400
y no crear la cuenta.

- **AC-003.1:** Given un registro por lo demás válido sin el campo `first_name`, When se envía, Then la respuesta es
  400 con `{"error": "El nombre es obligatorio"}` y no existe ninguna cuenta.
- **AC-003.2:** Given un registro por lo demás válido con `first_name` igual a `"   "`, When se envía, Then la
  respuesta es 400 con `{"error": "El nombre es obligatorio"}`.
- **AC-003.3:** Given un registro por lo demás válido con `first_name` numérico (`123`) o `null`, When se envía,
  Then la respuesta es 400 con `{"error": "El nombre es obligatorio"}`, nunca 5xx.
- **AC-003.4:** Given un registro por lo demás válido con `first_name` de 101 caracteres, When se envía, Then la
  respuesta es 400 con `{"error": "El nombre no puede superar los 100 caracteres"}` y no existe ninguna cuenta.
- **AC-003.5:** Given un registro por lo demás válido con `first_name` de 100 caracteres rodeado de espacios, When
  se envía, Then la respuesta es 201 y el nombre guardado son esos 100 caracteres sin los espacios.
- **AC-003.6:** Given un registro por lo demás válido con `first_name` igual a `"  María José "`, When se envía,
  Then la respuesta es 201 y el nombre guardado es `"María José"`.
- **AC-003.7:** Given un registro por lo demás válido con `first_name` de 300 caracteres, When se envía, Then la
  respuesta es 400 con `{"error": "El nombre no puede superar los 100 caracteres"}`, nunca 5xx.

### REQ-004 — Apellido obligatorio en el registro
WHEN se envía un registro THE SYSTEM SHALL exigir un `last_name` de texto que, sin los espacios de los extremos,
tenga entre 1 y 100 caracteres, y guardarlo sin esos espacios. IF no se cumple THEN THE SYSTEM SHALL responder 400
y no crear la cuenta.

- **AC-004.1:** Given un registro por lo demás válido sin el campo `last_name`, When se envía, Then la respuesta es
  400 con `{"error": "El apellido es obligatorio"}` y no existe ninguna cuenta.
- **AC-004.2:** Given un registro por lo demás válido con `last_name` igual a `""` o `"   "`, When se envía, Then la
  respuesta es 400 con `{"error": "El apellido es obligatorio"}`.
- **AC-004.3:** Given un registro por lo demás válido con `last_name` numérico (`123`) o `null`, When se envía, Then
  la respuesta es 400 con `{"error": "El apellido es obligatorio"}`, nunca 5xx.
- **AC-004.4:** Given un registro por lo demás válido con `last_name` de 101 caracteres, When se envía, Then la
  respuesta es 400 con `{"error": "El apellido no puede superar los 100 caracteres"}`.
- **AC-004.5:** Given un registro por lo demás válido con `last_name` igual a `" Pérez  "`, When se envía, Then la
  respuesta es 201 y el apellido guardado es `"Pérez"`.

### REQ-005 — Fecha de nacimiento del registro
WHEN se envía un registro THE SYSTEM SHALL exigir un `date_of_birth` con formato `AAAA-MM-DD`, que sea una fecha
real, no futura y con una edad de entre 14 y 100 años cumplidos en la fecha de hoy (UTC), con las mismas reglas y
mensajes que el perfil (spec 007, ADR-0019). IF no se cumple THEN THE SYSTEM SHALL responder 400 y no crear la
cuenta.

- **AC-005.1:** Given un registro por lo demás válido sin el campo `date_of_birth`, When se envía, Then la respuesta
  es 400 con `{"error": "La fecha de nacimiento no es válida"}` y no existe ninguna cuenta.
- **AC-005.2:** Given un registro por lo demás válido con `date_of_birth` igual a `null`, `""`, `19900101`,
  `"1990/01/01"` o `"no-es-fecha"`, When se envía, Then la respuesta es 400 con
  `{"error": "La fecha de nacimiento no es válida"}`, nunca 5xx.
- **AC-005.3:** Given un registro por lo demás válido con `date_of_birth` igual a `"2001-02-30"` (fecha
  inexistente), When se envía, Then la respuesta es 400 con `{"error": "La fecha de nacimiento no es válida"}`.
- **AC-005.4:** Given un registro por lo demás válido con `date_of_birth` igual a mañana (UTC), When se envía, Then
  la respuesta es 400 con `{"error": "La fecha de nacimiento no puede ser futura"}`.
- **AC-005.5:** Given un registro por lo demás válido con una fecha de nacimiento que da 13 años cumplidos hoy
  (cumple 14 mañana), When se envía, Then la respuesta es 400 con `{"error": "Debes tener entre 14 y 100 años"}`.
- **AC-005.6:** Given un registro por lo demás válido con una fecha de nacimiento que da exactamente 14 años hoy
  (cumple hoy), When se envía, Then la respuesta es 201.
- **AC-005.7:** Given un registro por lo demás válido con una fecha de nacimiento que da 101 años cumplidos hoy,
  When se envía, Then la respuesta es 400 con `{"error": "Debes tener entre 14 y 100 años"}`.
- **AC-005.8:** Given un registro por lo demás válido con una fecha de nacimiento que da 100 años cumplidos hoy (no
  cumple 101 hasta mañana), When se envía, Then la respuesta es 201 y el perfil (`GET /api/profile`) devuelve esa
  `date_of_birth`.

### REQ-006 — Orden de las validaciones del registro
WHEN un registro tiene varios datos no válidos THE SYSTEM SHALL devolver solo el primer error en este orden: cuerpo,
correo, contraseña, nombre, apellido, fecha de nacimiento y, por último, correo ya registrado.

- **AC-006.1:** Given un registro con correo `no-es-un-correo` y sin `first_name`, When se envía, Then la respuesta
  es 400 con `{"error": "Email inválido"}`.
- **AC-006.2:** Given un registro con contraseña `corta` y sin `first_name`, When se envía, Then la respuesta es 400
  con el mensaje de contraseña demasiado corta de la spec 014.
- **AC-006.3:** Given un registro sin `first_name`, sin `last_name` y sin `date_of_birth`, When se envía, Then la
  respuesta es 400 con `{"error": "El nombre es obligatorio"}`.
- **AC-006.4:** Given un registro sin `last_name` y con `date_of_birth` futura, When se envía, Then la respuesta es
  400 con `{"error": "El apellido es obligatorio"}`.
- **AC-006.5:** Given una cuenta existente `ana@example.com`, When se registra de nuevo ese correo sin
  `date_of_birth`, Then la respuesta es 400 con `{"error": "La fecha de nacimiento no es válida"}` (no 409).

### REQ-007 — Credenciales incorrectas en español
IF el login falla por credenciales incorrectas o datos anómalos (todos los casos que hoy responden 401) THEN THE
SYSTEM SHALL responder 401 con `{"error": "Correo o contraseña incorrectos"}`, igual en todos los casos.

- **AC-007.1:** Given una cuenta `ana@example.com` con contraseña `Clave123`, When se inicia sesión con contraseña
  `Otra1234`, Then la respuesta es 401 con `{"error": "Correo o contraseña incorrectos"}`.
- **AC-007.2:** Given ninguna cuenta con `nadie@example.com`, When se inicia sesión con ese correo, Then la
  respuesta es 401 con `{"error": "Correo o contraseña incorrectos"}`.
- **AC-007.3:** Given una cuenta creada con Google (sin contraseña), When se inicia sesión con su correo y cualquier
  contraseña, Then la respuesta es 401 con `{"error": "Correo o contraseña incorrectos"}`.
- **AC-007.4:** Given un login con `email` numérico, sin `password` o con una contraseña de 73 bytes, When se envía,
  Then la respuesta es 401 con `{"error": "Correo o contraseña incorrectos"}`.

### REQ-008 — Correo ya registrado en español
IF un registro válido usa un correo que ya pertenece a una cuenta THEN THE SYSTEM SHALL responder 409 con
`{"error": "Ya existe una cuenta con este correo"}` y no crear otra cuenta.

- **AC-008.1:** Given una cuenta `ana@example.com`, When se registra `ana@example.com` con datos válidos, Then la
  respuesta es 409 con `{"error": "Ya existe una cuenta con este correo"}` y sigue habiendo una sola cuenta.
- **AC-008.2:** Given una cuenta `ana@example.com`, When se registra `ANA@example.com` con datos válidos, Then la
  respuesta es 409 con `{"error": "Ya existe una cuenta con este correo"}`.

### REQ-009 — Un único instante al restablecer la contraseña
WHEN se restablece una contraseña con un enlace THE SYSTEM SHALL leer la hora una sola vez, al empezar a procesar
la petición, y usar ese mismo instante para comprobar la caducidad del enlace (en todas sus comprobaciones) y como
momento de uso del enlace.

- **AC-009.1:** Given un enlace creado en el instante T, y un reloj que devuelve T + 4 min la primera vez que se
  consulta y T + 6 min en cualquier consulta posterior, When se restablece la contraseña con ese enlace y una
  contraseña válida, Then la operación tiene éxito, la contraseña nueva queda guardada y el momento de uso
  registrado del enlace es T + 4 min.
- **AC-009.2:** Given un enlace creado en el instante T, y un reloj que devuelve T + 5 min la primera vez y T + 4 min
  después, When se restablece la contraseña, Then la respuesta es el error de enlace no válido o caducado de la spec
  014 y la contraseña no cambia.

## 5. Requisitos no funcionales

### NFR-001 — Sin errores internos ante entradas del cliente
THE SYSTEM SHALL responder a cualquier cuerpo enviado a `/api/auth/register` y `/api/auth/login` con un código
2xx, 400, 401 o 409, nunca con 5xx, y siempre con un cuerpo JSON `{"error": …}` en español cuando hay error.

- **AC-N001.1:** Given una batería de cuerpos anómalos (no JSON, JSON malformado, `null`, lista, número, texto,
  objeto vacío, objeto con cada campo como número, como `null` y como lista), When se envía cada uno a
  `/api/auth/register` y a `/api/auth/login`, Then ninguna respuesta es 5xx y todas las de error tienen el formato
  `{"error": <texto>}` sin los textos en inglés «Wrong Credentials», «Email already registered» ni el texto del
  framework sobre el tipo de contenido.

## 6. Datos y contratos visibles

**`POST /api/auth/register`** — cuerpo: objeto JSON con `email`, `password`, `first_name`, `last_name`,
`date_of_birth`.

| Campo | Regla | Mensaje si falla (400) |
|---|---|---|
| (cuerpo) | Objeto JSON | `La petición no es válida` |
| `email` | Sin cambios (spec 014) | `Email inválido` |
| `password` | Sin cambios (spec 014) | Mensajes de la spec 014 |
| `first_name` | Texto; sin espacios de los extremos, de 1 a 100 caracteres; se guarda recortado | `El nombre es obligatorio` / `El nombre no puede superar los 100 caracteres` |
| `last_name` | Texto; sin espacios de los extremos, de 1 a 100 caracteres; se guarda recortado | `El apellido es obligatorio` / `El apellido no puede superar los 100 caracteres` |
| `date_of_birth` | `AAAA-MM-DD`, fecha real, no futura, edad de 14 a 100 años cumplidos hoy (UTC) | `La fecha de nacimiento no es válida` / `La fecha de nacimiento no puede ser futura` / `Debes tener entre 14 y 100 años` |

- Correo ya registrado: 409 `{"error": "Ya existe una cuenta con este correo"}` (antes «Email already
  registered»).
- Éxito: 201 `{"token": …}`, sin cambios.

**`POST /api/auth/login`** — cuerpo: objeto JSON con `email` y `password`.

- Cuerpo que no es un objeto JSON: 400 `{"error": "La petición no es válida"}` (nuevo).
- Credenciales incorrectas o datos anómalos dentro de un objeto JSON: 401
  `{"error": "Correo o contraseña incorrectos"}` (antes «Wrong Credentials»).
- Éxito: 200 `{"token": …}`, sin cambios.

**Restablecimiento de contraseña:** sin cambios en el contrato visible.

**Compatibilidad:** el frontend muestra el texto del error tal cual, así que los mensajes nuevos aparecen sin
cambios en él. Un cliente externo que compare los textos «Wrong Credentials» o «Email already registered» dejará de
reconocerlos; los códigos HTTP de esos casos no cambian.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Qué mensaje y código se devuelven cuando el cuerpo no es un objeto JSON? | 400 `La petición no es válida`, el mismo en `/register` y `/login`. Un objeto JSON en `/login` al que le faltan campos sigue siendo 401 (spec 014). |  Sí, acepto la respuesta propuesta. |
| Q2 | ¿Qué textos sustituyen a «Wrong Credentials» y «Email already registered»? | `Correo o contraseña incorrectos` y `Ya existe una cuenta con este correo`. |  Sí, acepto la respuesta propuesta. |
| Q3 | ¿Límite de longitud y caracteres permitidos para nombre y apellido? | De 1 a 100 caracteres tras recortar los espacios de los extremos; se admite cualquier carácter (tildes, ñ, guiones, apóstrofos, espacios internos); se guarda recortado. |  Sí, acepto la respuesta propuesta. |
| Q4 | ¿La fecha de nacimiento del registro sigue las mismas reglas y mensajes que el perfil (formato, no futura, 14 a 100 años, «no es válida» también cuando falta)? | Sí, idénticas a las del perfil, con la fecha de hoy en UTC. |  Sí, acepto la respuesta propuesta. |
| Q5 | ¿Se incluye `/api/auth/google` (cuerpo no JSON y mensajes «Invalid Google token» y «Google email not verified» en inglés)? | No; queda fuera de alcance y se anota en el backlog. |  Sí, acepto la respuesta propuesta. |
| Q6 | ¿Se incluyen los NIT de `password_reset_service`? | Sí el de un único instante (REQ-009, con el instante leído al empezar la petición); no el de comprobar el usuario antes del bloqueo, que no cambia ningún comportamiento observable y se queda en el backlog. |  Sí, acepto la respuesta propuesta. |
| Q7 | ¿Orden de las validaciones del registro? | Cuerpo, correo, contraseña, nombre, apellido, fecha de nacimiento y, al final, correo duplicado (REQ-006); conserva el orden de la spec 014. |  Sí, acepto la respuesta propuesta. |

**Estado:** las siete preguntas están resueltas; el usuario aceptó todas las propuestas por defecto y ya están
incorporadas:
- Q1 → REQ-001, REQ-002 (AC-002.5) y la sección 6.
- Q2 → REQ-007 y REQ-008.
- Q3 → REQ-003 y REQ-004.
- Q4 → REQ-005.
- Q5 → fuera de alcance; pasa al backlog.
- Q6 → REQ-009 (un único instante, leído al empezar la petición); el NIT de comprobar el usuario antes del bloqueo
  pasa al backlog.
- Q7 → REQ-006.

## 8. Glosario

- **Objeto JSON:** un cuerpo que se interpreta como JSON y cuyo valor raíz es un objeto (`{…}`); `null`, listas,
  números y textos no lo son.
- **Edad cumplida hoy:** años completos entre la fecha de nacimiento y la fecha actual en UTC; quien cumple años hoy
  ya tiene la edad nueva.
