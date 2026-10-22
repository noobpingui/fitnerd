# Spec 025 — Registro de una comida con foto desde el diario

- **Feature:** `025-meal-photo-upload` · **Tipo:** feature
- **Ámbitos:** `frontend` (Q8 resuelta: el backend no cambia; el estado aún lista `backend` y el planner debe quitarlo)

## 1. Contexto y problema

Desde la spec 022 el usuario registra en el diario (`/diary`) lo que come, alimento por alimento, en cuatro tarjetas de
comida (Desayuno, Almuerzo, Cena y Meriendas). Desde la 023 busca en un catálogo propio de alimentos simples en español,
y desde la 024 existe `POST /api/meals/analyze`, que recibe la foto de una comida y devuelve los alimentos del catálogo
que reconoce, con gramos estimados, una confianza y sus macros, más los alimentos que ve y no están en el catálogo
(`unmatched`). Ninguna pantalla usa todavía ese análisis: registrar un plato con varios alimentos sigue siendo lento.

Esta spec cierra el plan de registro con foto (specs 021–025): desde cada tarjeta del diario el usuario hace o elige una
foto, la app la reduce en el dispositivo, la analiza y le muestra la propuesta para que la revise (corregir gramos,
quitar alimentos, resolver los que no están en el catálogo y añadir los que falten) antes de guardarla en esa comida.
Si el análisis no sirve, el usuario pasa al registro manual de la misma tarjeta sin perder el paso.

Incluye además los pendientes que el backlog asigna a la 025: actualizar la Política de privacidad (las fotos se
procesan en Amazon Web Services), tratar las fotos HEIC del iPhone, aplicar la orientación de la foto al reducirla
(la 024 quita sus metadatos y, con ellos, la orientación) y guardar varios alimentos en una sola petición.

## 2. Historia de usuario

Como **usuario de fitnerd con sesión iniciada y onboarding completado**, quiero **hacer una foto de mi comida desde una
tarjeta del diario, revisar los alimentos que propone la app y guardarlos en esa comida** para **registrar lo que como
en segundos, sin buscar cada alimento a mano y sin perder el control de lo que se guarda**.

## 3. Alcance

**Incluye:**
- Botón «Cargar imagen» en cada tarjeta de comida del diario, junto a «Añadir alimento».
- Un diálogo por tarjeta (a pantalla completa en pantallas estrechas) con todo el flujo:
  - hacer una foto con la cámara o elegir una foto del dispositivo, una sola por vez, con vista previa;
  - validación de la foto en el dispositivo (tipo, tamaño original y que se pueda leer), incluidas las fotos HEIC o
    HEIF cuando el navegador las sabe leer;
  - reducción de la foto en el dispositivo a JPEG, aplicando su orientación;
  - análisis con `POST /api/meals/analyze` (spec 024) y sus estados de carga y error;
  - revisión de la propuesta: gramos editables con vista previa de macros, confianza visible, alimentos sin
    coincidencia marcados, quitar alimentos, añadir un alimento que falte con la búsqueda del catálogo (023), y
    resolver un alimento sin coincidencia buscándolo en el catálogo o creándolo como personalizado;
  - guardado de todos los alimentos de la propuesta en una sola petición a `POST /api/meals` (sin cambios en ese
    endpoint), con el tipo de comida de la tarjeta y el día que muestra el diario; si la comida ya tiene alimentos, los
    nuevos se suman a ellos;
  - paso al registro manual de la misma tarjeta si el análisis falla, se alcanza el límite de uso o no reconoce nada.
- Actualización de la Política de privacidad: las fotos de comidas se procesan en Amazon Web Services y no se guardan.

**Fuera de alcance:**
- Cualquier cambio en el backend: `POST /api/meals/analyze`, `POST /api/meals`, `GET /api/catalog/search` y el resto de
  endpoints quedan igual (ver Q8).
- Varias fotos a la vez, varias fotos por comida, arrastrar y soltar archivos y pegar imágenes desde el portapapeles.
- Guardar la foto o mostrarla después en el diario; historial de análisis.
- Un texto del usuario que acompañe a la foto (backlog de la 024).
- Navegar a otros días en el diario (backlog de la 022): la foto se registra en el día que muestra el diario.
- Admitir HEIC en el servidor o añadir una dependencia para convertir HEIC en navegadores que no lo leen (ver Q4).
- Guardar alimentos sin coincidencia sin resolverlos (no tienen macros) y una biblioteca de alimentos personalizados.
- Mostrar cuántos análisis le quedan al usuario en la hora.
- El tope de gasto global con el proveedor y la caché del prompt (backlog de la 024).
- Cambiar los diálogos existentes «Añadir a {sección}» y «Editar gramos», salvo abrir «Añadir a {sección}» desde el
  diálogo de la foto.

## 4. Requisitos funcionales

### Entrada al flujo

