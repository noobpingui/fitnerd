# Spec 022 — Diario de comidas con totales del día frente al objetivo de Macros

- **Feature:** `022-meal-diary` · **Tipo:** feature
- **Ámbitos:** `backend`, `frontend`

## 1. Contexto y problema

fitnerd calcula el objetivo diario de calorías y macros del usuario (pantalla Macros, spec 007) y, desde la spec 021,
tiene una base de unos 8.262 alimentos de USDA con su búsqueda (`GET /api/foods/search`). Pero el usuario no puede
**registrar lo que come**: no sabe cuánto lleva consumido en el día ni cuánto le falta para su objetivo.

Esta spec añade un **diario de comidas**: el usuario registra los alimentos de cada comida del día (buscándolos en
USDA o creando uno personalizado para lo que USDA no tiene, como el gallo pinto), corrige los gramos, quita alimentos y
ve los totales del día frente a su objetivo de Macros. Es un producto útil sin IA y construye la edición de comidas que
reutilizará la spec 024 (registrar una comida a partir de una foto y confirmarla).

Los macros de cada alimento registrado se calculan al registrarlo y **quedan guardados con él**, de modo que el
historial no cambia aunque los datos de USDA se reimporten o cambien.

La spec cierra además dos pendientes de la 021: dar a «Alimentos» un sitio en la navegación (ahora, como parte del
diario) y añadir la atribución a USDA en la página legal.

## 2. Historia de usuario

Como **usuario de fitnerd con sesión iniciada y onboarding completado**, quiero **registrar los alimentos que como cada
día y ver mis totales frente a mi objetivo de calorías y macros** para **saber cuánto llevo y cuánto me falta sin hacer
cuentas a mano**.

Como **desarrollador de la spec 024**, quiero **un contrato estable para guardar una comida con varios alimentos y
editarla** para **reutilizarlo al confirmar los alimentos detectados en una foto**.

## 3. Alcance

**Incluye:**
- Backend:
  - Comidas por usuario y día, de cuatro tipos (desayuno, almuerzo, cena y meriendas), con sus alimentos.
  - Alimentos de una comida de dos clases: de USDA (por su FDC ID de la 021) o personalizados (nombre y macros por
    100 g escritos por el usuario). Cada uno con sus gramos y sus calorías, proteína, carbohidratos y grasa
    calculados y guardados.
  - Endpoints bajo `/api/meals` con sesión, siempre filtrados por el usuario de la sesión: consultar el diario de un
    día, añadir alimentos a una comida, cambiar los gramos de un alimento, quitar un alimento y borrar una comida.
  - El «día» de la comida lo indica el cliente con su fecha local y el servidor solo lo acepta si está a un día como
    mucho de la fecha de su reloj (`backend/utils/clock.py`).
  - La migración de base de datos que crea las estructuras nuevas; es aditiva y no se aplica sola (paso manual
    documentado para producción, Art. P4).
- Frontend (feature nueva por completo):
  - Pantalla «Diario» con las comidas del día de hoy, sus alimentos y los totales del día frente al objetivo de Macros.
  - Añadir un alimento buscando en USDA (reutiliza `GET /api/foods/search` de la 021, sin cambios en el endpoint),
    eligiendo los gramos con una vista previa de sus macros.
  - Añadir un alimento personalizado con sus macros por 100 g escritos a mano.
  - Editar los gramos de un alimento y quitarlo.
  - Entrada «Diario» en la barra de navegación de escritorio y en la barra inferior del móvil.
  - Atribución a USDA en la página de Términos de servicio y mención del diario y de las búsquedas de alimentos en la
    Política de privacidad.

**Fuera de alcance:**
- Branded Foods, la API de USDA, FNDDS y cualquier cambio en la importación o en la búsqueda de la 021.
- Un parámetro para elegir el número de resultados de la búsqueda: el diario usa los 20 que ya devuelve.
- Fotos y análisis con IA (specs 023 y 024).
- Ver o editar en la pantalla días distintos de hoy (navegar a días anteriores), copiar comidas de otro día y
  cualquier otra edición avanzada de comidas pasadas.
- Estadísticas semanales o por periodos, gráficas de consumo e informes.
- Una biblioteca de alimentos personalizados reutilizables («mis alimentos»), alimentos favoritos o recientes y
  recetas compuestas de varios alimentos.
- Medidas caseras (tazas, unidades, onzas): todo se registra en gramos.
- Mostrar el diario en kJ.
- Cambiar el cálculo del objetivo de Macros o mostrar micronutrientes.
- Cambiar el nombre o el tipo de una comida ya creada, o mover un alimento de una comida a otra.
- Deshacer la acción de quitar un alimento.
- Que la pantalla cambie sola de día si queda abierta al pasar la medianoche.
- Retirar la pantalla `/foods` de la 021: sigue accesible por su URL, sin entrada propia en la navegación.

## 4. Requisitos funcionales

### Backend

### REQ-001 — Añadir alimentos de USDA a una comida
WHEN un usuario con sesión pide `POST /api/meals` con una fecha válida, un tipo de comida válido y uno o más alimentos
de USDA (FDC ID y gramos) THE SYSTEM SHALL añadir esos alimentos a la comida de ese usuario, fecha y tipo, creándola si
no existe, y SHALL guardar en cada alimento su descripción de USDA, su conjunto de origen, sus valores por 100 g y sus
calorías, proteína, carbohidratos y grasa para los gramos indicados, calculados como `valor por 100 g × gramos / 100` y
redondeados a 2 decimales con las mitades hacia arriba (5,355 → 5,36). Si USDA no tiene dato de un nutriente, ese
nutriente queda como «sin dato» (`null`) en el alimento, nunca como 0. Responde 201 si la comida se creó y 200 si ya existía, con la comida completa.

- **AC-001.1:** Given un alimento de USDA con FDC ID 171477 y 165 kcal, 31,0 g de proteína, 0,0 g de carbohidratos y
  3,57 g de grasa por 100 g, y un usuario sin comidas, When pide `POST /api/meals` con `date` de hoy,
  `meal_type: "lunch"` y `items: [{"fdc_id": 171477, "grams": 150}]`, Then recibe 201 con una comida de tipo `lunch`
  y un alimento con `source: "usda"`, `fdc_id: 171477`, la descripción de USDA, `grams: 150` y `nutrients` igual a
  `{"calories_kcal": 247.5, "protein_g": 46.5, "carbs_g": 0.0, "fat_g": 5.36}`.
