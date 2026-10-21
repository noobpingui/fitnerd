# Spec 024 — Análisis de la foto de una comida con alimentos propuestos del catálogo

- **Feature:** `024-meal-image-analysis` · **Tipo:** feature
- **Ámbitos:** `backend`

## 1. Contexto y problema

Desde la spec 022 el usuario registra sus comidas en el diario buscando cada alimento y escribiendo sus gramos, y desde
la 023 lo hace con un catálogo propio de unos 260 alimentos simples en español, con un identificador estable y sus
calorías, proteína, carbohidratos y grasa por 100 g. Registrar una comida con varios alimentos sigue siendo lento.

El plan de registro con foto (backlog del proyecto, specs 021–025) quiere que el usuario pueda hacer una foto de su
plato y recibir una propuesta de lo que contiene. Esta spec añade **solo el backend** de ese paso: un endpoint que
recibe la foto de una comida, la envía a un modelo de visión de Amazon Bedrock y devuelve los alimentos que reconoce,
**elegidos solo del catálogo de la 023**, con sus gramos estimados, una confianza y sus macros. Los números
nutricionales salen siempre del catálogo, nunca del modelo. Lo que el modelo ve y no está en el catálogo se devuelve
aparte, sin macros.

El análisis no guarda nada: ni la foto ni la comida. La foto se procesa en la petición y se descarta. La pantalla para
subir la foto, revisar la propuesta y guardarla en el diario es la spec 025, que guardará con el `POST /api/meals` que
ya existe.

## 2. Historia de usuario

Como **usuario de fitnerd con sesión iniciada**, quiero **enviar la foto de mi comida y recibir los alimentos que
contiene, con sus gramos aproximados y sus macros** para **registrar la comida sin buscar cada alimento a mano**.

Como **desarrollador de la spec 025**, quiero **un contrato estable con alimentos del catálogo y sus gramos** para
**mostrarlos en la pantalla de confirmación y guardarlos con `POST /api/meals` sin transformarlos**.

## 3. Alcance

**Incluye:**
- El endpoint `POST /api/meals/analyze`, con sesión, que recibe una foto (JPEG, PNG o WebP de hasta 3 MB) y responde con:
  - los alimentos reconocidos que existen en el catálogo, cada uno con su identificador y nombre del catálogo, sus gramos
    estimados, su confianza, sus valores por 100 g del catálogo y sus nutrientes para esos gramos;
  - los alimentos reconocidos sin coincidencia en el catálogo, con un nombre descriptivo, sus gramos estimados y su
    confianza, sin macros;
  - los totales de los alimentos del catálogo.
- Validación de la foto (presencia, formato real, tamaño y dimensiones) antes de llamar al proveedor.
- Límite de uso por usuario en Redis, como el coach: 10 análisis por hora y usuario.
- Saneado de la respuesta del modelo: solo identificadores del catálogo, gramos en rango, confianzas válidas, sin
  duplicados y con un máximo de alimentos.
- La foto no se guarda en ningún sitio, no se escribe en los registros del servidor ni en las trazas, y se envía al
  proveedor sin sus metadatos (ubicación, cámara, fecha).
- Trazas del análisis en Langfuse, sin la imagen.
- La configuración del proveedor en producción (permisos de la instancia y variables), documentada como paso manual
  (Art. P4).

**Fuera de alcance:**
- Cualquier pantalla: subir o hacer la foto, redimensionarla en el cliente, confirmar y editar la propuesta (spec 025).
- Guardar la propuesta en el diario: se hace después con `POST /api/meals`, sin cambios en ese endpoint.
- La actualización de la Política de privacidad para mencionar que las fotos se envían a Amazon Web Services (va con la
  025, que es la primera pantalla que envía fotos; ver Q7).
- Guardar o reutilizar fotos, historial de análisis y caché de resultados.
- Varias fotos por petición, varios platos o comidas en una foto, etiquetas nutricionales y códigos de barras.
- Un texto del usuario que acompañe a la foto («es arroz integral»).
- Alimentos de USDA, alimentos personalizados y macros estimados por el modelo: los únicos macros son los del catálogo.
- Cambiar el catálogo de la 023 o su búsqueda.
- Un tope de gasto global (de todos los usuarios) con el proveedor (backlog, ver Q5).
- La medición de la precisión del modelo con fotos reales como test automatizado: es una revisión manual (ver Q9).

