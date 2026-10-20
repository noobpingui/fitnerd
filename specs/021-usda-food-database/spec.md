# Spec 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Feature:** `021-usda-food-database` · **Tipo:** feature
- **Ámbitos:** `backend`, `frontend`

## 1. Contexto y problema

fitnerd calcula los objetivos de calorías y macros del usuario (pantalla Macros), pero no tiene ninguna fuente de datos
nutricionales de alimentos. El plan de registro de comidas (specs 021–024, `docs/backlog.md`) necesita que los macros de
cada alimento salgan de datos reales de USDA FoodData Central y no de un modelo que los invente. Las specs 022 (diario de
comidas) y 023 (análisis de foto) dependen de poder **buscar un alimento por su nombre** y obtener sus calorías,
proteína, carbohidratos y grasa por 100 g.

Esta spec cubre la primera pieza: cargar en la base de datos de la app los conjuntos de datos públicos de USDA (licencia
CC0) mediante un proceso de importación que se ejecuta fuera de la app, como el pipeline RAG del coach; ofrecer una
búsqueda que combine coincidencia de texto y similitud de significado, y una pantalla mínima de búsqueda que sirva para
validar la calidad de los resultados antes de construir el diario.

Las descripciones de USDA están en inglés y son muy técnicas (por ejemplo, «Chicken, broilers or fryers, breast, meat
only, cooked, roasted»), mientras que los usuarios de fitnerd escriben en español. La búsqueda por similitud de
significado es la que permite encontrar «pechuga de pollo» aunque no comparta palabras con la descripción.

## 2. Historia de usuario

Como **usuario de fitnerd con sesión iniciada**, quiero **buscar un alimento por su nombre y ver sus calorías y macros
por 100 g** para **conocer su valor nutricional con datos fiables y, más adelante, registrarlo en mis comidas**.

Como **operador de fitnerd** (el dueño del proyecto), quiero **importar y actualizar los datos de USDA con un proceso
que se ejecuta a mano** para **tener la base de alimentos en producción sin depender de la API de USDA**.

## 3. Alcance

**Incluye:**
- Un proceso de importación, ejecutado a mano fuera de la app, que carga los conjuntos **Foundation Foods** y **SR
  Legacy** de USDA FoodData Central a partir de los archivos CSV descargados de USDA.
- Por cada alimento: su identificador de USDA (FDC ID), su descripción original, su conjunto de origen y cuatro
  nutrientes por 100 g: energía (kcal), proteína (g), carbohidratos (g) y grasa (g).
- Una representación semántica de cada alimento, calculada con el proveedor de embeddings que ya usa el coach (Voyage),
  para la búsqueda por similitud.
- Confirmación antes de escribir cuando la base de destino no es local, con la opción `--yes` para omitirla.
- Reimportación sin duplicados y reanudación de los alimentos que se quedaron sin representación semántica.
- El endpoint `GET /api/foods/search?q=…` con búsqueda híbrida (texto y similitud), con sesión iniciada, validación de
  la consulta y límite de uso.
- Una pantalla mínima «Alimentos» en el frontend, accesible solo por la URL `/foods`, con una caja de búsqueda, la
  lista de resultados con sus macros por 100 g, los estados de vacío, carga, sin resultados y error, y la atribución a
  USDA.
- Una validación manual de la calidad de la búsqueda durante la verificación, con una lista de unas 20 consultas reales
  en español y en inglés.
- La migración de base de datos que crea las estructuras nuevas, que no se aplica sola (paso manual documentado para
  producción, Art. P4).

**Fuera de alcance:**
- **FNDDS** (se decide en la 023 con el tamaño real medido tras esta importación), **Branded Foods** y la **API de
  USDA**.
- Importar archivos JSON de USDA: solo se admite CSV.
- Una entrada a «Alimentos» en la barra de navegación (la decide la 022).
- La atribución a USDA en la página legal (se añade cuando la funcionalidad sea visible en la navegación, 022).
- Fusionar alimentos casi iguales de Foundation Foods y SR Legacy: se muestran los dos.
- Que la búsqueda siga funcionando solo por texto cuando falla el proveedor de embeddings: responde 503 (REQ-011).
- Un parámetro para cambiar el número de resultados.
- Registrar comidas, alimentos personalizados y totales del día (spec 022).
- Análisis de fotos con IA (specs 023 y 024).
- Micronutrientes y cualquier nutriente distinto de los cuatro indicados.
- Porciones o medidas caseras de USDA (tazas, unidades): todo es por 100 g.
- Traducir las descripciones de USDA al español.
- Paginación de resultados y filtros por conjunto de origen o por nutriente.
- Un endpoint o pantalla de administración para lanzar la importación.
- Borrar alimentos que desaparezcan de una versión nueva de USDA.

