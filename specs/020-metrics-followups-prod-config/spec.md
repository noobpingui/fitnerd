# Spec 020 — Seguimiento de métricas corporales y configuración de producción

- **Feature:** `020-metrics-followups-prod-config` · **Tipo:** feature
- **Ámbitos:** backend, frontend

## 1. Contexto y problema

Esta feature recoge puntos pendientes del backlog de las specs 016 (mediciones con fecha pasada), 018 y 002 (recuperación de contraseña). Hay dos bloques independientes.

**(A) Métricas corporales.** Desde la spec 016, tras registrar una medición (desde el diálogo «Registrar medición» de Métricas o desde «Datos físicos» del perfil), la app vuelve a leer las mediciones y el perfil para mostrar el peso sincronizado. Quedan cuatro huecos:

- **Relectura fallida.** Si el registro se guarda pero la relectura falla, el usuario no recibe ninguna explicación. En Métricas, la página puede mostrar un error técnico y ocultar el botón «Registrar medición», aunque la medición sí se guardó. En el perfil, aparece «Cambios guardados» aunque el aviso de la medición posterior a hoy (spec 016, REQ-009) nunca se llegue a mostrar, porque la app no tiene los datos actualizados. No hay forma de reintentar sin recargar la página.
- **Historial plegado.** El Historial muestra 10 filas y un botón «Mostrar más». Si el usuario registra una medición de una fecha antigua, la fila nueva puede quedar oculta tras «Mostrar más», y no ve lo que acaba de guardar.
- **Sincronización del peso sin prueba de extremo a extremo.** Los tests de la página comprueban el peso que devuelve una lectura del perfil simulada con un valor fijo, no el que resulta de la regla del servidor (spec 016, REQ-006). Ningún test recorre «registrar desde la app → el servidor sincroniza → la app muestra el peso sincronizado».
- **Fechas en los tests de rutas.** Los tests de rutas del backend usan la fecha real del servidor. Los límites de fecha (un año hacia atrás en mediciones, edad de 14 a 100 años en el registro) solo se pueden probar con fechas relativas, y algunos pueden fallar justo al cruzar la medianoche UTC.

**(B) Configuración de producción.**

- **`FRONTEND_BASE_URL`.** En producción, si falta esa variable en el `.env` de EC2, el backend arranca con el valor de desarrollo `http://localhost:5173`. Los correos de recuperación de contraseña llevan entonces enlaces a `localhost` y nadie lo nota hasta que un usuario lo prueba.
- **Correo real sin probar.** El envío por Resend se ha probado por piezas (el transporte con una red simulada), pero ningún test arranca la app configurada como en producción (`MAIL_BACKEND=resend`) y comprueba que una solicitud de restablecimiento acaba en una petición a la API de Resend con el enlace correcto.

## 2. Historia de usuario

Como **usuario que registra sus mediciones**, quiero **ver siempre la medición que acabo de guardar y saber si la pantalla no se pudo actualizar** para **confiar en que mis datos y mi peso del perfil son los correctos**.

Como **responsable del despliegue**, quiero **que el backend no arranque en producción con una configuración de enlaces incorrecta y que el envío real de correos esté cubierto por tests** para **no descubrir los fallos cuando un usuario intenta recuperar su contraseña**.

## 3. Alcance

**Incluye:**
- Aviso con «Reintentar» si falla la relectura tras registrar una medición desde Métricas (REQ-001).
- Aviso con «Reintentar» si falla la relectura tras guardar un cambio de peso o composición desde «Datos físicos» (REQ-002).
- Desplegar el Historial hasta la medición recién registrada desde Métricas (REQ-003).
- Una prueba de la sincronización del peso del perfil en la que el peso mostrado sale de la regla del servidor, no de un valor fijo (REQ-004).
- Poder fijar la fecha y la hora actuales del servidor en la configuración de pruebas, para probar los límites de fecha de las rutas con fechas absolutas (REQ-005, NFR-001). Los tests de rutas existentes de los límites de fecha de las mediciones (spec 016) y de la edad en el registro (spec 018) pasan a usar un instante fijado y fechas absolutas; los demás tests no cambian (Q5).
- Exigir `FRONTEND_BASE_URL` en producción y no arrancar si falta o no es válida (REQ-006).
- Cubrir con tests la app configurada para enviar correos por Resend, de la configuración a la petición HTTP (REQ-007).

