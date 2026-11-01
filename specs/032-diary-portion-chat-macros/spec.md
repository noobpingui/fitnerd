# Spec 032 — Valores por 100 g en el chat de porciones y «Añadir alimento» precargado

- **Feature:** `032-diary-portion-chat-macros` · **Tipo:** feature
- **Ámbitos:** `backend`, `frontend`

## 1. Contexto y problema

El diario (`/diary`) tiene desde la spec 031 el bloque «Calcular gramos con IA», que consume
`POST /api/meals/portion-estimate` (spec 030): el usuario escribe un alimento o una porción («5 huevos») y recibe una
estimación de su peso en gramos. Para registrarlo, hoy tiene que anotar los gramos, abrir «Añadir alimento» en una
sección, crear un alimento personalizado y escribir a mano sus calorías, proteína, carbohidratos y grasa por 100 g,
que normalmente no conoce.

Esta feature amplía la respuesta del chat con el nombre del alimento y sus valores por 100 g (kcal, proteína,
carbohidratos y grasa), los muestra en la conversación y añade un botón «Añadir alimento», a la izquierda de
«Preguntar», que abre el formulario de «Crear alimento personalizado» ya relleno con esos datos y los gramos
estimados, para que el usuario los revise, elija la comida y lo guarde.

En la spec 031 (pregunta Q7) se dejó fuera de alcance añadir al diario desde el chat; esta feature, pedida
expresamente por el usuario en su idea, sustituye esa decisión. El usuario sigue revisando y confirmando los datos:
nada se añade al diario sin pulsar «Añadir».

## 2. Historia de usuario

Como **usuario con sesión que registra comidas en el diario**, quiero **que el chat de gramos me dé también las
calorías y los macros por 100 g y me deje añadir el alimento con esos datos ya rellenos** para **registrar lo que
comí sin buscar sus valores nutricionales ni escribirlos a mano**.

## 3. Alcance

**Incluye:**
- Backend: la respuesta `estimated` de `POST /api/meals/portion-estimate` añade el nombre del alimento y sus valores
  por 100 g (kcal, proteína, carbohidratos y grasa), validados en el servidor con las mismas reglas que un alimento
  personalizado del diario. Las demás claves del contrato de la 030 no cambian.
- Frontend: la respuesta del chat muestra los valores por 100 g cuando vienen.
- Frontend: un botón «Añadir alimento» en el bloque del chat, a la izquierda de «Preguntar», visible cuando la
  última pregunta tiene una estimación.
- Frontend: un diálogo «Añadir alimento» con un selector de comida (Desayuno, Almuerzo, Cena, Meriendas) y el mismo
  formulario de «Crear alimento personalizado» del diario, precargado con el nombre, los gramos y los valores por
  100 g de esa respuesta, editables antes de guardar.
- Guardar el alimento en la comida elegida del día que se está viendo, igual que «Crear alimento personalizado»
  (incluida su incorporación a la biblioteca de alimentos propios de la spec 028).

**Fuera de alcance:**
- Cambios en la validación de la pregunta, el límite de 10 preguntas cada 6 horas, el tope de 4096 bytes, los
  mensajes fijos, los errores o las trazas de la spec 030, salvo lo que se indica en NFR-001.
- Calcular en el servidor las calorías o los macros de la porción completa (solo se devuelven por 100 g; el
  formulario ya muestra la vista previa de la porción).
- Relacionar la respuesta con el catálogo de alimentos o con la biblioteca de alimentos propios (buscar si ya
  existe un alimento parecido).
- Un botón «Añadir alimento» por cada respuesta de la conversación: solo se ofrece para la última.
- Añadir al diario sin pasar por el formulario, o sin que el usuario pulse «Añadir».
- Preseleccionar la comida según la hora del día.
- Cambios en «Añadir a {sección}», en la propuesta de foto o en el resto del diario.

## 4. Requisitos funcionales

