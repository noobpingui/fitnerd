# Spec 002 — Recuperación de contraseña por correo (forgot password)

- **Feature:** `002-forgot-password` · **Tipo:** feature
- **Ámbito:** ambos

## 1. Contexto y problema

Hoy un usuario que se registró en fitnerd con correo y contraseña y la olvida no puede volver a entrar: la pantalla de login solo ofrece "Entrar" con contraseña o con Google, y no existe forma de restablecer la contraseña. La app tampoco envía hoy ningún correo electrónico.

Se necesita un flujo de autoservicio: desde la pantalla de login, el usuario pide un enlace de restablecimiento indicando su correo, lo recibe enseguida y, desde ese enlace, fija una contraseña nueva. Para evitar spam, solo se puede pedir un enlace cada 2 minutos por correo y, para frenar a scripts o bots que prueban muchos correos distintos, como mucho 3 solicitudes cada 10 minutos desde una misma dirección IP (Q15). Cada enlace caduca a los 5 minutos y el más reciente siempre invalida a los anteriores.

## 2. Historia de usuario

Como **usuario registrado con correo y contraseña que ha olvidado su contraseña**, quiero **pedir desde la pantalla de login un enlace que me llegue al correo y me permita fijar una contraseña nueva** para **recuperar el acceso a mi cuenta sin ayuda de nadie**.

## 3. Alcance

**Incluye:**
- Un enlace "¿Olvidaste tu contraseña?" en el formulario de login.
- Una página pública para solicitar el enlace de restablecimiento introduciendo el correo.
- El envío inmediato de un correo en español con el enlace de restablecimiento a las cuentas que tienen contraseña.
- El límite de una solicitud cada 2 minutos por dirección de correo.
- El límite de 3 solicitudes cada 10 minutos por dirección IP del cliente, que se aplica además del límite por correo (Q15).
- La caducidad del enlace a los 5 minutos, su invalidación al emitirse otro más reciente y su uso único.
- Una página pública, a la que lleva el enlace, para fijar la contraseña nueva.
- La actualización de la contraseña y la vuelta al login con un aviso de éxito.
- Dos endpoints públicos del backend que consume el frontend (ver sección 6).

**Fuera de alcance:**
- Que una cuenta creada solo con Google (sin contraseña) pueda crear una contraseña mediante este flujo (Q3).
- Cerrar las sesiones abiertas (tokens ya emitidos) al cambiar la contraseña (Q7).
- Cambiar la contraseña desde dentro de la app estando autenticado.
- Otros mecanismos antispam distintos del límite por correo y del límite por IP de la solicitud de enlace (captcha, listas de bloqueo, etc.).
- Limitar por IP el endpoint de fijar la contraseña nueva (`/api/auth/reset-password`) o el login.
- Verificación del correo en el registro y cualquier otro correo transaccional (bienvenida, avisos).
- Cambiar cómo se comparan los correos en el login o en el registro.
- Comprobar la validez del enlace al abrir la página, antes de enviar el formulario (Q10).

## 4. Requisitos funcionales

### REQ-001 — Acceso desde el login
THE SYSTEM SHALL mostrar en el formulario de login un enlace con el texto "¿Olvidaste tu contraseña?" que lleve a la página de solicitud de restablecimiento (`/forgot-password`).

- **AC-001.1:** Given un usuario en la página `/login`, When se muestra el formulario, Then hay un enlace con el texto "¿Olvidaste tu contraseña?" que apunta a `/forgot-password`.
- **AC-001.2:** Given un usuario sin sesión iniciada, When navega a `/forgot-password`, Then ve un formulario con un campo "Email" y un botón "Enviar enlace", sin ser redirigido al login.

### REQ-002 — Solicitud de enlace para una cuenta con contraseña
WHEN se solicita un restablecimiento para un correo que pertenece a una cuenta con contraseña y no hay ninguna solicitud previa para ese correo en los últimos 2 minutos ni se ha alcanzado el límite por IP (REQ-012) THE SYSTEM SHALL generar un enlace de restablecimiento nuevo, enviarlo por correo a esa dirección antes de responder y responder con el código `200` y el mensaje genérico de solicitud aceptada.

- **AC-002.1:** Given una cuenta con contraseña con el correo `ana@example.com` y sin solicitudes previas, When se hace `POST /api/auth/forgot-password` con `{"email": "ana@example.com"}`, Then la respuesta es `200` con el cuerpo `{"message": "Si el correo pertenece a una cuenta con contraseña, recibirás un enlace para restablecerla."}`.
- **AC-002.2:** Given el mismo escenario que AC-002.1, When la petición termina, Then se ha enviado exactamente un correo, dirigido a `ana@example.com`, antes de que se devolviera la respuesta.
- **AC-002.3:** Given el correo enviado en AC-002.2, When se inspecciona su contenido, Then está en español, contiene un enlace a la página `/reset-password` de la app pública de fitnerd con un token de restablecimiento, e indica que el enlace caduca a los 5 minutos.
- **AC-002.4:** Given una cuenta creada con contraseña y vinculada después a Google (tiene contraseña y Google), When se solicita el restablecimiento para su correo, Then se envía el correo igual que en AC-002.2.

