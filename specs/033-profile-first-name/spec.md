# Spec 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

- **Feature:** `033-profile-first-name` · **Tipo:** feature
- **Ámbitos:** backend, frontend

## 1. Contexto y problema

Hoy el registro con correo y contraseña pide nombre, apellido, correo, contraseña y fecha de nacimiento. La fecha de nacimiento se vuelve a pedir (o a confirmar) en el onboarding, que es donde de verdad se usa para calcular la edad, así que pedirla en el registro alarga el alta sin aportar nada.

Además, el nombre que el usuario dio al registrarse (o el que llegó de Google) no se ve ni se puede cambiar en ningún sitio: `/profile` no lo muestra y `/home` saluda con un «Hola de nuevo» genérico. Si el usuario se equivocó al escribirlo, o entró con Google y no tiene nombre, no tiene forma de corregirlo.

## 2. Historia de usuario

Como **usuario de fitnerd**, quiero **registrarme sin dar mi fecha de nacimiento, ver y corregir mi nombre en el perfil y que la pantalla de inicio me salude por mi nombre** para **darme de alta más rápido y sentir la app como algo mío**.

## 3. Alcance

**Incluye:**
- El formulario de registro deja de mostrar y enviar la fecha de nacimiento; el servidor ignora `date_of_birth` si llega en `POST /api/auth/register`. La fecha se pide solo en el onboarding (que ya la pide cuando la cuenta no la tiene).
- `GET /api/profile` devuelve el nombre (`first_name`) de la cuenta.
- `PUT /api/profile` acepta `first_name` de forma opcional: si viene, debe ser válido y se guarda; si no viene, el nombre no se toca.
- `/profile` muestra el campo «Nombre» como primer campo de la sección hasta ahora llamada «Datos físicos», que pasa a llamarse «Datos personales» (su descripción no cambia); el campo se precarga con el nombre de la cuenta (vacío si no tiene), se guarda con el mismo «Guardar cambios» y «Descartar» de la sección y no deja guardar con el nombre vacío.
- La regla del nombre es la misma en registro y perfil, en servidor y en navegador: obligatorio, sin espacios en los extremos y de 1 a 100 caracteres una vez recortado, con los mismos mensajes en ambos lados.
- `/home` saluda con «Hola de nuevo, {nombre}», o con «Hola de nuevo» a secas si la cuenta no tiene nombre.

**Fuera de alcance:**
- El apellido (`last_name`): no se muestra ni se edita en el perfil ni cambia en el registro.
- Cambiar la fecha de nacimiento de las cuentas existentes: las que la tienen la conservan.
- Obligar a las cuentas sin nombre a ponerlo: ni se bloquea el acceso a ninguna pantalla ni el onboarding.
- Google Sign-In: sigue tomando el nombre de Google como hasta ahora.
- `GET /api/auth/me` no cambia.
- Cambios en la base de datos (migraciones) y variables de entorno nuevas.

## 4. Requisitos funcionales

### REQ-001 — El registro ignora la fecha de nacimiento
WHEN se recibe una petición de registro con correo y contraseña THE SYSTEM SHALL crear la cuenta sin fecha de nacimiento, sin validar ni guardar `date_of_birth` aunque venga en el cuerpo, y con el resto de validaciones sin cambios.

- **AC-001.1:** Given un cuerpo válido con `email`, `password`, `first_name` y `last_name` y sin `date_of_birth`, When se hace `POST /api/auth/register`, Then responde 201 con un `token`, y `GET /api/profile` con ese token devuelve `date_of_birth: null` y `onboarding_completed: false`.
- **AC-001.2:** Given un cuerpo válido que además trae `date_of_birth: "1995-05-20"`, When se hace `POST /api/auth/register`, Then responde 201 y `GET /api/profile` con ese token devuelve `date_of_birth: null`.
- **AC-001.3:** Given un cuerpo válido cuyo `date_of_birth` no es una fecha válida o está fuera de rango (`"2001-02-30"`, `"abc"`, `123`, `null` o una fecha de mañana), When se hace `POST /api/auth/register`, Then responde 201 (no 400) y la cuenta queda creada con `date_of_birth: null`.
- **AC-001.4:** Given un cuerpo sin `date_of_birth` y sin `first_name`, When se hace `POST /api/auth/register`, Then responde 400 con `{"error": "El nombre es obligatorio"}` y no se crea la cuenta (el resto de validaciones y su orden, correo, contraseña, nombre, apellido y correo duplicado, no cambian).

### REQ-002 — Formulario de registro sin fecha de nacimiento
THE SYSTEM SHALL mostrar el formulario de registro sin el campo «Fecha de nacimiento» y enviar el alta sin `date_of_birth`.