### REQ-001 — Nombre y valores por 100 g en la estimación
WHEN el modelo devuelve una estimación válida THE SYSTEM SHALL incluir en la respuesta 200 `estimated`, además de las
claves de la spec 030, `name` (el nombre del alimento, o `null`) y `per_100g` (un objeto con `calories_kcal`,
`protein_g`, `carbs_g` y `fat_g`, o `null`).

- **AC-001.1:** Given un usuario con sesión y un modelo simulado que responde que es comida con 250 gramos, porción
  «5 huevos grandes», nota «Unos 50 g por huevo sin cáscara.», nombre «Huevo» y por 100 g 143 kcal, 12,6 g de
  proteína, 0,7 g de carbohidratos y 9,5 g de grasa, When envía `{"question": "5 huevos"}`, Then recibe 200 con
  `{"status": "estimated", "grams": 250, "unit": "5 huevos grandes", "note": "Unos 50 g por huevo sin cáscara.", "message": null, "name": "Huevo", "per_100g": {"calories_kcal": 143, "protein_g": 12.6, "carbs_g": 0.7, "fat_g": 9.5}}`.
- **AC-001.2:** Given un modelo simulado que responde una estimación válida sin nombre ni valores por 100 g, When el
  usuario pregunta, Then recibe 200 `estimated` con sus gramos, `name` `null` y `per_100g` `null`.
- **AC-001.3:** Given un modelo simulado que responde una estimación válida con nombre pero sin valores por 100 g,
  When el usuario pregunta, Then `name` trae el nombre y `per_100g` es `null`; y Given uno con valores por 100 g
  válidos pero sin nombre, Then `name` es `null` y `per_100g` trae los valores.

### REQ-002 — Validar los valores por 100 g
WHEN el modelo devuelve valores por 100 g THE SYSTEM SHALL redondear cada uno a un decimal (las mitades hacia arriba)
y devolverlos solo si los cuatro son números (no booleanos), las kcal están entre 0 y 900, cada macro entre 0 y 100
y la suma de proteína, carbohidratos y grasa no supera 100; IF alguno falta o no cumple estas reglas THEN THE SYSTEM
SHALL devolver `per_100g` `null` sin cambiar el resto de la estimación.

- **AC-002.1:** Given un modelo simulado que responde por 100 g 143,26 kcal, 12,65 g de proteína, 0,74 g de
  carbohidratos y 9,549 g de grasa, When el usuario pregunta, Then `per_100g` es
  `{"calories_kcal": 143.3, "protein_g": 12.7, "carbs_g": 0.7, "fat_g": 9.5}`.
- **AC-002.2:** Given un modelo simulado que responde por 100 g 0 kcal y 0 g de los tres macros, y en otro caso 900
  kcal, 0 g de proteína, 0 g de carbohidratos y 100 g de grasa, When el usuario pregunta, Then `per_100g` trae esos
  valores (los extremos son válidos).
- **AC-002.3:** Given un modelo simulado que responde una estimación con 250 gramos y, en cada caso, unas kcal de
  900,1 o de -1, una proteína de 100,1 o de -0,5, unas kcal `"143"`, una grasa `true`, una grasa `null`, sin el
  valor de carbohidratos, o macros de 50, 40 y 10,1 g (suma 100,1), When el usuario pregunta, Then la respuesta es
  200 `estimated` con `grams` 250, `unit` y `note` como en una estimación válida y `per_100g` `null`.
- **AC-002.4:** Given un modelo simulado que responde `per_100g` como algo que no es un objeto (un texto o una
  lista), When el usuario pregunta, Then la respuesta es 200 `estimated` con `per_100g` `null`.

### REQ-003 — Limpiar el nombre
WHEN el modelo devuelve un nombre THE SYSTEM SHALL quitar los espacios de los extremos y recortarlo a 100 caracteres
sin dejar espacios al final; IF no es texto o queda vacío THEN THE SYSTEM SHALL devolver `name` `null`.