## 4. Requisitos funcionales

### REQ-001 — Importación de alimentos de USDA
WHEN el operador ejecuta la importación con los archivos de Foundation Foods y SR Legacy descargados de USDA THE SYSTEM
SHALL guardar cada alimento de esos conjuntos con su FDC ID, su descripción original, su conjunto de origen y sus
valores por 100 g de energía (kcal), proteína (g), carbohidratos (g) y grasa (g). Para la energía SHALL usar, por este
orden de preferencia, el valor de energía en kcal; si no existe, el de Atwater general; si no existe, el de Atwater
específico; y si no existe ninguno, «sin dato». La energía nunca se calcula a partir de los macros.
IF la base de datos de destino no es local y el operador no indicó `--yes` THEN THE SYSTEM SHALL pedir confirmación
`[s/N]` antes de escribir nada, y SHALL cancelar la importación sin escribir y con un código de salida distinto de 0
salvo que la respuesta sea afirmativa. Se considera local solo un host `localhost`, `127.0.0.1`, `::1` o `postgres`
(sin distinguir mayúsculas); una base sin host o con cualquier otro host se considera no local.

- **AC-001.1:** Given unos archivos de Foundation Foods de muestra con 3 alimentos y sus nutrientes, When se ejecuta la
  importación, Then quedan guardados los 3 alimentos con su FDC ID, su descripción, el origen «Foundation» y los cuatro
  valores por 100 g iguales a los de los archivos.
- **AC-001.2:** Given unos archivos de SR Legacy de muestra con 2 alimentos, When se ejecuta la importación, Then quedan
  guardados los 2 alimentos con el origen «SR Legacy» y sus cuatro valores por 100 g.
- **AC-001.3:** Given un alimento de muestra sin energía en kcal y con los valores de Atwater general (120) y
  específico (118), When se ejecuta la importación, Then su energía guardada es 120; y Given otro alimento sin energía en
  kcal ni Atwater general pero con Atwater específico (95), Then su energía guardada es 95.
- **AC-001.4:** Given un alimento de muestra al que le falta alguno de los cuatro nutrientes, When se ejecuta la
  importación, Then el alimento se guarda y ese nutriente queda como «sin dato», no como 0.
- **AC-001.5:** Given archivos que incluyen nutrientes distintos de los cuatro indicados, When se ejecuta la
  importación, Then solo se guardan los cuatro nutrientes indicados.
- **AC-001.6:** Given un alimento de muestra con energía en kcal (165) y con valores de Atwater distintos, When se
  ejecuta la importación, Then su energía guardada es 165.
- **AC-001.7:** Given un alimento de muestra sin ningún valor de energía pero con proteína, carbohidratos y grasa, When
  se ejecuta la importación, Then su energía queda como «sin dato», no calculada a partir de los macros.
- **AC-001.8:** Given una base de destino con un host no local y sin `--yes`, When se ejecuta la importación y el
  operador responde «s», «S», «si» o «sí», Then se pide la confirmación una sola vez, la importación se ejecuta y
  termina con código 0.
- **AC-001.9:** Given una base de destino con un host no local y sin `--yes`, When el operador responde «n», deja la
  respuesta vacía o no hay entrada interactiva (fin de entrada), Then la importación se cancela con un código de salida
  distinto de 0 y no se escribe nada en la base.
- **AC-001.10:** Given una base de destino con un host no local, When se ejecuta la importación con `--yes`, Then no se
  pide confirmación y la importación se ejecuta con código 0.
- **AC-001.11:** Given una base de destino con host `localhost`, `127.0.0.1`, `::1`, `postgres` o `LOCALHOST`, When se
  ejecuta la importación sin `--yes`, Then no se pide confirmación y la importación se ejecuta con código 0.
- **AC-001.12:** Given una base de destino sin host o con un host desconocido (p. ej. `servidor-raro`), When se ejecuta
  la importación sin `--yes` y el operador responde «n», Then se pide confirmación (se trata como no local), la
  importación se cancela con un código distinto de 0 y no se escribe nada.