- **AC-002.1:** Given la pantalla de registro, When se muestra, Then no hay ningún campo con la etiqueta «Fecha de nacimiento» y siguen los campos «Nombre», «Apellido», «Email» y «Password».
- **AC-002.2:** Given el formulario de registro con nombre, apellido, correo y contraseña válidos, When se pulsa «Crear cuenta», Then se envía una única petición de registro cuyo cuerpo tiene `email`, `password`, `first_name` y `last_name` y no tiene la clave `date_of_birth`.

### REQ-003 — El onboarding pide la fecha a las cuentas nuevas
WHILE la cuenta no tiene fecha de nacimiento THE SYSTEM SHALL mostrar en el onboarding el campo de fecha de nacimiento vacío y no permitir avanzar sin rellenarlo.

- **AC-003.1:** Given un usuario con `date_of_birth: null` y `onboarding_completed: false`, When abre `/onboarding`, Then el campo de fecha de nacimiento aparece vacío y el paso no se puede completar hasta introducir una fecha válida.

### REQ-004 — El perfil devuelve el nombre
WHEN un usuario autenticado consulta su perfil THE SYSTEM SHALL incluir en la respuesta su nombre como `first_name`, o `null` si la cuenta no tiene nombre.

- **AC-004.1:** Given un usuario cuyo nombre guardado es «Ana», When hace `GET /api/profile`, Then la respuesta 200 incluye `"first_name": "Ana"` junto con los campos que ya devolvía.
- **AC-004.2:** Given un usuario sin nombre guardado (por ejemplo, una cuenta de Google sin nombre), When hace `GET /api/profile`, Then la respuesta 200 incluye `"first_name": null`.
- **AC-004.3:** Given un usuario autenticado, When hace `PUT /api/profile` con un cuerpo válido, Then la respuesta 200 incluye también `first_name` con el valor que queda guardado.

### REQ-005 — Guardar el nombre desde el perfil
WHEN `PUT /api/profile` recibe la clave `first_name` con un nombre válido THE SYSTEM SHALL guardarlo sin los espacios de los extremos junto con el resto del perfil; WHEN la petición no trae la clave `first_name` THE SYSTEM SHALL dejar el nombre guardado como estaba.

- **AC-005.1:** Given un usuario con nombre «Ana» y un cuerpo de perfil válido con `"first_name": "  María José "`, When hace `PUT /api/profile`, Then responde 200 con `"first_name": "María José"` y un `GET /api/profile` posterior devuelve `"first_name": "María José"`.
- **AC-005.2:** Given un usuario con nombre «Ana» y un cuerpo de perfil válido sin la clave `first_name` (como el que envía el onboarding), When hace `PUT /api/profile`, Then responde 200, el resto del perfil se guarda y `first_name` sigue siendo «Ana».
- **AC-005.3:** Given un usuario sin nombre y un cuerpo de perfil válido sin la clave `first_name`, When hace `PUT /api/profile`, Then responde 200 y `first_name` sigue siendo `null`.
- **AC-005.4:** Given un cuerpo de perfil válido con `first_name` de 100 caracteres rodeado de espacios, When hace `PUT /api/profile`, Then responde 200 y se guardan los 100 caracteres sin los espacios.

### REQ-006 — Rechazar un nombre no válido en el perfil
IF `PUT /api/profile` trae la clave `first_name` con un valor que no es texto, que queda vacío al quitar los espacios de los extremos o que supera 100 caracteres una vez recortado THEN THE SYSTEM SHALL responder 400 con el mensaje de la regla del nombre y no modificar nada (ni el nombre ni el resto del perfil).

- **AC-006.1:** Given un usuario con nombre «Ana» y un cuerpo de perfil por lo demás válido, When hace `PUT /api/profile` con `first_name` igual a `""`, `"   "`, `null` o `123`, Then responde 400 con `{"error": "El nombre es obligatorio"}`, el nombre sigue siendo «Ana» y los datos físicos no cambian.
- **AC-006.2:** Given un usuario con nombre «Ana» y un cuerpo de perfil por lo demás válido, When hace `PUT /api/profile` con `first_name` de 101 caracteres, Then responde 400 con `{"error": "El nombre no puede superar los 100 caracteres"}` y no cambia nada.
- **AC-006.3:** Given un cuerpo con `first_name` no válido y además un dato físico no válido, When hace `PUT /api/profile`, Then responde 400 con el mensaje del nombre (el nombre se valida primero).
- **AC-006.4:** Given un cuerpo con `first_name` de 300 caracteres, When hace `PUT /api/profile`, Then responde 400 con el mensaje de longitud, nunca un 5xx.