- **AC-001.2:** Given que el usuario ya tiene la comida `lunch` de hoy con un alimento, When pide `POST /api/meals` con
  la misma fecha, `meal_type: "lunch"` y otro alimento, Then recibe 200 con la misma comida (mismo `id`) y los dos
  alimentos, en el orden en que se añadieron.
- **AC-001.3:** Given que el usuario tiene la comida `lunch` de hoy, When pide `POST /api/meals` con la misma fecha y
  `meal_type: "dinner"`, Then recibe 201 con una comida nueva y distinta.
- **AC-001.4:** Given un alimento de USDA sin dato de carbohidratos, When se añade con 200 g, Then su `carbs_g` en
  `nutrients` y en `per_100g` es `null` y los demás nutrientes se calculan.
- **AC-001.5:** Given una petición con tres alimentos en `items`, When se añade, Then la comida tiene los tres
  alimentos, en el orden de `items`.
- **AC-001.6:** Given una comida guardada, When se lee la respuesta, Then incluye los campos de la sección 6, con
  `per_100g` del alimento igual a los valores de USDA en el momento de añadirlo.

### REQ-002 — Añadir alimentos personalizados
WHEN un usuario con sesión pide `POST /api/meals` con un alimento personalizado (nombre, gramos y sus cuatro valores por
100 g) THE SYSTEM SHALL añadirlo a la comida igual que un alimento de USDA, con `source: "custom"`, sin FDC ID, con el
nombre sin espacios en los extremos y con sus nutrientes calculados de la misma forma. Una misma petición puede mezclar
alimentos de USDA y personalizados.

- **AC-002.1:** Given un usuario con sesión, When pide `POST /api/meals` con `items: [{"name": "  Gallo pinto  ",
  "grams": 250, "per_100g": {"calories_kcal": 160, "protein_g": 5.5, "carbs_g": 27, "fat_g": 3.2}}]`, Then recibe
  201 con un alimento con `source: "custom"`, `fdc_id: null`, `name: "Gallo pinto"`, `grams: 250` y `nutrients` igual
  a `{"calories_kcal": 400.0, "protein_g": 13.75, "carbs_g": 67.5, "fat_g": 8.0}`.
- **AC-002.2:** Given una petición con un alimento de USDA y uno personalizado, When se añade, Then la comida tiene los
  dos, cada uno con su `source`.
- **AC-002.3:** Given un alimento personalizado con un valor por 100 g igual a 0, When se añade, Then ese nutriente es
  0 (no `null`).

### REQ-003 — Validación de las comidas y de sus alimentos
IF el cuerpo de la petición no es un objeto JSON, falta un campo obligatorio o algún valor no cumple los límites de la
sección 6 THEN THE SYSTEM SHALL responder 400 con el mensaje correspondiente de la sección 6 y SHALL NOT guardar
ninguno de los alimentos de la petición.

- **AC-003.1:** Given un usuario con sesión, When pide `POST /api/meals` con un cuerpo que no es un objeto JSON (texto,
  `null`, una lista o JSON malformado), Then recibe 400 con `{"error": "La petición no es válida"}`.
- **AC-003.2:** Given un `meal_type` que falta o no es `breakfast`, `lunch`, `dinner` ni `snack`, When se pide
  `POST /api/meals`, Then recibe 400 con `{"error": "El tipo de comida no es válido."}`.
- **AC-003.3:** Given `items` que falta, no es una lista o está vacía, When se pide `POST /api/meals`, Then recibe 400
  con `{"error": "Añade al menos un alimento."}`.
- **AC-003.4:** Given unos gramos que faltan, no son un número, son menores que 1 o mayores que 2000, When se añade el
  alimento, Then recibe 400 con `{"error": "Los gramos deben estar entre 1 y 2000."}`; con 1 y con 2000, el alimento
  se añade.
- **AC-003.5:** Given unos gramos con más de un decimal (p. ej. 150,25), When se añade el alimento, Then recibe 400 con
  `{"error": "Los gramos admiten como mucho un decimal."}`; con 150,5, el alimento se añade.
- **AC-003.6:** Given un FDC ID que no existe en la base de alimentos, When se añade, Then recibe 400 con
  `{"error": "No encontramos ese alimento."}`.
- **AC-003.7:** Given un alimento que trae a la vez `fdc_id` y `name`, o ninguno de los dos, When se añade, Then recibe
  400 con `{"error": "Cada alimento debe ser de USDA o personalizado."}`.
- **AC-003.8:** Given un alimento personalizado con el nombre vacío o con solo espacios, When se añade, Then recibe 400
  con `{"error": "Escribe el nombre del alimento."}`; con más de 100 caracteres después de quitar los espacios de los
  extremos, recibe 400 con `{"error": "El nombre no puede superar los 100 caracteres."}`.
- **AC-003.9:** Given un alimento personalizado al que le falta alguno de sus cuatro valores por 100 g o que lo trae
  sin ser un número, When se añade, Then recibe 400 con `{"error": "Indica las calorías, proteína, carbohidratos y
  grasa por 100 g."}`.
- **AC-003.10:** Given un alimento personalizado con calorías por 100 g menores que 0 o mayores que 900, When se añade,
  Then recibe 400 con `{"error": "Las calorías por 100 g deben estar entre 0 y 900."}`; con 0 y con 900, se añade.
- **AC-003.11:** Given un alimento personalizado con proteína, carbohidratos o grasa por 100 g menores que 0 o mayores
  que 100, When se añade, Then recibe 400 con `{"error": "Los macros por 100 g deben estar entre 0 y 100 g."}`.
- **AC-003.12:** Given un alimento personalizado cuya proteína, carbohidratos y grasa por 100 g suman más de 100 g,
  When se añade, Then recibe 400 con `{"error": "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g
  por 100 g."}`; si suman exactamente 100, se añade.
- **AC-003.13:** Given una comida que ya tiene 48 alimentos, When se piden 3 alimentos más, Then recibe 400 con
  `{"error": "Una comida no puede tener más de 50 alimentos."}` y la comida sigue con 48; con 2 más, queda con 50.
