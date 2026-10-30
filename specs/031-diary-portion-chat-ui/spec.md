# Spec 031 — Chat de porciones en el diario (frontend)

- **Feature:** `031-diary-portion-chat-ui` · **Tipo:** feature
- **Ámbitos:** `frontend`

## 1. Contexto y problema

Al registrar una comida en el diario (`/diary`), el usuario tiene que escribir los gramos de cada alimento y muchas
veces no sabe cuánto pesa lo que comió («5 huevos», «un filete de pescado»). La spec 030 añadió al backend una
consulta con sesión, `POST /api/meals/portion-estimate`, que estima el peso en gramos de una porción descrita en
texto, pero todavía no hay ninguna pantalla que la use.

Esta feature añade al diario una ventana de chat pequeña, situada entre la tarjeta de totales del día (calorías,
proteínas, carbohidratos y grasas) y la sección «Desayuno», con un texto encima que explica para qué sirve: preguntar
a la IA cuántos gramos pesa un alimento o una porción. Cada pregunta se responde de forma independiente (la consulta
de la 030 no admite historial); la ventana solo muestra los turnos de la conversación mientras el usuario sigue en el
diario.

## 2. Historia de usuario

Como **usuario con sesión que registra comidas en el diario**, quiero **preguntar desde el propio diario cuántos
gramos pesa un alimento o una porción** para **anotar sus gramos sin tener que pesarlo ni salir de la pantalla**.

## 3. Alcance

**Incluye:**
- Un bloque nuevo en `/diary`, entre la tarjeta de totales del día y la sección «Desayuno», con un título, un texto
  explicativo, el área de la conversación y un campo para escribir la pregunta con su botón de envío.
- Validación de la pregunta en el dispositivo (obligatoria y de hasta 200 caracteres sin los espacios de los
  extremos), con contador de caracteres.
- Envío de la pregunta a `POST /api/meals/portion-estimate` (contrato de la spec 030, sin cambios) y presentación de
  los tres resultados posibles: estimación (`estimated`) y mensaje fijo (`not_food` y `unknown`).
- Indicador de espera mientras se calcula la respuesta y bloqueo del envío de otra pregunta hasta recibirla.
- Presentación de los errores (400, 429, 503 y cualquier otro fallo o respuesta inesperada) dentro de la
  conversación, con mensajes en español.
- Conservación de la conversación en memoria mientras el usuario sigue en `/diary`, también al cambiar de día.

**Fuera de alcance:**
- Cualquier cambio en el backend o en el contrato de `POST /api/meals/portion-estimate` (spec 030).
- Añadir al diario el alimento o los gramos estimados desde el chat (botón «Usar estos gramos» o similar), o
  rellenar con ellos el campo de gramos de «Añadir a {sección}», de la propuesta de foto o de «Editar gramos»: el
  chat solo informa de los gramos y el usuario los anota él mismo.
- Calcular calorías o macros de la porción estimada, o relacionarla con el catálogo o la biblioteca de alimentos.
- Guardar la conversación: se pierde al salir de `/diary` o al recargar la página; no se guarda en el servidor ni en
  el almacenamiento del navegador.
- Preguntas de seguimiento con contexto («¿y si son 3?»): cada pregunta se envía sola, sin las anteriores.
- Mostrar cuántas preguntas quedan del límite de 10 cada 6 horas.
- Plegar u ocultar la ventana de chat, o abrirla como diálogo flotante.
- Cambios en el coach (`/coach`), en «Añadir a {sección}», en la propuesta de foto o en el resto del diario.

## 4. Requisitos funcionales

### REQ-001 — Bloque del chat en el diario
WHILE el diario del día elegido y los objetivos de Macros están cargados THE SYSTEM SHALL mostrar el bloque del chat
de porciones inmediatamente después de la tarjeta de totales del día y antes del aviso de día vacío (si aparece) y
de la sección «Desayuno», con el título «Calcular gramos con IA», el texto explicativo de la sección 6, un campo con
la etiqueta accesible «Alimento o porción» y un botón «Preguntar».

- **AC-001.1:** Given un usuario con sesión, perfil y un diario cargado en `/diary`, When se muestra la pantalla,
  Then aparece el título «Calcular gramos con IA», el texto «Pregunta a la IA cuántos gramos pesa un alimento o una
  porción, por ejemplo «5 huevos» o «un filete de pescado». La respuesta es una estimación aproximada.», un campo con
  la etiqueta «Alimento o porción» y un botón «Preguntar».
- **AC-001.2:** Given el diario cargado, When se recorre la pantalla en el orden del documento, Then el bloque del chat
  está después de la tarjeta de totales del día y antes del encabezado «Desayuno».