### REQ-007 — Ver y editar el nombre en /profile
THE SYSTEM SHALL mostrar en `/profile`, como primer campo de la sección «Datos personales» (antes «Datos físicos», con la misma descripción), un campo «Nombre» precargado con el nombre de la cuenta (vacío si no tiene) y guardarlo con el mismo «Guardar cambios» y «Descartar» que el resto de la sección; IF el nombre no cumple la regla THEN THE SYSTEM SHALL mostrar el aviso correspondiente bajo el campo y no permitir guardar.

- **AC-007.1:** Given un perfil con `first_name: "Ana"`, When se abre `/profile`, Then se ve un campo con la etiqueta «Nombre» y el valor «Ana».- **AC-007.2:** Given un perfil con `first_name: null`, When se abre `/profile`, Then el campo «Nombre» aparece vacío, con el aviso «El nombre es obligatorio», y el resto de la pantalla se puede usar.
- **AC-007.3:** Given un perfil con `first_name: "Ana"`, When el usuario cambia solo el nombre a «Beatriz» y pulsa «Guardar cambios», Then se envía un `PUT /api/profile` cuyo cuerpo incluye `"first_name": "Beatriz"` y el resto de datos del perfil sin cambios, no se registra ninguna medición corporal y aparece «Cambios guardados».
- **AC-007.4:** Given el campo «Nombre» con «  Beatriz  », When se guarda, Then el cuerpo enviado lleva `"first_name": "Beatriz"`.
- **AC-007.5:** Given el campo «Nombre» vacío o solo con espacios, When se muestra el formulario, Then aparece «El nombre es obligatorio» bajo el campo y «Guardar cambios» está desactivado.
- **AC-007.6:** Given el campo «Nombre» con 101 caracteres, When se muestra el formulario, Then aparece «El nombre no puede superar los 100 caracteres» bajo el campo y «Guardar cambios» está desactivado.
- **AC-007.7:** Given un perfil con `first_name: "Ana"` y el nombre cambiado a «Beatriz» sin guardar, When se pulsa «Descartar», Then el campo vuelve a «Ana».
- **AC-007.8:** Given un perfil cargado, When se abre `/profile`, Then la sección que contiene los datos físicos se titula «Datos personales» (no aparece el título «Datos físicos»), conserva la descripción que tenía y su primer campo es «Nombre», antes que el resto de campos de la sección.
### REQ-008 — Una sola regla para el nombre en el navegador
THE SYSTEM SHALL validar el nombre en el formulario de registro y en el de perfil con la misma regla que el servidor: se recortan los espacios de los extremos y el resultado debe tener entre 1 y 100 caracteres, contados como caracteres y no como unidades de codificación.

- **AC-008.1:** Given la regla del nombre del navegador, When se valida «  Ana  », Then es válido y el valor resultante es «Ana».
- **AC-008.2:** Given la regla del nombre del navegador, When se valida `""` o `"   "`, Then no es válido con el mensaje «El nombre es obligatorio».
- **AC-008.3:** Given la regla del nombre del navegador, When se valida un nombre de 100 caracteres rodeado de espacios, Then es válido; When se valida uno de 101 caracteres, Then no es válido con «El nombre no puede superar los 100 caracteres».
- **AC-008.4:** Given la regla del nombre del navegador, When se valida un nombre de 100 emojis (100 caracteres que ocupan más de 100 unidades UTF-16), Then es válido; con 101 emojis no lo es.
- **AC-008.5:** Given el formulario de registro, When se intenta crear la cuenta con el nombre «   » o con 101 caracteres, Then se muestra el mensaje de la regla bajo «Nombre» («El nombre es obligatorio» o «El nombre no puede superar los 100 caracteres», respectivamente) y no se envía la petición de registro.
- **AC-008.6:** Given el formulario de registro con «Nombre» y «Apellido» vacíos, When se intenta crear la cuenta, Then bajo «Nombre» aparece «El nombre es obligatorio», bajo «Apellido» aparece «Campo obligatorio» y no se envía la petición de registro.

### REQ-009 — Saludo con el nombre en /home
THE SYSTEM SHALL mostrar en `/home` el saludo «Hola de nuevo, {nombre}» con el nombre de la cuenta sin espacios en los extremos; IF la cuenta no tiene nombre o solo tiene espacios THEN THE SYSTEM SHALL mostrar «Hola de nuevo» a secas.

- **AC-009.1:** Given un perfil con `first_name: "Ana"`, When se abre `/home`, Then el encabezado principal dice «Hola de nuevo, Ana».
- **AC-009.2:** Given un perfil con `first_name: null`, When se abre `/home`, Then el encabezado principal dice «Hola de nuevo», sin coma ni nombre.
- **AC-009.3:** Given un perfil con `first_name: "   "`, When se abre `/home`, Then el encabezado principal dice «Hola de nuevo».
- **AC-009.4:** Given un usuario que acaba de guardar «Beatriz» como nombre en `/profile`, When navega a `/home` sin recargar la página, Then el encabezado principal dice «Hola de nuevo, Beatriz».