- **AC-003.14:** Given una petición con dos alimentos válidos y uno no válido, When se pide `POST /api/meals`, Then
  recibe 400 y no se guarda ninguno de los tres ni se crea la comida.

### REQ-004 — Día de la comida
THE SYSTEM SHALL tomar el día de la comida de la fecha `date` que envía el cliente (su fecha local, `AAAA-MM-DD`) y
SHALL aceptarla al añadir alimentos solo si está entre el día anterior y el siguiente a la fecha actual del reloj del
servidor.
IF la fecha falta, no tiene el formato `AAAA-MM-DD` o no es una fecha real THEN THE SYSTEM SHALL responder 400 con
`{"error": "La fecha no es válida."}`.
IF la fecha está fuera de esa ventana al añadir alimentos THEN THE SYSTEM SHALL responder 400 con
`{"error": "Solo puedes registrar comidas de hoy."}` sin guardar nada.

- **AC-004.1:** Given el reloj del servidor fijado en 2026-10-21 03:00 (UTC), When se añade un alimento con
  `date: "2026-10-20"`, `"2026-10-21"` o `"2026-10-22"`, Then se guarda en la comida de esa fecha.
- **AC-004.2:** Given el reloj del servidor fijado en 2026-10-21 03:00 (UTC), When se añade un alimento con
  `date: "2026-10-19"` o `"2026-10-23"`, Then recibe 400 con `{"error": "Solo puedes registrar comidas de hoy."}` y no
  se guarda nada.
- **AC-004.3:** Given una petición sin `date`, con `date: "20-10-2026"` o con `date: "2026-02-30"`, When se pide
  `POST /api/meals`, Then recibe 400 con `{"error": "La fecha no es válida."}`.

### REQ-005 — Consultar el diario de un día
WHEN un usuario con sesión pide `GET /api/meals?date=AAAA-MM-DD` THE SYSTEM SHALL responder 200 con sus comidas de esa
fecha, en el orden desayuno, almuerzo, cena y meriendas, cada una con sus alimentos y su subtotal, y con el total del
día. Cada total suma los valores conocidos de sus alimentos y, si algún alimento no tiene dato de un nutriente, lo
indica en `incomplete`. La consulta admite cualquier fecha real, también fuera de la ventana de REQ-004.

- **AC-005.1:** Given un usuario con la comida `dinner` y la comida `breakfast` de una fecha, When pide el diario de esa
  fecha, Then recibe 200 con las dos comidas, primero `breakfast` y después `dinner`.
- **AC-005.2:** Given un usuario sin comidas en una fecha, When pide el diario de esa fecha, Then recibe 200 con
  `meals` vacío, `totals` con los cuatro valores a 0 e `incomplete` vacío.
- **AC-005.3:** Given una comida con dos alimentos de 247,5 y 400,0 kcal, When se pide el diario, Then el subtotal de
  la comida y el total del día tienen `calories_kcal: 647.5`.
- **AC-005.4:** Given un día con un alimento sin dato de carbohidratos (`null`) y otro con 67,5 g, When se pide el
  diario, Then el total del día tiene `carbs_g: 67.5` e `incomplete: ["carbs_g"]`, y la comida que contiene ese
  alimento también lo indica en su `incomplete`.
- **AC-005.5:** Given comidas en el 2026-10-20 y en el 2026-10-21, When se pide `date=2026-10-20`, Then solo aparecen
  las del 2026-10-20.
- **AC-005.6:** Given una petición sin `date` o con una fecha no válida, When se pide el diario, Then recibe 400 con
  `{"error": "La fecha no es válida."}`.
- **AC-005.7:** Given el reloj del servidor en 2026-10-21 y comidas guardadas el 2026-09-01, When se pide
  `date=2026-09-01`, Then recibe 200 con esas comidas.

### REQ-006 — Cambiar los gramos de un alimento
WHEN un usuario con sesión pide `PATCH /api/meals/{meal_id}/items/{item_id}` con unos gramos válidos THE SYSTEM SHALL
cambiar los gramos de ese alimento y recalcular sus nutrientes a partir de los valores por 100 g **guardados en el
alimento**, sin volver a consultar la base de USDA, y SHALL responder 200 con la comida completa.

- **AC-006.1:** Given el alimento de AC-001.1 con 150 g, When se cambian sus gramos a 200, Then la respuesta es 200 y
  el alimento tiene `grams: 200` y `nutrients` igual a `{"calories_kcal": 330.0, "protein_g": 62.0, "carbs_g": 0.0,
  "fat_g": 7.14}`.
- **AC-006.2:** Given un alimento personalizado de 250 g, When se cambian sus gramos a 100, Then sus nutrientes son sus
  valores por 100 g.
- **AC-006.3:** Given unos gramos no válidos (fuera de 1 a 2000, con más de un decimal o que faltan), When se pide el
  cambio, Then recibe 400 con el mismo mensaje que en AC-003.4 o AC-003.5 y el alimento no cambia.
- **AC-006.4:** Given un cuerpo que no es un objeto JSON, When se pide el cambio, Then recibe 400 con
  `{"error": "La petición no es válida"}`.
- **AC-006.5:** Given el reloj del servidor en 2026-10-21 y un alimento propio en una comida del 2026-09-01 (fuera de
  la ventana de REQ-004), When se cambian sus gramos, Then la respuesta es 200 con los gramos y los nutrientes nuevos.

### REQ-007 — Quitar un alimento y borrar una comida
WHEN un usuario con sesión pide `DELETE /api/meals/{meal_id}/items/{item_id}` THE SYSTEM SHALL quitar ese alimento de
la comida y, si la comida se queda sin alimentos, SHALL borrar también la comida. WHEN pide `DELETE /api/meals/{meal_id}`
THE SYSTEM SHALL borrar la comida con todos sus alimentos. En los dos casos responde 204.

- **AC-007.1:** Given una comida con dos alimentos, When se quita uno, Then la respuesta es 204 y el diario de ese día
  muestra la comida con el otro alimento.
- **AC-007.2:** Given una comida con un solo alimento, When se quita, Then la respuesta es 204 y el diario de ese día ya
  no contiene esa comida.