- **AC-001.3:** Given un día sin comidas registradas, When se muestra el diario, Then el bloque del chat está antes
  del aviso «Todavía no has registrado nada hoy.» (o «No hay nada registrado este día.» en un día pasado).
- **AC-001.4:** Given un día pasado elegido con `?date=`, When se muestra el diario, Then el bloque del chat también
  aparece.
- **AC-001.5:** Given que el diario se está cargando o ha fallado al cargarse, When se muestra la pantalla, Then el
  bloque del chat no aparece (igual que la tarjeta de totales).
- **AC-001.6:** Given el diario cargado y ninguna pregunta hecha, When se muestra el bloque, Then el área de la
  conversación muestra «Todavía no has preguntado nada.».

### REQ-002 — Validar la pregunta antes de enviarla
THE SYSTEM SHALL admitir en el campo como máximo 200 caracteres, mostrar un contador «{n}/200» y mantener desactivado
el botón «Preguntar» mientras la pregunta esté vacía o solo tenga espacios, sin enviar ninguna petición en ese caso.

- **AC-002.1:** Given el campo vacío, When se muestra el bloque, Then el botón «Preguntar» está desactivado y el
  contador muestra «0/200».
- **AC-002.2:** Given el campo con solo espacios, When el usuario pulsa Enter en el campo, Then no se envía ninguna
  petición y el botón sigue desactivado.
- **AC-002.3:** Given el campo vacío, When el usuario escribe o pega un texto de 250 caracteres, Then el campo contiene
  solo los 200 primeros y el contador muestra «200/200».
- **AC-002.4:** Given el campo con «5 huevos», When se muestra, Then el contador muestra «8/200» y el botón
  «Preguntar» está activado.

### REQ-003 — Enviar la pregunta
WHEN el usuario pulsa «Preguntar», o Enter en el campo, con una pregunta válida y sin otra pregunta en curso THE
SYSTEM SHALL enviar a `POST /api/meals/portion-estimate` el cuerpo `{"question": <pregunta sin los espacios de los
extremos>}`, sin las preguntas anteriores, añadir la pregunta a la conversación, vaciar el campo y mostrar
«Calculando…» hasta recibir la respuesta.

- **AC-003.1:** Given el campo con «  5 huevos  », When el usuario pulsa «Preguntar», Then se envía una sola petición
  a `POST /api/meals/portion-estimate` con el cuerpo `{"question": "5 huevos"}`, la conversación muestra la pregunta
  «5 huevos», el campo queda vacío y se muestra «Calculando…».
- **AC-003.2:** Given el campo con «un filete de pescado», When el usuario pulsa Enter en el campo, Then se envía la
  petición con `{"question": "un filete de pescado"}`.
- **AC-003.3:** Given una pregunta ya respondida («5 huevos»), When el usuario envía «un plátano», Then el cuerpo de
  la segunda petición es exactamente `{"question": "un plátano"}`.

### REQ-004 — Una pregunta cada vez
WHILE hay una pregunta esperando respuesta THE SYSTEM SHALL mantener desactivado el envío (botón y Enter), aunque el
usuario pueda seguir escribiendo en el campo.

- **AC-004.1:** Given una pregunta en curso cuya respuesta no ha llegado, When el usuario escribe «un plátano» y pulsa
  «Preguntar» o Enter, Then el botón está desactivado, no se envía una segunda petición y el campo conserva
  «un plátano».
- **AC-004.2:** Given una pregunta en curso, When llega su respuesta, Then desaparece «Calculando…» y, si el campo
  tiene texto válido, el botón «Preguntar» vuelve a estar activado.

### REQ-005 — Mostrar una estimación
WHEN la respuesta tiene `status` `"estimated"` THE SYSTEM SHALL mostrar, como respuesta a esa pregunta, «Unos {grams}
g» y, si vienen, la porción como «Porción: {unit}» y la nota tal cual.

- **AC-005.1:** Given una respuesta `{"status": "estimated", "grams": 250, "unit": "5 huevos grandes", "note": "Unos
  50 g por huevo sin cáscara.", "message": null}`, When llega, Then la conversación muestra, debajo de la pregunta,
  «Unos 250 g», «Porción: 5 huevos grandes» y «Unos 50 g por huevo sin cáscara.».
- **AC-005.2:** Given una respuesta `estimated` con `grams` 120 y `unit` y `note` nulos, When llega, Then la respuesta
  muestra solo «Unos 120 g», sin «Porción:» ni nota.
- **AC-005.3:** Given una respuesta `estimated` con `grams` 5000, When llega, Then muestra «Unos 5000 g» (entero, sin
  decimales).

### REQ-006 — Mostrar el mensaje fijo
WHEN la respuesta tiene `status` `"not_food"` o `"unknown"` THE SYSTEM SHALL mostrar como respuesta a esa pregunta el
`message` recibido, sin gramos ni porción.