### REQ-001 — Botón «Cargar imagen» en cada tarjeta
THE SYSTEM SHALL mostrar en cada tarjeta de comida del diario un botón «Cargar imagen» junto a «Añadir alimento».
WHEN el usuario lo pulsa THE SYSTEM SHALL abrir el diálogo «Añadir a {sección} con una foto» de esa tarjeta, que en
pantallas de menos de 640 px de ancho ocupa toda la pantalla.

- **AC-001.1:** Given un diario simulado de hoy, When se muestra la pantalla, Then cada una de las cuatro tarjetas
  (Desayuno, Almuerzo, Cena y Meriendas) tiene un botón «Cargar imagen» además de su «Añadir alimento», y su nombre
  accesible es «Cargar imagen en {sección}» (p. ej. «Cargar imagen en Cena»).
- **AC-001.2:** Given la tarjeta Cena, When el usuario pulsa su «Cargar imagen», Then se abre un diálogo con el título
  «Añadir a Cena con una foto», los botones «Hacer una foto», «Elegir una foto» y «Cancelar», y el texto «Puedes
  analizar hasta 10 fotos por hora.».
- **AC-001.3:** Given una pantalla de 375 px de ancho, When se abre el diálogo, Then ocupa todo el ancho y todo el alto
  de la pantalla; y Given una pantalla de 1024 px, Then se muestra como un diálogo centrado, como «Añadir a {sección}».
- **AC-001.4:** Given el diálogo sin foto elegida, When el usuario pulsa «Cancelar» o cierra el diálogo, Then se cierra
  sin hacer ninguna petición.

### REQ-002 — Hacer o elegir una foto
WHEN el usuario pulsa «Hacer una foto» THE SYSTEM SHALL abrir la cámara trasera del dispositivo donde el navegador lo
permita (en escritorio, el selector de archivos), y WHEN pulsa «Elegir una foto» THE SYSTEM SHALL abrir el selector de
archivos de imagen. En los dos casos se elige un solo archivo. WHEN el usuario elige una foto válida THE SYSTEM SHALL
mostrar su vista previa con los botones «Analizar foto» y «Cambiar foto», sin hacer ninguna petición hasta que pulse
«Analizar foto».

- **AC-002.1:** Given el diálogo, When se inspeccionan los dos selectores de archivo, Then ninguno admite varios
  archivos, los dos aceptan solo imágenes JPEG, PNG, WebP, HEIC y HEIF, y el de «Hacer una foto» pide la cámara
  trasera.
- **AC-002.2:** Given el diálogo, When el usuario elige una foto JPEG válida, Then se ve la imagen «Vista previa de la
  foto» y los botones «Analizar foto» y «Cambiar foto», y no se ha hecho ninguna petición de análisis.
- **AC-002.3:** Given una foto en vista previa, When el usuario pulsa «Cambiar foto» y elige otra, Then la vista previa
  muestra la nueva y la anterior se descarta.

### REQ-003 — Validación de la foto en el dispositivo
IF el archivo elegido no es una imagen JPEG, PNG, WebP, HEIC ni HEIF, supera los 20 MB o el navegador no lo puede leer
THEN THE SYSTEM SHALL mostrar el mensaje correspondiente de la sección 6, SHALL NOT mostrar la vista previa ni hacer
ninguna petición, y SHALL dejar elegir otra foto.

- **AC-003.1:** Given el diálogo, When el usuario elige un archivo PDF o un GIF, Then se ve «Elige una foto JPEG, PNG,
  WebP o HEIC.» y no se hace ninguna petición.
- **AC-003.2:** Given el diálogo, When el usuario elige una foto JPEG de 20 × 1024 × 1024 bytes, Then se acepta; y When
  elige una de 20 × 1024 × 1024 + 1 bytes, Then se ve «La foto no puede superar los 20 MB.» y no se hace ninguna
  petición.
- **AC-003.3:** Given un archivo con tipo JPEG que el navegador no puede leer (contenido dañado), o una foto HEIC en un
  navegador que no lee HEIC, When el usuario la elige, Then se ve «No se pudo leer la foto. Prueba con otra foto en
  JPEG, PNG o WebP.» y no se hace ninguna petición.
- **AC-003.4:** Given un mensaje de error de validación, When el usuario elige después una foto válida, Then el mensaje
  desaparece y se ve su vista previa.

### REQ-004 — Reducción de la foto y orientación
WHEN el usuario pulsa «Analizar foto» THE SYSTEM SHALL enviar a `POST /api/meals/analyze` una sola imagen en el campo
`image`, generada en el dispositivo a partir de la foto elegida: en JPEG, con la orientación de la foto aplicada (tal
como se ve en la vista previa), con su lado mayor reducido a 1600 px si lo supera y conservando la proporción, sin
agrandar las fotos más pequeñas y de 3 MB como mucho.
IF la imagen generada supera los 3 MB THEN THE SYSTEM SHALL mostrar «La imagen no puede superar los 3 MB.» sin hacer la
petición.