- **AC-007.3:** Given una comida con tres alimentos, When se pide `DELETE /api/meals/{meal_id}`, Then la respuesta es
  204 y el diario de ese día ya no contiene esa comida ni sus alimentos.
- **AC-007.4:** Given una comida borrada, When se añaden alimentos de nuevo a ese día y tipo, Then se crea una comida
  nueva (201).
- **AC-007.5:** Given el reloj del servidor en 2026-10-21 y una comida propia del 2026-09-01 con dos alimentos, When se
  quita uno de sus alimentos y después se borra la comida, Then las dos respuestas son 204 y el diario del 2026-09-01
  queda sin esa comida.

### REQ-008 — Historial estable ante cambios en USDA
WHILE un alimento de USDA esté registrado en una comida THE SYSTEM SHALL conservar su descripción, su origen, sus
valores por 100 g y sus nutrientes tal como se guardaron, aunque el alimento de USDA cambie o desaparezca de la base de
alimentos.

- **AC-008.1:** Given un alimento de USDA registrado en una comida, When cambian en la base de alimentos su
  descripción y su proteína por 100 g (como en una reimportación), Then el diario devuelve la descripción, la proteína
  por 100 g y los nutrientes que se guardaron.
- **AC-008.2:** Given el caso de AC-008.1, When se cambian los gramos del alimento registrado, Then los nutrientes se
  recalculan con los valores por 100 g guardados, no con los nuevos.
- **AC-008.3:** Given un alimento de USDA registrado en una comida, When el alimento desaparece de la base de
  alimentos, Then el diario sigue devolviendo el alimento registrado con sus datos.

### REQ-009 — Solo con sesión y solo las comidas propias
IF una petición a `/api/meals` no trae un token de sesión válido THEN THE SYSTEM SHALL responder 401 como el resto de
endpoints protegidos. IF la comida o el alimento indicados no existen o pertenecen a otro usuario THEN THE SYSTEM SHALL
responder 404 con el mensaje de la sección 6, sin revelar si existen, y SHALL NOT modificarlos.

- **AC-009.1:** Given una petición sin cabecera de autorización o con un token caducado o inválido, When pide
  cualquiera de los endpoints de `/api/meals`, Then recibe 401.
- **AC-009.2:** Given el usuario A con comidas en una fecha y el usuario B sin comidas, When B pide el diario de esa
  fecha, Then recibe 200 con `meals` vacío.
- **AC-009.3:** Given una comida del usuario A, When el usuario B pide cambiar los gramos de uno de sus alimentos,
  quitarlo o borrar la comida, Then recibe 404 con `{"error": "No encontramos esa comida."}` y la comida de A no cambia.
- **AC-009.4:** Given una comida del usuario y un `item_id` que no existe o es de otra comida, When pide cambiar sus
  gramos o quitarlo, Then recibe 404 con `{"error": "No encontramos ese alimento en la comida."}`.
- **AC-009.5:** Given un `meal_id` que no existe, When se pide cualquier operación sobre él, Then recibe 404 con
  `{"error": "No encontramos esa comida."}`.
- **AC-009.6:** Given el usuario A con la comida `lunch` de hoy, When el usuario B añade un alimento a `lunch` de hoy,
  Then se crea una comida nueva de B (201) y la de A no cambia.

### Frontend

### REQ-010 — Pantalla «Diario»
WHEN un usuario con sesión y onboarding completado abre la ruta `/diary` THE SYSTEM SHALL mostrar la pantalla «Diario»
con la fecha de hoy (fecha local del dispositivo), las cuatro secciones de comida en el orden Desayuno, Almuerzo, Cena y
Meriendas, y en cada una sus alimentos, su subtotal de calorías y el botón «Añadir alimento».

- **AC-010.1:** Given un diario simulado de hoy con un alimento en Almuerzo, When se abre la pantalla, Then se ven el
  título «Diario», la fecha de hoy en formato largo (p. ej. «martes, 20 de octubre»), las cuatro secciones en orden y,
  en Almuerzo, el alimento con su nombre, sus gramos («150 g»), sus calorías («248 kcal») y el subtotal «248 kcal».
- **AC-010.2:** Given la pantalla, When pide el diario, Then lo pide con la fecha local del dispositivo en formato
  `AAAA-MM-DD`.
- **AC-010.3:** Given un diario simulado sin comidas, When se abre la pantalla, Then cada sección muestra «Sin
  alimentos.» y su botón «Añadir alimento», y se ve el texto «Todavía no has registrado nada hoy.».
- **AC-010.4:** Given el diario en carga, When aún no llega la respuesta, Then se ve «Cargando el diario…».
- **AC-010.5:** Given que la carga del diario falla, When termina, Then se ve «No se pudo cargar el diario.» con un
  botón «Reintentar» que vuelve a pedirlo.
- **AC-010.6:** Given un alimento de USDA en el diario, When se muestra, Then se ve su descripción de USDA y su origen
  («Foundation» o «SR Legacy»); y Given un alimento personalizado, Then se ve su nombre y la etiqueta «Personalizado».

### REQ-011 — Añadir un alimento buscando en USDA
WHEN el usuario pulsa «Añadir alimento» en una sección THE SYSTEM SHALL abrir un diálogo con la búsqueda de alimentos de
la 021 (mismas validaciones, estados y mensajes) y, al elegir un resultado, SHALL pedir los gramos (100 por defecto)
con una vista previa de sus calorías y macros para esos gramos; al pulsar «Añadir», SHALL guardarlo en la comida de esa
sección y de hoy y actualizar el diario y los totales.

- **AC-011.1:** Given la sección Desayuno, When el usuario pulsa su «Añadir alimento», Then se abre un diálogo con el
  título «Añadir a Desayuno», la caja «Buscar alimento» y el botón «Buscar».
- **AC-011.2:** Given una búsqueda simulada con resultados, When el usuario elige el pollo (165 kcal por 100 g), Then
  se ve el campo «Gramos» con 100 y la vista previa «165 kcal · 31,0 g proteína · 0,0 g carbohidratos · 3,6 g grasa».
- **AC-011.3:** Given el pollo elegido, When el usuario cambia los gramos a 150, Then la vista previa pasa a «248 kcal ·
  46,5 g proteína · 0,0 g carbohidratos · 5,4 g grasa» sin hacer ninguna petición.