**Fuera de alcance:**
- Avisos de relectura fallida tras **corregir** o **borrar** una medición (ver Q1).
- La carga inicial de Métricas o del perfil: sus errores siguen como hoy.
- Desplazar la pantalla hasta la fila nueva del Historial o resaltarla (ver Q3).
- Cambiar la regla de sincronización del peso del perfil (spec 016, REQ-006) o cualquier cálculo de indicadores.
- Una herramienta de pruebas en navegador real (ver Q4).
- Exigir `RESEND_API_KEY` al arrancar en producción (ver Q7). Sin clave, el envío sigue fallando con 503, como hoy.
- Cambiar las configuraciones de desarrollo y de pruebas de `FRONTEND_BASE_URL`.
- Unificar o reorganizar el código del reloj de los servicios más allá de lo que pida REQ-005.
- Datos existentes: no cambia ningún dato guardado ni el esquema de la base.

## 4. Requisitos funcionales

> **Convenciones de esta sección.**
> - «Hoy» es la fecha del dispositivo; en los AC del frontend es el lunes 12 de octubre de 2026. En los AC del backend, el instante actual del servidor es el 2026-10-12 a las 12:00 UTC, salvo que se diga otra cosa.
> - «Relectura» es la nueva lectura de la lista de mediciones y del perfil que la app hace tras registrar una medición (spec 016, REQ-008).
> - «El aviso de relectura» es el texto de la sección 6 con su botón «Reintentar».
> - Pesos en kg salvo que se diga otra cosa; formatos de fecha y número como en la spec 016.

### REQ-001 — Aviso y reintento si falla la relectura tras registrar desde Métricas

IF el registro de una medición desde el diálogo «Registrar medición» termina con éxito pero falla la relectura de las mediciones o del perfil THEN THE SYSTEM SHALL cerrar el diálogo, seguir mostrando los datos que la página ya tenía (incluido el botón «Registrar medición»), y mostrar en `/body-metrics`, bajo el botón «Registrar medición», el aviso «Guardamos tu medición, pero no pudimos actualizar los datos de la pantalla.» con el botón «Reintentar». El aviso no desaparece solo con el paso del tiempo. Al pulsar «Reintentar», la app vuelve a leer las mediciones y el perfil; si lo consigue, el aviso desaparece y la página muestra los datos actualizados; si vuelve a fallar, el aviso sigue visible.

- **AC-001.1:** Given mediciones del 2026-10-11 y del 2026-10-01, y un servidor que acepta el registro pero responde con error a la siguiente lectura de mediciones, When el usuario registra desde el diálogo una medición del 2026-10-05 con peso 80, Then el diálogo se cierra, se ve el aviso «Guardamos tu medición, pero no pudimos actualizar los datos de la pantalla.» con el botón «Reintentar», y no se ve «No se pudo guardar la medición. Inténtalo de nuevo.».
- **AC-001.2:** Given el caso de AC-001.1, When el usuario mira la página, Then sigue viendo el Historial con las filas del 2026-10-11 y del 2026-10-01, los indicadores y el botón «Registrar medición».
- **AC-001.3:** Given el caso de AC-001.1 y un servidor que ya responde bien, When el usuario pulsa «Reintentar», Then el aviso desaparece y el Historial muestra las filas del 2026-10-11, 2026-10-05 y 2026-10-01.
- **AC-001.4:** Given el caso de AC-001.1 y un servidor que sigue respondiendo con error a la lectura de mediciones, When el usuario pulsa «Reintentar», Then el aviso sigue visible y la página sigue mostrando los datos anteriores.
- **AC-001.5:** Given un servidor que acepta el registro y la relectura de mediciones, pero responde con error a la relectura del perfil, When el usuario registra una medición desde el diálogo, Then se ve el aviso de relectura con el botón «Reintentar».
- **AC-001.6:** Given el aviso de relectura visible, When se busca por rol, Then el aviso tiene el rol `alert` y el botón «Reintentar» se encuentra por su nombre accesible «Reintentar».
- **AC-001.7:** Given un registro cuyas relecturas terminan con éxito, When el diálogo se cierra, Then no se ve el aviso de relectura.
- **AC-001.8:** Given el aviso de relectura visible en Métricas, When pasan 60 segundos sin que el usuario haga nada, Then el aviso sigue visible.
- **AC-001.9:** Given el aviso de relectura visible en Métricas, When se examina el orden del documento, Then el aviso aparece después del botón «Registrar medición» y antes del Historial.