- **AC-003.1:** Given un modelo simulado que devuelve `"  Huevo cocido  "` como nombre, When el usuario pregunta,
  Then `name` es `"Huevo cocido"`.
- **AC-003.2:** Given un modelo simulado que devuelve un nombre de 140 caracteres, When el usuario pregunta, Then
  `name` tiene como máximo 100 caracteres, coincide con el inicio del nombre original y no termina en espacio.
- **AC-003.3:** Given un modelo simulado que devuelve como nombre `""`, `"   "`, `5` o `null`, When el usuario
  pregunta, Then `name` es `null` y la estimación sigue siendo `estimated`.

### REQ-004 — Claves nuevas en las respuestas sin estimación
WHEN la respuesta 200 tiene `status` `"not_food"` o `"unknown"` THE SYSTEM SHALL incluir `name` y `per_100g` con
valor `null`, sin ningún dato generado por el modelo.

- **AC-004.1:** Given un modelo simulado que responde que no es comida pero incluye nombre y valores por 100 g, When
  el usuario pregunta, Then recibe 200 con
  `{"status": "not_food", "grams": null, "unit": null, "note": null, "message": "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento.", "name": null, "per_100g": null}`.
- **AC-004.2:** Given un modelo simulado que responde que es comida con 0 gramos pero con nombre y valores por 100 g
  válidos, When el usuario pregunta, Then recibe 200 `unknown` con el mensaje fijo de la 030, `name` `null` y
  `per_100g` `null`.

### REQ-005 — Mostrar los valores por 100 g en el chat
WHEN una respuesta `estimated` trae `per_100g` THE SYSTEM SHALL mostrar en esa respuesta, después de la porción y la
nota, la línea «Por 100 g: {kcal} kcal · {proteína} g proteína · {carbohidratos} g carbohidratos · {grasa} g grasa»,
con las kcal sin decimales y los gramos con un decimal y coma decimal.

- **AC-005.1:** Given la respuesta de AC-001.1, When llega, Then la conversación muestra «Unos 250 g», «Porción: 5
  huevos grandes», «Unos 50 g por huevo sin cáscara.» y «Por 100 g: 143 kcal · 12,6 g proteína · 0,7 g carbohidratos
  · 9,5 g grasa», en ese orden.
- **AC-005.2:** Given una respuesta `estimated` con `per_100g` `null`, When llega, Then la respuesta no muestra
  «Por 100 g:».
- **AC-005.3:** Given una respuesta `estimated` con `per_100g` 52,4 kcal, 0 g, 13,8 g y 0,2 g, When llega, Then
  muestra «Por 100 g: 52 kcal · 0,0 g proteína · 13,8 g carbohidratos · 0,2 g grasa».

### REQ-006 — Botón «Añadir alimento» en el chat
WHILE la pregunta más reciente de la conversación tiene una respuesta `estimated` THE SYSTEM SHALL mostrar en el
bloque del chat un botón «Añadir alimento» inmediatamente a la izquierda de «Preguntar»; en cualquier otro caso
(conversación vacía, última pregunta en curso, con mensaje fijo o con error) THE SYSTEM SHALL no mostrarlo.

- **AC-006.1:** Given la conversación vacía, When se muestra el bloque del chat, Then no hay ningún botón «Añadir
  alimento» dentro del bloque.
- **AC-006.2:** Given una pregunta respondida con una estimación, When se muestra el bloque, Then dentro del bloque
  aparece el botón «Añadir alimento» y, en el orden del documento, está justo antes del botón «Preguntar».
- **AC-006.3:** Given una estimación ya respondida, When el usuario envía otra pregunta y su respuesta aún no ha
  llegado, Then el botón «Añadir alimento» no aparece.
- **AC-006.4:** Given una estimación ya respondida, When la siguiente pregunta recibe `not_food`, `unknown`, un 429
  o cualquier error, Then el botón «Añadir alimento» no aparece.