- **AC-011.4:** Given el pollo con 150 g en la sección Desayuno, When el usuario pulsa «Añadir», Then se envía una
  petición para añadir `{"fdc_id": 171477, "grams": 150}` a `breakfast` con la fecha de hoy, el diálogo se cierra y el
  diario se vuelve a leer.
- **AC-011.5:** Given el campo «Gramos» vacío, con 0, con más de 2000 o con más de un decimal, When el usuario pulsa
  «Añadir», Then se ve el aviso correspondiente («Los gramos deben estar entre 1 y 2000.» o «Los gramos admiten como
  mucho un decimal.») y no se hace ninguna petición.
- **AC-011.6:** Given que guardar falla, When termina, Then el diálogo sigue abierto con lo elegido y se ve el mensaje
  del servidor si es un 400, o «No se pudo guardar. Vuelve a intentarlo.» en cualquier otro error.
- **AC-011.7:** Given un resultado con algún nutriente sin dato, When se elige, Then la vista previa muestra «—» en ese
  nutriente.
- **AC-011.8:** Given el diálogo, When el usuario pulsa «Cancelar» o cierra el diálogo, Then no se guarda nada.
- **AC-011.9:** Given el pollo elegido, When el usuario pulsa «Volver a la búsqueda», Then vuelve a ver los resultados
  de su búsqueda sin repetirla.
- **AC-011.10:** Given un guardado en curso, When aún no llega la respuesta, Then el botón «Añadir» está desactivado y
  muestra «Guardando…».

### REQ-012 — Añadir un alimento personalizado
WHEN el usuario pulsa «Crear alimento personalizado» en el diálogo de añadir THE SYSTEM SHALL mostrar un formulario con
el nombre, los gramos y las calorías, proteína, carbohidratos y grasa por 100 g, validarlo con los límites de la
sección 6 y, al pulsar «Añadir», guardarlo en la comida de esa sección y de hoy.

- **AC-012.1:** Given el diálogo de añadir, When el usuario pulsa «Crear alimento personalizado», Then se ven los campos
  «Nombre», «Gramos», «Calorías por 100 g (kcal)», «Proteína por 100 g (g)», «Carbohidratos por 100 g (g)» y «Grasa
  por 100 g (g)».
- **AC-012.2:** Given el formulario con «Gallo pinto», 250 g y 160, 5,5, 27 y 3,2 por 100 g, When el usuario pulsa
  «Añadir», Then se envía un alimento personalizado con esos valores, el diálogo se cierra y el diario se vuelve a leer.
- **AC-012.3:** Given el formulario relleno, When cambian los gramos o los valores por 100 g, Then se ve la vista previa
  de la porción («400 kcal · 13,8 g proteína · 67,5 g carbohidratos · 8,0 g grasa» para el caso de AC-012.2).
- **AC-012.4:** Given el nombre vacío, un valor por 100 g vacío o fuera de sus límites, o una suma de macros mayor que
  100 g, When el usuario pulsa «Añadir», Then se ve junto al campo el mensaje de la sección 6 y no se hace ninguna
  petición.
- **AC-012.5:** Given el campo «Nombre», When el usuario intenta escribir más de 100 caracteres, Then no admite más.
- **AC-012.6:** Given que la búsqueda no encuentra nada, When se muestra «No encontramos alimentos para «{consulta}».»,
  Then junto al mensaje se ve el botón «Crear alimento personalizado», y al pulsarlo el nombre viene relleno con la
  consulta.

### REQ-013 — Editar los gramos y quitar un alimento en la pantalla
WHEN el usuario pulsa «Editar» en un alimento del diario THE SYSTEM SHALL abrir un diálogo con sus gramos y la vista
previa de sus macros y, al pulsar «Guardar», SHALL guardar los gramos nuevos y actualizar el diario. WHEN pulsa «Quitar»
THE SYSTEM SHALL quitar el alimento sin pedir confirmación y actualizar el diario.

- **AC-013.1:** Given un alimento de 150 g, When el usuario pulsa «Editar», Then se abre el diálogo «Editar gramos» con
  el campo «Gramos» a 150 y la vista previa calculada con los valores por 100 g guardados en el alimento.
- **AC-013.2:** Given el diálogo con 200 g, When el usuario pulsa «Guardar», Then se envía el cambio de gramos de ese
  alimento, el diálogo se cierra y el diario se vuelve a leer.
- **AC-013.3:** Given unos gramos no válidos, When el usuario pulsa «Guardar», Then se ve el aviso de AC-011.5 y no se
  hace ninguna petición.
- **AC-013.4:** Given un alimento del diario, When el usuario pulsa «Quitar», Then se pide quitarlo y el diario se
  vuelve a leer.
- **AC-013.5:** Given que guardar o quitar falla, When termina, Then se ve «No se pudo guardar. Vuelve a intentarlo.» o
  «No se pudo quitar el alimento. Vuelve a intentarlo.» y el diario no cambia.
- **AC-013.6:** Given los botones «Editar» y «Quitar» de un alimento, When se consultan por su nombre accesible, Then se
  llaman «Editar {nombre del alimento}» y «Quitar {nombre del alimento}».

### REQ-014 — Totales del día frente al objetivo de Macros
THE SYSTEM SHALL mostrar en la pantalla «Diario» el total del día de calorías, proteína, carbohidratos y grasa junto al
objetivo diario que calcula Macros para el perfil del usuario, con lo que queda hasta el objetivo o lo que lo supera, y
una barra de progreso por cada uno.

- **AC-014.1:** Given un objetivo de Macros de 2000 kcal, 150 g de proteína, 200 g de carbohidratos y 67 g de grasa,
  y un total del día de 650 kcal, 45 g, 80,5 g y 20 g, When se muestra la pantalla, Then se ven «650 / 2000 kcal» con
  «Quedan 1350 kcal», «45,0 / 150 g» de proteína con «Quedan 105,0 g», «80,5 / 200 g» de carbohidratos y «20,0 / 67 g»
  de grasa.
- **AC-014.2:** Given un total del día de 2150 kcal frente a un objetivo de 2000, When se muestra, Then se ve
  «2150 / 2000 kcal» con «150 kcal por encima del objetivo» y la barra de calorías llena.