## 4. Requisitos funcionales

### Petición y validación

### REQ-001 — Análisis de una foto válida
WHEN un usuario con sesión pide `POST /api/meals/analyze` con una foto válida THE SYSTEM SHALL enviar la foto al
proveedor de visión junto con la lista de alimentos del catálogo, y SHALL responder 200 con los alimentos propuestos
(`items`), los alimentos sin coincidencia (`unmatched`) y los totales (`totals`) con el formato de la sección 6.

- **AC-001.1:** Given el alimento del catálogo `arroz-blanco-cocido` («Arroz blanco cocido», 130 kcal, 2,69 g de
  proteína, 28,17 g de carbohidratos y 0,28 g de grasa por 100 g) y un proveedor simulado que reconoce en la foto ese
  identificador con 150 g y confianza `high`, When un usuario con sesión envía una foto JPEG válida, Then recibe 200 con
  un único alimento en `items` con `catalog_id: "arroz-blanco-cocido"`, `name: "Arroz blanco cocido"`, `grams: 150`,
  `confidence: "high"`, `per_100g` igual a los valores del catálogo y `nutrients` igual a
  `{"calories_kcal": 195.0, "protein_g": 4.04, "carbs_g": 42.26, "fat_g": 0.42}`, `unmatched` vacío y `totals` igual a
  esos `nutrients`.
- **AC-001.2:** Given un proveedor simulado, When se envía una foto PNG válida y otra WebP válida, Then las dos responden
  200 y el proveedor recibe en cada caso la imagen y su formato.
- **AC-001.3:** Given un catálogo con varios alimentos, When se envía una foto válida, Then el proveedor simulado recibe
  el identificador y el nombre de todos los alimentos del catálogo.
- **AC-001.4:** Given un proveedor simulado que reconoce dos alimentos del catálogo, When se analiza la foto, Then
  `items` los tiene en el orden en que los devolvió el proveedor y `totals` es la suma de sus `nutrients`.
- **AC-001.5:** Given un proveedor simulado que no reconoce ningún alimento (por ejemplo, la foto de un paisaje), When
  se analiza, Then la respuesta es 200 con `items` y `unmatched` vacíos y los cuatro `totals` en 0.

### REQ-002 — Foto ausente o duplicada
IF la petición no es `multipart/form-data`, no trae el campo `image`, el archivo está vacío o trae más de un archivo en
`image` THEN THE SYSTEM SHALL responder 400 con el mensaje de la sección 6 y SHALL NOT llamar al proveedor.

- **AC-002.1:** Given un usuario con sesión, When pide el análisis sin cuerpo, con un cuerpo JSON o con un formulario
  sin el campo `image`, Then recibe 400 con `{"error": "Adjunta una foto de la comida."}` y el proveedor simulado no
  recibe ninguna llamada.
- **AC-002.2:** Given un usuario con sesión, When envía el campo `image` con un archivo de 0 bytes, Then recibe 400 con
  `{"error": "Adjunta una foto de la comida."}`.
- **AC-002.3:** Given un usuario con sesión, When envía dos archivos en el campo `image`, Then recibe 400 con
  `{"error": "Adjunta una sola foto."}` y el proveedor no recibe ninguna llamada.
- **AC-002.4:** Given un usuario con sesión, When envía una foto válida en `image` y otros campos adicionales, Then los
  campos adicionales se ignoran y la respuesta es 200.

### REQ-003 — Formato, tamaño y dimensiones de la foto
IF el contenido del archivo no es una imagen JPEG, PNG o WebP (sin importar su nombre ni el tipo declarado), no se
puede leer, supera los 3 MB o alguno de sus lados supera los 8000 píxeles THEN THE SYSTEM SHALL responder con el código
y el mensaje de la sección 6 y SHALL NOT llamar al proveedor.

- **AC-003.1:** Given un usuario con sesión, When envía un archivo de texto llamado `comida.jpg` con tipo
  `image/jpeg`, o una imagen GIF, Then recibe 400 con `{"error": "La imagen debe ser JPEG, PNG o WebP."}` y el
  proveedor no recibe ninguna llamada.