- **AC-006.5:** Given una respuesta `estimated` sin `name` ni `per_100g`, When llega, Then el botón «Añadir
  alimento» sí aparece.

### REQ-007 — Abrir el formulario precargado
WHEN el usuario pulsa «Añadir alimento» en el chat THE SYSTEM SHALL abrir el diálogo «Añadir alimento» con el campo
«Comida» y el formulario de «Crear alimento personalizado» (los mismos campos, reglas, vista previa, aviso de la
biblioteca y mensajes que en «Añadir a {sección}»), precargado con los datos de la respuesta más reciente: «Nombre»
con `name`, «Gramos» con `grams` y los cuatro campos por 100 g con `per_100g` (con coma decimal); los campos cuyo
dato es `null` quedan vacíos. Todos los campos se pueden editar.

- **AC-007.1:** Given la respuesta de AC-001.1, When el usuario pulsa «Añadir alimento», Then se abre un diálogo con
  el título «Añadir alimento» y los campos «Nombre» = «Huevo», «Gramos» = «250», «Calorías por 100 g (kcal)» =
  «143», «Proteína por 100 g (g)» = «12,6», «Carbohidratos por 100 g (g)» = «0,7» y «Grasa por 100 g (g)» = «9,5».
- **AC-007.2:** Given el diálogo de AC-007.1, When se muestra, Then aparece la vista previa de la porción con los
  valores de 250 g y el aviso «Se guardará en tus alimentos para usarlo otro día. Si ya tienes uno con el mismo
  nombre, se actualizarán sus valores.».
- **AC-007.3:** Given una respuesta `estimated` con `grams` 120, `name` `null` y `per_100g` `null`, When el usuario
  pulsa «Añadir alimento», Then «Gramos» = «120» y «Nombre» y los cuatro campos por 100 g están vacíos.
- **AC-007.4:** Given una respuesta `estimated` con `grams` 3000, When el usuario abre el diálogo, elige una comida y
  pulsa «Añadir», Then «Gramos» muestra «3000», aparece «Los gramos deben estar entre 1 y 2000.» y no se envía
  ninguna petición.
- **AC-007.5:** Given dos estimaciones en la conversación («5 huevos» y después «un plátano»), When el usuario pulsa
  «Añadir alimento», Then el formulario se precarga con los datos de la respuesta de «un plátano».
- **AC-007.6:** Given el diálogo abierto, When el usuario cambia el nombre a «Huevo duro» y los gramos a «100» y lo
  guarda, Then se envían los valores editados, no los de la respuesta.
- **AC-007.7:** Given el diálogo abierto sobre el día de hoy, When llega la medianoche del dispositivo, Then el día
  del diario no cambia mientras el diálogo siga abierto (como con los diálogos de las secciones).

### REQ-008 — Elegir la comida
THE SYSTEM SHALL mostrar en el diálogo, antes del formulario, un campo obligatorio «Comida» con las opciones
«Desayuno», «Almuerzo», «Cena» y «Meriendas», sin ninguna elegida al abrirse; IF el usuario pulsa «Añadir» sin
elegir una THEN THE SYSTEM SHALL mostrar «Elige en qué comida añadirlo.» y no enviar nada.

- **AC-008.1:** Given el diálogo recién abierto, When se muestra, Then el campo «Comida» ofrece «Desayuno»,
  «Almuerzo», «Cena» y «Meriendas», en ese orden, y ninguna está elegida.
- **AC-008.2:** Given el diálogo con todos los datos válidos y sin comida elegida, When el usuario pulsa «Añadir»,
  Then aparece «Elige en qué comida añadirlo.» y no se envía ninguna petición.

### REQ-009 — Guardar el alimento
WHEN el usuario pulsa «Añadir» con una comida elegida y datos válidos THE SYSTEM SHALL guardar el alimento
personalizado en esa comida del día que se está viendo, igual que «Crear alimento personalizado» en «Añadir a
{sección}», cerrar el diálogo, mostrar el diario actualizado y conservar la conversación del chat.