- **AC-004.1:** Given una foto JPEG de 4000 × 3000 px sin orientación, When se analiza, Then la petición lleva en
  `image` un único archivo JPEG de 1600 × 1200 px.
- **AC-004.2:** Given una foto PNG de 800 × 600 px, When se analiza, Then la petición lleva un JPEG de 800 × 600 px.
- **AC-004.3:** Given una foto JPEG guardada en 4000 × 3000 px con la orientación «girada 90°» (EXIF 6), When se
  analiza, Then la petición lleva un JPEG de 1200 × 1600 px con la imagen derecha, como en la vista previa.
- **AC-004.4:** Given una foto HEIC que el navegador sabe leer, When se analiza, Then la petición lleva un JPEG.
- **AC-004.5:** Given una imagen generada de más de 3 × 1024 × 1024 bytes, When el usuario pulsa «Analizar foto», Then
  se ve «La imagen no puede superar los 3 MB.» y no se hace ninguna petición.

### Análisis

### REQ-005 — Estado de análisis
WHILE el análisis está en curso THE SYSTEM SHALL mostrar «Analizando la foto…» y desactivar «Analizar foto» y «Cambiar
foto». WHEN el usuario cierra el diálogo durante el análisis THE SYSTEM SHALL cerrarlo y descartar el resultado cuando
llegue, sin guardar nada.

- **AC-005.1:** Given un análisis simulado que aún no responde, When el usuario pulsó «Analizar foto», Then se ve
  «Analizando la foto…» y los botones «Analizar foto» y «Cambiar foto» están desactivados.
- **AC-005.2:** Given un análisis en curso, When el usuario pulsa «Cancelar» y después llega la respuesta, Then el
  diálogo sigue cerrado, no se hace ninguna petición para guardar y el diario no cambia.

### REQ-006 — Revisión de la propuesta
WHEN el análisis responde 200 con al menos un alimento en `items` o en `unmatched` THE SYSTEM SHALL mostrar la propuesta:
los alimentos de `items` en su orden, cada uno con su nombre, un campo «Gramos» con los gramos estimados, su confianza
y la vista previa de sus macros para esos gramos; después, los de `unmatched`, marcados «Sin coincidencia en el
catálogo», con su nombre, sus gramos estimados y su confianza, sin macros; y el total de la propuesta, que suma solo los
alimentos que se van a guardar.

- **AC-006.1:** Given un análisis simulado con «Arroz blanco cocido» (150 g, confianza `high`, 130 kcal, 2,69 g de
  proteína, 28,17 g de carbohidratos y 0,28 g de grasa por 100 g), When se muestra la propuesta, Then se ve «Arroz
  blanco cocido», el campo «Gramos de Arroz blanco cocido» con 150, «Confianza alta» y «195 kcal · 4,0 g proteína ·
  42,3 g carbohidratos · 0,4 g grasa».
- **AC-006.2:** Given alimentos con confianza `high`, `medium` y `low`, When se muestran, Then se ven «Confianza alta»,
  «Confianza media» y «Confianza baja», como texto (no solo con color).
- **AC-006.3:** Given un análisis simulado con «Salsa de tomate» en `unmatched` (30 g, confianza `low`), When se muestra
  la propuesta, Then se ve «Salsa de tomate» con la marca «Sin coincidencia en el catálogo», «30 g» y «Confianza baja»,
  sin calorías ni macros, y con los botones «Buscar Salsa de tomate en el catálogo», «Crear Salsa de tomate como
  personalizado» y «Quitar Salsa de tomate».
- **AC-006.4:** Given una propuesta con el arroz de AC-006.1, «Pechuga de pollo a la plancha» de 100 g (165 kcal, 31 g
  de proteína, 0 g de carbohidratos y 3,57 g de grasa por 100 g) y «Salsa de tomate» sin coincidencia, When se muestra,
  Then el total es «Total: 360 kcal · 35,0 g proteína · 42,3 g carbohidratos · 4,0 g grasa» (la salsa no cuenta).
- **AC-006.5:** Given una propuesta con algún alimento sin coincidencia sin resolver, When se muestra, Then se ve
  «Los alimentos sin coincidencia no se guardan: búscalos en el catálogo, créalos como personalizados o quítalos.».

### REQ-007 — Editar los gramos de la propuesta
WHEN el usuario cambia los gramos de un alimento de la propuesta THE SYSTEM SHALL recalcular su vista previa y el total
de la propuesta sin hacer ninguna petición, con las mismas reglas de gramos del diario (de 1 a 2000, como mucho un
decimal, con coma o punto). IF algún gramo de la propuesta no es válido THEN THE SYSTEM SHALL mostrar el aviso junto al
campo y SHALL NOT guardar al pulsar «Guardar en {sección}».