- **AC-003.2:** Given un usuario con sesión, When envía una imagen PNG válida con el nombre `foto.jpg` y tipo
  `image/jpeg`, Then la respuesta es 200 y el proveedor la recibe como PNG (cuenta el contenido, no el nombre).
- **AC-003.3:** Given un usuario con sesión, When envía un archivo que empieza como un JPEG pero está truncado y no se
  puede leer, Then recibe 400 con `{"error": "No se pudo leer la imagen."}`.
- **AC-003.4:** Given un usuario con sesión, When envía una imagen de 3 × 1024 × 1024 bytes exactos, Then se analiza;
  y When envía una de 3 × 1024 × 1024 + 1 bytes, Then recibe 413 con
  `{"error": "La imagen no puede superar los 3 MB."}` y el proveedor no recibe ninguna llamada.
- **AC-003.5:** Given un usuario con sesión, When envía una petición cuyo cuerpo supera los 4 MB, Then recibe 413 con
  `{"error": "La imagen no puede superar los 3 MB."}` (y no el mensaje genérico en inglés del servidor).
- **AC-003.6:** Given un usuario con sesión, When envía una imagen de 8000 × 6000 píxeles, Then se analiza; y When
  envía una de 8001 × 100 o de 100 × 8001 píxeles, Then recibe 400 con
  `{"error": "La imagen no puede superar los 8000 píxeles por lado."}`.

### REQ-004 — Sesión
IF la petición no trae un token de sesión válido THEN THE SYSTEM SHALL responder 401 como el resto de endpoints
protegidos, sin validar la foto ni llamar al proveedor.

- **AC-004.1:** Given una petición sin cabecera de autorización, o con un token caducado o inválido, When pide el
  análisis con una foto válida, Then recibe 401 y el proveedor simulado no recibe ninguna llamada.

### REQ-005 — Límite de uso
IF un usuario ya hizo 10 análisis en la última hora THEN THE SYSTEM SHALL responder 429 con el mensaje de la sección 6
sin llamar al proveedor. Solo cuentan los análisis con una foto válida que llegan a pedirse al proveedor, incluidos los
que terminan en 503; las peticiones rechazadas con 400, 401 o 413 no cuentan. El límite es independiente para cada
usuario.

- **AC-005.1:** Given un usuario que hizo 10 análisis válidos en la última hora, When pide el 11, Then recibe 429 con
  `{"error": "Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato."}` y el proveedor simulado no
  recibe esa llamada.
- **AC-005.2:** Given un usuario que llegó al límite, When otro usuario pide un análisis válido, Then el segundo recibe
  200.
- **AC-005.3:** Given un usuario que hizo 9 análisis válidos y 5 peticiones rechazadas con 400 en la última hora, When
  pide un análisis válido, Then recibe 200.

### Respuesta del modelo

### REQ-006 — Solo alimentos y macros del catálogo
THE SYSTEM SHALL tomar el nombre y los valores por 100 g de cada alimento de `items` del catálogo, y SHALL calcular sus
nutrientes con los gramos estimados con el mismo cálculo y redondeo del diario (valor por 100 g × gramos / 100, a 2
decimales). Cualquier número nutricional o nombre que proponga el modelo para un alimento del catálogo se ignora.
IF el proveedor propone un identificador que no existe en el catálogo THEN THE SYSTEM SHALL tratarlo como alimento sin
coincidencia, con el nombre descriptivo que dé el proveedor, o descartarlo si no lo da.

- **AC-006.1:** Given un proveedor simulado que propone `arroz-blanco-cocido` con el nombre «Arroz frito» y 300 kcal por
  100 g, When se analiza, Then el alimento de `items` tiene `name: "Arroz blanco cocido"` y los valores por 100 g del
  catálogo.
- **AC-006.2:** Given un proveedor simulado que propone el identificador `gallo-pinto`, que no existe en el catálogo, con
  el nombre «Gallo pinto» y 200 g, When se analiza, Then `items` no lo incluye y `unmatched` tiene
  `{"name": "Gallo pinto", "grams": 200, "confidence": …}`.
- **AC-006.3:** Given un proveedor simulado que propone un identificador inexistente sin nombre, When se analiza, Then
  no aparece ni en `items` ni en `unmatched`.