- **AC-009.1:** Given el diario de hoy y el diálogo de AC-007.1 con «Cena» elegida, When el usuario pulsa «Añadir»,
  Then se envía una sola petición a `POST /api/meals` con la fecha de hoy, `meal_type` `"dinner"` y un único alimento
  con nombre «Huevo», 250 g y los valores por 100 g 143, 12,6, 0,7 y 9,5, igual que la que envía «Crear alimento
  personalizado» con esos datos.
- **AC-009.2:** Given un día pasado elegido con `?date=` y «Desayuno» elegido, When el usuario guarda, Then la
  petición lleva la fecha de ese día y `meal_type` `"breakfast"`.
- **AC-009.3:** Given un guardado que responde con éxito, When termina, Then el diálogo se cierra, la sección elegida
  muestra el alimento nuevo y la conversación del chat sigue mostrando sus preguntas y respuestas, con el botón
  «Añadir alimento» todavía visible.
- **AC-009.4:** Given un guardado en curso, When el usuario vuelve a pulsar «Añadir», Then no se envía una segunda
  petición y el botón muestra «Guardando…».

### REQ-010 — Cancelar y errores al guardar
IF el guardado falla THEN THE SYSTEM SHALL mantener el diálogo abierto con los datos escritos y mostrar el mismo
mensaje de error que «Añadir a {sección}»; WHEN el usuario pulsa «Cancelar» o Escape sin un guardado en curso THE
SYSTEM SHALL cerrar el diálogo sin enviar nada.

- **AC-010.1:** Given un guardado que responde 400 con «Los gramos deben estar entre 1 y 2000.», When llega, Then el
  diálogo sigue abierto, muestra ese mensaje y los campos conservan lo escrito.
- **AC-010.2:** Given un guardado que falla por la red o con 500, When llega el fallo, Then el diálogo sigue abierto
  y muestra el mensaje genérico de error al guardar del diario.
- **AC-010.3:** Given el diálogo abierto, When el usuario pulsa «Cancelar», y en otro caso Escape, Then el diálogo se
  cierra, no se envía ninguna petición a `POST /api/meals` y la conversación del chat no cambia.

### REQ-011 — Respuestas de un backend anterior
IF una respuesta `estimated` no trae las claves `name` o `per_100g` THEN THE SYSTEM SHALL tratarlas como `null`; IF
las trae con una forma distinta de la del contrato THEN THE SYSTEM SHALL tratar la respuesta como inesperada,
igual que en la spec 031.

- **AC-011.1:** Given una respuesta `{"status": "estimated", "grams": 250, "unit": null, "note": null, "message": null}`
  (sin las claves nuevas), When llega, Then la conversación muestra «Unos 250 g», no muestra «Por 100 g:» y aparece
  el botón «Añadir alimento».
- **AC-011.2:** Given una respuesta `estimated` con `per_100g` `"143"`, o con `per_100g` sin `fat_g`, o con `name`
  `5`, When llega, Then debajo de la pregunta aparece «No se pudo estimar el peso. Vuelve a intentarlo.» y el botón
  «Añadir alimento» no aparece.

## 5. Requisitos no funcionales

### NFR-001 — Coste acotado con la respuesta ampliada
THE SYSTEM SHALL consultar el modelo con un máximo de 250 tokens de salida (en lugar de los 150 de la spec 030),
para que quepan el nombre y los valores por 100 g, manteniendo una sola consulta por pregunta y el mismo modelo
configurado.

- **AC-N001.1:** Given un modelo simulado que registra los parámetros recibidos, When el usuario hace una pregunta
  válida, Then el modelo se consulta una sola vez con un máximo de 250 tokens de salida.

