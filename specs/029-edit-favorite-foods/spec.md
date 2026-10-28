# Spec 029 — Editar alimentos propios en el buscador de «Añadir alimento»

- **Feature:** `029-edit-favorite-foods` · **Tipo:** feature
- **Ámbitos:** `backend`, `frontend`

## 1. Contexto y problema

Desde la spec 028, los alimentos personalizados que el usuario registra se guardan en su biblioteca («tus alimentos») y
se reutilizan desde la búsqueda compartida del diario («Añadir a {sección}» y la propuesta de foto), con las listas
«Favoritos» y «Recientes». La 028 solo permite **borrar** un alimento propio; para cambiar sus valores hay que volver a
registrarlo con el mismo nombre (decisión Q4 de la 028), y no hay forma de **cambiarle el nombre**: si el usuario se
equivocó al escribirlo, o quiere corregir sus calorías o macros, tiene que borrarlo y crearlo otra vez, y pierde con ello
el favorito.

Esta spec añade un botón **«Editar»** en los alimentos propios de la búsqueda compartida, que abre un formulario dentro
del propio elemento para cambiar el nombre y los cuatro valores por 100 g (calorías, proteína, carbohidratos y grasa),
con las mismas reglas que al crear un alimento personalizado (022). «Guardar» solo se habilita cuando hay cambios y
mientras el nombre no lo tenga ya otro alimento propio del usuario. Las comidas ya registradas no cambian: cada una
conserva su copia del nombre y de los valores (ADR-0036).

De la 028 sustituye la parte de la decisión Q4 y de «Fuera de alcance» que dejaba fuera la edición de un alimento propio
(«Editar un alimento propio desde una pantalla»). Lo demás de la 028 se mantiene; en particular, registrar un
personalizado con el nombre de uno propio sigue actualizándolo (REQ-001 de la 028).

## 2. Historia de usuario

Como **usuario con sesión que tiene alimentos propios en su biblioteca**, quiero **corregir el nombre y los valores por
100 g de uno de ellos desde la búsqueda del diario** para **seguir usándolo bien sin tener que borrarlo y crearlo otra
vez**.

## 3. Alcance

**Incluye:**
- Backend:
  - Editar un alimento propio del usuario: nombre y los cuatro valores por 100 g, con las validaciones de los
    personalizados de la 022 y la regla de nombres únicos por usuario de la 028, también comprobada en el servidor.
  - Errores claros: nombre repetido, alimento que no existe o es de otro usuario, datos no válidos y sin sesión.
  - Las comidas ya registradas conservan su copia; la búsqueda, los recientes, los favoritos y los registros nuevos usan
    los valores editados.
- Frontend:
  - Botón «Editar» en cada alimento propio de la búsqueda compartida, después de «Elegir» y de la estrella de favorito,
    en las listas «Favoritos», «Recientes» y «Resultados» (Q1), también en la búsqueda de la propuesta de foto (Q2).
  - Formulario de edición en línea, dentro del elemento, con el nombre y los cuatro valores por 100 g rellenos con los
    actuales, «Guardar» y «Cancelar».
  - «Guardar» deshabilitado mientras no haya cambios, mientras el nombre lo tenga otro alimento propio (con el aviso
    «Ya tienes un alimento con ese nombre.») y mientras se guarda.
  - Tras guardar, las listas muestran el nombre y los valores nuevos; las filas de una propuesta de foto que usan ese
    alimento se actualizan (Q5).
  - Teclado y foco accesibles: Escape cierra solo el formulario, y el foco no se pierde.

**Fuera de alcance:**
- Editar alimentos del catálogo (son compartidos y de solo lectura) o de USDA.
- Cambiar las comidas ya registradas al editar un alimento propio, o editar un alimento desde las filas del diario.
- Editar los gramos de un reciente (`last_grams`) o el estado de favorito desde el formulario de edición.
- Una pantalla propia «Mis alimentos» fuera de los diálogos del diario, editar varios alimentos a la vez y deshacer una
  edición.
- Crear un alimento propio sin registrarlo en una comida.
- Cambios en la Política de privacidad: ya menciona los alimentos personalizados guardados (REQ-021 de la 028).

## 4. Requisitos funcionales

### Backend