- **AC-007.1:** Given el arroz de AC-006.1, When el usuario cambia sus gramos a 200, Then su vista previa pasa a
  «260 kcal · 5,4 g proteína · 56,3 g carbohidratos · 0,6 g grasa», el total se actualiza y no se hace ninguna petición.
- **AC-007.2:** Given el campo de gramos con «150,5», When se guarda la propuesta, Then se envían 150.5 gramos.
- **AC-007.3:** Given un campo de gramos vacío, con 0, con 2001 o con «150,25», When el usuario pulsa «Guardar en
  {sección}», Then junto a ese campo se ve «Los gramos deben estar entre 1 y 2000.» o «Los gramos admiten como mucho un
  decimal.» y no se hace ninguna petición.

### REQ-008 — Quitar alimentos de la propuesta
WHEN el usuario pulsa «Quitar {nombre}» en un alimento de la propuesta THE SYSTEM SHALL quitarlo de la propuesta sin
pedir confirmación y recalcular el total.

- **AC-008.1:** Given la propuesta de AC-006.4, When el usuario pulsa «Quitar Pechuga de pollo a la plancha», Then la
  pechuga deja de verse y el total pasa a «Total: 195 kcal · 4,0 g proteína · 42,3 g carbohidratos · 0,4 g grasa».
- **AC-008.2:** Given la propuesta de AC-006.4, When el usuario quita «Salsa de tomate», Then deja de verse y también el
  aviso de AC-006.5.

### REQ-009 — Añadir un alimento que falta
WHEN el usuario pulsa «Añadir otro alimento» en la propuesta THE SYSTEM SHALL mostrar la búsqueda del catálogo con los
mismos textos, estados y validaciones que el diálogo «Añadir a {sección}» de la 023 y, al elegir un resultado, SHALL
añadirlo al final de la propuesta con 100 g editables y la etiqueta «Añadido por ti» en lugar de la confianza, y volver a
la propuesta. WHEN el usuario pulsa «Volver a la propuesta» THE SYSTEM SHALL volver sin cambios.

- **AC-009.1:** Given la propuesta, When el usuario pulsa «Añadir otro alimento», Then se ven la caja «Buscar alimento»
  y el botón «Buscar», y el texto de ayuda de la búsqueda del catálogo.
- **AC-009.2:** Given una búsqueda simulada del catálogo para «aguacate» con «Aguacate», When el usuario pulsa «Elegir
  Aguacate», Then vuelve a la propuesta, «Aguacate» aparece al final con el campo de gramos a 100, la etiqueta «Añadido
  por ti» y su vista previa, y el total lo incluye.
- **AC-009.3:** Given la búsqueda abierta desde la propuesta, When el usuario pulsa «Volver a la propuesta», Then ve la
  propuesta igual que antes.
- **AC-009.4:** Given un alimento del catálogo que ya está en la propuesta, When el usuario lo elige otra vez, Then
  aparece dos veces en la propuesta y las dos se guardan.

### REQ-010 — Resolver un alimento sin coincidencia
WHEN el usuario pulsa «Buscar {nombre} en el catálogo» en un alimento sin coincidencia THE SYSTEM SHALL abrir la búsqueda
del catálogo con su nombre ya escrito y buscado y, al elegir un resultado, SHALL sustituir el alimento sin coincidencia
por ese alimento del catálogo, en la misma posición y con los mismos gramos estimados.
WHEN el usuario pulsa «Crear {nombre} como personalizado» THE SYSTEM SHALL mostrar el formulario de alimento
personalizado del diario con el nombre y los gramos ya rellenos y, al pulsar «Añadir a la propuesta» con el formulario
válido, SHALL sustituir el alimento sin coincidencia por ese alimento personalizado, en la misma posición.
En los dos casos el alimento sustituido deja de estar marcado «Sin coincidencia en el catálogo» y cuenta en el total.

- **AC-010.1:** Given «Salsa de tomate» (30 g) sin coincidencia y una búsqueda simulada del catálogo para «Salsa de
  tomate» con «Tomate», When el usuario pulsa «Buscar Salsa de tomate en el catálogo», Then se ve la caja «Buscar
  alimento» con «Salsa de tomate» y se pide la búsqueda de ese texto; y When pulsa «Elegir Tomate», Then «Tomate» ocupa
  la posición de la salsa con el campo de gramos a 30, la etiqueta «Añadido por ti» y su vista previa.
- **AC-010.2:** Given «Gallo pinto» (200 g) sin coincidencia, When el usuario pulsa «Crear Gallo pinto como
  personalizado», Then se ve el formulario con «Nombre» «Gallo pinto», «Gramos» 200 y los cuatro valores por 100 g
  vacíos.
- **AC-010.3:** Given ese formulario con 160, 5,5, 27 y 3,2 por 100 g, When el usuario pulsa «Añadir a la propuesta»,
  Then «Gallo pinto» ocupa su posición con la etiqueta «Personalizado», el campo de gramos a 200 y la vista previa
  «320 kcal · 11,0 g proteína · 54,0 g carbohidratos · 6,4 g grasa», y el total lo incluye.