### REQ-003 — Sin revelar qué correos tienen cuenta
IF se solicita un restablecimiento para un correo que no pertenece a ninguna cuenta, o que pertenece a una cuenta sin contraseña (creada solo con Google) THEN THE SYSTEM SHALL no enviar ningún correo y responder exactamente igual que en REQ-002 (código `200` y el mismo mensaje genérico).

- **AC-003.1:** Given que no existe ninguna cuenta con el correo `nadie@example.com`, When se hace `POST /api/auth/forgot-password` con ese correo, Then la respuesta es `200` con el mismo cuerpo que AC-002.1 y no se envía ningún correo.
- **AC-003.2:** Given una cuenta creada solo con Google (sin contraseña) con el correo `google@example.com`, When se hace `POST /api/auth/forgot-password` con ese correo, Then la respuesta es `200` con el mismo cuerpo que AC-002.1 y no se envía ningún correo.

### REQ-004 — Límite de una solicitud cada 2 minutos por correo
IF se solicita un restablecimiento para un correo que ya tuvo una solicitud aceptada hace menos de 2 minutos THEN THE SYSTEM SHALL rechazar la solicitud con el código `429`, no enviar ningún correo y no generar un enlace nuevo. El límite se aplica por dirección de correo, exista o no la cuenta, para no revelar qué correos están registrados, y es independiente del límite por IP de REQ-012 (se aplican los dos).

- **AC-004.1:** Given una cuenta con contraseña con una solicitud aceptada hace 1 minuto y 59 segundos, When se vuelve a solicitar el restablecimiento para su correo, Then la respuesta es `429` con el cuerpo `{"error": "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde."}` y no se envía ningún correo.
- **AC-004.2:** Given la situación de AC-004.1, When se usa el enlace emitido en la solicitud aceptada (todavía dentro de sus 5 minutos), Then sigue siendo válido (la solicitud rechazada no lo invalida).
- **AC-004.3:** Given una cuenta con contraseña con una solicitud aceptada hace exactamente 2 minutos, When se vuelve a solicitar el restablecimiento para su correo, Then la respuesta es `200` y se envía un correo nuevo.
- **AC-004.4:** Given un correo sin cuenta con una solicitud hace 1 minuto, When se vuelve a solicitar para ese correo, Then la respuesta es `429` con el mismo cuerpo que AC-004.1.
- **AC-004.5:** Given una solicitud aceptada para `ana@example.com` hace 1 minuto, When se solicita el restablecimiento para otra cuenta con contraseña `luis@example.com`, Then la respuesta es `200` y se envía el correo a `luis@example.com` (el límite es independiente por correo).

### REQ-005 — Validación del correo en la solicitud
IF la solicitud de restablecimiento no incluye el correo, lo incluye vacío o con un formato de correo inválido THEN THE SYSTEM SHALL rechazarla con el código `400` y el cuerpo `{"error": "Email inválido"}`, sin enviar correo ni contar para el límite de 2 minutos.

- **AC-005.1:** Given una petición `POST /api/auth/forgot-password` con `{"email": "no-es-un-correo"}`, When se procesa, Then la respuesta es `400` con `{"error": "Email inválido"}` y no se envía ningún correo.
- **AC-005.2:** Given una petición `POST /api/auth/forgot-password` sin el campo `email` o con `{"email": ""}`, When se procesa, Then la respuesta es `400` con `{"error": "Email inválido"}`.
- **AC-005.3:** Given el formulario de `/forgot-password` con un correo de formato inválido, When el usuario pulsa "Enviar enlace", Then se muestra "Email inválido" junto al campo y no se envía ninguna petición.

### REQ-006 — Fallo al enviar el correo
IF el envío del correo de restablecimiento falla para una cuenta con contraseña THEN THE SYSTEM SHALL responder con el código `503` y el cuerpo `{"error": "No se pudo enviar el correo. Inténtalo de nuevo más tarde."}`, el enlace generado no será válido y la solicitud no contará para el límite de 2 minutos.

- **AC-006.1:** Given una cuenta con contraseña y un servicio de correo que falla, When se solicita el restablecimiento, Then la respuesta es `503` con `{"error": "No se pudo enviar el correo. Inténtalo de nuevo más tarde."}`.
- **AC-006.2:** Given la situación de AC-006.1, When el servicio de correo vuelve a funcionar y se solicita de nuevo el restablecimiento de inmediato, Then la respuesta es `200` y se envía el correo (no aplica el límite de 2 minutos).
- **AC-006.3:** Given una cuenta con un enlace válido emitido antes, When una solicitud posterior falla con `503`, Then el enlace anterior sigue siendo válido mientras no caduque.