### REQ-002 — Aviso y reintento si falla la relectura tras guardar desde «Datos físicos»

IF al guardar desde «Datos físicos» del perfil un cambio de peso o composición, el perfil y la medición de hoy se guardan con éxito pero falla la relectura de las mediciones o del perfil THEN THE SYSTEM SHALL mostrar junto al botón «Guardar cambios», en el lugar donde aparece «Cambios guardados» y en lugar de ese texto y del aviso de la medición posterior a hoy (spec 016, REQ-009), el aviso «Guardamos tus cambios, pero no pudimos actualizar los datos de la pantalla.» con el botón «Reintentar», que no desaparece solo con el paso del tiempo, y dejar el formulario sin cambios pendientes, con los valores escritos. Al pulsar «Reintentar», la app vuelve a leer las mediciones y el perfil; si lo consigue, el aviso desaparece y se muestra lo que habría mostrado sin el fallo: el aviso de la spec 016, REQ-009 (con el peso del perfil en el campo «Peso») si hay una medición de peso de fecha posterior a hoy, o «Cambios guardados» si no la hay. Si vuelve a fallar, el aviso sigue visible.

- **AC-002.1:** Given un perfil en kg con peso 80 y un servidor que acepta el perfil y la medición pero responde con error a la siguiente lectura de mediciones, When el usuario cambia el peso a 79 y pulsa «Guardar cambios», Then ve «Guardamos tus cambios, pero no pudimos actualizar los datos de la pantalla.» con el botón «Reintentar», y no ve «Cambios guardados» ni «No se pudo guardar la medición. Inténtalo de nuevo.».
- **AC-002.2:** Given el caso de AC-002.1, When el usuario mira el formulario, Then el campo «Peso» muestra 79, «Guardar cambios» está deshabilitado y no hay botón «Descartar».
- **AC-002.3:** Given el caso de AC-002.1, una medición del 2026-10-13 con peso 80 y un perfil que el servidor devuelve con peso 80, When el usuario pulsa «Reintentar» y la relectura termina con éxito, Then el aviso de relectura desaparece, el campo «Peso» muestra 80 y se ve el aviso «Guardamos tu medición de hoy, pero tu peso del perfil es el de tu medición más reciente, del {fecha}. Puedes corregirla o borrarla en Métricas.» con la fecha del 2026-10-13.
- **AC-002.4:** Given el caso de AC-002.1, sin mediciones de fecha posterior a hoy y un perfil que el servidor devuelve con peso 79, When el usuario pulsa «Reintentar» y la relectura termina con éxito, Then el aviso de relectura desaparece y se ve «Cambios guardados».
- **AC-002.5:** Given el caso de AC-002.1 y un servidor que sigue respondiendo con error, When el usuario pulsa «Reintentar», Then el aviso de relectura sigue visible y no se ve «Cambios guardados».
- **AC-002.6:** Given el caso de AC-002.1, When el usuario pulsa «Reintentar», Then el servidor no recibe ningún registro de medición nuevo ni ningún guardado de perfil nuevo.
- **AC-002.7:** Given el aviso de relectura visible en el perfil, When se busca por rol, Then el aviso tiene el rol `alert` y el botón «Reintentar» se encuentra por su nombre accesible.
- **AC-002.8:** Given un servidor que acepta el perfil y la medición y responde con error a la relectura del perfil (las mediciones se leen bien), When el usuario cambia el peso a 79 y guarda, Then ve el aviso de relectura con el botón «Reintentar».
- **AC-002.9:** Given un cambio solo de nivel de actividad o de meta (sin cambio de peso ni de composición), When el usuario guarda con éxito, Then ve «Cambios guardados», como hoy, y no ve el aviso de relectura.
- **AC-002.10:** Given el aviso de relectura visible en el perfil, When pasan 60 segundos sin que el usuario haga nada, Then el aviso sigue visible.

### REQ-003 — El Historial se despliega hasta la medición recién registrada