- **AC-010.4:** Given el formulario con algún valor vacío o fuera de los límites del diario, When el usuario pulsa
  «Añadir a la propuesta», Then se ven los mensajes del formulario personalizado del diario y la propuesta no cambia.
- **AC-010.5:** Given la búsqueda o el formulario abiertos desde un alimento sin coincidencia, When el usuario pulsa
  «Volver a la propuesta», Then el alimento sigue sin coincidencia y en su posición.

### Guardado

### REQ-011 — Guardar la propuesta en la comida
WHEN el usuario pulsa «Guardar en {sección}» con al menos un alimento que se pueda guardar y todos los gramos válidos THE
SYSTEM SHALL enviar una sola petición a `POST /api/meals` con la fecha que muestra el diario, el tipo de comida de la
tarjeta y todos los alimentos que se pueden guardar en el orden de la propuesta (`{"catalog_id", "grams"}` los del
catálogo y `{"name", "grams", "per_100g"}` los personalizados), sin los alimentos sin coincidencia; y, si responde bien,
SHALL cerrar el diálogo y volver a leer el diario, en el que los alimentos nuevos se suman a los que ya tenía la comida.
WHILE no haya ningún alimento que se pueda guardar THE SYSTEM SHALL desactivar «Guardar en {sección}» y mostrar
«Añade al menos un alimento para guardar.».

- **AC-011.1:** Given la propuesta de AC-006.4 en la tarjeta Almuerzo con la fecha del diario `2026-10-22`, When el
  usuario pulsa «Guardar en Almuerzo», Then se hace una sola petición con `{"date": "2026-10-22", "meal_type": "lunch",
  "items": [{"catalog_id": "arroz-blanco-cocido", "grams": 150}, {"catalog_id": "pechuga-de-pollo-a-la-plancha",
  "grams": 100}]}`, el diálogo se cierra y el diario se vuelve a leer.
- **AC-011.2:** Given una propuesta con un alimento del catálogo y el «Gallo pinto» personalizado de AC-010.3, When se
  guarda, Then `items` lleva los dos, en el orden de la propuesta, el personalizado como `{"name": "Gallo pinto",
  "grams": 200, "per_100g": {"calories_kcal": 160, "protein_g": 5.5, "carbs_g": 27, "fat_g": 3.2}}`.
- **AC-011.3:** Given la tarjeta Almuerzo con dos alimentos ya registrados y una propuesta con uno, When se guarda y el
  diario se vuelve a leer, Then Almuerzo muestra los tres alimentos.
- **AC-011.4:** Given una propuesta en la que se quitaron todos los alimentos o que solo tiene alimentos sin
  coincidencia, When se muestra, Then «Guardar en {sección}» está desactivado y se ve «Añade al menos un alimento para
  guardar.».
- **AC-011.5:** Given un guardado en curso, When aún no llega la respuesta, Then el botón muestra «Guardando…» y está
  desactivado, y el diálogo no se puede cerrar.
- **AC-011.6:** Given que guardar responde 400 (p. ej. «Una comida no puede tener más de 50 alimentos.»), When termina,
  Then el diálogo sigue abierto con la propuesta intacta y se ve el mensaje del servidor; y Given cualquier otro error,
  Then se ve «No se pudo guardar. Vuelve a intentarlo.».

### Fallos y registro manual

### REQ-012 — Fallos del análisis y paso al registro manual
IF el análisis responde 503, 429 o falla por la red o por un error inesperado, o responde 200 sin ningún alimento en
`items` ni en `unmatched`, THEN THE SYSTEM SHALL mostrar el mensaje correspondiente de la sección 6 con el botón
«Registrar a mano», que cierra este diálogo y abre «Añadir a {sección}» de la misma tarjeta. IF el análisis responde 400
o 413 THEN THE SYSTEM SHALL mostrar el mensaje del servidor con «Cambiar foto».

- **AC-012.1:** Given un análisis simulado que responde 503 con el mensaje de la 024, When termina, Then se ven «No se
  pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos.», «Reintentar» y «Registrar a mano».
- **AC-012.2:** Given el caso de AC-012.1, When el usuario pulsa «Reintentar», Then se vuelve a enviar la misma imagen y
  se ve «Analizando la foto…».
- **AC-012.3:** Given un análisis simulado que responde 429, When termina, Then se ve «Alcanzaste el límite de 10
  análisis por hora. Vuelve a intentarlo en un rato.» con «Registrar a mano» y sin «Reintentar».
- **AC-012.4:** Given un análisis simulado que falla por la red, When termina, Then se ve «No se pudo analizar la foto.
  Vuelve a intentarlo.» con «Reintentar» y «Registrar a mano».