### REQ-007 — Restablecer la contraseña con un enlace válido
WHEN se envía una contraseña nueva válida junto con un token de restablecimiento vigente THE SYSTEM SHALL sustituir la contraseña de la cuenta por la nueva, invalidar ese token y responder con el código `200`.

- **AC-007.1:** Given un enlace emitido hace 1 minuto para `ana@example.com`, When se hace `POST /api/auth/reset-password` con `{"token": "<token del enlace>", "password": "NuevaClave123"}`, Then la respuesta es `200` con `{"message": "Contraseña actualizada"}`.
- **AC-007.2:** Given el restablecimiento de AC-007.1, When se hace login con `ana@example.com` y `NuevaClave123`, Then el login tiene éxito; y When se hace login con la contraseña anterior, Then falla con `401`.
- **AC-007.3:** Given un enlace ya usado con éxito, When se vuelve a usar con otra contraseña, Then la respuesta es `400` con el mensaje de enlace no válido (REQ-008) y la contraseña no cambia.

### REQ-008 — Rechazo de enlaces no válidos
IF el token de restablecimiento no existe, está mal formado, han pasado 5 minutos o más desde que se emitió, ya se usó o se emitió después otro enlace para la misma cuenta THEN THE SYSTEM SHALL rechazar el restablecimiento con el código `400` y el cuerpo `{"error": "El enlace no es válido o ha caducado. Solicita uno nuevo."}`, sin cambiar la contraseña.

- **AC-008.1:** Given un enlace emitido hace 4 minutos y 59 segundos, When se usa con una contraseña válida, Then la respuesta es `200`.
- **AC-008.2:** Given un enlace emitido hace exactamente 5 minutos, When se usa con una contraseña válida, Then la respuesta es `400` con `{"error": "El enlace no es válido o ha caducado. Solicita uno nuevo."}` y la contraseña no cambia.
- **AC-008.3:** Given dos enlaces emitidos para la misma cuenta (el primero hace 3 minutos y el segundo hace 30 segundos), When se usa el primero, Then la respuesta es `400` con el mismo mensaje; y When se usa el segundo, Then la respuesta es `200`.
- **AC-008.4:** Given un token inventado que nunca se emitió, When se usa, Then la respuesta es `400` con el mismo mensaje.
- **AC-008.5:** Given una petición `POST /api/auth/reset-password` sin el campo `token` o con él vacío, When se procesa, Then la respuesta es `400` con el mismo mensaje.

### REQ-009 — Validación de la contraseña nueva
La contraseña nueva debe tener un mínimo de 8 caracteres (la misma regla mínima que el registro) y un tamaño máximo de 72 bytes codificada en UTF-8 (Q12 y Q13), y el backend también lo valida en este flujo. Un carácter sin tilde ni símbolos especiales ocupa 1 byte; las letras con tilde y la ñ ocupan 2, y los emojis hasta 4. El registro no cambia en esta feature; alinear su máximo queda para otra sesión.

IF la contraseña nueva falta o tiene menos de 8 caracteres THEN THE SYSTEM SHALL rechazar el restablecimiento con el código `400` y el cuerpo `{"error": "La contraseña debe tener al menos 8 caracteres"}`, sin cambiar la contraseña ni invalidar el token.

IF la contraseña nueva ocupa más de 72 bytes en UTF-8 THEN THE SYSTEM SHALL rechazar el restablecimiento con el código `400` y el cuerpo `{"error": "La contraseña es demasiado larga"}` (mensaje genérico que no menciona bytes, Q14), sin cambiar la contraseña ni invalidar el token, y nunca con un error de servidor (`5xx`).

- **AC-009.1:** Given un enlace vigente, When se envía la contraseña `"corta"` (5 caracteres), Then la respuesta es `400` con `{"error": "La contraseña debe tener al menos 8 caracteres"}` y la contraseña no cambia.
- **AC-009.2:** Given un enlace vigente y un intento rechazado por AC-009.1, When se vuelve a usar el mismo enlace con una contraseña válida antes de que caduque, Then la respuesta es `200`.
- **AC-009.3:** Given una petición con un token vigente y sin el campo `password`, When se procesa, Then la respuesta es `400` con `{"error": "La contraseña debe tener al menos 8 caracteres"}`.
- **AC-009.4:** Given un enlace vigente, When se envía una contraseña de exactamente 8 caracteres (`"Clave123"`), Then la respuesta es `200` y el login con esa contraseña tiene éxito.
- **AC-009.5:** Given un enlace vigente, When se envía una contraseña de 73 bytes formada por `"a"` repetida 73 veces, Then la respuesta es `400` con `{"error": "La contraseña es demasiado larga"}` y la contraseña no cambia.
- **AC-009.6:** Given un enlace vigente, When se envía una contraseña de exactamente 72 bytes formada por `"a"` repetida 72 veces, Then la respuesta es `200` y el login con esa contraseña tiene éxito.
- **AC-009.7:** Given un enlace vigente y un intento rechazado por AC-009.5, When se vuelve a usar el mismo enlace con una contraseña válida antes de que caduque, Then la respuesta es `200`.
- **AC-009.8:** Given un enlace vigente, When se envía una contraseña formada por `"ñ"` repetida 37 veces (37 caracteres, 74 bytes), Then la respuesta es `400` con `{"error": "La contraseña es demasiado larga"}`, nunca `5xx`, y la contraseña no cambia.
- **AC-009.9:** Given un enlace vigente, When se envía una contraseña formada por `"ñ"` repetida 36 veces (36 caracteres, exactamente 72 bytes), Then la respuesta es `200` y el login con esa contraseña tiene éxito.