- **AC-006.1:** Given una respuesta `{"status": "not_food", "grams": null, "unit": null, "note": null, "message":
  "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento."}`, When llega, Then la conversación muestra ese
  mensaje como respuesta y no muestra «Unos» ni «Porción:».
- **AC-006.2:** Given una respuesta `unknown` con el mensaje «No he podido estimar el peso. Prueba a describir el
  alimento de otra forma.», When llega, Then la conversación muestra ese mensaje como respuesta.

### REQ-007 — Errores de la consulta
IF la petición falla THEN THE SYSTEM SHALL conservar la pregunta en la conversación y mostrar como respuesta a ella:
el mensaje del servidor si el código es 400, 429 o 503, y «No se pudo estimar el peso. Vuelve a intentarlo.» en
cualquier otro caso (otro código, fallo de red o respuesta con una forma inesperada), dejando el campo y el botón
disponibles para una pregunta nueva.

- **AC-007.1:** Given una petición que responde 429 con «Alcanzaste el límite de 10 preguntas cada 6 horas. Vuelve a
  intentarlo más tarde.», When llega, Then la pregunta sigue en la conversación y debajo aparece ese mensaje, con el
  estilo neutro de un aviso y no con el estilo de error.
- **AC-007.2:** Given una petición que responde 503 con «No se pudo estimar el peso en este momento. Vuelve a
  intentarlo en unos minutos.», When llega, Then la pregunta sigue en la conversación y debajo aparece ese mensaje
  con el estilo de error.
- **AC-007.3:** Given una petición que responde 400 con «La pregunta no puede superar los 200 caracteres.», When
  llega, Then debajo de la pregunta aparece ese mensaje con el estilo de error.
- **AC-007.4:** Given una petición que falla por la red, o que responde 500, When llega el fallo, Then debajo de la
  pregunta aparece «No se pudo estimar el peso. Vuelve a intentarlo.» y no aparece el texto del error original.
- **AC-007.5:** Given una respuesta 200 cuya forma no es la del contrato (por ejemplo, `status` `"estimated"` con
  `grams` nulo, o un `status` desconocido), When llega, Then debajo de la pregunta aparece «No se pudo estimar el
  peso. Vuelve a intentarlo.».
- **AC-007.6:** Given una pregunta que ha fallado (con cualquiera de los casos anteriores), When el usuario escribe
  otra pregunta válida, Then el botón «Preguntar» está activado y al pulsarlo se envía la nueva petición.

### REQ-008 — Historial de la conversación en pantalla
THE SYSTEM SHALL mostrar todas las preguntas de la visita a `/diary` con su respuesta o error, en el orden en que se
hicieron, y conservarlas al cambiar de día dentro del diario.

- **AC-008.1:** Given dos preguntas respondidas («5 huevos» y después «un plátano»), When se muestra la conversación,
  Then aparecen las dos preguntas con sus respuestas, en ese orden.
- **AC-008.2:** Given una pregunta respondida, When el usuario cambia de día con «Día anterior», «Día siguiente»,
  «Hoy» o el selector de fecha y el diario del nuevo día se carga, Then la conversación sigue mostrando la pregunta y
  su respuesta.
- **AC-008.3:** Given una pregunta en curso, When el usuario cambia de día antes de recibir la respuesta, Then, cuando
  llega, la respuesta aparece debajo de esa pregunta en la conversación del nuevo día y no se envía ninguna petición
  adicional.
- **AC-008.4:** Given una pregunta respondida, When el usuario sale de `/diary` y vuelve, Then la conversación está
  vacía y muestra «Todavía no has preguntado nada.».

## 5. Requisitos no funcionales

### NFR-001 — Accesibilidad de la conversación
THE SYSTEM SHALL anunciar a los lectores de pantalla las respuestas nuevas de la conversación y el estado
«Calculando…», sin mover el foco del campo de la pregunta al enviar.

- **AC-N001.1:** Given el bloque del chat, When se muestra, Then el área de la conversación es una región que anuncia
  los cambios de forma educada (`role="log"` o `aria-live="polite"`) y tiene un nombre accesible
  «Conversación sobre gramos».
- **AC-N001.2:** Given el foco en el campo «Alimento o porción» con una pregunta válida, When el usuario pulsa Enter,
  Then el foco sigue en el campo.

### NFR-002 — Sin efectos sobre el diario
THE SYSTEM SHALL no modificar el diario ni la biblioteca de alimentos al preguntar, ni volver a leer el diario por
ello.

- **AC-N002.1:** Given una pregunta respondida con una estimación, When se recibe, Then no se ha hecho ninguna
  petición a `POST /api/meals` ni a otros endpoints del diario o de la biblioteca, salvo `POST
  /api/meals/portion-estimate`, y los totales del día no cambian.