### REQ-002 — Reimportación sin duplicados
WHEN el operador vuelve a ejecutar la importación sobre una base que ya tiene alimentos THE SYSTEM SHALL actualizar los
alimentos existentes (identificados por su FDC ID), añadir los nuevos y conservar los que ya no aparezcan en los
archivos, sin crear duplicados.

- **AC-002.1:** Given una base con los 3 alimentos de AC-001.1, When se vuelve a importar el mismo archivo, Then sigue
  habiendo exactamente 3 alimentos con los mismos valores.
- **AC-002.2:** Given una base con un alimento importado, When se importa un archivo en el que ese FDC ID trae otra
  descripción u otro valor de proteína, Then el alimento queda con la descripción y la proteína nuevas.
- **AC-002.3:** Given una base con un alimento importado, When se importa un archivo que ya no lo incluye, Then el
  alimento sigue guardado y sigue apareciendo en la búsqueda.

### REQ-003 — Representación semántica de cada alimento
WHEN la importación guarda un alimento nuevo o cambia su descripción THE SYSTEM SHALL calcularle una representación
semántica con el proveedor de embeddings, y SHALL NOT volver a calcularla para los alimentos cuya descripción no cambió.

- **AC-003.1:** Given archivos de muestra con 3 alimentos nuevos y un proveedor de embeddings simulado, When se ejecuta
  la importación, Then los 3 alimentos quedan con representación semántica.
- **AC-003.2:** Given una base con alimentos que ya tienen representación semántica, When se vuelve a importar el mismo
  archivo, Then no se pide ninguna representación al proveedor de embeddings.
- **AC-003.3:** Given un alimento importado cuya descripción cambia en una reimportación, When se ejecuta la importación,
  Then se pide una representación nueva solo para ese alimento.

### REQ-004 — Fallos durante la importación
IF los archivos indicados no existen o no tienen el formato CSV esperado de USDA THEN THE SYSTEM SHALL terminar la
importación con un mensaje que indique qué archivo falla, sin modificar los alimentos guardados.
IF el proveedor de embeddings falla durante la importación THEN THE SYSTEM SHALL conservar los alimentos y sus
nutrientes ya guardados sin representación semántica, y SHALL completar esas representaciones en la siguiente
ejecución.

- **AC-004.1:** Given una base con alimentos y una ruta a un archivo que no existe, When se ejecuta la importación, Then
  termina con un error que nombra ese archivo y los alimentos guardados no cambian.
- **AC-004.2:** Given un archivo al que le falta una columna obligatoria, When se ejecuta la importación, Then termina con
  un error que nombra el archivo y la columna, y los alimentos guardados no cambian.
- **AC-004.3:** Given un proveedor de embeddings simulado que falla, When se ejecuta la importación de 3 alimentos, Then
  los 3 quedan guardados con sus nutrientes y sin representación semántica, y el resumen lo indica.
- **AC-004.4:** Given 3 alimentos guardados sin representación semántica y un proveedor que ya responde, When se vuelve a
  ejecutar la importación, Then los 3 quedan con representación semántica.

### REQ-005 — Resumen de la importación
WHEN la importación termina THE SYSTEM SHALL mostrar al operador, por cada conjunto de origen, cuántos alimentos se
añadieron, cuántos se actualizaron, cuántos quedaron sin cambios y cuántos quedaron sin representación semántica.

- **AC-005.1:** Given una base vacía y archivos de muestra con 3 alimentos de Foundation y 2 de SR Legacy, When termina
  la importación, Then el resumen indica 3 añadidos en Foundation, 2 añadidos en SR Legacy y 0 sin representación
  semántica.
- **AC-005.2:** Given una reimportación en la que cambia 1 de 3 alimentos, When termina la importación, Then el resumen
  indica 0 añadidos, 1 actualizado y 2 sin cambios.

### REQ-006 — Búsqueda híbrida de alimentos
WHEN un usuario con sesión iniciada pide `GET /api/foods/search?q={consulta}` con una consulta válida THE SYSTEM SHALL
responder 200 con hasta 20 alimentos ordenados por relevancia, combinando la coincidencia de texto con la descripción y
la similitud de significado entre la consulta y el alimento. El número máximo de resultados es fijo; el cliente no puede
cambiarlo. Los alimentos de Foundation Foods y SR Legacy se devuelven por separado aunque sean casi iguales, cada uno
con su conjunto de origen. En la coincidencia de texto, ante igual coincidencia con la consulta, una descripción corta y
exacta SHALL puntuar por encima de una larga que solo menciona la palabra.