- **AC-014.3:** Given el mismo perfil que ve el usuario en Macros, When se muestran los objetivos del diario, Then son
  exactamente las calorías y los gramos de proteína, carbohidratos y grasa que muestra Macros.
- **AC-014.4:** Given un total del día con `incomplete: ["carbs_g"]`, When se muestra, Then junto a los carbohidratos se
  ve «Algún alimento no tiene este dato: el total puede ser mayor.».
- **AC-014.5:** Given un diario sin comidas, When se muestra, Then los totales son «0 / 2000 kcal» con «Quedan
  2000 kcal» y las barras vacías.
- **AC-014.6:** Given un alimento recién añadido, editado o quitado, When el diario se vuelve a leer, Then los totales
  muestran los valores nuevos.

### REQ-015 — Navegación
THE SYSTEM SHALL incluir la entrada «Diario», que lleva a `/diary`, en la barra de navegación de escritorio y en la
barra inferior del móvil, a continuación de «Inicio» en la barra inferior y como primera entrada en la de escritorio.

- **AC-015.1:** Given un usuario con sesión en escritorio, When se muestra la barra de navegación, Then contiene
  «Diario», «Macros», «Métricas», «Coach» y «Tienda», en ese orden, y «Diario» lleva a `/diary`.
- **AC-015.2:** Given un usuario con sesión en el móvil, When se muestra la barra inferior, Then contiene «Inicio»,
  «Diario», «Macros», «Métricas», «Coach» y «Tienda», en ese orden, y «Diario» lleva a `/diary`.
- **AC-015.3:** Given la ruta `/diary`, When el usuario está en ella, Then la entrada «Diario» aparece como activa.
- **AC-015.4:** Given un usuario con sesión, When abre `/foods`, Then sigue viendo la pantalla «Alimentos» de la 021.

### REQ-016 — Páginas legales
THE SYSTEM SHALL mostrar en «Términos de servicio» una sección «Datos nutricionales» con la atribución a USDA y el aviso
de que los valores son aproximados, y SHALL mencionar en la «Política de privacidad» el diario de comidas entre los
datos que se recogen y las búsquedas de alimentos entre lo que recibe Voyage AI.

- **AC-016.1:** Given la página «Términos de servicio», When se muestra, Then contiene la sección «Datos nutricionales»
  con el texto «Datos: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.» y el texto «Los
  valores nutricionales son aproximados y pueden variar según el alimento y su preparación.».
- **AC-016.2:** Given la página «Política de privacidad», When se muestra, Then en «Qué información recolectamos» hay un
  punto «Diario de comidas:» que menciona los alimentos y cantidades que registras, y el punto de Voyage AI menciona el
  texto de tus búsquedas de alimentos.

## 5. Requisitos no funcionales

### NFR-001 — Carga bajo demanda de la pantalla
THE SYSTEM SHALL cargar la pantalla «Diario» bajo demanda, como el resto de pantallas (ADR-0026), sin que el chunk de
entrada supere los 500 kB.

- **AC-N001.1:** Given la aplicación, When se carga una ruta distinta de `/diary`, Then el código de la pantalla
  «Diario» no se ha descargado; al visitar `/diary`, se muestra «Cargando…» hasta que llega.

### NFR-002 — Accesibilidad del diario
THE SYSTEM SHALL dar nombre accesible a los campos, botones y diálogos del diario, y anunciar a los lectores de pantalla
los cambios de estado (carga, error y guardado).

- **AC-N002.1:** Given el diálogo de añadir, When se consulta por su rol, Then es un diálogo con el nombre «Añadir a
  {sección}» y sus campos se encuentran por su etiqueta.
- **AC-N002.2:** Given las barras de progreso de los totales, When se consultan por su rol, Then cada una es una barra de
  progreso con el nombre del nutriente («Calorías», «Proteína», «Carbohidratos», «Grasa»).
- **AC-N002.3:** Given los estados «Cargando el diario…», «No se pudo cargar el diario.» y los errores al guardar, When
  aparecen, Then están dentro de una región que se anuncia a los lectores de pantalla.

## 6. Datos y contratos visibles

**Tipos de comida:**

| Valor en la API | En pantalla | Orden |
|---|---|---|
| `breakfast` | Desayuno | 1 |
| `lunch` | Almuerzo | 2 |
| `dinner` | Cena | 3 |
| `snack` | Meriendas | 4 |

Hay como mucho una comida por usuario, fecha y tipo.

**Alimento de una comida (respuesta):**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | entero | Identificador del alimento dentro del diario. |
| `source` | texto | `"usda"` o `"custom"`. |
| `fdc_id` | entero o `null` | FDC ID de USDA; `null` en los personalizados. |
| `name` | texto | Descripción de USDA en el momento de añadirlo, o nombre del alimento personalizado. |
| `data_type` | texto o `null` | `"foundation"` o `"sr_legacy"`; `null` en los personalizados. |
| `grams` | número | Gramos registrados (de 1 a 2000, como mucho un decimal). |
| `per_100g` | objeto | `calories_kcal`, `protein_g`, `carbs_g`, `fat_g` por 100 g guardados al añadirlo; número o `null` (sin dato de USDA). |
| `nutrients` | objeto | Los mismos cuatro campos para los gramos registrados: `per_100g × grams / 100`, redondeado a 2 decimales con las mitades hacia arriba; `null` si el valor por 100 g es `null`. |

**Comida (respuesta):** `id` (entero), `date` (`AAAA-MM-DD`), `meal_type`, `items` (en el orden en que se añadieron),
`totals` (los cuatro campos, suma de los `nutrients` conocidos de sus alimentos) e `incomplete` (lista de los campos de
`totals` en los que algún alimento tiene `null`, en el orden `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`).

**Endpoints** (todos requieren `Authorization: Bearer {token}` y solo operan sobre las comidas del usuario de la
sesión):