### NFR-002 — Instrucciones fijas ampliadas
THE SYSTEM SHALL mantener unas instrucciones fijas que, además de lo de la spec 030, pidan el nombre corto del
alimento estimado y sus valores por 100 g de la parte comestible, en el mismo estado (crudo, cocinado…) que la
porción supuesta. La calidad de los valores depende del modelo y no se comprueba con tests automatizados; solo se
comprueba que las instrucciones son fijas y piden esos datos.

- **AC-N002.1:** Given un modelo simulado que registra lo recibido, When se hacen dos preguntas distintas, Then las
  instrucciones recibidas son idénticas en las dos y la descripción de la respuesta estructurada pedida incluye el
  nombre y los cuatro valores por 100 g.

### NFR-003 — Accesibilidad del diálogo
THE SYSTEM SHALL dar al diálogo el nombre accesible «Añadir alimento» y devolver el foco al botón «Añadir alimento»
del chat al cerrarlo sin guardar.

- **AC-N003.1:** Given el diálogo abierto, When se consulta por su rol, Then es un `dialog` con el nombre
  «Añadir alimento».
- **AC-N003.2:** Given el diálogo abierto desde el chat, When el usuario pulsa «Cancelar», Then el foco vuelve al
  botón «Añadir alimento» del bloque del chat.

## 6. Datos y contratos visibles

**Endpoint:** `POST /api/meals/portion-estimate` (spec 030). La petición, los códigos de error, sus mensajes, el
límite de uso y el tope de 4096 bytes no cambian.

**Respuesta 200** (todas las claves siempre presentes; las dos últimas son nuevas):

| Campo | Tipo | `estimated` | `not_food` / `unknown` |
|---|---|---|---|
| `status` | texto | `"estimated"` | `"not_food"` o `"unknown"` |
| `grams` | entero | De 1 a 5000 | `null` |
| `unit` | texto o `null` | Porción considerada, hasta 50 caracteres | `null` |
| `note` | texto o `null` | Aclaración breve, hasta 100 caracteres | `null` |
| `message` | texto o `null` | `null` | Mensaje fijo de la 030 |
| `name` | texto o `null` | Nombre del alimento, sin espacios en los extremos, hasta 100 caracteres | `null` |
| `per_100g` | objeto o `null` | `{"calories_kcal", "protein_g", "carbs_g", "fat_g"}`, números con un decimal como máximo, o `null` si falta o no es válido | `null` |

**Reglas de `per_100g`** (las mismas de un alimento personalizado del diario): `calories_kcal` de 0 a 900;
`protein_g`, `carbs_g` y `fat_g` de 0 a 100 cada uno, con una suma de 100 como máximo; los cuatro presentes o
ninguno.

**Textos visibles nuevos (español):**

| Lugar | Texto |
|---|---|
| Línea de la respuesta `estimated` con `per_100g` | `Por 100 g: {kcal} kcal · {p} g proteína · {c} g carbohidratos · {g} g grasa` (kcal sin decimales; gramos con un decimal y coma) |
| Botón del chat, a la izquierda de «Preguntar» | `Añadir alimento` |
| Título del diálogo | `Añadir alimento` |
| Descripción del diálogo | `Revisa los datos de la IA y elige en qué comida añadirlo.` |
| Campo de comida | Etiqueta `Comida`; opciones `Desayuno`, `Almuerzo`, `Cena`, `Meriendas`; sin opción elegida al abrir |
| Comida sin elegir al pulsar «Añadir» | `Elige en qué comida añadirlo.` |
| Botones del diálogo | `Añadir` (`Guardando…` mientras guarda) y `Cancelar` |

Los demás campos, sus etiquetas, la vista previa, el aviso de la biblioteca y los mensajes de validación y de
error al guardar son los de «Crear alimento personalizado» (specs 022 y 028).

**Precarga del formulario:**