- **AC-006.1:** Given alimentos «Chicken, broilers or fryers, breast, meat only, raw» y «Rice, white, long-grain,
  regular, raw», When se busca `q=chicken breast`, Then el primer resultado es el pollo.
- **AC-006.2:** Given el alimento del pollo y un proveedor de embeddings simulado que sitúa «pechuga de pollo» junto al
  pollo, When se busca `q=pechuga de pollo` (sin palabras en común con la descripción), Then el pollo aparece en los
  resultados.
- **AC-006.3:** Given un alimento que coincide con la consulta por texto y por similitud y otro que solo coincide por
  similitud con una similitud igual o mayor, When se busca, Then el que coincide por las dos vías aparece antes.
- **AC-006.4:** Given 30 alimentos que coinciden con la consulta, When se busca, Then la respuesta tiene exactamente 20
  resultados.
- **AC-006.5:** Given el alimento del pollo, When se busca `q=CHICKEN` o `q=  chicken  `, Then el pollo aparece en los
  resultados igual que con `q=chicken`.
- **AC-006.6:** Given un alimento importado sin representación semántica, When se busca una palabra de su descripción,
  Then el alimento aparece en los resultados.
- **AC-006.7:** Given un resultado, When se lee la respuesta, Then incluye su FDC ID, su descripción original, su
  conjunto de origen y sus cuatro valores por 100 g, con `null` en los que no tienen dato (formato de la sección 6).
- **AC-006.8:** Given 30 alimentos que coinciden con la consulta, When se busca con un parámetro adicional `limit=50`,
  Then la respuesta tiene exactamente 20 resultados.
- **AC-006.9:** Given «Milk, whole, 3.25% milkfat» guardado una vez como Foundation (FDC ID 1) y otra como SR Legacy
  (FDC ID 2), When se busca `q=whole milk`, Then aparecen los dos resultados, cada uno con su FDC ID y su origen.
- **AC-006.10:** Given «Bananas, raw» y 50 descripciones largas que solo mencionan la palabra (p. ej. «Babyfood, banana
  apple dessert, strained, …») con FDC ID menores, When se obtienen los candidatos por coincidencia de texto para
  `banana`, Then «Bananas, raw» está entre ellos y va por delante de todas las largas; y Given solo «Bananas, raw» y dos
  descripciones largas de «Babyfood, banana…», Then «Bananas, raw» va primero y aparecen las tres. Este criterio ordena
  la coincidencia de texto y no altera AC-006.3: un alimento que coincide por texto y por similitud sigue por delante de
  uno que coincide por una sola vía.

### REQ-007 — Búsqueda sin resultados relevantes
IF ningún alimento coincide con la consulta por texto y ninguno supera la similitud mínima de relevancia THEN THE SYSTEM
SHALL responder 200 con una lista de resultados vacía.

- **AC-007.1:** Given alimentos guardados y un proveedor simulado que da a la consulta una similitud por debajo del mínimo
  con todos ellos, When se busca `q=zzxqv` (sin coincidencia de texto), Then la respuesta es 200 con `results` vacío.
- **AC-007.2:** Given una base sin alimentos, When se busca `q=chicken`, Then la respuesta es 200 con `results` vacío.

### REQ-008 — Validación de la consulta
IF la consulta falta, está vacía o solo tiene espacios, tiene menos de 2 caracteres o más de 100 después de quitar los
espacios de los extremos THEN THE SYSTEM SHALL responder 400 con el mensaje correspondiente de la sección 6, sin
consumir el límite de uso ni llamar al proveedor de embeddings.

- **AC-008.1:** Given un usuario con sesión, When pide la búsqueda sin `q`, con `q=` o con `q=%20%20%20`, Then recibe 400
  con `{"error": "Escribe qué alimento quieres buscar."}`.
- **AC-008.2:** Given un usuario con sesión, When busca `q=a`, Then recibe 400 con
  `{"error": "La búsqueda debe tener al menos 2 caracteres."}`.
- **AC-008.3:** Given un usuario con sesión, When busca una consulta de 101 caracteres, Then recibe 400 con
  `{"error": "La búsqueda no puede superar los 100 caracteres."}`; con 100 caracteres, la búsqueda responde 200.