- `GET /api/meals?date=AAAA-MM-DD` → 200:
  ```json
  {
    "date": "2026-10-20",
    "meals": [
      {
        "id": 12,
        "date": "2026-10-20",
        "meal_type": "lunch",
        "items": [
          {
            "id": 31,
            "source": "usda",
            "fdc_id": 171477,
            "name": "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
            "data_type": "sr_legacy",
            "grams": 150,
            "per_100g": { "calories_kcal": 165.0, "protein_g": 31.0, "carbs_g": 0.0, "fat_g": 3.57 },
            "nutrients": { "calories_kcal": 247.5, "protein_g": 46.5, "carbs_g": 0.0, "fat_g": 5.36 }
          }
        ],
        "totals": { "calories_kcal": 247.5, "protein_g": 46.5, "carbs_g": 0.0, "fat_g": 5.36 },
        "incomplete": []
      }
    ],
    "totals": { "calories_kcal": 247.5, "protein_g": 46.5, "carbs_g": 0.0, "fat_g": 5.36 },
    "incomplete": []
  }
  ```
  Comidas en el orden de la tabla de tipos. Sin comidas: `meals` vacío, `totals` a 0 e `incomplete` vacío.
- `POST /api/meals` con `{"date": "AAAA-MM-DD", "meal_type": "...", "items": [...]}`, donde cada elemento de `items`
  es `{"fdc_id": entero, "grams": número}` (USDA) o `{"name": texto, "grams": número, "per_100g": {"calories_kcal":
  número, "protein_g": número, "carbs_g": número, "fat_g": número}}` (personalizado). Añade los alimentos a la comida
  de ese día y tipo, y responde con la comida completa: 201 si se creó, 200 si ya existía. O se guardan todos los
  alimentos de la petición o ninguno.
- `PATCH /api/meals/{meal_id}/items/{item_id}` con `{"grams": número}` → 200 con la comida completa.
- `DELETE /api/meals/{meal_id}/items/{item_id}` → 204. Si la comida se queda sin alimentos, se borra.
- `DELETE /api/meals/{meal_id}` → 204.

**Límites y mensajes de error:**

| Caso | Código | Mensaje |
|---|---|---|
| Cuerpo que no es un objeto JSON | 400 | `La petición no es válida` |
| Fecha que falta, con otro formato o que no existe | 400 | `La fecha no es válida.` |
| Fecha fuera de la ventana de hoy ± 1 día del servidor al añadir | 400 | `Solo puedes registrar comidas de hoy.` |
| Tipo de comida que falta o no es válido | 400 | `El tipo de comida no es válido.` |
| `items` que falta, no es una lista o está vacía | 400 | `Añade al menos un alimento.` |
| Más de 50 alimentos en la comida tras añadir | 400 | `Una comida no puede tener más de 50 alimentos.` |
| Alimento con `fdc_id` y `name` a la vez, o sin ninguno | 400 | `Cada alimento debe ser de USDA o personalizado.` |
| Gramos que faltan, no numéricos, menores que 1 o mayores que 2000 | 400 | `Los gramos deben estar entre 1 y 2000.` |
| Gramos con más de un decimal | 400 | `Los gramos admiten como mucho un decimal.` |
| FDC ID que no existe | 400 | `No encontramos ese alimento.` |
| Nombre personalizado vacío o con solo espacios | 400 | `Escribe el nombre del alimento.` |
| Nombre personalizado de más de 100 caracteres (sin los espacios de los extremos) | 400 | `El nombre no puede superar los 100 caracteres.` |
| Falta un valor por 100 g o no es un número | 400 | `Indica las calorías, proteína, carbohidratos y grasa por 100 g.` |
| Calorías por 100 g fuera de 0 a 900 | 400 | `Las calorías por 100 g deben estar entre 0 y 900.` |
| Proteína, carbohidratos o grasa por 100 g fuera de 0 a 100 | 400 | `Los macros por 100 g deben estar entre 0 y 100 g.` |
| Proteína + carbohidratos + grasa por 100 g mayor que 100 | 400 | `La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g.` |
| Sin sesión o con token no válido | 401 | El error de sesión de los demás endpoints protegidos. |
| Comida que no existe o es de otro usuario | 404 | `No encontramos esa comida.` |
| Alimento que no existe o no es de esa comida | 404 | `No encontramos ese alimento en la comida.` |

**Pantalla «Diario» (`/diary`):**

| Elemento | Texto |
|---|---|
| Título | «Diario» |
| Fecha | La de hoy en formato largo en español, p. ej. «martes, 20 de octubre» |
| Secciones | «Desayuno», «Almuerzo», «Cena», «Meriendas», cada una con su subtotal «{n} kcal» y el botón «Añadir alimento» |
| Sección vacía | «Sin alimentos.» |
| Día vacío | «Todavía no has registrado nada hoy.» |
| Cargando | «Cargando el diario…» |
| Error al cargar | «No se pudo cargar el diario.» y botón «Reintentar» |
| Alimento | Nombre; origen («Foundation», «SR Legacy» o «Personalizado»); «{gramos} g»; «{n} kcal»; botones «Editar» y «Quitar» |
| Totales | Por nutriente: «{consumido} / {objetivo} {unidad}», «Quedan {n} {unidad}» o «{n} {unidad} por encima del objetivo», y una barra de progreso (llena al llegar o superar el objetivo) |
| Total incompleto | «Algún alimento no tiene este dato: el total puede ser mayor.» |
| Diálogo de añadir | Título «Añadir a {sección}»; búsqueda con los textos de la 021; campo «Gramos» (100 por defecto); vista previa «{kcal} kcal · {g} g proteína · {g} g carbohidratos · {g} g grasa»; botones «Añadir», «Volver a la búsqueda», «Cancelar» y «Crear alimento personalizado» |
| Alimento personalizado | Campos «Nombre», «Gramos», «Calorías por 100 g (kcal)», «Proteína por 100 g (g)», «Carbohidratos por 100 g (g)», «Grasa por 100 g (g)»; los mismos mensajes de validación que la API |
| Diálogo de editar | Título «Editar gramos»; campo «Gramos»; vista previa; botones «Guardar» y «Cancelar» |
| Guardando | Botón con «Guardando…» y desactivado |
| Error al guardar | El mensaje del servidor si es un 400; si no, «No se pudo guardar. Vuelve a intentarlo.» |
| Error al quitar | «No se pudo quitar el alimento. Vuelve a intentarlo.» |
| Formato de valores | kcal sin decimales (`248 kcal`), con el mismo formato numérico que Macros; gramos de nutrientes con un decimal y coma decimal (`46,5 g`); gramos registrados sin decimales si son enteros y con uno si no (`150 g`, `150,5 g`); objetivos tal como los muestra Macros; `—` si no hay dato |