### REQ-001 — Editar un alimento propio
WHEN un usuario con sesión pide `PATCH /api/food-library/custom/{custom_food_id}` de un alimento de su biblioteca con un
cuerpo válido `{"name": texto, "per_100g": {"calories_kcal", "protein_g", "carbs_g", "fat_g"}}` THE SYSTEM SHALL
sustituir su nombre (sin los espacios de los extremos, como en la 022) y sus cuatro valores por 100 g por los recibidos,
conservar su identificador y su estado de favorito, y responder 200 con el alimento editado en el formato de resultado
de la biblioteca de la 028 (`kind: "custom"`, `id`, `name`, `per_100g` y `favorite`).

- **AC-001.1:** Given el alimento propio «Gallo pinto» (id 12, 180 kcal, 6 g, 30 g y 4 g por 100 g, favorito), When el
  usuario pide `PATCH /api/food-library/custom/12` con `{"name": "  Gallo pinto con huevo ", "per_100g":
  {"calories_kcal": 200, "protein_g": 9, "carbs_g": 28, "fat_g": 6}}`, Then recibe 200 con `{"kind": "custom", "id": 12,
  "name": "Gallo pinto con huevo", "per_100g": {"calories_kcal": 200.0, "protein_g": 9.0, "carbs_g": 28.0, "fat_g": 6.0},
  "favorite": true}`.
- **AC-001.2:** Given el caso de AC-001.1, When el usuario pide sus favoritos y busca `q=gallo`, Then «Gallo pinto con
  huevo» aparece con id 12, los valores nuevos y `favorite: true`, y ya no aparece ningún «Gallo pinto» con los valores
  anteriores.
- **AC-001.3:** Given el alimento propio «Gallo pinto», When el usuario lo edita con el nombre «gallo PINTO» y los mismos
  valores, Then recibe 200 y el nombre queda «gallo PINTO» (cambiar solo mayúsculas o tildes de su propio nombre no es un
  nombre repetido).
- **AC-001.4:** Given el alimento propio «Gallo pinto», When el usuario lo edita con exactamente su nombre y sus valores
  actuales, Then recibe 200 con el alimento sin cambios.
- **AC-001.5:** Given «Arroz blanco cocido» en el catálogo y un alimento propio «Arroz de la casa», When el usuario edita
  el propio con el nombre «Arroz blanco cocido», Then recibe 200 (los nombres del catálogo no cuentan como repetidos).
- **AC-001.6:** Given un alimento propio no favorito, When se edita, Then la respuesta lleva `favorite: false` y sigue sin
  ser favorito.

### REQ-002 — Datos no válidos
IF el cuerpo de `PATCH /api/food-library/custom/{custom_food_id}` no es un objeto JSON THEN THE SYSTEM SHALL responder 400
con `{"error": "La petición no es válida"}`. IF falta `name` o `per_100g`, o alguno no cumple las reglas de los
personalizados de la 022 THEN THE SYSTEM SHALL responder 400 con el mismo mensaje que la 022 para ese caso. En los dos
casos SHALL NOT cambiar el alimento.

- **AC-002.1:** Given un alimento propio, When se pide la edición con el cuerpo `"hola"` como texto, con `null`, con una
  lista o con JSON malformado, Then recibe 400 con `{"error": "La petición no es válida"}` y el alimento no cambia.
- **AC-002.2:** Given un alimento propio, When se pide la edición sin `name`, con `name` vacío o solo con espacios, Then
  recibe 400 con `{"error": "Escribe el nombre del alimento."}`.
- **AC-002.3:** Given un alimento propio, When se pide la edición con un `name` de 101 caracteres tras quitar los espacios
  de los extremos, Then recibe 400 con `{"error": "El nombre no puede superar los 100 caracteres."}`; y con 100 caracteres,
  Then recibe 200.
- **AC-002.4:** Given un alimento propio, When se pide la edición sin `per_100g` o sin alguno de sus cuatro valores, Then
  recibe 400 con `{"error": "Indica las calorías, proteína, carbohidratos y grasa por 100 g."}`.
- **AC-002.5:** Given un alimento propio, When se pide la edición con `calories_kcal` de -1 o de 901, Then recibe 400 con
  `{"error": "Las calorías por 100 g deben estar entre 0 y 900."}`.
- **AC-002.6:** Given un alimento propio, When se pide la edición con `protein_g` de -1 o `fat_g` de 101, Then recibe 400
  con `{"error": "Los macros por 100 g deben estar entre 0 y 100 g."}`.
- **AC-002.7:** Given un alimento propio, When se pide la edición con `protein_g` 40, `carbs_g` 40 y `fat_g` 30, Then
  recibe 400 con `{"error": "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g."}`.