- **AC-008.4:** Given un proveedor de embeddings simulado, When se hace una búsqueda que recibe 400, Then no se pide
  ninguna representación al proveedor y el contador de uso del usuario no cambia.

### REQ-009 — Solo con sesión iniciada
IF la petición de búsqueda no trae un token de sesión válido THEN THE SYSTEM SHALL responder 401 como el resto de
endpoints protegidos de la app.

- **AC-009.1:** Given una petición sin cabecera de autorización, When pide `GET /api/foods/search?q=chicken`, Then recibe
  401.
- **AC-009.2:** Given una petición con un token caducado o inválido, When pide la búsqueda, Then recibe 401.

### REQ-010 — Límite de uso de la búsqueda
IF un usuario supera 30 búsquedas válidas en una ventana de 1 minuto THEN THE SYSTEM SHALL responder 429 con el mensaje
de la sección 6, sin llamar al proveedor de embeddings. Cuenta como búsqueda válida toda petición que pasa la validación
de REQ-008, también las que terminan en 503 por REQ-011.

- **AC-010.1:** Given un usuario que ya hizo 30 búsquedas válidas en el último minuto, When hace la búsqueda 31, Then
  recibe 429 con `{"error": "Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato."}` y no se
  pide ninguna representación al proveedor.
- **AC-010.2:** Given un usuario A que alcanzó el límite, When un usuario B hace una búsqueda, Then B recibe 200.
- **AC-010.3:** Given un usuario que hizo 29 búsquedas válidas en el último minuto, When hace la búsqueda 30, Then
  recibe 200.

### REQ-011 — Fallo del proveedor de embeddings en la búsqueda
IF el proveedor de embeddings falla al procesar una consulta válida THEN THE SYSTEM SHALL responder 503 con el mensaje
de la sección 6, sin devolver resultados parciales solo de texto y sin un error 500.

- **AC-011.1:** Given el alimento del pollo y un proveedor de embeddings simulado que falla, When se busca
  `q=chicken` (que coincide por texto), Then la respuesta es 503 con
  `{"error": "La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato."}` y sin `results`.
- **AC-011.2:** Given un proveedor de embeddings simulado que falla, When se busca `q=pechuga de pollo`, Then la
  respuesta es 503 con el mismo mensaje.
- **AC-011.3:** Given un proveedor de embeddings simulado que falla en la primera búsqueda y responde en la segunda,
  When se repite la búsqueda `q=chicken`, Then la segunda respuesta es 200 e incluye el pollo.

### REQ-012 — Pantalla «Alimentos»
WHEN un usuario con sesión iniciada y onboarding completado abre la ruta `/foods` THE SYSTEM SHALL mostrar la pantalla
«Alimentos» con una caja de búsqueda y, al enviar la búsqueda (botón «Buscar» o tecla Intro), SHALL mostrar cada
resultado con su descripción, su conjunto de origen y sus calorías, proteína, carbohidratos y grasa por 100 g.

- **AC-012.1:** Given la pantalla recién abierta, When aún no se ha buscado nada, Then se ve la caja con la etiqueta
  «Buscar alimento», el botón «Buscar» y el texto «Busca un alimento para ver sus calorías y macros por 100 g.».
- **AC-012.2:** Given una respuesta simulada con 2 alimentos, When el usuario escribe «chicken» y pulsa «Buscar», Then se
  ven los 2 alimentos con su descripción, su origen («Foundation» o «SR Legacy») y sus valores como «165 kcal», «31,0 g
  proteína», «0,0 g carbohidratos» y «3,6 g grasa».
- **AC-012.3:** Given una respuesta simulada con un alimento sin dato de carbohidratos, When se muestran los resultados,
  Then en su lugar se ve «—».
- **AC-012.4:** Given la caja de búsqueda, When el usuario escribe «chicken» y pulsa Intro, Then se lanza la misma
  búsqueda que con el botón.
- **AC-012.5:** Given una búsqueda en curso, When aún no llega la respuesta, Then se ve «Buscando…» y el botón «Buscar»
  está desactivado.
- **AC-012.6:** Given una respuesta simulada con `results` vacío para «zzxqv», When termina la búsqueda, Then se ve «No
  encontramos alimentos para «zzxqv».».
- **AC-012.7:** Given la pantalla recién abierta, When el usuario escribe «chicken» sin pulsar «Buscar» ni Intro, Then no
  se hace ninguna petición de búsqueda.