WHEN el usuario registra con éxito una medición desde el diálogo «Registrar medición» THE SYSTEM SHALL desplegar el Historial en bloques de 10 filas, como «Mostrar más», hasta que la fila de la fecha registrada sea visible. Si ya lo es, el número de filas visibles no cambia: el Historial nunca se pliega por un registro.

- **AC-003.1:** Given 25 mediciones, una por día del 2026-10-11 al 2026-09-17, y el Historial con 10 filas visibles, When el usuario registra una medición del 2026-09-01, Then el Historial muestra las 26 filas, la última es la del 2026-09-01 y no se ve «Mostrar más».
- **AC-003.2:** Given 35 mediciones, una por día del 2026-10-11 al 2026-09-07, y el Historial con 10 filas visibles, When el usuario registra una medición del 2026-09-25 (que actualiza la de ese día), Then el Historial muestra 20 filas, incluida la del 2026-09-25, y sigue viéndose «Mostrar más».
- **AC-003.3:** Given 25 mediciones, una por día del 2026-10-11 al 2026-09-17, y el Historial con 10 filas visibles, When el usuario registra una medición del 2026-10-12, Then el Historial sigue mostrando 10 filas, la primera es la del 2026-10-12 y se ve «Mostrar más».
- **AC-003.4:** Given 25 mediciones, una por día del 2026-10-11 al 2026-09-17, y el Historial desplegado con 25 filas visibles, When el usuario registra una medición del 2026-10-12, Then el Historial muestra las 26 filas (no se pliega).
- **AC-003.5:** Given el caso de AC-003.1 y un registro que falla, When termina, Then el Historial sigue con 10 filas visibles.

### REQ-004 — Prueba de extremo a extremo de la sincronización del peso del perfil

WHEN el usuario registra una medición con peso desde la app THE SYSTEM SHALL mostrar en el perfil y en el home el peso que resulta de aplicar en el servidor la regla de la spec 016, REQ-006, sobre las mediciones guardadas, y esto **DEBE** comprobarse con pruebas en las que el peso mostrado no esté fijado de antemano en la respuesta simulada, sino que dependa de las mediciones registradas durante la propia prueba.

- **AC-004.1:** Given un perfil en kg con peso 78 y una única medición del 2026-10-01 con peso 78, guardados en un servidor de prueba con estado que aplica la regla de sincronización, When el usuario registra desde Métricas una medición del 2026-10-05 con peso 77 y va a `/profile`, Then el campo «Peso» de «Datos físicos» muestra 77, y en `/home` «Peso actual» muestra «77 kg».
- **AC-004.2:** Given el mismo servidor de prueba con un perfil en kg con peso 78 y una medición del 2026-10-11 con peso 78, When el usuario registra desde Métricas una medición del 2026-10-05 con peso 80 y va a `/profile`, Then el campo «Peso» sigue mostrando 78.
- **AC-004.3:** Given el mismo servidor de prueba con un perfil en lb y una única medición del 2026-10-01 con peso 78 kg, When el usuario registra desde Métricas una medición del 2026-10-05 de 162 lb (equivale exactamente a 73,5 kg, y 73,5 kg vuelve a ser 162,0 lb) y va a `/profile`, Then el campo «Peso» muestra 162 y la unidad es lb.
- **AC-004.4:** Given un usuario real en el servidor de pruebas del backend con perfil en kg (peso 78) y una medición del 2026-10-01 con peso 78, When en la misma prueba registra por la API una medición del 2026-10-05 con peso 77, después una del 2026-10-03 con peso 76 y lee su perfil tras cada registro, Then el perfil devuelve `weight: 77` en ambas lecturas.

### REQ-005 — Fecha y hora fijables en la configuración de pruebas

WHERE la app se ejecuta con la configuración de pruebas y una prueba fija el instante actual THE SYSTEM SHALL usar ese instante, en lugar del reloj real, en todas las reglas del servidor que dependen de la fecha o la hora actuales: la fecha por defecto y los límites de fecha de las mediciones, la edad en el registro y en el perfil, la fecha de completado del onboarding, el «hoy» del análisis con IA y los plazos del restablecimiento de contraseña. El instante fijado no avanza solo: es el mismo durante toda la prueba hasta que la prueba lo cambie. Si la prueba no lo fija, se usa el reloj real.