### REQ-003 — Nombre repetido
IF el nombre recibido, comparado con la regla de nombres de la 028 (sin distinguir mayúsculas ni tildes, sin espacios en
los extremos y con los espacios repetidos contados como uno), coincide con el de **otro** alimento propio del mismo
usuario THEN THE SYSTEM SHALL responder 409 con `{"error": "Ya tienes un alimento con ese nombre."}` y SHALL NOT cambiar
ninguno de los dos alimentos.

- **AC-003.1:** Given un usuario con los alimentos propios «Gallo pinto» y «Arroz con pollo de mamá», When edita «Gallo
  pinto» con el nombre «  ARROZ con   pollo de mama », Then recibe 409 con ese mensaje y los dos alimentos conservan su
  nombre y sus valores.
- **AC-003.2:** Given que el usuario B tiene un alimento propio «Arroz con pollo de mamá», When el usuario A edita uno
  suyo con ese nombre, Then recibe 200 (los nombres de otros usuarios no cuentan).
- **AC-003.3:** Given un usuario con los alimentos propios «Avena» y «Banano», When dos peticiones simultáneas editan
  «Avena» y «Banano» con el nombre «Batido», Then una responde 200 y la otra 409 con ese mensaje, ninguna responde 500, y
  la biblioteca tiene un solo alimento llamado «Batido».
- **AC-003.4:** Given un alimento propio que se renombró de «Gallo pinto» a «Pinto», When el usuario registra después un
  personalizado «Gallo pinto» en una comida (REQ-001 de la 028), Then se crea un alimento propio nuevo, con otro
  identificador, y «Pinto» no cambia.

### REQ-004 — Alimento que no existe, de otro usuario y sesión
IF el alimento no existe, es de otro usuario o el identificador no es un entero entre 1 y 2.147.483.647 THEN THE SYSTEM
SHALL responder 404 con `{"error": "No encontramos ese alimento."}` sin cambiar nada. IF la petición no trae un token de
sesión válido THEN THE SYSTEM SHALL responder 401 como el resto de endpoints protegidos.

- **AC-004.1:** Given un alimento propio del usuario B, When el usuario A pide editarlo con un cuerpo válido, Then recibe
  404 con ese mensaje y el alimento de B no cambia.
- **AC-004.2:** Given un identificador que no existe, `abc`, `0` o `2147483648`, When se pide la edición con un cuerpo
  válido, Then recibe 404 con ese mensaje.
- **AC-004.3:** Given un alimento propio borrado (REQ-004 de la 028), When se pide su edición, Then recibe 404 con ese
  mensaje.
- **AC-004.4:** Given una petición sin cabecera de autorización o con un token caducado, When pide la edición, Then recibe
  401.

### REQ-005 — Efecto de la edición en el diario
WHEN se edita un alimento propio THE SYSTEM SHALL conservar en las comidas ya registradas el nombre, los valores por
100 g y los nutrientes copiados al registrarlas, con su mismo `custom_food_id`. Los recientes, los favoritos y la
búsqueda conjunta SHALL mostrar los valores editados (como en AC-008.8 de la 028), y lo que se registre después con ese
`custom_food_id` SHALL copiar los valores editados.

- **AC-005.1:** Given «Gallo pinto» (180 kcal por 100 g) registrado con 200 g el 27 de octubre, When el usuario lo edita a
  «Gallo pinto con huevo» con 200 kcal por 100 g y pide el diario del 27 de octubre, Then el alimento registrado sigue con
  `name: "Gallo pinto"`, 180 kcal por 100 g, 360 kcal de nutrientes y el mismo `custom_food_id`.
- **AC-005.2:** Given el caso de AC-005.1, When el usuario pide los recientes, Then «Gallo pinto con huevo» aparece con
  200 kcal por 100 g y `last_grams: 200.0`.
- **AC-005.3:** Given el caso de AC-005.1, When el usuario pide `POST /api/meals` con `{"custom_food_id": <su id>,
  "grams": 100}`, Then el alimento registrado lleva `name: "Gallo pinto con huevo"` y 200 kcal por 100 g.
- **AC-005.4:** Given un alimento propio registrado y quitado con `undo=1` antes de editarlo, When se edita y después se
  restaura con su `restore_token` (026), Then el alimento restaurado vuelve con el nombre y los valores que tenía al
  quitarlo y con su `custom_food_id`.

### Frontend

### REQ-006 — Botón «Editar»
THE SYSTEM SHALL mostrar en cada alimento propio de las listas «Favoritos», «Recientes» y «Resultados» de la búsqueda
compartida (diálogo «Añadir a {sección}» y búsquedas de la propuesta de foto) un botón «Editar» con nombre accesible
«Editar {nombre}», situado después de «Elegir» y de la estrella de favorito y antes de «Borrar». Los alimentos del
catálogo SHALL NOT tener este botón.