- **AC-012.8:** Given un usuario con sesión en cualquier pantalla, When se muestra la barra de navegación, Then no
  contiene ninguna entrada «Alimentos» ni enlace a `/foods`.

### REQ-013 — Validación y errores en la pantalla
IF la consulta escrita no es válida o la búsqueda falla THEN THE SYSTEM SHALL mostrar en la pantalla el aviso
correspondiente, sin perder lo que el usuario escribió.

- **AC-013.1:** Given la caja vacía o con solo espacios, When el usuario pulsa «Buscar», Then se ve «Escribe qué alimento
  quieres buscar.» y no se hace ninguna petición.
- **AC-013.2:** Given la caja con «a», When el usuario pulsa «Buscar», Then se ve «La búsqueda debe tener al menos 2
  caracteres.» y no se hace ninguna petición.
- **AC-013.3:** Given la caja, When el usuario intenta escribir más de 100 caracteres, Then la caja no admite más de 100.
- **AC-013.4:** Given una búsqueda que falla con un error de red o del servidor, When termina, Then se ve «No se pudo
  completar la búsqueda.» con un botón «Reintentar», y la caja conserva el texto.
- **AC-013.5:** Given el aviso de error de AC-013.4, When el usuario pulsa «Reintentar», Then se repite la misma búsqueda.
- **AC-013.6:** Given una búsqueda que recibe 429, When termina, Then se ve el mensaje que devuelve el servidor
  («Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato.») y la caja conserva el texto.
- **AC-013.7:** Given una búsqueda que recibe 503, When termina, Then se ve el mensaje que devuelve el servidor («La
  búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato.») con el botón «Reintentar», y la caja
  conserva el texto.

### REQ-014 — Atribución a USDA
THE SYSTEM SHALL mostrar en la pantalla «Alimentos» la atribución «Datos: U.S. Department of Agriculture, Agricultural
Research Service. FoodData Central.».

- **AC-014.1:** Given la pantalla «Alimentos», When se muestra, con o sin resultados, Then se ve el texto de atribución.

## 5. Requisitos no funcionales

### NFR-001 — Carga bajo demanda de la pantalla
THE SYSTEM SHALL cargar la pantalla «Alimentos» bajo demanda, como el resto de pantallas (ADR-0026), sin aumentar el
chunk de entrada por encima de 500 kB.

- **AC-N001.1:** Given la aplicación, When se carga una ruta distinta de `/foods`, Then el código de la pantalla
  «Alimentos» no se ha descargado; al visitar `/foods`, se muestra «Cargando…» hasta que llega.

### NFR-002 — Accesibilidad de la búsqueda
THE SYSTEM SHALL dar a la caja de búsqueda una etiqueta accesible y anunciar a los lectores de pantalla los cambios de
estado de la búsqueda (buscando, sin resultados, error).

- **AC-N002.1:** Given la pantalla «Alimentos», When se consulta por su rol y nombre accesible, Then existe un campo de
  búsqueda con nombre «Buscar alimento».
- **AC-N002.2:** Given los estados «Buscando…», sin resultados y error, When aparecen, Then están dentro de una región
  que se anuncia a los lectores de pantalla.

## 6. Datos y contratos visibles

**Alimento (lo que ve el usuario y el consumidor del endpoint):**

| Campo | Tipo | Descripción |
|---|---|---|
| `fdc_id` | entero | Identificador de USDA FoodData Central. Estable entre reimportaciones; es el que usará la spec 022 para referirse al alimento. |
| `description` | texto | Descripción original de USDA, en inglés, sin modificar. |
| `data_type` | texto | `"foundation"` o `"sr_legacy"`. En pantalla: «Foundation» y «SR Legacy». |
| `per_100g.calories_kcal` | número o `null` | Energía en kcal por 100 g. |
| `per_100g.protein_g` | número o `null` | Proteína en g por 100 g. |
| `per_100g.carbs_g` | número o `null` | Carbohidratos totales (por diferencia) en g por 100 g. |
| `per_100g.fat_g` | número o `null` | Grasa total en g por 100 g. |

`null` significa «sin dato en USDA»; nunca se sustituye por 0.

**`GET /api/foods/search?q={consulta}`** (requiere `Authorization: Bearer {token}`):