## 6. Datos y contratos visibles

**Consumo:** `POST /api/meals/portion-estimate` (spec 030), con la sesión del usuario. Petición
`{"question": "<texto>"}`; respuesta 200 con `status`, `grams`, `unit`, `note` y `message`, todas las claves siempre
presentes. El contrato no cambia.

**Campo de la pregunta:**

| Elemento | Regla |
|---|---|
| Etiqueta accesible | `Alimento o porción` |
| Texto de ejemplo dentro del campo | `Por ejemplo: 5 huevos` |
| Longitud | Hasta 200 caracteres; lo que se escribe o pega de más se descarta. |
| Contador | `{n}/200`, con `n` el número de caracteres del campo. |
| Envío | Botón `Preguntar` o Enter; desactivado si la pregunta, sin los espacios de los extremos, está vacía, o si hay otra en curso. |
| Valor enviado | La pregunta sin los espacios de los extremos. |

**Textos visibles (español):**

| Lugar | Texto |
|---|---|
| Título del bloque | `Calcular gramos con IA` |
| Texto explicativo, encima de la conversación | `Pregunta a la IA cuántos gramos pesa un alimento o una porción, por ejemplo «5 huevos» o «un filete de pescado». La respuesta es una estimación aproximada.` |
| Conversación vacía | `Todavía no has preguntado nada.` |
| Nombre accesible de la conversación | `Conversación sobre gramos` |
| Esperando respuesta | `Calculando…` |
| Respuesta `estimated` | `Unos {grams} g`; si hay `unit`, `Porción: {unit}`; si hay `note`, la nota tal cual. `grams` se muestra como entero sin decimales ni separador de miles. |
| Respuesta `not_food` / `unknown` | El `message` recibido. |
| Error 400, 429 o 503 | El mensaje `error` del servidor (el 429 con estilo de aviso neutro; el 400 y el 503 con estilo de error). |
| Otro error, fallo de red o respuesta con forma inesperada | `No se pudo estimar el peso. Vuelve a intentarlo.` |

Un 401 con sesión caducada sigue el comportamiento general de la app (cierra la sesión y lleva a `/login`).

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Qué título y qué texto explicativo lleva el bloque? | Título «Calcular gramos con IA» y texto «Pregunta a la IA cuántos gramos pesa un alimento o una porción, por ejemplo «5 huevos» o «un filete de pescado». La respuesta es una estimación aproximada.» (REQ-001). | Sí, acepto las 8 propuestas. |
| Q2 | ¿Cómo se muestra una estimación? | «Unos {grams} g», debajo «Porción: {unit}» si viene y la nota si viene (REQ-005). | Sí, acepto las 8 propuestas. |
| Q3 | ¿La conversación se conserva al cambiar de día dentro del diario? | Sí: el chat no depende del día; se conserva al cambiar de día y se pierde al salir de `/diary` o recargar (REQ-008). | Sí, acepto las 8 propuestas. |
| Q4 | ¿El chat se muestra mientras el diario carga o si falla su carga? | No: aparece junto con la tarjeta de totales, solo con el diario cargado (AC-001.5). | Sí, acepto las 8 propuestas. |
| Q5 | ¿Qué pasa con una pregunta que falla? | Se queda en la conversación con el mensaje de error debajo; el usuario puede escribir otra (o la misma) y enviarla; sin botón «Reintentar» (REQ-007). | Sí, acepto las 8 propuestas. |
| Q6 | ¿El campo es de una línea o admite varias? | Una línea: Enter envía; con el tope de 200 caracteres no hacen falta saltos de línea (REQ-003). | Sí, acepto las 8 propuestas. |
| Q7 | ¿Se ofrece desde la respuesta añadir el alimento o los gramos al diario? | No: fuera de alcance (sección 3); el usuario anota los gramos él mismo. | Sí, acepto las 8 propuestas. El Q7 queda descartado, ni siquiera para backlog. La idea es que las personas sepan los gramos de una alimento para poder ingresarlos ellos mismos. |

Estado: Q1–Q8 resueltas; las propuestas aceptadas están incorporadas en los REQ y AC indicados.
| Q8 | ¿Se avisa de cuántas preguntas quedan del límite o se desactiva el campo tras un 429? | No: el 429 se muestra como aviso neutro en la conversación y el campo sigue activo (AC-007.1). | Sí, acepto las 8 propuestas. |

## 8. Glosario

- **Chat de porciones:** bloque del diario para preguntar cuántos gramos pesa un alimento o una porción.
- **Turno:** una pregunta del usuario y su respuesta, mensaje fijo o error.
- **Pregunta en curso:** pregunta enviada cuya respuesta todavía no ha llegado.