- **AC-006.1:** Given el diálogo «Añadir a Desayuno» con «Favoritos» desplegada, que contiene el propio «Gallo pinto» y
  «Banano» del catálogo, When se muestra, Then «Gallo pinto» tiene, en este orden, «Elegir Gallo pinto», «Quitar Gallo
  pinto de favoritos», «Editar Gallo pinto» y «Borrar Gallo pinto de tus alimentos», y «Banano» no tiene botón «Editar».
- **AC-006.2:** Given el propio «Gallo pinto» en «Recientes» y en los resultados de buscar «gallo», When se muestran,
  Then en los dos tiene el botón «Editar Gallo pinto».
- **AC-006.3:** Given la búsqueda de «Añadir otro alimento» de una propuesta de foto con «Gallo pinto» en «Favoritos»,
  When se muestra, Then tiene el botón «Editar Gallo pinto».

### REQ-007 — Formulario de edición en línea
WHEN el usuario pulsa «Editar {nombre}» THE SYSTEM SHALL mostrar, dentro del elemento de la lista donde lo pulsó y sin
ocultar el resto de la búsqueda, un formulario con el título «Editar «{nombre}»», los campos «Nombre», «Calorías por
100 g (kcal)», «Proteína por 100 g (g)», «Carbohidratos por 100 g (g)» y «Grasa por 100 g (g)» rellenos con los valores
actuales del alimento, y los botones «Guardar» y «Cancelar». Los campos SHALL validarse con las reglas y los mensajes del
formulario de alimento personalizado de la 022 (sin el campo «Gramos»). Solo SHALL haber abierto a la vez un formulario de
edición o una confirmación de borrado (028) en toda la búsqueda: abrir uno cierra el otro sin guardar.
WHEN el usuario pulsa «Cancelar» o Escape THE SYSTEM SHALL cerrar solo el formulario, sin guardar ni pedir confirmación:
SHALL NOT cerrar el diálogo «Añadir a {sección}», SHALL NOT abrir la confirmación de descartar la propuesta de la 026 y
SHALL conservar el texto de la caja de búsqueda. WHEN cambia el texto de la caja de búsqueda o el alimento deja de
mostrarse (por ejemplo, al plegar su lista) THE SYSTEM SHALL cerrar el formulario sin guardar, como la confirmación de
borrado de la 028.

- **AC-007.1:** Given «Gallo pinto» (180 kcal, 6 g, 30 g y 4 g por 100 g) en «Favoritos», When el usuario pulsa «Editar
  Gallo pinto», Then dentro de su elemento de «Favoritos» ve el título «Editar «Gallo pinto»», los cinco campos con «Gallo
  pinto», 180, 6, 30 y 4, y los botones «Guardar» y «Cancelar», y la lista «Favoritos» sigue visible.
- **AC-007.2:** Given el formulario abierto con el nombre cambiado, When el usuario pulsa «Cancelar», Then el formulario se
  cierra, no se hace ninguna petición y «Gallo pinto» sigue con su nombre y sus valores; y When vuelve a pulsar «Editar
  Gallo pinto», Then el formulario muestra otra vez los valores actuales.
- **AC-007.3:** Given el diálogo «Añadir a Desayuno» con el formulario de edición abierto, When el usuario pulsa Escape,
  Then el formulario se cierra sin petición y el diálogo sigue abierto; y When pulsa Escape otra vez, Then el diálogo se
  cierra.
- **AC-007.4:** Given la búsqueda de «Añadir otro alimento» de una propuesta de foto con el formulario de edición abierto,
  When el usuario pulsa Escape, Then el formulario se cierra, no aparece la confirmación de descartar la propuesta (026) y
  la búsqueda sigue visible con su texto.
- **AC-007.5:** Given el formulario abierto, When el usuario vacía «Nombre», escribe 901 en calorías o pone proteína 40,
  carbohidratos 40 y grasa 30 y pulsa «Guardar», Then ve respectivamente «Escribe el nombre del alimento.», «Las calorías
  por 100 g deben estar entre 0 y 900.» o «La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por
  100 g.», y no se hace ninguna petición.
- **AC-007.6:** Given el formulario de edición de «Gallo pinto» abierto, When el usuario pulsa «Borrar Avena casera de tus
  alimentos» en otro alimento, Then el formulario de «Gallo pinto» se cierra sin guardar y se abre la confirmación de
  borrado de «Avena casera»; y When, con esa confirmación abierta, pulsa «Editar Gallo pinto», Then la confirmación se
  cierra sin borrar y se abre el formulario.