- **AC-005.1:** Given la configuración de pruebas con el instante fijado en 2026-10-12 12:00 UTC, When un usuario registra por la API una medición sin `recorded_at`, Then la respuesta tiene `recorded_at: "2026-10-12"`.
- **AC-005.2:** Given el instante fijado en 2026-10-12 12:00 UTC, When un usuario registra por la API una medición con `recorded_at: "2025-10-11"`, Then responde `201`; y con `recorded_at: "2025-10-10"`, responde `400` con «La fecha de la medición no puede tener más de un año de antigüedad».
- **AC-005.3:** Given el instante fijado en 2026-10-12 12:00 UTC, When un usuario registra por la API una medición con `recorded_at: "2026-10-13"`, Then responde `201`; y con `recorded_at: "2026-10-14"`, responde `400` con «La fecha de la medición no puede ser futura».
- **AC-005.4:** Given el instante fijado en 2026-10-12 12:00 UTC, When se envía a `/api/auth/register` un registro por lo demás válido con `date_of_birth: "2012-10-12"`, Then responde `201`; y con `date_of_birth: "2012-10-13"`, responde `400` con `{"error": "Debes tener entre 14 y 100 años"}`.
- **AC-005.5:** Given el instante fijado en 2026-10-12 23:59 UTC, When un usuario registra por la API una medición sin `recorded_at`, Then la respuesta tiene `recorded_at: "2026-10-12"`; y con el instante fijado en 2026-10-13 00:00 UTC, tiene `recorded_at: "2026-10-13"`.
- **AC-005.6:** Given la configuración de pruebas sin instante fijado, When un usuario registra por la API una medición sin `recorded_at`, Then la respuesta tiene como `recorded_at` la fecha UTC real del momento de la prueba.
- **AC-005.7:** Given el instante fijado en 2026-10-12 12:00:00 UTC y un usuario con contraseña que solicita el restablecimiento, When la prueba fija el instante en 2026-10-12 12:04:59 UTC y usa el enlace recibido con una contraseña válida, Then responde `200` con «Contraseña actualizada».
- **AC-005.8:** Given el instante fijado en 2026-10-12 12:00:00 UTC y un usuario con contraseña que solicita el restablecimiento, When la prueba fija el instante en 2026-10-12 12:05:00 UTC (fin del plazo de 5 minutos del enlace) y usa el enlace recibido con una contraseña válida, Then responde `400` con «El enlace no es válido o ha caducado. Solicita uno nuevo.».
- **AC-005.9:** Given el instante fijado en 2026-10-12 12:00 UTC, When un usuario registra por la API dos mediciones sin `recorded_at` en dos peticiones sucesivas sin que la prueba cambie el instante, Then ambas respuestas tienen `recorded_at: "2026-10-12"` y la segunda actualiza la medición de la primera (una sola medición ese día).

### REQ-006 — `FRONTEND_BASE_URL` obligatoria en producción

IF la app se arranca con la configuración de producción y `FRONTEND_BASE_URL` no está definida, está vacía o solo tiene espacios, o no empieza por `https://` THEN THE SYSTEM SHALL no arrancar y terminar con el error «FRONTEND_BASE_URL es obligatoria en producción y debe empezar por https://», sin atender ninguna petición. Con un valor válido, los enlaces de los correos se construyen con ese valor. Las configuraciones de desarrollo y de pruebas no cambian.

- **AC-006.1:** Given la configuración de producción sin la variable `FRONTEND_BASE_URL` en el entorno, When se crea la app, Then falla con el error «FRONTEND_BASE_URL es obligatoria en producción y debe empezar por https://».
- **AC-006.2:** Given la configuración de producción con `FRONTEND_BASE_URL` vacía o igual a `"   "`, When se crea la app, Then falla con el mismo error.
- **AC-006.3:** Given la configuración de producción con `FRONTEND_BASE_URL=http://localhost:5173`, When se crea la app, Then falla con el mismo error.
- **AC-006.4:** Given la configuración de producción con `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev` y el resto de variables necesarias, When se crea la app, Then arranca y su URL base del frontend es `https://fitnerd.betofallas.dev`.
- **AC-006.5:** Given la configuración de desarrollo sin la variable `FRONTEND_BASE_URL`, When se crea la app, Then arranca y su URL base del frontend es `http://localhost:5173`.
- **AC-006.6:** Given la configuración de pruebas, cualquiera que sea el valor de `FRONTEND_BASE_URL` en el entorno, When se crea la app, Then arranca y su URL base del frontend es `http://localhost:5173`.