- `q`: texto de 2 a 100 caracteres después de quitar los espacios de los extremos. No distingue mayúsculas.
- 200:
  ```json
  {
    "results": [
      {
        "fdc_id": 171477,
        "description": "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
        "data_type": "sr_legacy",
        "per_100g": { "calories_kcal": 165.0, "protein_g": 31.0, "carbs_g": 0.0, "fat_g": 3.57 }
      }
    ]
  }
  ```
  Hasta 20 resultados, del más al menos relevante. Lista vacía si no hay resultados relevantes.
- 400 `{"error": "Escribe qué alimento quieres buscar."}`: `q` falta, está vacía o solo tiene espacios.
- 400 `{"error": "La búsqueda debe tener al menos 2 caracteres."}`
- 400 `{"error": "La búsqueda no puede superar los 100 caracteres."}`
- 401: el error de sesión de los demás endpoints protegidos.
- 429 `{"error": "Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato."}`: más de 30
  búsquedas válidas en 1 minuto por usuario.
- 503 `{"error": "La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato."}`: el proveedor de
  embeddings falló al procesar la consulta.
- Cualquier otro parámetro distinto de `q` (por ejemplo, `limit`) se ignora.

**Pantalla «Alimentos» (`/foods`):**

| Elemento | Texto |
|---|---|
| Título | «Alimentos» |
| Etiqueta de la caja | «Buscar alimento» |
| Ejemplo en la caja | «Ej.: chicken breast, arroz blanco» |
| Botón | «Buscar» |
| Estado inicial | «Busca un alimento para ver sus calorías y macros por 100 g.» |
| Cargando | «Buscando…» |
| Sin resultados | «No encontramos alimentos para «{consulta}».», donde `{consulta}` es el texto buscado sin los espacios de los extremos |
| Error de red o del servidor | «No se pudo completar la búsqueda.» y botón «Reintentar» |
| Límite de uso (429) | El mensaje del servidor: «Alcanzaste el límite de 30 búsquedas por minuto. Vuelve a intentarlo en un rato.» |
| Búsqueda no disponible (503) | El mensaje del servidor: «La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato.» y botón «Reintentar» |
| Valores | kcal sin decimales (`165 kcal`); gramos con un decimal y coma decimal (`31,0 g proteína`, `0,0 g carbohidratos`, `3,6 g grasa`); `—` si no hay dato |
| Atribución | «Datos: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.» |

**Importación (lo que ve el operador):**
- Entrada: las rutas de los archivos CSV de Foundation Foods y SR Legacy descargados de USDA FoodData Central.
- Salida: el resumen de REQ-005 por conjunto (añadidos, actualizados, sin cambios, sin representación semántica) o un
  error que nombra el archivo y, si aplica, la columna que falla.
- Se ejecuta a mano contra la base que indique la configuración del entorno; en producción, después de aplicar la
  migración (paso manual documentado en el runbook).