- **AC-007.7:** Given «Gallo pinto» en «Favoritos» y en «Recientes», When el usuario pulsa «Editar Gallo pinto» en
  «Recientes», Then el formulario aparece dentro del elemento de «Recientes» y no en el de «Favoritos».
- **AC-007.8:** Given el formulario abierto en «Favoritos», When el usuario escribe en la caja de búsqueda o pliega
  «Favoritos», Then el formulario se cierra sin hacer ninguna petición.

### REQ-008 — «Guardar» solo con cambios
WHILE los valores del formulario son iguales a los actuales del alimento THE SYSTEM SHALL mantener «Guardar»
deshabilitado; WHEN el usuario cambia alguno THE SYSTEM SHALL habilitarlo, y SHALL deshabilitarlo de nuevo si vuelve a
dejarlos como estaban. Un nombre cuenta como igual si, sin los espacios de los extremos, es idéntico al actual (cambiar
una mayúscula o una tilde sí es un cambio); un valor numérico cuenta como igual si es el mismo número (por ejemplo, «6»,
«6,0» y «6.0»). Un campo con un valor no válido cuenta como cambio.

- **AC-008.1:** Given el formulario de «Gallo pinto» recién abierto, When se muestra, Then «Guardar» está deshabilitado.
- **AC-008.2:** Given el formulario recién abierto, When el usuario cambia las calorías de 180 a 190, Then «Guardar» se
  habilita; y When las vuelve a dejar en 180, Then se deshabilita.
- **AC-008.3:** Given el formulario recién abierto, When el usuario cambia el nombre a «gallo pinto», Then «Guardar» se
  habilita.
- **AC-008.4:** Given el formulario recién abierto, When el usuario añade espacios al final del nombre o cambia la
  proteína de «6» a «6,0», Then «Guardar» sigue deshabilitado.
- **AC-008.5:** Given el formulario recién abierto, When el usuario vacía las calorías, Then «Guardar» se habilita y, al
  pulsarlo, ve «Indica las calorías, proteína, carbohidratos y grasa por 100 g.» sin petición.

### REQ-009 — Aviso de nombre repetido
WHEN el nombre escrito en el formulario coincide, con la regla de nombres de la 028, con el de **otro** alimento propio
del usuario (esté o no en favoritos) THE SYSTEM SHALL mostrar junto al campo «Nombre» el aviso «Ya tienes un alimento con
ese nombre.» sin que el usuario pulse «Guardar», y SHALL mantener «Guardar» deshabilitado hasta que el nombre deje de
coincidir. WHILE la comprobación del nombre está en curso THE SYSTEM SHALL mantener «Guardar» deshabilitado. IF la
comprobación no puede completarse THEN THE SYSTEM SHALL no mostrar el aviso y dejar que decida el servidor (REQ-010).
Su propio nombre, con otras mayúsculas o tildes, no es un nombre repetido. Los nombres del catálogo no cuentan.

- **AC-009.1:** Given un usuario con los propios «Gallo pinto» (favorito) y «Avena casera» (favorito), When en el
  formulario de «Gallo pinto» escribe «avena CASERA», Then ve «Ya tienes un alimento con ese nombre.» y «Guardar» está
  deshabilitado; y When cambia el nombre a «Avena casera de la abuela», Then el aviso desaparece y «Guardar» se habilita.
- **AC-009.2:** Given un usuario con el propio «Arroz con pollo de mamá» que no es favorito, When en el formulario de
  «Gallo pinto» abierto desde «Favoritos» escribe «Arroz con pollo de mama», Then ve el aviso y «Guardar» está
  deshabilitado.
- **AC-009.3:** Given el formulario de «Gallo pinto», When el usuario escribe «GALLO PINTO», Then no ve el aviso y
  «Guardar» está habilitado.
- **AC-009.4:** Given el formulario de un alimento propio, When el usuario escribe «Banano», que solo existe en el
  catálogo, Then no ve el aviso.
- **AC-009.5:** Given que la comprobación del nombre falla, When el usuario cambia el nombre, Then no ve el aviso y
  «Guardar» está habilitado.