### REQ-010 — Pantalla de solicitud del enlace
WHEN el usuario envía el formulario de `/forgot-password` con un correo válido THE SYSTEM SHALL mostrar el resultado de la solicitud en la misma página.

- **AC-010.1:** Given la página `/forgot-password`, When el usuario envía un correo válido y el backend responde `200`, Then se muestra el mensaje "Si el correo pertenece a una cuenta con contraseña, recibirás un enlace para restablecerla. Revisa tu bandeja de entrada y la carpeta de spam."
- **AC-010.2:** Given la página `/forgot-password`, When el backend responde `429` o `503`, Then se muestra el texto del campo `error` de la respuesta.
- **AC-010.3:** Given la página `/forgot-password`, When la petición está en curso, Then el botón muestra "Enviando..." y está deshabilitado.
- **AC-010.4:** Given la página `/forgot-password`, When se muestra, Then hay un enlace "Volver al login" que apunta a `/login`.

### REQ-011 — Pantalla para fijar la contraseña nueva
WHEN el usuario abre el enlace del correo THE SYSTEM SHALL mostrar en `/reset-password` un formulario con los campos "Nueva contraseña" y "Confirmar contraseña" y un botón "Guardar contraseña"; y WHEN el restablecimiento tiene éxito THE SYSTEM SHALL llevar al usuario a `/login` mostrando el aviso "Contraseña actualizada. Ya puedes iniciar sesión."

- **AC-011.1:** Given la URL `/reset-password?token=abc`, When se carga la página, Then se muestran los campos "Nueva contraseña" y "Confirmar contraseña" y el botón "Guardar contraseña".
- **AC-011.2:** Given el formulario con una contraseña de menos de 8 caracteres, When el usuario lo envía, Then se muestra "Mínimo 8 caracteres" junto al campo y no se envía ninguna petición.
- **AC-011.3:** Given el formulario con "Nueva contraseña" y "Confirmar contraseña" distintas, When el usuario lo envía, Then se muestra "Las contraseñas no coinciden" junto a "Confirmar contraseña" y no se envía ninguna petición.
- **AC-011.4:** Given el formulario con contraseñas válidas y coincidentes, When el backend responde `200`, Then el usuario termina en `/login` y ve el aviso "Contraseña actualizada. Ya puedes iniciar sesión."
- **AC-011.5:** Given el formulario válido, When el backend responde `400`, Then se muestra el texto del campo `error` de la respuesta y un enlace "Solicitar un enlace nuevo" que apunta a `/forgot-password`.
- **AC-011.6:** Given la URL `/reset-password` sin el parámetro `token` (o vacío), When se carga la página, Then no se muestra el formulario y se muestra "El enlace no es válido o ha caducado. Solicita uno nuevo." con el enlace "Solicitar un enlace nuevo" a `/forgot-password`.
- **AC-011.7:** Given el formulario válido, When la petición está en curso, Then el botón muestra "Guardando..." y está deshabilitado.
- **AC-011.8:** Given el formulario con una "Nueva contraseña" formada por `"a"` repetida 73 veces (73 bytes), When el usuario lo envía, Then se muestra "Contraseña demasiado larga" junto al campo y no se envía ninguna petición.
- **AC-011.9:** Given el formulario con una "Nueva contraseña" formada por `"ñ"` repetida 37 veces (37 caracteres, 74 bytes), When el usuario lo envía, Then se muestra "Contraseña demasiado larga" junto al campo y no se envía ninguna petición.

### REQ-012 — Límite de 3 solicitudes cada 10 minutos por IP
IF se solicita un restablecimiento desde una dirección IP de cliente que ya tiene 3 solicitudes aceptadas en los últimos 10 minutos THEN THE SYSTEM SHALL rechazar la solicitud con el código `429` y el cuerpo `{"error": "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."}`, sin enviar ningún correo, sin generar un enlace nuevo y sin consumir el límite por correo de REQ-004 (Q15). El límite cuenta las solicitudes aceptadas desde esa IP para cualquier correo, exista o no la cuenta, y se aplica además del límite por correo.