### REQ-007 — Gramos, confianza y alimentos sin coincidencia
THE SYSTEM SHALL devolver los gramos estimados como un número entero de 1 a 2000 (redondeando al entero más cercano y
llevando a 2000 lo que lo supere), SHALL devolver la confianza como `high`, `medium` o `low` (y `low` si el proveedor da
otro valor o ninguno), y SHALL devolver el nombre de cada alimento sin coincidencia sin espacios en los extremos y con
hasta 100 caracteres. IF los gramos de un alimento faltan, no son un número o quedan por debajo de 1 al redondear, o el
nombre de un alimento sin coincidencia queda vacío THEN THE SYSTEM SHALL descartar ese alimento.

- **AC-007.1:** Given un proveedor simulado que propone un alimento del catálogo con 152,6 g, When se analiza, Then
  `grams` es 153; con 2500 g, Then `grams` es 2000 y sus nutrientes se calculan con 2000.
- **AC-007.2:** Given un proveedor simulado que propone alimentos con 0,3 g, con `-5`, con `"mucho"` o sin gramos, When
  se analiza, Then ninguno aparece en la respuesta.
- **AC-007.3:** Given un proveedor simulado que propone confianzas `high`, `medium`, `low`, `alta` y ninguna, When se
  analiza, Then la respuesta tiene `high`, `medium`, `low`, `low` y `low`.
- **AC-007.4:** Given un proveedor simulado que propone un alimento sin coincidencia con el nombre «  Salsa de tomate  »,
  When se analiza, Then su `name` es «Salsa de tomate»; con un nombre de 150 caracteres, Then su `name` son los 100
  primeros; y con un nombre de solo espacios, Then se descarta.

### REQ-008 — Duplicados y máximo de alimentos
WHEN el proveedor propone el mismo alimento del catálogo más de una vez THE SYSTEM SHALL devolverlo una sola vez, en la
posición de su primera aparición, con la suma de sus gramos (hasta 2000) y la menor de sus confianzas.
THE SYSTEM SHALL devolver como mucho 20 alimentos en total entre `items` y `unmatched`, conservando los primeros en el
orden del proveedor después de descartar y unir duplicados.

- **AC-008.1:** Given un proveedor simulado que propone `arroz-blanco-cocido` con 100 g y confianza `high` y, más tarde,
  otra vez con 80 g y confianza `medium`, When se analiza, Then `items` tiene un solo arroz con `grams: 180` y
  `confidence: "medium"` en la posición del primero.
- **AC-008.2:** Given un proveedor simulado que propone 25 alimentos válidos distintos (15 del catálogo y 10 sin
  coincidencia, intercalados), When se analiza, Then `items` y `unmatched` suman 20, que son los 20 primeros en el orden
  del proveedor.

### REQ-009 — Fallos del proveedor
IF el proveedor de visión no está configurado, falla, no responde en 30 segundos o devuelve una respuesta que no se
puede interpretar, o el catálogo está vacío, THEN THE SYSTEM SHALL responder 503 con el mensaje de la sección 6, sin
detalles del error, y SHALL registrar el fallo en el registro del servidor sin la imagen.

- **AC-009.1:** Given un proveedor simulado que lanza un error, o un error de tiempo agotado, When se analiza una foto
  válida, Then la respuesta es 503 con
  `{"error": "No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos."}`.
- **AC-009.2:** Given un proveedor simulado que devuelve un texto que no tiene el formato esperado (por ejemplo, «No
  puedo ayudar con eso»), When se analiza, Then la respuesta es 503 con el mismo mensaje.
- **AC-009.3:** Given un catálogo vacío, When se analiza una foto válida, Then la respuesta es 503 con el mismo mensaje y
  el proveedor no recibe ninguna llamada.
- **AC-009.4:** Given la aplicación sin la configuración del proveedor, When se analiza una foto válida, Then la respuesta
  es 503 con el mismo mensaje.

### REQ-010 — Sin metadatos de la foto
THE SYSTEM SHALL enviar la imagen al proveedor sin sus metadatos (ubicación GPS, modelo de cámara, fecha de la toma y
cualquier otro bloque EXIF, XMP o de texto), conservando su contenido visible.