| Campo | Valor inicial |
|---|---|
| Nombre | `name`, o vacío si es `null` |
| Gramos | `grams` como entero |
| Calorías por 100 g (kcal) | `per_100g.calories_kcal`, con coma decimal, o vacío |
| Proteína por 100 g (g) | `per_100g.protein_g`, con coma decimal, o vacío |
| Carbohidratos por 100 g (g) | `per_100g.carbs_g`, con coma decimal, o vacío |
| Grasa por 100 g (g) | `per_100g.fat_g`, con coma decimal, o vacío |

**Guardado:** la misma petición `POST /api/meals` que «Crear alimento personalizado», con el día que se está viendo y
la comida elegida. Sin migraciones ni variables nuevas.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | El chat está fuera de las secciones, así que no sabe en qué comida añadir el alimento. ¿Cómo se elige? | Campo obligatorio «Comida» en el diálogo (Desayuno, Almuerzo, Cena, Meriendas), sin ninguna preseleccionada; si no se elige, «Elige en qué comida añadirlo.» (REQ-008). | Aceptada la propuesta por defecto. |
| Q2 | ¿Qué nombre se precarga? | Un nombre corto del alimento que devuelve la IA en una clave nueva `name` («Huevo»), no la pregunta («5 huevos») ni la porción; si no viene, el campo queda vacío (REQ-001, REQ-003, REQ-007). | Aceptada la propuesta por defecto. |
| Q3 | ¿Qué pasa si los valores por 100 g que da la IA no son válidos (fuera de rango, suma de macros > 100, falta alguno)? | El servidor devuelve `per_100g` `null` (los cuatro o ninguno), la estimación de gramos se mantiene, el chat no muestra «Por 100 g:» y el formulario deja esos campos vacíos (REQ-002). | Aceptada la propuesta por defecto. |
| Q4 | ¿Cuándo se ve el botón «Añadir alimento» y qué respuesta usa? | Solo cuando la pregunta más reciente tiene una respuesta `estimated` (aunque no traiga `per_100g`), y usa esa respuesta; no hay un botón por cada respuesta (REQ-006, AC-007.5). | Aceptada la propuesta por defecto. |
| Q5 | ¿Se muestran los valores por 100 g en la respuesta del chat, o solo en el formulario? | También en el chat, con la línea «Por 100 g: 143 kcal · 12,6 g proteína · 0,7 g carbohidratos · 9,5 g grasa» (REQ-005). | Aceptada la propuesta por defecto. |
| Q6 | Los gramos estimados llegan hasta 5000, pero un alimento del diario admite de 1 a 2000. ¿Qué se hace con una estimación mayor de 2000? | Se precargan tal cual y el formulario muestra su error habitual al guardar («Los gramos deben estar entre 1 y 2000.»); el usuario los corrige (AC-007.4). | Aceptada la propuesta por defecto. |
| Q7 | La respuesta ampliada necesita más tokens de salida. ¿Se sube el máximo? | Sí, de 150 a 250 tokens de salida por pregunta, con el mismo modelo y una sola consulta (NFR-001). | Aceptada la propuesta por defecto. |

**Estado:** Q1–Q7 resueltas (iteración 1). Las propuestas por defecto aceptadas ya están incorporadas: Q1 en
REQ-008 (AC-008.1, AC-008.2); Q2 en REQ-001, REQ-003 y REQ-007; Q3 en REQ-002 y AC-005.2, AC-007.3; Q4 en REQ-006 y
AC-007.5; Q5 en REQ-005; Q6 en AC-007.4; Q7 en NFR-001. No quedan preguntas abiertas.

## 8. Glosario

- **Valores por 100 g:** calorías (kcal), proteína, carbohidratos y grasa (g) de 100 g de la parte comestible del
  alimento, como los que pide «Crear alimento personalizado».
- **Respuesta más reciente:** la respuesta a la última pregunta enviada en la conversación del chat.
- **Día que se está viendo:** el día elegido en `/diary` (hoy o el de `?date=`).