- **AC-012.1:** Given 3 solicitudes aceptadas en los últimos 10 minutos desde la IP `203.0.113.10` para tres correos distintos, When desde esa IP se solicita el restablecimiento para un cuarto correo `luis@example.com` de una cuenta con contraseña, Then la respuesta es `429` con `{"error": "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."}` y no se envía ningún correo.
- **AC-012.2:** Given 2 solicitudes aceptadas en los últimos 10 minutos desde la IP `203.0.113.10`, When desde esa IP se solicita el restablecimiento para otra cuenta con contraseña, Then la respuesta es `200` y se envía el correo.
- **AC-012.3:** Given 3 solicitudes aceptadas desde la IP `203.0.113.10`, la más antigua hace exactamente 10 minutos y las otras dos hace menos, When desde esa IP se solicita el restablecimiento para otra cuenta con contraseña, Then la respuesta es `200` y se envía el correo.
- **AC-012.4:** Given la IP `203.0.113.10` en el límite (como en AC-012.1), When desde la IP `198.51.100.20` se solicita el restablecimiento para una cuenta con contraseña, Then la respuesta es `200` y se envía el correo (el límite es independiente por IP).
- **AC-012.5:** Given 3 solicitudes aceptadas en los últimos 10 minutos desde una IP, todas para correos sin cuenta, When desde esa IP se solicita el restablecimiento para una cuenta con contraseña, Then la respuesta es `429` con el mismo cuerpo que AC-012.1 y no se envía ningún correo.
- **AC-012.6:** Given desde una IP, en los últimos 10 minutos, 3 solicitudes rechazadas con `400` (correo inválido), 3 rechazadas con `429` por el límite por correo y 3 fallidas con `503`, y ninguna aceptada, When desde esa IP se solicita el restablecimiento para otra cuenta con contraseña, Then la respuesta es `200` y se envía el correo (solo cuentan las solicitudes aceptadas).
- **AC-012.7:** Given la situación de AC-012.1, When justo después se solicita el restablecimiento para `luis@example.com` desde la IP `198.51.100.20`, Then la respuesta es `200` y se envía el correo (la solicitud rechazada por IP no consume el límite por correo).
- **AC-012.8:** Given la IP `203.0.113.10` en el límite y una solicitud aceptada para `ana@example.com` hace 1 minuto desde otra IP, When desde `203.0.113.10` se solicita el restablecimiento para `ana@example.com`, Then la respuesta es `429` con el cuerpo de AC-012.1 (prevalece el límite por IP).
- **AC-012.9:** Given dos clientes con IPs distintas cuyas peticiones llegan a la app a través del mismo proxy inverso de producción, When el primero alcanza el límite de 3 solicitudes, Then el segundo sigue obteniendo `200` (se cuenta la IP del cliente original, no la del proxy).

## 5. Requisitos no funcionales

### NFR-001 — No exponer el token ni detalles internos
THE SYSTEM SHALL NOT incluir el token de restablecimiento en ninguna respuesta HTTP, ni detalles internos de fallos del servicio de correo en las respuestas de error.

- **AC-N001.1:** Given una solicitud aceptada para una cuenta con contraseña, When se inspecciona la respuesta `200`, Then su cuerpo es exactamente `{"message": "Si el correo pertenece a una cuenta con contraseña, recibirás un enlace para restablecerla."}` y no contiene el token enviado por correo.
- **AC-N001.2:** Given un servicio de correo que falla con un error cuyo mensaje contiene un texto identificable, When se solicita el restablecimiento, Then el cuerpo de la respuesta `503` no contiene ese texto.

### NFR-002 — Tokens impredecibles
THE SYSTEM SHALL generar cada token de restablecimiento de forma aleatoria e impredecible, distinto en cada emisión.

- **AC-N002.1:** Given dos solicitudes aceptadas para la misma cuenta separadas por 2 minutos, When se comparan los tokens de los dos correos, Then son distintos y cada uno tiene al menos 32 caracteres.

### NFR-003 — Contraseña almacenada de forma segura
THE SYSTEM SHALL guardar la contraseña nueva con el mismo mecanismo de hash que el registro, nunca en claro.

- **AC-N003.1:** Given un restablecimiento con éxito con la contraseña `NuevaClave123`, When se lee la contraseña guardada de la cuenta, Then no es igual a `NuevaClave123` y permite el login con esa contraseña (AC-007.2).

## 6. Datos y contratos visibles

### Endpoint `POST /api/auth/forgot-password` (público)

Cuerpo de la petición: `{"email": "<correo>"}`.

| Situación | Código | Cuerpo JSON |
|---|---|---|
| Correo válido (con cuenta con contraseña, sin cuenta o con cuenta solo de Google), fuera del límite de 2 minutos por correo y del límite por IP | `200` | `{"message": "Si el correo pertenece a una cuenta con contraseña, recibirás un enlace para restablecerla."}` |
| Correo ausente, vacío o con formato inválido | `400` | `{"error": "Email inválido"}` |
| La IP del cliente ya tiene 3 solicitudes aceptadas en los últimos 10 minutos | `429` | `{"error": "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."}` |
| Solicitud para el mismo correo hace menos de 2 minutos (y la IP no está en su límite) | `429` | `{"error": "Ya se envió un enlace hace menos de 2 minutos. Inténtalo de nuevo más tarde."}` |
| Fallo al enviar el correo | `503` | `{"error": "No se pudo enviar el correo. Inténtalo de nuevo más tarde."}` |