### REQ-007 — Envío real de correos por Resend, de la configuración a la petición

WHEN la app arranca con `MAIL_BACKEND=resend` y un usuario con contraseña solicita el restablecimiento THE SYSTEM SHALL enviar el correo con una única petición `POST` a `https://api.resend.com/emails`, con la clave de `RESEND_API_KEY`, el User-Agent de fitnerd, el remitente de `MAIL_FROM` y el enlace construido con `FRONTEND_BASE_URL`. Las pruebas interceptan esa petición: ninguna llega a Resend (Art. B5.4).

- **AC-007.1:** Given la app arrancada con `MAIL_BACKEND=resend`, `RESEND_API_KEY=re_test_key`, `MAIL_FROM=fitnerd <no-reply@fitnerd.betofallas.dev>`, `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev`, un usuario con contraseña `ana@example.com` y la red interceptada respondiendo `200`, When se envía `POST /api/auth/forgot-password` con `{"email": "ana@example.com"}`, Then responde `200` con el mensaje de solicitud aceptada y se intercepta exactamente una petición `POST` a `https://api.resend.com/emails`.
- **AC-007.2:** Given el caso de AC-007.1, When se examina la petición interceptada, Then lleva la cabecera `Authorization: Bearer re_test_key`, la cabecera `User-Agent: fitnerd/1.0 (+https://fitnerd.betofallas.dev)` y un cuerpo JSON con `from` igual a `fitnerd <no-reply@fitnerd.betofallas.dev>`, `to` igual a `["ana@example.com"]`, `subject` igual a «Restablece tu contraseña de fitnerd», y un texto y un HTML que contienen un enlace que empieza por `https://fitnerd.betofallas.dev/reset-password?token=`.
- **AC-007.3:** Given el caso de AC-007.1, When se usa el token del enlace interceptado en `POST /api/auth/reset-password` con una contraseña válida, Then responde `200` con «Contraseña actualizada».
- **AC-007.4:** Given la app arrancada con `MAIL_BACKEND=resend` y la red interceptada respondiendo `403`, When se solicita el restablecimiento de un usuario con contraseña, Then responde `503` con `{"error": "No se pudo enviar el correo. Inténtalo de nuevo más tarde."}`, el log no contiene la clave y no queda ningún enlace válido para ese usuario.
- **AC-007.5:** Given la app arrancada con `MAIL_BACKEND=resend` sin `RESEND_API_KEY`, When se solicita el restablecimiento de un usuario con contraseña, Then responde `503` con el mismo mensaje y no se intercepta ninguna petición.
- **AC-007.6:** Given la app arrancada con `MAIL_BACKEND=resend`, When se solicita el restablecimiento de un correo sin cuenta, Then responde `200` con el mensaje de solicitud aceptada y no se intercepta ninguna petición.
- **AC-007.7:** Given la configuración con `MAIL_BACKEND=console`, When se solicita el restablecimiento de un usuario con contraseña, Then responde `200`, el log contiene el asunto «Restablece tu contraseña de fitnerd» y no se intercepta ninguna petición a Resend.
- **AC-007.8:** Given la configuración con `MAIL_BACKEND=pigeon`, When se crea la app, Then falla con el error «MAIL_BACKEND desconocido: pigeon».

## 5. Requisitos no funcionales

### NFR-001 — El instante actual solo se puede fijar en pruebas

THE SYSTEM SHALL usar siempre el reloj real (UTC) en las configuraciones de desarrollo y de producción; la posibilidad de fijar el instante actual (REQ-005) solo existe en la configuración de pruebas y no se puede activar con ninguna variable de entorno ni ningún dato de una petición.

- **AC-N001.1:** Given la configuración de producción (con las variables obligatorias) o la de desarrollo, When un usuario registra por la API una medición sin `recorded_at`, Then la respuesta tiene como `recorded_at` la fecha UTC real del momento de la prueba.
- **AC-N001.2:** Given la configuración de producción y una petición de registro de medición sin `recorded_at` que incluye en el cuerpo y en las cabeceras campos con una fecha u hora distintas (por ejemplo, `"now": "2020-01-01T00:00:00Z"`), When se envía, Then la medición se guarda con la fecha UTC real.