## 5. Requisitos no funcionales

No aplican requisitos no funcionales específicos. La seguridad del perfil no cambia: `GET` y `PUT /api/profile` siguen exigiendo sesión y solo leen o modifican la cuenta del token.

## 6. Datos y contratos visibles

**`POST /api/auth/register`** (cambio):
- Campos que se usan: `email`, `password`, `first_name`, `last_name`. `date_of_birth` deja de ser obligatorio y, si llega, se ignora (ni se valida ni se guarda). Respuesta sin cambios: 201 `{"token": …}`.
- Desaparecen de este endpoint los errores de fecha de nacimiento («La fecha de nacimiento no es válida» y los de rango de edad).

**`GET /api/profile`** (amplía la respuesta):
- Nuevo campo `first_name`: `string | null`, el nombre guardado de la cuenta.
- El resto de campos (`onboarding_completed`, `onboarding_completed_at`, `date_of_birth`, `profile`) no cambia.

**`PUT /api/profile`** (amplía el cuerpo y la respuesta):
- Nueva clave opcional `first_name` en el cuerpo. Si está presente (aunque valga `null`), se valida con la regla del nombre; si falta, el nombre no se toca. Se valida antes que el resto de campos del perfil.
- La respuesta incluye `first_name` como en `GET`.
- Errores nuevos (400, `{"error": …}`):
  - «El nombre es obligatorio»: `first_name` no es texto o queda vacío al recortarlo.
  - «El nombre no puede superar los 100 caracteres»: más de 100 caracteres una vez recortado.

**Regla del nombre** (registro y perfil, servidor y navegador): se recortan los espacios de los extremos; se conservan los espacios interiores, tildes y cualquier carácter; el resultado debe tener entre 1 y 100 caracteres.

**Pantallas:**
- Registro: campos «Nombre», «Apellido», «Email» y «Password»; sin «Fecha de nacimiento». Mensajes del campo «Nombre»: «El nombre es obligatorio» y «El nombre no puede superar los 100 caracteres» (sustituyen a «Campo obligatorio» en ese campo). El campo «Apellido» sigue con «Campo obligatorio».
- `/profile`: la sección «Datos físicos» pasa a titularse «Datos personales» (misma descripción) y su primer campo es «Nombre», con los mismos dos mensajes, guardado con su «Guardar cambios» y revertido con su «Descartar».
- `/home`: encabezado «Hola de nuevo, {nombre}» o «Hola de nuevo».

**Datos existentes:** no se migran. Las cuentas con fecha de nacimiento la conservan; las que no tienen nombre ven el campo vacío en `/profile` y el saludo sin nombre. Un nombre antiguo de más de 100 caracteres (posible si vino de Google) se muestra tal cual, pero el formulario de perfil exige acortarlo para guardar.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Dónde va el campo «Nombre» en `/profile`? El guardado del perfil es una sola petición con todos los datos. | Como primer campo del formulario de «Datos físicos», guardado con el mismo «Guardar cambios» y «Descartar»; la sección pasa a llamarse «Datos personales» y su descripción se mantiene. Cambiar solo el nombre no registra ninguna medición. | sí a todas |
| Q2 | La idea dice «Hola de nuevo {first_name}». En español correcto el vocativo va con coma. ¿Se escribe con coma? | Sí: «Hola de nuevo, Ana». Sin nombre, «Hola de nuevo» sin coma. | sí a todas |
| Q3 | Hoy el registro muestra «Campo obligatorio» si el nombre está vacío. Al compartir la regla con el perfil, ¿qué mensajes usa el navegador? | Los mismos del servidor en registro y perfil: «El nombre es obligatorio» y «El nombre no puede superar los 100 caracteres». El apellido del registro sigue con «Campo obligatorio» (fuera de alcance). | sí a todas |

**Estado:** Q1, Q2 y Q3 resueltas con la propuesta por defecto. Q1 se incorpora en el alcance, REQ-007 (AC-007.3, AC-007.7 y AC-007.8) y la sección 6; Q2 en REQ-009; Q3 en REQ-008 (AC-008.5 y AC-008.6) y la sección 6. No quedan preguntas pendientes.

## 8. Glosario

- **Nombre:** el `first_name` de la cuenta. No incluye el apellido.
- **Regla del nombre:** la validación de la spec 018 para el nombre del registro (de 1 a 100 caracteres sin espacios en los extremos), que esta spec reutiliza en el perfil.