- **AC-010.1:** Given una foto JPEG con datos EXIF que incluyen una ubicación GPS y un modelo de cámara, When se analiza,
  Then la imagen que recibe el proveedor simulado no contiene datos EXIF ni de ubicación y tiene las mismas dimensiones
  que la original.
- **AC-010.2:** Given una imagen PNG con un bloque de texto de metadatos, When se analiza, Then la imagen que recibe el
  proveedor simulado no contiene ese bloque.

## 5. Requisitos no funcionales

### NFR-001 — La foto no se conserva
THE SYSTEM SHALL procesar la foto solo durante la petición y SHALL NOT guardarla en la base de datos ni en ningún
almacenamiento, ni escribirla (en bruto ni codificada) en el registro del servidor ni en las trazas. El análisis no crea
ni modifica comidas ni ningún otro dato.

- **AC-N001.1:** Given un usuario sin comidas, When hace un análisis que responde 200 y otro que responde 503, Then
  ninguna tabla de la base tiene filas nuevas ni modificadas y el diario de hoy sigue vacío.
- **AC-N001.2:** Given un proveedor simulado que falla, When se analiza una foto, Then el registro del servidor de esa
  petición no contiene los bytes de la imagen ni su codificación en base64.

### NFR-002 — Trazas del análisis
THE SYSTEM SHALL registrar cada análisis que llega al proveedor como una traza con el usuario, el formato y el tamaño en
bytes de la foto, el número de alimentos propuestos y sin coincidencia, el uso de tokens del proveedor y un resultado
(`answered` si hay algún alimento, `empty` si no hay ninguno, `error` si responde 503), sin la imagen. Las peticiones
rechazadas con 400, 401, 413 o 429 no generan traza.

- **AC-N002.1:** Given un trazador simulado y un análisis con dos alimentos propuestos y uno sin coincidencia, When
  termina, Then hay una traza con el usuario, el formato, el tamaño, los recuentos 2 y 1 y el resultado `answered`, y
  ninguno de sus datos contiene los bytes de la imagen ni su codificación en base64.
- **AC-N002.2:** Given un trazador simulado, When un análisis no reconoce ningún alimento o el proveedor falla, Then la
  traza tiene el resultado `empty` o `error`, respectivamente.
- **AC-N002.3:** Given un trazador simulado, When una petición se rechaza con 400 o 429, Then no se crea ninguna traza.
- **AC-N002.4:** Given un trazador que falla al registrar, When se analiza una foto con un proveedor que responde bien,
  Then la respuesta sigue siendo 200 (un fallo de las trazas nunca convierte el análisis en 503).

## 6. Datos y contratos visibles

**`POST /api/meals/analyze`** (requiere `Authorization: Bearer {token}`):

- Cuerpo: `multipart/form-data` con un único archivo en el campo `image`. Otros campos se ignoran.
- Foto admitida: contenido JPEG, PNG o WebP (se comprueba el contenido, no el nombre ni el tipo declarado), de 1 byte a
  3 MB (3 × 1024 × 1024 bytes) y con lados de hasta 8000 píxeles.
- 200:
  ```json
  {
    "items": [
      {
        "catalog_id": "arroz-blanco-cocido",
        "name": "Arroz blanco cocido",
        "grams": 150,
        "confidence": "high",
        "per_100g": { "calories_kcal": 130.0, "protein_g": 2.69, "carbs_g": 28.17, "fat_g": 0.28 },
        "nutrients": { "calories_kcal": 195.0, "protein_g": 4.04, "carbs_g": 42.26, "fat_g": 0.42 }
      }
    ],
    "unmatched": [
      { "name": "Salsa de tomate", "grams": 30, "confidence": "low" }
    ],
    "totals": { "calories_kcal": 195.0, "protein_g": 4.04, "carbs_g": 42.26, "fat_g": 0.42 }
  }
  ```