- Antes de escribir, muestra el entorno y la base de destino (sin contraseña). Si la base no es local y no se indicó
  `--yes`, pregunta «La base de datos NO es local. ¿Escribir en ella? [s/N]: »; son afirmativas «s», «si», «sí», «y» y
  «yes» (sin distinguir mayúsculas). Cualquier otra respuesta, la respuesta vacía o el fin de entrada muestran
  «Importación cancelada: no se ha escrito nada.» y terminan con código 1 (REQ-001, AC-001.8 a AC-001.12).

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Entra FNDDS en esta spec? La idea dice «si cabe», que no es comprobable. FNDDS aporta platos compuestos (útiles para la foto de la 023) pero ocupa más espacio en el plan gratuito de Supabase (500 MB). | No entra en la 021: solo Foundation Foods y SR Legacy. FNDDS pasa al backlog y se decide en la 023 con el tamaño real medido tras esta importación. | sí a todas las propuestas |
| Q2 | ¿Qué formato de archivo de USDA usa la importación: CSV o JSON? | CSV, el formato del plan global (unos 86 MB sin comprimir para los dos conjuntos). | sí a todas las propuestas |
| Q3 | Muchos alimentos de Foundation Foods no traen la energía en kcal «clásica», sino los valores calculados por Atwater (general y específico). ¿Qué valor se guarda como calorías? | Orden de preferencia: energía en kcal; si no hay, Atwater general; si no hay, Atwater específico; si no hay ninguno, «sin dato». Nunca se calcula a partir de los macros. | sí a todas las propuestas |
| Q4 | ¿Cuántos resultados devuelve la búsqueda y puede el cliente pedir otro número? | Siempre hasta 20, sin parámetro para cambiarlo. La 022 puede añadirlo si lo necesita. | sí a todas las propuestas |
| Q5 | ¿Cuál es el límite de uso de la búsqueda? Cada búsqueda cuesta una llamada a Voyage. | 60 búsquedas por minuto y usuario; la pantalla solo busca al pulsar «Buscar» o Intro, nunca mientras se escribe. | 30 Busquedas por minuto y usuario |
| Q6 | Si Voyage falla al procesar la consulta, ¿la búsqueda responde solo con resultados de texto (200) o responde 503? El Art. P3.3 pide traducir los fallos del proveedor a 503; la propuesta lo interpreta como «nunca un 500 sin control», ya que aquí el resultado degradado sigue siendo útil. | Responder 200 con resultados solo de texto (REQ-011). Si prefieres 503, el mensaje sería «La búsqueda no está disponible en este momento. Vuelve a intentarlo en un rato.». | 503 |
| Q7 | ¿Cómo llega el usuario a la pantalla «Alimentos»? Es una pantalla de validación que la 022 convertirá en parte del diario. | Solo por la URL `/foods`, sin entrada en la barra de navegación; la 022 decide dónde enlazarla. | sí a todas las propuestas |
| Q8 | Las descripciones son en inglés y los usuarios escriben en español. ¿Se acepta que en la 021 las consultas en español dependan solo de la similitud de significado, sin traducción? | Sí: sin traducción en la 021. La calidad se valida a mano con una lista de unas 20 consultas reales (en español e inglés) durante la verificación; si no es buena, se anota en el backlog para la 022. | sí a todas las propuestas |
| Q9 | Foundation Foods y SR Legacy tienen alimentos casi iguales (por ejemplo, la leche entera). ¿Se muestran los dos? | Sí, los dos, cada uno con su origen visible; no se fusionan. | sí a todas las propuestas |
| Q10 | ¿La atribución a USDA va solo en la pantalla «Alimentos» o también en la página legal? | Solo en la pantalla «Alimentos» en la 021; la página legal se actualiza cuando la funcionalidad sea visible en la navegación (022). | sí a todas las propuestas |

**Estado:** todas las preguntas están resueltas e incorporadas a la spec:
- Q1: FNDDS fuera de alcance (sección 3).
- Q2: solo CSV (sección 3, REQ-004 y sección 6).
- Q3: orden de preferencia de la energía (REQ-001, AC-001.3, AC-001.6 y AC-001.7).
- Q4: siempre hasta 20 resultados, sin parámetro (REQ-006, AC-006.4 y AC-006.8).
- Q5: 30 búsquedas por minuto y usuario; solo se busca al enviar (REQ-010, AC-012.7, AC-013.6 y sección 6).
- Q6: 503 con el mensaje propuesto, sin degradar a solo texto (REQ-011, AC-013.7 y sección 6).
- Q7: solo por la URL `/foods` (sección 3 y AC-012.8).
- Q8: sin traducción; validación manual con unas 20 consultas en la verificación (sección 3).
- Q9: se muestran los dos alimentos, cada uno con su origen (REQ-006 y AC-006.9).
- Q10: atribución solo en la pantalla «Alimentos» (sección 3 y REQ-014).

## 8. Glosario

- **USDA FoodData Central:** base de datos pública de composición de alimentos del Departamento de Agricultura de
  Estados Unidos, con licencia CC0.
- **Foundation Foods / SR Legacy / FNDDS / Branded Foods:** conjuntos de datos de FoodData Central. Foundation Foods y SR
  Legacy son alimentos básicos con análisis de laboratorio; FNDDS son alimentos y platos tal como se consumen; Branded
  Foods son productos de marca.
- **FDC ID:** identificador numérico de un alimento en FoodData Central.
- **Atwater:** método para calcular la energía de un alimento a partir de sus macronutrientes con factores por gramo;
  USDA publica el valor general y el específico.
- **Representación semántica (embedding):** vector numérico que resume el significado de un texto y permite comparar
  textos por similitud aunque no compartan palabras.
- **Búsqueda híbrida:** búsqueda que combina la coincidencia de palabras con la similitud de significado.
- **Operador:** la persona que ejecuta la importación a mano (el dueño del proyecto).