### REQ-010 — Guardar la edición
WHEN el usuario pulsa «Guardar» con el formulario válido THE SYSTEM SHALL enviar la edición (REQ-001) con el nombre sin
los espacios de los extremos y los cuatro valores, mostrar «Guardando…» con los botones deshabilitados mientras dura y, si
responde 200, cerrar el formulario y mostrar el nombre y los valores nuevos en todas las listas de la búsqueda
(«Favoritos», «Recientes» y «Resultados»), en el orden de cada lista.
IF responde 409 THEN THE SYSTEM SHALL mostrar el aviso «Ya tienes un alimento con ese nombre.» junto al campo «Nombre»,
conservar lo escrito y mantener «Guardar» deshabilitado hasta que cambie el nombre. IF responde 404 THEN THE SYSTEM SHALL
mostrar «No encontramos ese alimento.», cerrar el formulario y volver a leer las listas. IF responde 400 THEN THE SYSTEM
SHALL mostrar el mensaje del servidor y conservar lo escrito. IF falla por cualquier otro motivo THEN THE SYSTEM SHALL
mostrar «No se pudo guardar el alimento.» y conservar lo escrito con «Guardar» habilitado.

- **AC-010.1:** Given el formulario de «Gallo pinto» (id 12) con el nombre « Gallo pinto con huevo » y 200 kcal, When el
  usuario pulsa «Guardar», Then se envía la edición del id 12 con `{"name": "Gallo pinto con huevo", "per_100g":
  {"calories_kcal": 200, "protein_g": 6, "carbs_g": 30, "fat_g": 4}}` y, mientras dura, ve «Guardando…» con los botones
  deshabilitados.
- **AC-010.2:** Given que la edición de AC-010.1 responde 200, When termina, Then el formulario se cierra y «Favoritos»
  muestra «Gallo pinto con huevo» con «200 kcal», sin «Gallo pinto», y «Recientes» también lo muestra con los valores
  nuevos.
- **AC-010.3:** Given que la edición responde 409, When termina, Then ve «Ya tienes un alimento con ese nombre.» junto a
  «Nombre», el formulario conserva lo escrito y «Guardar» está deshabilitado; y When cambia el nombre, Then «Guardar» se
  habilita.
- **AC-010.4:** Given que la edición responde 404, When termina, Then ve «No encontramos ese alimento.», el formulario se
  cierra y se vuelven a pedir los favoritos y los recientes.
- **AC-010.5:** Given que la edición responde 500 o no hay red, When termina, Then ve «No se pudo guardar el alimento.», el
  formulario conserva lo escrito y «Guardar» está habilitado.
- **AC-010.6:** Given «Guardando…» en curso, When el usuario vuelve a pulsar «Guardar» o pulsa Intro en un campo, Then no
  se envía otra petición.
- **AC-010.7:** Given «Avena casera» y «Gallo pinto» en «Favoritos», When el usuario renombra «Gallo pinto» a «Arepa» y se
  guarda, Then «Favoritos» muestra «Arepa» antes de «Avena casera» (orden por nombre de la 028).

### REQ-011 — Propuesta de foto con un alimento editado
WHEN el usuario guarda la edición de un alimento propio desde la búsqueda de una propuesta de foto que ya tiene filas con
ese alimento THE SYSTEM SHALL actualizar en esas filas el nombre y los valores por 100 g con los editados, conservar sus
gramos y la etiqueta «Personalizado», y recalcular sus nutrientes y el total de la propuesta (Q5).

- **AC-011.1:** Given una propuesta con el propio «Gallo pinto» (180 kcal por 100 g) con 250 g, When el usuario pulsa
  «Añadir otro alimento», edita «Gallo pinto» a «Gallo pinto con huevo» con 200 kcal, guarda y vuelve a la propuesta,
  Then la fila muestra «Gallo pinto con huevo», 250 g, «Personalizado» y 500 kcal, y el total incluye esas 500 kcal.
- **AC-011.2:** Given el caso de AC-011.1, When el usuario pulsa «Guardar en {sección}», Then esa fila se envía con
  `{"custom_food_id": <su id>, "grams": 250}`.
- **AC-011.3:** Given una propuesta con filas de otros alimentos, When el usuario edita un alimento propio que no está en
  la propuesta, Then las filas no cambian.

## 5. Requisitos no funcionales

### NFR-001 — Accesibilidad y foco
THE SYSTEM SHALL dar al formulario de edición un nombre accesible igual a su título («Editar «{nombre}»»), con cada campo
etiquetado y el aviso de nombre repetido asociado al campo «Nombre» y anunciado a los lectores de pantalla. Al abrir el
formulario, el foco SHALL ir al campo «Nombre»; al cerrarlo con «Cancelar» o Escape, SHALL volver al botón «Editar
{nombre}» desde el que se abrió; tras guardar con éxito, SHALL ir al botón «Editar {nombre nuevo}» del mismo alimento en
la lista donde se abrió y, si ya no está, a la caja «Buscar alimento». El foco SHALL NOT quedar en el cuerpo de la página.