| Campo | Tipo | Descripción |
|---|---|---|
| `items[].catalog_id` | texto | Identificador del alimento en el catálogo de la 023. Junto con `grams`, es lo que la 025 envía a `POST /api/meals` (`{"catalog_id": …, "grams": …}`). |
| `items[].name` | texto | Nombre del alimento en el catálogo. |
| `items[].grams` | entero | Gramos estimados, de 1 a 2000. |
| `items[].confidence` | texto | `high`, `medium` o `low`: seguridad del modelo al reconocer el alimento. |
| `items[].per_100g` | objeto | Los cuatro valores por 100 g del catálogo (`calories_kcal`, `protein_g`, `carbs_g`, `fat_g`). |
| `items[].nutrients` | objeto | Los cuatro valores para `grams`, con el cálculo y redondeo del diario (2 decimales). |
| `unmatched[].name` | texto | Nombre descriptivo en español de un alimento visto en la foto que no está en el catálogo, de 1 a 100 caracteres. Sin macros. |
| `unmatched[].grams` | entero | Gramos estimados, de 1 a 2000. |
| `unmatched[].confidence` | texto | `high`, `medium` o `low`. |
| `totals` | objeto | Suma de `nutrients` de `items` (los de `unmatched` no cuentan); ceros si `items` está vacío. |

Como mucho 20 alimentos entre `items` y `unmatched`; un alimento del catálogo aparece una sola vez. Las dos listas
pueden estar vacías (la 025 vuelve entonces al registro manual).

**Errores:**

| Caso | Código | Mensaje |
|---|---|---|
| Sin cuerpo multipart, sin campo `image` o archivo vacío | 400 | `Adjunta una foto de la comida.` |
| Más de un archivo en `image` | 400 | `Adjunta una sola foto.` |
| El contenido no es JPEG, PNG ni WebP | 400 | `La imagen debe ser JPEG, PNG o WebP.` |
| El formato es admitido pero la imagen no se puede leer | 400 | `No se pudo leer la imagen.` |
| Algún lado de más de 8000 píxeles | 400 | `La imagen no puede superar los 8000 píxeles por lado.` |
| Foto de más de 3 MB o cuerpo de la petición de más de 4 MB | 413 | `La imagen no puede superar los 3 MB.` |
| Sin sesión válida | 401 | El error de sesión de los demás endpoints protegidos. |
| Más de 10 análisis en la última hora | 429 | `Alcanzaste el límite de 10 análisis por hora. Vuelve a intentarlo en un rato.` |
| Proveedor sin configurar, con error, sin respuesta en 30 s o con respuesta no interpretable; catálogo vacío | 503 | `No se pudo analizar la imagen en este momento. Vuelve a intentarlo en unos minutos.` |

Todas las respuestas de error tienen la forma `{"error": "…"}`. Las validaciones se aplican en este orden: sesión,
tamaño del cuerpo, presencia de la foto, formato, lectura, dimensiones, límite de uso y proveedor.

**Sin cambios:** `POST /api/meals`, `GET /api/catalog/search` y el resto de endpoints de comidas y del catálogo.