### Endpoint `POST /api/auth/reset-password` (público)

Cuerpo de la petición: `{"token": "<token del enlace>", "password": "<contraseña nueva>"}`.

| Situación | Código | Cuerpo JSON |
|---|---|---|
| Token vigente y contraseña válida | `200` | `{"message": "Contraseña actualizada"}` |
| Token ausente, inexistente, caducado, ya usado o sustituido por uno más reciente | `400` | `{"error": "El enlace no es válido o ha caducado. Solicita uno nuevo."}` |
| Contraseña ausente o de menos de 8 caracteres | `400` | `{"error": "La contraseña debe tener al menos 8 caracteres"}` |
| Contraseña que ocupa más de 72 bytes en UTF-8 | `400` | `{"error": "La contraseña es demasiado larga"}` |

Si el token no es válido y además la contraseña tampoco, prevalece el error del token.

### Reglas

- **Correo:** se ignoran los espacios al principio y al final; la comparación con las cuentas existentes es la misma que usa hoy el login.
- **Límite por correo:** 1 solicitud aceptada cada 2 minutos por dirección de correo. Una solicitud rechazada (`400`, `429`) o fallida (`503`) no reinicia ni consume el límite.
- **Límite por IP (Q15):** como mucho 3 solicitudes aceptadas en cualquier intervalo de 10 minutos desde la misma IP de cliente, para cualquier correo. Una solicitud deja de contar cuando han pasado 10 minutos desde que se aceptó. Las rechazadas (`400`, `429`) o fallidas (`503`) no cuentan. La IP es la del cliente original, aunque la petición pase por el proxy inverso de producción. Se aplica además del límite por correo; si se superan los dos, prevalece el error del límite por IP. El frontend muestra el texto del campo `error` igual que en el resto de los `429` (AC-010.2).
- **Orden de comprobación:** primero la validación del correo (`400`), después el límite por IP, después el límite por correo y, por último, el envío (`503` si falla).
- **Caducidad:** el enlace es válido mientras hayan pasado menos de 5 minutos desde su emisión.
- **Vigencia única:** como mucho hay un enlace válido por cuenta; emitir uno nuevo invalida los anteriores, y usarlo con éxito lo invalida.
- **Contraseña nueva:** mínimo 8 caracteres (igual que el registro) y máximo 72 bytes en UTF-8 (Q13), validado en el frontend y en el backend. Un carácter sin tilde ni símbolos ocupa 1 byte, las letras con tilde y la ñ 2, y los emojis hasta 4; por eso una contraseña con esos caracteres puede superar el máximo con menos de 72 caracteres. El registro no cambia en esta feature.

### Correo de restablecimiento

- En español.
- Remitente: `no-reply@fitnerd.betofallas.dev`, con el nombre "fitnerd" (Q1).
- Asunto: "Restablece tu contraseña de fitnerd".
- Contiene el enlace `https://fitnerd.betofallas.dev/reset-password?token=<token>` (la URL base es la de la app pública de cada entorno).
- Indica que el enlace caduca a los 5 minutos y que, si el usuario no pidió el cambio, puede ignorar el correo.

### Rutas del frontend (públicas)

| Ruta | Contenido |
|---|---|
| `/forgot-password` | Campo "Email", botón "Enviar enlace" ("Enviando..." en curso), enlace "Volver al login". |
| `/reset-password?token=<token>` | Campos "Nueva contraseña" y "Confirmar contraseña", botón "Guardar contraseña" ("Guardando..." en curso). |
| `/login` | Nuevo enlace "¿Olvidaste tu contraseña?" y, tras un restablecimiento con éxito, el aviso "Contraseña actualizada. Ya puedes iniciar sesión." |

Mensajes de validación del frontend: "Email inválido", "Mínimo 8 caracteres", "Contraseña demasiado larga", "Las contraseñas no coinciden".

## 7. Preguntas abiertas