- **AC-N001.1:** Given «Gallo pinto» en «Favoritos», When el usuario pulsa «Editar Gallo pinto», Then hay un formulario
  con nombre accesible «Editar «Gallo pinto»» y el foco está en el campo «Nombre».
- **AC-N001.2:** Given el formulario abierto desde «Recientes», When el usuario lo cierra con «Cancelar» o con Escape,
  Then el foco está en el botón «Editar Gallo pinto» de «Recientes».
- **AC-N001.3:** Given el formulario de «Gallo pinto» abierto desde «Favoritos», When guarda el nombre «Gallo pinto con
  huevo» y responde 200, Then el foco está en el botón «Editar Gallo pinto con huevo» de «Favoritos».
- **AC-N001.4:** Given el formulario abierto desde «Resultados» de la búsqueda «gallo», When guarda el nombre «Pinto» (que
  ya no coincide con «gallo») y responde 200, Then el foco está en la caja «Buscar alimento».
- **AC-N001.5:** Given el aviso de nombre repetido, When aparece, Then el campo «Nombre» lo tiene como descripción
  accesible y está en una región que se anuncia a los lectores de pantalla.

## 6. Datos y contratos visibles

**Endpoint nuevo** (requiere `Authorization: Bearer {token}`; 401 sin sesión válida):

| Petición | Respuesta correcta | Errores |
|---|---|---|
| `PATCH /api/food-library/custom/{custom_food_id}` con `{"name": texto, "per_100g": {"calories_kcal": número, "protein_g": número, "carbs_g": número, "fat_g": número}}` | 200 con el alimento editado en el formato de resultado de la biblioteca de la 028 | 400 (ver tabla), 404 `No encontramos ese alimento.`, 409 `Ya tienes un alimento con ese nombre.` |

Respuesta 200 de ejemplo:

```json
{
  "kind": "custom",
  "id": 12,
  "name": "Gallo pinto con huevo",
  "per_100g": { "calories_kcal": 200.0, "protein_g": 9.0, "carbs_g": 28.0, "fat_g": 6.0 },
  "favorite": true
}
```

| Caso | Código | Mensaje |
|---|---|---|
| Cuerpo que no es un objeto JSON | 400 | `La petición no es válida` |
| `name` ausente, vacío o solo con espacios | 400 | `Escribe el nombre del alimento.` |
| `name` de más de 100 caracteres sin los espacios de los extremos | 400 | `El nombre no puede superar los 100 caracteres.` |
| `per_100g` ausente o sin alguno de sus cuatro valores | 400 | `Indica las calorías, proteína, carbohidratos y grasa por 100 g.` |
| Calorías fuera de 0 a 900 | 400 | `Las calorías por 100 g deben estar entre 0 y 900.` |
| Proteína, carbohidratos o grasa fuera de 0 a 100 | 400 | `Los macros por 100 g deben estar entre 0 y 100 g.` |
| Proteína + carbohidratos + grasa > 100 | 400 | `La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g.` |
| Alimento que no existe, de otro usuario o identificador no válido | 404 | `No encontramos ese alimento.` |
| Nombre igual al de otro alimento propio del usuario (regla de nombres de la 028) | 409 | `Ya tienes un alimento con ese nombre.` |

El nombre se guarda sin los espacios de los extremos. El identificador y el estado de favorito no cambian. Las comidas ya
registradas conservan su copia (REQ-005). El resto de contratos de la 028 no cambia.

**Pantallas (búsqueda compartida: diálogo «Añadir a {sección}» y búsquedas de la propuesta de foto):**

| Elemento | Texto |
|---|---|
| Botón en los alimentos propios | «Editar» (nombre accesible «Editar {nombre}»), después de «Elegir» y de la estrella, antes de «Borrar» |
| Formulario de edición | Título «Editar «{nombre}»»; campos «Nombre», «Calorías por 100 g (kcal)», «Proteína por 100 g (g)», «Carbohidratos por 100 g (g)» y «Grasa por 100 g (g)»; botones «Guardar» y «Cancelar»; dentro del elemento, en su lista |
| Guardando | «Guardando…», con los botones deshabilitados |
| Nombre repetido | «Ya tienes un alimento con ese nombre.» junto a «Nombre»; «Guardar» deshabilitado |
| Alimento ya borrado | «No encontramos ese alimento.» |
| Error al guardar | «No se pudo guardar el alimento.» |
| Validación de campos | Los mensajes del formulario de alimento personalizado de la 022 |