Los gramos del formulario admiten coma o punto como separador decimal.

**Páginas legales:**
- «Términos de servicio», sección nueva «Datos nutricionales»: «Datos: U.S. Department of Agriculture, Agricultural
  Research Service. FoodData Central.» y «Los valores nutricionales son aproximados y pueden variar según el alimento y
  su preparación.».
- «Política de privacidad»: punto nuevo «Diario de comidas:» (los alimentos y cantidades que registras) en «Qué
  información recolectamos», y el punto de Voyage AI amplía lo que recibe al texto de tus búsquedas de alimentos. La
  fecha de actualización de las dos páginas pasa a la del cambio.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Quién decide el «día» de una comida? El reloj del servidor (`clock.py`) va en UTC: en Costa Rica (UTC−6), una cena a las 19:00 caería en el día siguiente si el servidor decidiera solo. | El cliente envía su fecha local y el servidor la acepta solo si está a ±1 día de la fecha de su reloj (como hace Métricas con `today + 1`); fuera de esa ventana, 400 «Solo puedes registrar comidas de hoy.» (REQ-004). | Aprobado |
| Q2 | ¿Cómo se organizan las comidas del día? | Cuatro tipos fijos (Desayuno, Almuerzo, Cena y Meriendas), como mucho una comida por tipo y día; añadir a un tipo que ya existe agrega los alimentos a esa comida. La 024 guardará la foto en el tipo que elija el usuario. | Aprobado |
| Q3 | ¿El alimento personalizado se introduce por 100 g o por porción? | Por 100 g, como USDA y las etiquetas nutricionales, más los gramos de la porción; la pantalla muestra la vista previa de la porción. Los cuatro valores son obligatorios (0 permitido). | Aprobado |
| Q4 | ¿Los alimentos personalizados se guardan para reutilizarlos otro día? | No en la 022: viven solo en la comida donde se crean. Una biblioteca «mis alimentos» pasa al backlog. | Aprobado |
| Q5 | ¿La pantalla permite ver o editar días anteriores? | No: solo hoy. La API sí permite consultar cualquier fecha y editar o quitar alimentos de comidas propias de cualquier fecha, pero solo deja añadir en la ventana de hoy ± 1 día. | Aprobado |
| Q6 | Límites numéricos: ¿gramos, valores por 100 g y alimentos por comida? | Gramos de 1 a 2000 con un decimal como mucho; calorías por 100 g de 0 a 900; proteína, carbohidratos y grasa de 0 a 100 g cada uno y sumando 100 g como mucho; nombre de 1 a 100 caracteres; hasta 50 alimentos por comida. | Aprobado |
| Q7 | Si un alimento de USDA no tiene dato de un nutriente, ¿cómo cuenta en los totales? | Queda como «sin dato» en el alimento (no 0); los totales suman los valores conocidos y avisan «Algún alimento no tiene este dato: el total puede ser mayor.». | Aprobado |
| Q8 | ¿Dónde va el diario en la navegación? La barra inferior del móvil ya tiene 5 entradas. | Entrada «Diario» (`/diary`) primera en la barra de escritorio y segunda (tras «Inicio») en la inferior, que pasa a 6 entradas sin quitar ninguna. `/foods` sigue accesible por URL y sin entrada propia; la búsqueda vive dentro del diario. | Aprobado |
| Q9 | ¿Dónde va la atribución a USDA en la parte legal? | Sección «Datos nutricionales» en «Términos de servicio» con la atribución y un aviso de valores aproximados; además, la Política de privacidad menciona el diario y que Voyage AI recibe el texto de las búsquedas de alimentos. | Aprobado |
| Q10 | ¿Hace falta el parámetro para elegir el número de resultados de la búsqueda? | No: el diálogo usa los 20 resultados de la 021 y el endpoint no cambia. | Aprobado |
| Q11 | ¿Quitar un alimento pide confirmación? | No: se quita al pulsar «Quitar» (volver a añadirlo es fácil). Deshacer pasa al backlog. | Aprobado |

**Estado:** las 11 preguntas están resueltas; el usuario aceptó todas las propuestas por defecto tal cual. Dónde quedan
incorporadas:

- Q1: REQ-004 (AC-004.1 a AC-004.3), REQ-010 (AC-010.2) y glosario («Ventana de hoy»).
- Q2: REQ-001 (AC-001.2, AC-001.3), REQ-005 (AC-005.1) y la tabla de tipos de comida de la sección 6.
- Q3: REQ-002, REQ-003 (AC-003.9 a AC-003.12) y REQ-012.
- Q4: Fuera de alcance («mis alimentos»).
- Q5: Fuera de alcance (otros días en la pantalla), REQ-005 (AC-005.7), REQ-006 (AC-006.5) y REQ-007 (AC-007.5).
- Q6: REQ-003 (AC-003.4, AC-003.5, AC-003.8, AC-003.10 a AC-003.13) y la tabla de límites de la sección 6.
- Q7: REQ-001 (AC-001.4), REQ-005 (AC-005.4) y REQ-014 (AC-014.4).
- Q8: REQ-015.
- Q9: REQ-016.
- Q10: Alcance (reutiliza la búsqueda de la 021 sin cambios) y Fuera de alcance.
- Q11: REQ-013 (AC-013.4) y Fuera de alcance (deshacer).

## 8. Glosario

- **Diario:** el registro de las comidas de un usuario en un día.
- **Comida:** el conjunto de alimentos de un tipo (desayuno, almuerzo, cena o meriendas) en un día.
- **Alimento de USDA:** alimento de la base importada en la spec 021, identificado por su FDC ID.
- **Alimento personalizado:** alimento con nombre y valores por 100 g escritos por el usuario, para lo que USDA no
  tiene.
- **Valores por 100 g guardados:** los valores nutricionales copiados en el alimento registrado al añadirlo; los
  nutrientes se recalculan siempre a partir de ellos.
- **Objetivo de Macros:** las calorías y los gramos de proteína, carbohidratos y grasa diarios que calcula la pantalla
  Macros (spec 007) a partir del perfil.
- **Ventana de hoy:** del día anterior al siguiente a la fecha actual del reloj del servidor.