- **AC-012.5:** Given un análisis simulado que responde 200 con `items` y `unmatched` vacíos, When termina, Then se ven
  «No reconocimos alimentos en la foto.», «Cambiar foto» y «Registrar a mano».
- **AC-012.6:** Given un análisis simulado que responde 400 con «La imagen debe ser JPEG, PNG o WebP.», When termina,
  Then se ve ese mensaje y «Cambiar foto».
- **AC-012.7:** Given el diálogo de la tarjeta Cena con un error de AC-012.1, AC-012.3 o AC-012.5, When el usuario pulsa
  «Registrar a mano», Then el diálogo de la foto se cierra y se abre «Añadir a Cena».
- **AC-012.8:** Given una respuesta 200 con `items` vacío y un alimento en `unmatched`, When termina, Then se muestra la
  propuesta (REQ-006), no el mensaje de AC-012.5.

### REQ-013 — Cerrar el diálogo con una propuesta
WHEN el usuario pulsa «Cancelar» o cierra el diálogo con una propuesta sin guardar THE SYSTEM SHALL cerrarlo sin guardar
nada y sin pedir confirmación.

- **AC-013.1:** Given una propuesta, When el usuario pulsa «Cancelar», Then el diálogo se cierra, no se hace ninguna
  petición para guardar y el diario no cambia.
- **AC-013.2:** Given que el usuario cerró el diálogo con una propuesta, When lo vuelve a abrir, Then empieza sin foto.

### Páginas legales

### REQ-014 — Política de privacidad
THE SYSTEM SHALL mencionar en la «Política de privacidad», en «Con quién se comparte», que las fotos de comidas que el
usuario envía para analizar se procesan con Amazon Web Services (Amazon Bedrock), sin sus metadatos y sin guardarse en
fitnerd; y SHALL mencionar en el punto de Langfuse que del análisis de fotos solo se envían datos del análisis, nunca la
foto. La fecha de actualización pasa a la del cambio.

- **AC-014.1:** Given la página «Política de privacidad», When se muestra, Then en «Con quién se comparte» hay un punto
  «Amazon Web Services (Amazon Bedrock):» con el texto «Las fotos de comidas que envías para analizar se procesan con un
  modelo de IA de Amazon Bedrock para reconocer los alimentos. Se envían sin sus metadatos (ubicación, cámara y fecha) y
  fitnerd no las guarda.».
- **AC-014.2:** Given la página, When se muestra, Then el punto de Langfuse contiene «Del análisis de fotos solo se
  envían el formato, el tamaño y el número de alimentos reconocidos, nunca la foto.».
- **AC-014.3:** Given la página, When se muestra, Then su fecha de actualización es «22 de octubre de 2026» y los demás
  puntos de la política siguen igual.

## 5. Requisitos no funcionales

### NFR-001 — La foto no sale del flujo
THE SYSTEM SHALL usar la foto solo para la vista previa y para la petición de análisis: SHALL NOT guardarla en el
almacenamiento del navegador ni enviarla en ninguna otra petición, y SHALL liberar la vista previa al cambiar de foto o
cerrar el diálogo.

- **AC-N001.1:** Given un flujo completo (elegir, analizar y guardar), When termina, Then el almacenamiento local y de
  sesión del navegador no tiene claves nuevas y la petición de guardado no contiene datos de la imagen.
- **AC-N001.2:** Given una foto en vista previa, When el usuario cambia de foto o cierra el diálogo, Then la vista previa
  anterior se libera.

### NFR-002 — Accesibilidad del flujo con foto
THE SYSTEM SHALL dar nombre accesible al diálogo, a sus botones y a sus campos, y anunciar a los lectores de pantalla
los cambios de estado (análisis, errores y guardado).

- **AC-N002.1:** Given el diálogo, When se consulta por su rol, Then es un diálogo con el nombre «Añadir a {sección} con
  una foto»; cada campo de gramos se encuentra por su etiqueta «Gramos de {nombre}»; y los botones «Quitar», «Buscar» y
  «Crear» llevan el nombre del alimento.
- **AC-N002.2:** Given los estados «Analizando la foto…», los errores de validación y de análisis, y los errores al
  guardar, When aparecen, Then están dentro de una región que se anuncia a los lectores de pantalla.

### NFR-003 — Carga bajo demanda
THE SYSTEM SHALL mantener el chunk de entrada de la aplicación en 500 kB como mucho (ADR-0026): el código del flujo con
foto solo se descarga con la pantalla «Diario».

- **AC-N003.1:** Given la aplicación, When se carga una ruta distinta de `/diary`, Then el código del diálogo de la foto
  no se ha descargado.

## 6. Datos y contratos visibles

**Endpoints que usa (sin cambios):**
- `POST /api/meals/analyze` (spec 024): `multipart/form-data` con un único archivo en `image`. La app envía siempre un
  JPEG de lado mayor ≤ 1600 px y ≤ 3 MB. Respuesta 200 con `items`, `unmatched` y `totals`; errores 400, 413, 429 y 503
  con `{"error": "…"}`.