**Producción:** sin variables nuevas ni pasos manuales previstos; si el plan necesitara una migración, lo dirá y se
documentará (Art. P4).

## 7. Preguntas abiertas

Todas resueltas: el usuario aceptó las propuestas por defecto de Q1 a Q7, que ya están incorporadas en los requisitos.

- **Q1 (resuelta):** «Editar» en «Favoritos», «Recientes» y «Resultados» (REQ-006, AC-006.2).
- **Q2 (resuelta):** también en la búsqueda de la propuesta de foto (AC-006.3, AC-007.4, REQ-011).
- **Q3 (resuelta):** el nombre repetido se compara con todos los alimentos propios del usuario, no con el catálogo ni
  consigo mismo (REQ-003, REQ-009).
- **Q4 (resuelta):** regla de «cambio» de REQ-008.
- **Q5 (resuelta):** las filas de la propuesta con el alimento editado se actualizan conservando los gramos (REQ-011).
- **Q6 (resuelta):** «Cancelar» y Escape descartan sin confirmación (REQ-007).
- **Q7 (resuelta):** si la comprobación del nombre falla, «Guardar» se habilita y decide el servidor (REQ-009,
  AC-009.5, AC-010.3).

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿«Editar» va solo en «Favoritos», como se pidió, o también en «Recientes» y en los resultados de búsqueda? | En las tres listas, como «Borrar» de la 028: así un alimento propio que no es favorito se puede editar sin marcarlo antes (REQ-006, AC-006.2). Alternativa: solo en «Favoritos». | acepto todas las propuestas |
| Q2 | La búsqueda es compartida con la propuesta de foto. ¿«Editar» aparece también ahí? | Sí, con el mismo comportamiento (AC-006.3, AC-007.4 y REQ-011). Alternativa: solo en el diálogo «Añadir a {sección}». | acepto todas las propuestas |
| Q3 | El aviso de nombre repetido dice «otro favorito». ¿Se compara solo con los favoritos o con todos los alimentos propios del usuario? | Con todos los alimentos propios (favoritos o no), porque la biblioteca no admite dos con el mismo nombre y el servidor lo rechazaría igual; los nombres del catálogo no cuentan y su propio nombre con otras mayúsculas o tildes tampoco (REQ-003 y REQ-009). Texto: «Ya tienes un alimento con ese nombre.». | acepto todas las propuestas |
| Q4 | ¿Qué cuenta como «cambio» para habilitar «Guardar»? | Nombre distinto sin los espacios de los extremos (una mayúscula o tilde sí cuenta) o un número distinto («6», «6,0» y «6.0» son iguales); un campo no válido cuenta como cambio y se valida al pulsar «Guardar», como en el formulario de la 022 (REQ-008). | acepto todas las propuestas |
| Q5 | Si en la propuesta de foto ya hay filas con el alimento editado, ¿qué pasa con ellas? | Se actualizan al nombre y los valores nuevos, conservando sus gramos, para que lo que se ve sea lo que se guarda: al guardar la propuesta, el servidor copia los valores actuales del alimento propio (REQ-011). Alternativa: conservar los valores antiguos en la fila, que no coincidirían con lo guardado. | acepto todas las propuestas |
| Q6 | Al cancelar o pulsar Escape con cambios sin guardar, ¿se pide confirmación? | No: se descartan sin preguntar, como «Cancelar» de la confirmación de borrado de la 028; el formulario es corto (REQ-007). | acepto todas las propuestas |
| Q7 | Si la comprobación del nombre repetido no puede hacerse (fallo de red), ¿qué hace «Guardar»? | Se habilita sin aviso y decide el servidor: si responde 409, se muestra el aviso y «Guardar» vuelve a deshabilitarse hasta cambiar el nombre (AC-009.5 y AC-010.3). | acepto todas las propuestas |

## 8. Glosario

- **Alimento propio / tus alimentos:** alimento personalizado guardado en la biblioteca del usuario (028), identificado
  por `custom_food_id`.
- **Regla de nombres de la 028:** dos nombres son el mismo si coinciden sin distinguir mayúsculas ni tildes, sin espacios
  en los extremos y con los espacios repetidos contados como uno.
- **Búsqueda compartida:** el componente de búsqueda del diálogo «Añadir a {sección}» y de la propuesta de foto (028).
- **Formulario en línea:** formulario que se muestra dentro del elemento de la lista, sin ventana modal.