### NFR-002 — Las pruebas nuevas no llaman a servicios externos

THE SYSTEM SHALL ejecutar las pruebas de REQ-004 y REQ-007 sin llamadas reales a Resend ni a ningún otro servicio externo, y las de REQ-004 del frontend sin red real.

- **AC-N002.1:** Given la suite de pruebas del backend, When se ejecutan las pruebas de REQ-007, Then todas las peticiones a `https://api.resend.com` quedan interceptadas y ninguna sale a la red.

## 6. Datos y contratos visibles

**Textos del frontend (nuevos):**
- Aviso de relectura en Métricas (REQ-001), rol `alert`, bajo el botón «Registrar medición»: «Guardamos tu medición, pero no pudimos actualizar los datos de la pantalla.» y botón «Reintentar».
- Aviso de relectura en «Datos físicos» (REQ-002), rol `alert`, junto al botón «Guardar cambios», en el lugar de «Cambios guardados»: «Guardamos tus cambios, pero no pudimos actualizar los datos de la pantalla.» y botón «Reintentar».
- Ninguno de los dos avisos desaparece solo; desaparecen al reintentar con éxito.
- Los demás textos (diálogo de registro, «Cambios guardados», aviso de la medición posterior a hoy, «Mostrar más») no cambian (spec 016).

**Historial (REQ-003):** se despliega de 10 en 10, igual que con «Mostrar más»; no cambia el tamaño del bloque.

**Configuración del backend (contrato con quien despliega):**

| Variable | Producción | Desarrollo | Pruebas |
|---|---|---|---|
| `FRONTEND_BASE_URL` | Obligatoria; debe empezar por `https://` (en EC2: `https://fitnerd.betofallas.dev`). Si falta o no es válida, la app no arranca. | Opcional; por defecto `http://localhost:5173` | Fija, `http://localhost:5173` |
| `MAIL_BACKEND` | Sin cambios (`resend` por defecto) | Sin cambios (`console`) | Sin cambios (`memory`) |
| `RESEND_API_KEY` | Sin cambios: si falta, el restablecimiento responde 503 | — | — |

**Mensajes de arranque (los ve quien despliega, en el log del contenedor y en el fallo de la comprobación de salud del CD):**
- «FRONTEND_BASE_URL es obligatoria en producción y debe empezar por https://» (nuevo).
- «MAIL_BACKEND desconocido: {valor}» (sin cambios).

**Contrato externo con Resend (REQ-007, sin cambios):** `POST https://api.resend.com/emails`, cabeceras `Authorization: Bearer {RESEND_API_KEY}`, `Content-Type: application/json` y `User-Agent: fitnerd/1.0 (+https://fitnerd.betofallas.dev)`; cuerpo `{"from", "to": [correo], "subject", "text", "html"}`.

**Endpoints:** ninguno cambia de contrato. `POST /api/auth/forgot-password` sigue respondiendo `200` con el mensaje de solicitud aceptada o `503` con «No se pudo enviar el correo. Inténtalo de nuevo más tarde.».