- `POST /api/meals` (specs 022 y 023): `{"date", "meal_type", "items"}`, con `items` de catálogo
  `{"catalog_id", "grams"}` y personalizados `{"name", "grams", "per_100g"}`. Todo o nada; límite de 50 alimentos por
  comida.
- `GET /api/catalog/search` (spec 023), para añadir o resolver alimentos.

**Foto en el dispositivo:**

| Regla | Valor |
|---|---|
| Tipos que se pueden elegir | JPEG, PNG, WebP, HEIC y HEIF (HEIC y HEIF solo si el navegador los sabe leer) |
| Tamaño máximo del archivo elegido | 20 MB (20 × 1024 × 1024 bytes) |
| Imagen enviada | JPEG, con la orientación aplicada, lado mayor ≤ 1600 px (sin agrandar), proporción conservada, ≤ 3 MB |
| Fotos por análisis | Una |

**Diálogo «Añadir a {sección} con una foto»:**

| Elemento | Texto |
|---|---|
| Botón en la tarjeta | «Cargar imagen» (nombre accesible «Cargar imagen en {sección}») |
| Título | «Añadir a {sección} con una foto» |
| Inicio | Botones «Hacer una foto», «Elegir una foto» y «Cancelar»; texto «Puedes analizar hasta 10 fotos por hora.» |
| Vista previa | Imagen «Vista previa de la foto»; botones «Analizar foto» y «Cambiar foto» |
| Analizando | «Analizando la foto…» |
| Alimento del catálogo | Nombre; campo «Gramos de {nombre}»; «Confianza alta», «Confianza media» o «Confianza baja» (o «Añadido por ti» si lo eligió el usuario); vista previa «{kcal} kcal · {g} g proteína · {g} g carbohidratos · {g} g grasa»; botón «Quitar {nombre}» |
| Alimento personalizado | Igual, con la etiqueta «Personalizado» |
| Alimento sin coincidencia | Nombre; «Sin coincidencia en el catálogo»; «{gramos} g»; confianza; botones «Buscar {nombre} en el catálogo», «Crear {nombre} como personalizado» y «Quitar {nombre}» |
| Aviso de sin coincidencia | «Los alimentos sin coincidencia no se guardan: búscalos en el catálogo, créalos como personalizados o quítalos.» |
| Total | «Total: {kcal} kcal · {g} g proteína · {g} g carbohidratos · {g} g grasa» (solo alimentos que se guardan) |
| Acciones de la propuesta | «Añadir otro alimento», «Guardar en {sección}», «Cancelar» |
| Búsqueda desde la propuesta | Los textos de la búsqueda del catálogo de la 023 y el botón «Volver a la propuesta» |
| Formulario personalizado | Los campos y mensajes del diario (022) y los botones «Añadir a la propuesta» y «Volver a la propuesta» |
| Sin alimentos para guardar | «Añade al menos un alimento para guardar.» y «Guardar en {sección}» desactivado |
| Guardando | «Guardando…», botón desactivado |

Formato de valores: el del diario (kcal sin decimales, gramos de nutrientes con un decimal y coma decimal).

**Mensajes:**

| Caso | Mensaje | Acciones |
|---|---|---|
| Archivo que no es JPEG, PNG, WebP, HEIC ni HEIF | «Elige una foto JPEG, PNG, WebP o HEIC.» | Elegir otra |
| Archivo de más de 20 MB | «La foto no puede superar los 20 MB.» | Elegir otra |
| El navegador no puede leer la foto | «No se pudo leer la foto. Prueba con otra foto en JPEG, PNG o WebP.» | Elegir otra |
| Imagen generada de más de 3 MB | «La imagen no puede superar los 3 MB.» | «Cambiar foto» |
| Análisis 400 o 413 | El mensaje del servidor | «Cambiar foto» |
| Análisis 429 | El mensaje del servidor («Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato.») | «Registrar a mano» |
| Análisis 503 | El mensaje del servidor («No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos.») | «Reintentar», «Registrar a mano» |
| Fallo de red u otro error del análisis | «No se pudo analizar la foto. Vuelve a intentarlo.» | «Reintentar», «Registrar a mano» |
| Análisis sin ningún alimento | «No reconocimos alimentos en la foto.» | «Cambiar foto», «Registrar a mano» |
| Gramos no válidos | «Los gramos deben estar entre 1 y 2000.» o «Los gramos admiten como mucho un decimal.» | — |
| Guardar responde 400 | El mensaje del servidor | — |
| Guardar falla por otra causa | «No se pudo guardar. Vuelve a intentarlo.» | — |