**Producción (lo que ve el operador):** el análisis necesita acceso al proveedor de visión desde la instancia del
backend y su configuración; el paso manual se documenta en el runbook o en el `docs-report.md` (Art. P4). Sin esa
configuración el endpoint responde 503 y el resto de la app funciona igual.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Cómo se envía la foto: archivo en un formulario o texto en base64 dentro de un JSON? | `multipart/form-data` con un único archivo en el campo `image`: es lo natural para subir una foto desde el navegador o el móvil y evita inflar el tamaño un 33 % (REQ-002). | Acepto |
| Q2 | ¿Qué formatos, tamaño y dimensiones se admiten? | JPEG, PNG y WebP comprobados por el contenido; hasta 3 MB y 8000 píxeles por lado (por encima, 413 o 400). La 025 redimensionará en el cliente, así que una foto normal quedará muy por debajo. HEIC (iPhone) y GIF no se admiten; en el móvil la 025 convertirá a JPEG al redimensionar (REQ-003). | Acepto |
| Q3 | ¿Cómo se expresa la confianza: un número de 0 a 1 o tres niveles? | Tres niveles, `high`, `medium` y `low`: los modelos no dan probabilidades calibradas y a la 025 le basta con marcar los dudosos (REQ-007). | Acepto |
| Q4 | ¿Qué pasa con lo que el modelo ve y no está en el catálogo (por ejemplo, gallo pinto o una salsa)? | Va en una lista aparte, `unmatched`, con un nombre descriptivo, gramos y confianza, sin macros; la 025 lo marcará para que el usuario lo cree como alimento personalizado o lo quite. Los platos compuestos se piden al modelo desglosados en alimentos del catálogo cuando sus ingredientes se distinguen (arroz con pollo → arroz blanco cocido y pechuga de pollo); si no, van a `unmatched` (REQ-006). | Acepto |
| Q5 | ¿Cuál es el límite de uso? ¿Hace falta un tope de gasto global? | 20 análisis por hora y usuario, como las preguntas del coach; cuentan también los que terminan en 503, porque ya llamaron al proveedor. Sin tope global en esta spec: pasa al backlog, junto con la medición del coste real por imagen (REQ-005). | 10 análisis por hora y usuario |
| Q6 | ¿Se quitan los metadatos de la foto (ubicación GPS, cámara, fecha) antes de enviarla al proveedor? | Sí: la ubicación de casa del usuario no tiene que salir de fitnerd y el modelo no la necesita (REQ-010). Puede requerir una dependencia nueva para tratar imágenes, que decidirá el plan. | Acepto |
| Q7 | ¿La Política de privacidad se actualiza en esta spec para decir que las fotos se envían a Amazon Web Services? | No: esta spec es solo backend y ninguna pantalla envía fotos todavía; la actualización va con la 025 y se anota en su backlog. | Acepto |
| Q8 | ¿Cuánto se espera al proveedor y qué pasa si su respuesta no tiene el formato esperado? | Hasta 30 segundos; un tiempo agotado, un error o una respuesta no interpretable responden 503 con el mismo mensaje y sin reintento automático (REQ-009). | Acepto |
| Q9 | La estimación de gramos desde una foto es el riesgo principal del plan. ¿Cómo se mide antes de darla por buena? | Con una revisión manual en el gate de `review`: el usuario analiza unas 10 fotos reales de sus comidas contra el proveedor real en local y compara alimentos y gramos con lo que pesó; el resultado se anota en la feature, sin guardar las fotos en el repositorio. No es un AC automatizado (los tests usan un proveedor simulado) y no bloquea el cierre salvo que el usuario lo decida. | Acepto |
| Q10 | ¿Quién puede usar el análisis? ¿Hace falta haber completado el onboarding? | Cualquier usuario con sesión, como el resto de `/api/meals`; el análisis no depende del perfil (REQ-004). | Acepto |
| Q11 | ¿Los gramos estimados van con decimales? | Enteros de 1 a 2000: la estimación no tiene más precisión y caben en el rango de gramos del diario, así que la 025 puede guardarlos tal cual (REQ-007). | Acepto |

**Estado:** las 11 preguntas están resueltas y no quedan preguntas abiertas. Q1–Q4 y Q6–Q11 se resolvieron con la
propuesta por defecto, ya incorporada en REQ-002, REQ-003, REQ-004, REQ-006, REQ-007, REQ-009, REQ-010 y en el alcance.
Q5 se resolvió con un límite de **10 análisis por hora y usuario** (no 20), incorporado en el alcance, REQ-005,
AC-005.1, AC-005.3 y la tabla de errores de la sección 6; el resto de la propuesta de Q5 (cuentan los 503, sin tope
global en esta spec) se mantiene.

## 8. Glosario

- **Análisis:** una petición a `POST /api/meals/analyze` que llega a pedirse al proveedor de visión.
- **Proveedor de visión:** el modelo de Amazon Bedrock que reconoce los alimentos de la foto; en los tests, un proveedor
  simulado.
- **Catálogo:** la lista propia de alimentos simples en español de la spec 023; es la lista cerrada de alimentos que
  puede proponer el análisis.
- **Alimento propuesto (`items`):** un alimento del catálogo reconocido en la foto, con gramos estimados, confianza y
  macros del catálogo.
- **Alimento sin coincidencia (`unmatched`):** algo que el modelo reconoce como comida en la foto y que no está en el
  catálogo; se devuelve sin macros.
- **Confianza:** la seguridad del modelo al reconocer un alimento (`high`, `medium` o `low`), no la de sus gramos.
- **Metadatos de la foto:** los datos que la cámara guarda junto a la imagen (EXIF, XMP, bloques de texto), como la
  ubicación GPS, el modelo de cámara o la fecha.