Q1–Q14 están **resueltas** (usuario, 2026-10-05) e incorporadas a la spec. Q5 eliminó el máximo, Q12 lo recuperó y Q13 lo fija en 72 **bytes** (no caracteres): la contraseña nueva tiene un mínimo de 8 caracteres y un máximo de 72 bytes en UTF-8 (REQ-009, AC-009.5 a AC-009.9, AC-011.8 y AC-011.9). Q14 sustituye los mensajes de ese máximo por otros genéricos que no mencionan bytes: "La contraseña es demasiado larga" (`400`) y "Contraseña demasiado larga" (frontend). Q9 se mantiene como se propuso; la comparación de mayúsculas en el correo queda para otra feature. Q15 (reapertura desde el gate de plan) también está **resuelta**: se añade un límite de 3 solicitudes aceptadas cada 10 minutos por IP, además del límite de 1 cada 2 minutos por correo (REQ-012). No quedan preguntas abiertas.

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | La app no envía correos hoy. ¿Con qué servicio y remitente se envían? Hace falta una cuenta en un proveedor de correo transaccional y, normalmente, verificar el dominio. **Propuesta:** un proveedor de correo transaccional que se elegirá en el plan, con el remitente `no-reply@fitnerd.betofallas.dev` y el nombre "fitnerd". Los tests usan un servicio de correo falso. | Acepto todas las propuestas (usuario, 2026-10-05). |
| Q2 | Para no revelar qué correos están registrados, ¿la respuesta debe ser la misma exista o no la cuenta? **Propuesta:** sí; siempre `200` con el mensaje genérico (REQ-003), y el límite de 2 minutos se aplica por correo aunque no exista la cuenta (AC-004.4). | Acepto todas las propuestas (usuario, 2026-10-05). |
| Q3 | ¿Qué pasa con las cuentas creadas solo con Google (sin contraseña)? **Propuesta:** no reciben correo y ven la misma respuesta genérica; crear una contraseña para ellas queda fuera de alcance. Las cuentas con contraseña que también están vinculadas a Google sí pueden restablecerla (AC-002.4). | Acepto todas las propuestas (usuario, 2026-10-05). |
| Q4 | ¿El enlace es de un solo uso? La idea no lo dice. **Propuesta:** sí; tras usarse con éxito deja de ser válido (AC-007.3). Un intento rechazado por una contraseña inválida no lo consume (AC-009.2). | Acepto todas las propuestas (usuario, 2026-10-05). |
| Q5 | ¿Qué reglas tiene la contraseña nueva? Hoy el backend no valida la longitud y el frontend exige un mínimo de 8 en el registro. **Propuesta:** de 8 a 72 caracteres (72 es el máximo que admite el hash actual), validado en backend y frontend, solo en este flujo; el registro no cambia. | "el nuevo password debe cumplir exactamente con las mismas reglas que se consideran a la hora de hacer un registro." Luego: "Q5 opción ii" = las mismas reglas que el registro (mínimo 8 caracteres), validadas también en el backend (en el servicio de reset), sin tocar el registro. **Resuelta:** incorporada en REQ-009 y en la sección 6 (mínimo 8, sin máximo). |
| Q6 | Tras restablecer, ¿se inicia sesión automáticamente o se vuelve al login? **Propuesta:** se vuelve a `/login` con el aviso "Contraseña actualizada. Ya puedes iniciar sesión." (REQ-011). | Acepto todas las propuestas (usuario, 2026-10-05). |
| Q7 | Las sesiones ya abiertas (tokens emitidos antes del cambio) ¿deben cerrarse al cambiar la contraseña? **Propuesta:** no en esta feature; siguen siendo válidas hasta su caducidad normal. Queda fuera de alcance. | Acepto todas las propuestas (usuario, 2026-10-05). |
| Q8 | Si falla el envío del correo, ¿qué ve el usuario? **Propuesta:** `503` con "No se pudo enviar el correo. Inténtalo de nuevo más tarde.", sin consumir el límite de 2 minutos (REQ-006). Implica que, solo ante un fallo del proveedor, se distingue una cuenta con contraseña de una inexistente; se acepta ese riesgo a cambio de avisar al usuario. | Acepto todas las propuestas (usuario, 2026-10-05). |
| Q9 | El login compara hoy el correo de forma exacta (distingue mayúsculas). ¿Este flujo debe ignorar mayúsculas y minúsculas? **Propuesta:** no; se quitan los espacios de los extremos y se compara igual que el login, para ser coherentes. Cambiar la comparación en toda la app sería otra feature. | "Q9 opción a" = mantener la propuesta: comparar igual que el login (exacta, quitando espacios de los extremos). "Despues yo reviso en otra sesion lo de las mayusculas en el correo a la hora de hacer un registro. Lo bueno, acabo de ver la base de datos y no tenemos ningun caso donde alguien se registrara usando mayusculas en el correo." |
| Q10 | ¿La página `/reset-password` debe comprobar si el enlace es válido al abrirse, antes de que el usuario escriba la contraseña? **Propuesta:** no; el error se muestra al enviar el formulario (AC-011.5), salvo que falte el token en la URL (AC-011.6). | Acepto todas las propuestas (usuario, 2026-10-05). |
| Q11 | ¿Se aplica algún tratamiento a las cuentas desactivadas? El modelo de usuario tiene un indicador de cuenta activa, pero el login actual no lo comprueba. **Propuesta:** se tratan igual que en el login (sin comprobación adicional). | Acepto todas las propuestas (usuario, 2026-10-05). |
| Q12 | (Gate de spec, orquestador) El backend usa bcrypt 5.0.0, que lanza ValueError con contraseñas de más de 72 bytes; sin máximo, una contraseña muy larga daría un 500 en el reset. **Propuesta (A):** añadir la regla "más de 72 → 400 con un mensaje claro". | "1. A, no pasa nada. Pongamos la regla de minimo 8 caracteres y hasta 72 caracteres. Despues yo lo arreglo en otra sesion en la parte de register para que queden alineados." (usuario, 2026-10-05) **Resuelta:** incorporada en REQ-009 (AC-009.5 a AC-009.7), AC-011.8 y la sección 6, con el mensaje `400` "La contraseña no puede tener más de 72 caracteres" y, en el frontend, "Máximo 72 caracteres". |
| Q13 | El límite real del hash es de 72 **bytes**, no de 72 caracteres: las letras con tilde, la ñ o los emojis ocupan 2 a 4 bytes, así que una contraseña como "contraseñaÁrbol…" de menos de 72 caracteres puede superar el límite y daría un error 500. ¿Cómo se trata? **Propuesta:** el máximo visible es "72 caracteres", pero el backend rechaza también las que superan el tamaño real admitido con el mismo `400` "La contraseña no puede tener más de 72 caracteres" (nunca un 500), aunque tengan menos de 72 caracteres. El frontend solo comprueba los 72 caracteres; el caso raro de caracteres especiales lo muestra el error del backend (AC-011.5). Es un caso poco frecuente. | "que sean 72 bytes, no caracteres" (usuario, 2026-10-05) **Resuelta:** el máximo es de 72 bytes en UTF-8, validado igual en backend y frontend (REQ-009, AC-009.5 a AC-009.9, AC-011.8, AC-011.9 y sección 6). Los mensajes pasan a "La contraseña no puede ocupar más de 72 bytes (las tildes, la ñ y los emojis cuentan más de uno)" (`400`) y "Máximo 72 bytes (las tildes, la ñ y los emojis cuentan más de uno)" (frontend). Nunca da un `5xx`. |
| Q14 | (Gate de spec, orquestador) Los mensajes de error del máximo de 72 bytes (backend y frontend) mencionan "bytes" y son poco amigables. ¿Se simplifican? | "Con respecto a los dos mensajes de 72 bytes, tienes razon, eso no es amigable con el usuario, mejor mantener eltono que sugieres, algo mas generico sin dar tanto detalle. "La contrasena es demasiado larga" O algo parecido." (usuario, 2026-10-05) **Resuelta:** el mensaje `400` del backend pasa a "La contraseña es demasiado larga" (REQ-009, AC-009.5, AC-009.8 y sección 6) y el de validación del frontend a "Contraseña demasiado larga" (AC-011.8, AC-011.9 y sección 6), en la línea de "Mínimo 8 caracteres". La regla no cambia: máximo de 72 bytes en UTF-8, nunca `5xx`. Los mensajes citados en Q12 y Q13 quedan sustituidos. |
| Q15 | (Gate de plan, orquestador; reabre la spec) El límite de REQ-004 es solo por correo: un bot puede enviar solicitudes para miles de correos distintos desde una misma IP. ¿Se añade un límite por IP? ¿Solo por IP o por IP y por correo? ¿Con qué cuota? | "el 3 si, porque un script o bot malicioso puede generar problemas graves a futuro. [...] el 3 si es necesario regresar y replantear que la regla de solicitudes cada 2 minutos se aplique para la ip y no para el email como tal." Tras aclarar opciones: "1. Por IP y por correo. 2. Dejemolo en un punto intermedio; 3 solicitudes cada 10 minutos." (usuario, 2026-10-05) **Resuelta:** se aplican los dos límites. El límite por correo de REQ-004 no cambia (1 solicitud aceptada cada 2 minutos) y se añade REQ-012: como mucho 3 solicitudes aceptadas cada 10 minutos por IP de cliente, para cualquier correo, con `429` y `{"error": "Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde."}` (AC-012.1 a AC-012.9 y sección 6). Detalles fijados por el spec-writer en la línea de las reglas ya aprobadas: solo cuentan las solicitudes aceptadas (`200`), igual que en el límite por correo; la ventana es móvil y una solicitud deja de contar a los 10 minutos exactos; una solicitud rechazada por IP no consume el límite por correo; si se superan los dos límites, prevalece el de IP; se cuenta la IP del cliente original aunque pase por el proxy. El límite por IP de `reset-password` y del login queda fuera de alcance. |

## 8. Glosario

- **Cuenta con contraseña:** cuenta registrada con correo y contraseña, aunque después se haya vinculado a Google.
- **Cuenta solo de Google:** cuenta creada con Google Sign-In que no tiene contraseña.
- **Enlace (o token) de restablecimiento:** URL enviada por correo que permite fijar una contraseña nueva una sola vez, durante 5 minutos.
- **Solicitud aceptada:** solicitud de restablecimiento que obtiene `200` (se haya enviado correo o no, según REQ-002 y REQ-003).
- **IP del cliente:** dirección IP del dispositivo que hace la petición, no la del proxy inverso que la reenvía a la app.