**Política de privacidad:** punto nuevo «Amazon Web Services (Amazon Bedrock):» en «Con quién se comparte», frase nueva
en el punto de Langfuse (textos en AC-014.1 y AC-014.2) y fecha «22 de octubre de 2026».

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Qué se hace con los alimentos sin coincidencia (`unmatched`), que no tienen macros? | Se muestran marcados y no se guardan tal cual. Cada uno se puede buscar en el catálogo (con su nombre ya buscado; el elegido lo sustituye con los mismos gramos), crear como personalizado (nombre y gramos ya rellenos, macros a mano) o quitar. Los que queden sin resolver no impiden guardar el resto y se avisa de que no se guardan (REQ-006, REQ-010, REQ-011). | acepto todas |
| Q2 | ¿Se analiza la foto nada más elegirla o hay un paso de vista previa? | Vista previa con «Analizar foto» y «Cambiar foto»: cada análisis cuenta para el límite de 10 por hora, así que el usuario confirma la foto antes de gastarlo (REQ-002). | acepto todas |
| Q3 | ¿A qué tamaño y formato se reduce la foto en el dispositivo? | JPEG con el lado mayor en 1600 px como mucho (sin agrandar las pequeñas), con la orientación aplicada. Basta para reconocer alimentos y deja la imagen muy por debajo de los 3 MB del servidor (REQ-004). | acepto todas |
| Q4 | ¿Cómo se tratan las fotos HEIC o HEIF del iPhone? | Se intentan leer en el navegador y se convierten a JPEG al reducirlas; Safari en iPhone y Mac las lee, y además el iPhone suele entregarlas ya en JPEG al elegirlas desde la web. Si el navegador no las lee (p. ej. Chrome en Windows), se muestra «No se pudo leer la foto. Prueba con otra foto en JPEG, PNG o WebP.». Sin dependencias nuevas para convertir HEIC (REQ-003, REQ-004). | acepto todas |
| Q5 | ¿Hay un límite al tamaño de la foto original antes de reducirla? | 20 MB: cubre las fotos de cualquier móvil actual y evita que el navegador se quede sin memoria con archivos enormes (REQ-003). | acepto todas |
| Q6 | Si el usuario cierra el diálogo con una propuesta sin guardar, ¿se pide confirmación? Ese análisis ya contó para el límite. | No: se cierra sin preguntar, como «Añadir a {sección}», y empieza de cero al volver a abrirlo (REQ-013). | acepto todas |
| Q7 | ¿Qué dice la Política de privacidad sobre las fotos? | Un punto «Amazon Web Services (Amazon Bedrock):» en «Con quién se comparte» («Las fotos de comidas que envías para analizar se procesan con un modelo de IA de Amazon Bedrock para reconocer los alimentos. Se envían sin sus metadatos (ubicación, cámara y fecha) y fitnerd no las guarda.») y una frase en el punto de Langfuse sobre los datos del análisis sin la foto. Sin afirmar nada sobre lo que Amazon hace con los datos más allá de eso (REQ-014). | acepto todas |
| Q8 | El estado de la feature incluye el ámbito `backend`, pero la idea pide no cambiar `POST /api/meals` y `POST /api/meals` ya acepta varios alimentos por petición. ¿Hace falta algún cambio en el backend? | No: la 025 es solo frontend. «Añadir varios alimentos en una sola petición» se resuelve guardando toda la propuesta en una única petición a `POST /api/meals`, que ya es todo o nada. El planner debería quitar `backend` de los ámbitos. | acepto todas |
| Q9 | ¿Se muestran siempre los dos botones «Hacer una foto» y «Elegir una foto», también en escritorio? | Sí, siempre los dos: detectar si hay cámara no es fiable; en escritorio «Hacer una foto» abre el selector de archivos (REQ-002). | acepto todas |

**Estado:** Q1–Q9 resueltas el 2026-10-22 con la propuesta por defecto; ya están incorporadas en los REQ, AC y NFR
indicados en cada fila. No quedan preguntas abiertas.

## 8. Glosario

- **Propuesta:** la lista de alimentos que la app muestra tras el análisis y que el usuario revisa antes de guardar.
- **Alimento que se puede guardar:** un alimento del catálogo o personalizado de la propuesta; los alimentos sin
  coincidencia no se pueden guardar hasta resolverlos.
- **Alimento sin coincidencia:** un alimento que el análisis reconoce en la foto y que no está en el catálogo
  (`unmatched` en la 024); no tiene macros.
- **Resolver un alimento sin coincidencia:** sustituirlo por un alimento del catálogo o por uno personalizado.
- **Confianza:** la seguridad del análisis al reconocer un alimento (alta, media o baja), no la de sus gramos.
- **Registro manual:** el diálogo «Añadir a {sección}» de la tarjeta (specs 022 y 023).
- **Día del diario:** la fecha local del dispositivo que muestra la pantalla «Diario».
- **Orientación de la foto:** el giro con el que la cámara indica que hay que mostrar la imagen (EXIF); al reducirla se
  aplica para que la imagen enviada se vea derecha.