**Datos existentes:** no se modifica ningún dato ni el esquema. Paso manual en producción: comprobar antes del despliegue que el `backend/.env` de EC2 tiene `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev`; si no, el contenedor no arrancará y la comprobación de `/api/health` del CD fallará.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿El aviso de relectura con «Reintentar» se aplica también al **corregir** o **borrar** una medición en el Historial, que también vuelven a leer mediciones y perfil? | No: solo al registrar (desde Métricas y desde «Datos físicos»), como dice la idea. Corregir y borrar pasan al backlog. |  Acepto las 8 propuestas |
| Q2 | ¿Textos, ubicación y comportamiento del aviso de relectura? | En Métricas, bajo el botón «Registrar medición»: «Guardamos tu medición, pero no pudimos actualizar los datos de la pantalla.» + «Reintentar». En el perfil, junto al botón «Guardar cambios», en lugar de «Cambios guardados»: «Guardamos tus cambios, pero no pudimos actualizar los datos de la pantalla.» + «Reintentar». Mientras falla, la página sigue mostrando los datos anteriores. El aviso no desaparece solo. |  Acepto las 8 propuestas |
| Q3 | Al desplegar el Historial hasta la medición nueva, ¿además se desplaza la pantalla hasta la fila o se resalta? | No: solo se despliega en bloques de 10 hasta que la fila sea visible. Desplazar o resaltar queda para el backlog. |  Acepto las 8 propuestas |
| Q4 | «Test de extremo a extremo»: ¿con un navegador real y backend levantado (por ejemplo, Playwright, que sería una dependencia nueva y cambios en CI) o sin herramientas nuevas? | Sin dependencias nuevas: en el frontend, un servidor de prueba con estado que guarda mediciones y perfil y aplica la regla de sincronización, de modo que el peso mostrado depende de lo registrado en la prueba (AC-004.1 a AC-004.3); en el backend, una prueba de rutas que encadena registros y lecturas del perfil (AC-004.4). Las pruebas en navegador real pasan al backlog. |  Acepto las 8 propuestas |
| Q5 | ¿Qué reglas usan el instante fijado y qué tests existentes se pasan a fechas absolutas? | Todas las reglas del servidor que dependen de la fecha o la hora (REQ-005). El instante es fijo durante la prueba (no avanza solo). Se pasan a fechas absolutas los tests de rutas que dependen de la frontera del día: los límites de fecha de mediciones de la spec 016 (AC-005.1 a AC-005.3) y los de edad de la spec 018 (AC-005.4 a AC-005.8); los demás siguen como están. |  Acepto las 8 propuestas |
| Q6 | En producción, ¿basta con que `FRONTEND_BASE_URL` exista, o también se rechaza un valor que no sea `https://` (por ejemplo, `http://localhost:5173`)? | Se rechaza también cualquier valor que no empiece por `https://` (REQ-006). No se exige que sea exactamente `https://fitnerd.betofallas.dev`. |  Acepto las 8 propuestas |
| Q7 | ¿También debe negarse a arrancar la producción si `MAIL_BACKEND=resend` y falta `RESEND_API_KEY`? | No en esta feature: sigue el comportamiento actual (el restablecimiento responde 503 y se registra el fallo). Queda en el backlog. |  Acepto las 8 propuestas |
| Q8 | ¿Se mantiene `http://localhost:5173` como valor por defecto en desarrollo? | Sí (AC-006.5); solo cambia la producción. |  Acepto las 8 propuestas |

**Estado:** las ocho preguntas están **resueltas**; el usuario aceptó todas las propuestas por defecto. Dónde se incorporan:
- Q1: sección 3, fuera de alcance (corregir y borrar quedan para el backlog).
- Q2: REQ-001 (AC-001.8, AC-001.9), REQ-002 (AC-002.10) y sección 6.
- Q3: sección 3, fuera de alcance; REQ-003 solo despliega el Historial.
- Q4: REQ-004 (AC-004.1 a AC-004.4), sin dependencias nuevas; las pruebas en navegador real quedan para el backlog.
- Q5: REQ-005 (instante que no avanza solo; AC-005.7 a AC-005.9) y sección 3 (tests existentes que pasan a fechas absolutas).
- Q6: REQ-006 (AC-006.3).
- Q7: sección 3, fuera de alcance, y sección 6; queda para el backlog.
- Q8: REQ-006 (AC-006.5).

**Q-P1 (del plan) resuelta:** el usuario eligió la opción B. AC-004.3 registra 162 lb, que va y vuelve sin pérdida (73,5 kg y 162,0 lb), y espera «Peso» 162 en lb. La variación de 0,1 lb con otros valores sigue en el backlog de la feature.

## 8. Glosario

- **Relectura:** la nueva lectura de mediciones y perfil que la app hace tras un registro para mostrar el peso sincronizado.
- **Aviso de relectura:** el aviso con botón «Reintentar» de REQ-001 y REQ-002.
- **Servidor de prueba con estado:** simulación de la API, usada solo en tests, que guarda lo que se registra durante la prueba y responde en consecuencia, en lugar de devolver respuestas fijadas de antemano.
- **Instante fijado:** fecha y hora que una prueba impone como «ahora» del servidor en la configuración de pruebas.


## Comentarios del usuario

- Q-P1 (plan, AC-004.3): "Opción B, 162 lb"
