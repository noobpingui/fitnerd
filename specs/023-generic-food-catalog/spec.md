# Spec 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Feature:** `023-generic-food-catalog` · **Tipo:** feature
- **Ámbitos:** `backend`, `frontend`

## 1. Contexto y problema

Desde la spec 022, el diario de comidas busca los alimentos en la base de USDA de la spec 021 (unos 8.262 alimentos de
Foundation y SR Legacy). Esa base es fiable, pero para registrar una comida resulta difícil de usar:

- las descripciones están en inglés y son muy técnicas («Chicken, broilers or fryers, breast, meat only, cooked,
  roasted»);
- un mismo alimento aparece en decenas de variantes (crudo, cocido, con piel, sin piel, de cada marca de corte…), y el
  usuario no sabe cuál elegir;
- las consultas en español de varias palabras dan resultados débiles (backlog de la 021: «avena cocida»).

Esta spec añade un **catálogo propio de unos 300 alimentos simples**, con nombres en español neutro, sinónimos
regionales y una sola versión por alimento (cocida salvo lo que se come crudo), con sus calorías, proteína,
carbohidratos y grasa por 100 g tomados de USDA sin modificar. El diario pasa a buscar **solo** en este catálogo; los
alimentos personalizados se mantienen para lo que el catálogo no tenga.

El catálogo será también la **lista cerrada** de alimentos que usará el análisis de imagen de la spec 024.

## 2. Historia de usuario

Como **usuario de fitnerd con sesión iniciada y onboarding completado**, quiero **encontrar en el diario un alimento
por su nombre en español y ver sus macros por 100 g sin tener que elegir entre decenas de variantes en inglés** para
**registrar mis comidas de forma rápida y sencilla**.

Como **operador de fitnerd** (el dueño del proyecto), quiero **revisar el catálogo en un archivo CSV y cargarlo en la
base con un proceso que se ejecuta a mano** para **controlar qué alimentos ve el usuario y con qué datos**.

Como **desarrollador de la spec 024**, quiero **un identificador estable para cada alimento del catálogo** para
**usarlo como lista cerrada al reconocer los alimentos de una foto**.

## 3. Alcance

**Incluye:**
- Backend:
  - Un catálogo de alimentos genéricos, cada uno con un identificador estable, su nombre en español, sus sinónimos y
    sus cuatro valores por 100 g (calorías, proteína, carbohidratos y grasa), con referencia al alimento de USDA del que
    salen sus valores o, si no viene de USDA, marcado como añadido a mano.
  - Un archivo CSV del catálogo, incluido en el repositorio, con unos 300 alimentos que cumplen las reglas de la
    sección 6, preparado durante la feature y revisado por el usuario antes de cargarse en producción.
  - Un proceso de carga, ejecutado a mano fuera de la app (como la importación de USDA de la 021), que valida el CSV
    completo y deja el catálogo de la base igual al del archivo, con confirmación antes de escribir en una base no
    local.
  - El endpoint `GET /api/catalog/search?q=…` con sesión: búsqueda por texto en el nombre y los sinónimos, sin
    distinguir mayúsculas ni tildes, sin llamar a ningún proveedor externo.
  - Una tercera clase de alimento en las comidas, el **alimento del catálogo** (`source: "catalog"`), que se añade con
    su identificador y sus gramos y guarda copia de su nombre y sus valores por 100 g, como los de USDA en la 022.
  - La migración de base de datos de las estructuras nuevas; es aditiva y no se aplica sola (paso manual documentado
    para producción, Art. P4), seguida de la carga del catálogo en producción.
- Frontend:
  - El diálogo «Añadir a {sección}» del diario busca en el catálogo en lugar de USDA, y muestra cada resultado con su
    nombre en español y sus macros por 100 g, sin etiqueta de origen.
  - En el diario, los alimentos del catálogo se muestran con su nombre y sin etiqueta de origen; los de USDA ya
    registrados siguen mostrando «Foundation» o «SR Legacy» y los personalizados, «Personalizado».
  - La ruta `/foods` deja de mostrar la pantalla «Alimentos» de la 021 y redirige a `/diary`.
  - Actualización de las páginas legales: «Datos nutricionales» conserva la atribución a USDA sin frases nuevas y la
    Política de privacidad deja de decir que Voyage AI recibe las búsquedas de alimentos.

**Fuera de alcance:**
- Platos compuestos y combinaciones de alimentos, marcas, Branded Foods, FNDDS y la API de USDA.
- Medidas caseras (tazas, unidades, onzas): todo sigue en gramos.
- Fotos y análisis de imagen (specs 024 y 025).
- Borrar la base de USDA (`public.foods`), cambiar su importación o retirar el endpoint `GET /api/foods/search`, que se
  conserva sin cambios aunque ninguna pantalla lo use.
- Cambiar los alimentos de USDA ya registrados en comidas existentes: se conservan tal cual.
- Una pantalla o endpoint de administración para editar el catálogo: solo se edita en el CSV y se carga a mano.
- Categorías del catálogo (frutas, carnes…), navegar el catálogo sin escribir y búsqueda mientras se escribe.
- Búsqueda por similitud de significado y tolerancia a erratas. La equivalencia entre singular y plural se limita a la
  regla de REQ-004 (quitar una «s» o «es» final de cada palabra de la consulta).
- Micronutrientes y cualquier nutriente distinto de los cuatro indicados.
- Biblioteca «mis alimentos», favoritos y recientes (backlog de la 022).

## 4. Requisitos funcionales

### Catálogo y carga

### REQ-001 — Reglas del catálogo en el CSV
THE SYSTEM SHALL incluir en el repositorio un CSV del catálogo con entre 250 y 350 alimentos, en el que cada fila cumple
las reglas de la sección 6: identificador único y con el formato indicado, nombre en español único, sinónimos que no
coinciden con el nombre ni con los sinónimos de otro alimento, los cuatro valores por 100 g presentes y dentro de sus
límites, y origen `usda` con su FDC ID o `manual` con su fuente. Ningún nombre contiene las palabras «con», «frito»,
«frita», «fritos» ni «fritas».

- **AC-001.1:** Given el CSV del catálogo del repositorio, When se valida con las reglas de la sección 6, Then no hay
  ningún error y tiene entre 250 y 350 alimentos.
- **AC-001.2:** Given el CSV del catálogo del repositorio, When se comparan los nombres y sinónimos de todos sus
  alimentos sin distinguir mayúsculas ni tildes, Then no hay dos iguales.
- **AC-001.3:** Given el CSV del catálogo del repositorio, When se revisan sus nombres, Then ninguno contiene como
  palabra «con», «frito», «frita», «fritos» ni «fritas».
- **AC-001.4:** Given el CSV del catálogo del repositorio, When se revisan sus filas, Then incluye, por su nombre o por un
  sinónimo, cada uno de los 39 alimentos de la lista mínima de la sección 6.

### REQ-002 — Carga del catálogo
WHEN el operador ejecuta la carga con un CSV válido THE SYSTEM SHALL dejar el catálogo de la base igual al del archivo:
añadir los alimentos nuevos, actualizar los existentes (identificados por su identificador) y quitar del catálogo los
que ya no estén en el archivo, y SHALL mostrar un resumen con cuántos se añadieron, actualizaron, quedaron sin cambios
y se quitaron. Quitar un alimento del catálogo no cambia los alimentos ya registrados en comidas.
IF la base de destino no es local y el operador no indicó `--yes` THEN THE SYSTEM SHALL pedir confirmación `[s/N]`
con las mismas reglas que la importación de la 021 (respuestas afirmativas, base local y código de salida).

- **AC-002.1:** Given una base sin catálogo y un CSV de muestra válido con 3 alimentos, When se ejecuta la carga, Then el
  catálogo tiene esos 3 alimentos con su identificador, nombre, sinónimos y valores por 100 g, y el resumen indica 3
  añadidos.
- **AC-002.2:** Given el catálogo de AC-002.1, When se vuelve a cargar el mismo CSV, Then sigue habiendo 3 alimentos
  con los mismos datos y el resumen indica 0 añadidos, 0 actualizados, 3 sin cambios y 0 quitados.
- **AC-002.3:** Given el catálogo de AC-002.1, When se carga un CSV en el que un alimento cambia de nombre y de
  sinónimos y otro desaparece, Then el primero queda con el nombre y los sinónimos nuevos, el segundo ya no aparece en
  la búsqueda y el resumen indica 1 actualizado, 1 sin cambios y 1 quitado.
- **AC-002.4:** Given un alimento del catálogo registrado en una comida, When se carga un CSV que lo quita, Then el
  diario de ese día sigue devolviendo el alimento registrado con su nombre, sus valores por 100 g y sus nutrientes.
- **AC-002.5:** Given una base de destino con un host no local y sin `--yes`, When el operador responde «n», deja la
  respuesta vacía o no hay entrada interactiva, Then la carga se cancela con un código de salida distinto de 0 y el
  catálogo no cambia; y When responde «s», Then la carga se ejecuta con código 0.
- **AC-002.6:** Given una base de destino con host `localhost` o con `--yes`, When se ejecuta la carga, Then no se pide
  confirmación.

### REQ-003 — Validación del CSV y de los valores de USDA al cargar
IF el archivo no existe, le falta una columna obligatoria o alguna fila no cumple las reglas de la sección 6 THEN THE
SYSTEM SHALL terminar la carga con un error que nombra el archivo y, si aplica, el número de fila, el identificador y la
regla que falla, y SHALL NOT modificar el catálogo.
IF una fila de origen `usda` indica un FDC ID que no existe en la base de alimentos de USDA o unos valores por 100 g
distintos de los de ese alimento en USDA THEN THE SYSTEM SHALL tratarla como fila no válida.

- **AC-003.1:** Given un catálogo cargado y una ruta a un archivo que no existe, When se ejecuta la carga, Then termina
  con un error que nombra el archivo y el catálogo no cambia.
- **AC-003.2:** Given un CSV al que le falta la columna de sinónimos, When se ejecuta la carga, Then termina con un error
  que nombra el archivo y la columna, y el catálogo no cambia.
- **AC-003.3:** Given un CSV con dos filas válidas y una tercera con la proteína por 100 g en 120, When se ejecuta la
  carga, Then termina con un error que nombra la fila 3, su identificador y la regla, y no se carga ninguna de las tres.
- **AC-003.4:** Given un CSV con dos filas con el mismo identificador, o con el mismo nombre, o con un sinónimo igual al
  nombre de otro alimento, When se ejecuta la carga, Then termina con un error que nombra las filas en conflicto y el
  catálogo no cambia.
- **AC-003.5:** Given el alimento de USDA con FDC ID 171477 y 165 kcal, 31,0 g, 0,0 g y 3,57 g por 100 g, When se carga
  una fila `usda` con ese FDC ID y esos mismos valores, Then la fila se carga; y When los valores son 165, 31,0, 0,0 y
  3,6, Then termina con un error que nombra la fila y el nutriente distinto, y el catálogo no cambia.
- **AC-003.6:** Given una fila `usda` con un FDC ID que no existe en la base de USDA, When se ejecuta la carga, Then
  termina con un error que nombra la fila y el FDC ID.
- **AC-003.7:** Given una fila `manual` sin fuente, o una fila `usda` sin FDC ID, When se ejecuta la carga, Then termina
  con un error que nombra la fila.
- **AC-003.8:** Given una fila con algún valor por 100 g vacío, When se ejecuta la carga, Then termina con un error que
  nombra la fila: todos los alimentos del catálogo tienen los cuatro valores.

### Búsqueda

### REQ-004 — Búsqueda en el catálogo
WHEN un usuario con sesión pide `GET /api/catalog/search?q={consulta}` con una consulta válida THE SYSTEM SHALL
responder 200 con hasta 20 alimentos del catálogo en los que **cada palabra** de la consulta coincide con el inicio de
alguna palabra del nombre o de un mismo sinónimo, sin distinguir mayúsculas, tildes ni diéresis (y con «ñ» igual a
«n»), ordenados así: primero los que tienen el nombre o un sinónimo igual a la consulta, después aquellos cuyo nombre
empieza por la consulta, y después el resto; dentro de cada grupo, por nombre en orden alfabético.
Para tolerar el plural, cada palabra de la consulta tiene, además de su **forma escrita**, hasta dos **formas
reducidas**: la que resulta de quitarle una «s» final y la que resulta de quitarle «es» final, cada una solo si queda
con al menos 3 caracteres. Una palabra de la consulta coincide si cualquiera de sus formas es el inicio de una palabra
del nombre o del sinónimo, y las comparaciones del orden («igual a la consulta», «empieza por la consulta») también
aceptan cualquier forma de cada palabra. No hay otra tolerancia: las erratas no coinciden.

- **AC-004.1:** Given un catálogo con «Arroz blanco cocido», «Arroz integral cocido» y «Frijoles negros cocidos», When
  se busca `q=arroz`, Then la respuesta es 200 con los dos arroces, primero «Arroz blanco cocido», y sin los frijoles.
- **AC-004.2:** Given el catálogo de AC-004.1, When se busca `q=cocido arroz`, Then aparecen los dos arroces (el orden
  de las palabras no importa).
- **AC-004.3:** Given «Plátano maduro cocido» en el catálogo, When se busca `q=PLATANO`, `q=plátano` o `q=  platano  `,
  Then aparece en los tres casos.
- **AC-004.4:** Given «Banano» con el sinónimo «guineo», When se busca `q=guineo`, Then aparece «Banano» en primer
  lugar.
- **AC-004.5:** Given «Frijoles negros cocidos», When se busca `q=frijol`, Then aparece (coincidencia por inicio de
  palabra); y When se busca `q=ijol`, Then no aparece.
- **AC-004.6:** Given «Piña» en el catálogo, When se busca `q=pina`, Then aparece.
- **AC-004.7:** Given «Pechuga de pollo a la plancha» y «Muslo de pollo al horno», sin sinónimos,
  When se busca `q=pollo`, Then aparecen los dos ordenados por nombre; y Given además un alimento llamado «Pollo
  desmenuzado cocido», Then ese va primero porque su nombre empieza por la consulta.
- **AC-004.8:** Given 30 alimentos que coinciden con la consulta, When se busca, Then la respuesta tiene exactamente 20
  resultados; con un parámetro adicional `limit=50`, también 20.
- **AC-004.9:** Given un catálogo sin coincidencias para `q=zzxqv`, When se busca, Then la respuesta es 200 con `results`
  vacío.
- **AC-004.10:** Given un resultado, When se lee la respuesta, Then incluye su identificador, su nombre y sus cuatro
  valores por 100 g con el formato de la sección 6, y no incluye sinónimos, FDC ID ni fuente.
- **AC-004.11:** Given un catálogo vacío (sin cargar), When se busca `q=arroz`, Then la respuesta es 200 con `results`
  vacío.
- **AC-004.12:** Given «Huevo cocido» en el catálogo, When se busca `q=huevos` o `q=huevos cocidos`, Then aparece en los
  dos casos (quitando la «s» final).
- **AC-004.13:** Given «Limón» en el catálogo, When se busca `q=limones`, Then aparece (quitando «es» final).
- **AC-004.14:** Given «Banano» y «Batido de banano» (este solo para la prueba), When se busca `q=bananos`, Then aparecen
  los dos y «Banano» va primero, porque su nombre es igual a la consulta con la forma reducida.
- **AC-004.15:** Given «Espinaca cocida» y «Elote cocido», When se busca `q=es`, Then aparece «Espinaca cocida» y no
  aparece «Elote cocido» (la forma reducida «e» tiene menos de 3 caracteres y no se usa).
- **AC-004.16:** Given «Huevo cocido», When se busca `q=guevos` o `q=huevoz`, Then no aparece (las erratas no
  coinciden).

### REQ-005 — Validación de la consulta y sesión
IF la consulta falta, está vacía o solo tiene espacios, tiene menos de 2 caracteres o más de 100 después de quitar los
espacios de los extremos THEN THE SYSTEM SHALL responder 400 con los mismos mensajes que la búsqueda de la 021
(sección 6). IF la petición no trae un token de sesión válido THEN THE SYSTEM SHALL responder 401 como el resto de
endpoints protegidos.

- **AC-005.1:** Given un usuario con sesión, When pide la búsqueda sin `q`, con `q=` o con `q=%20%20`, Then recibe 400
  con `{"error": "Escribe qué alimento quieres buscar."}`.
- **AC-005.2:** Given un usuario con sesión, When busca `q=a`, Then recibe 400 con
  `{"error": "La búsqueda debe tener al menos 2 caracteres."}`.
- **AC-005.3:** Given un usuario con sesión, When busca una consulta de 101 caracteres, Then recibe 400 con
  `{"error": "La búsqueda no puede superar los 100 caracteres."}`; con 100 caracteres, responde 200.
- **AC-005.4:** Given una petición sin cabecera de autorización o con un token caducado o inválido, When pide la
  búsqueda del catálogo, Then recibe 401.

### Diario

### REQ-006 — Añadir alimentos del catálogo a una comida
WHEN un usuario con sesión pide `POST /api/meals` con uno o más alimentos del catálogo (`catalog_id` y gramos) THE
SYSTEM SHALL añadirlos a la comida igual que los de USDA en la 022 (REQ-001 de la 022: misma comida por fecha y tipo,
mismos códigos 201 y 200, mismo cálculo y redondeo), con `source: "catalog"`, su identificador del catálogo, el nombre
del catálogo en el momento de añadirlo y sus valores por 100 g copiados. Una misma petición puede mezclar alimentos del
catálogo, de USDA y personalizados; los alimentos de USDA por FDC ID se siguen aceptando.

- **AC-006.1:** Given el alimento del catálogo `pechuga-de-pollo-a-la-plancha` con 165 kcal, 31,0 g de proteína, 0,0 g
  de carbohidratos y 3,57 g de grasa por 100 g, y un usuario sin comidas, When pide `POST /api/meals` con `date` de hoy,
  `meal_type: "lunch"` e `items: [{"catalog_id": "pechuga-de-pollo-a-la-plancha", "grams": 150}]`, Then recibe 201 con
  un alimento con `source: "catalog"`, `catalog_id: "pechuga-de-pollo-a-la-plancha"`, `fdc_id: null`,
  `data_type: null`, `name: "Pechuga de pollo a la plancha"`, `grams: 150` y `nutrients` igual a
  `{"calories_kcal": 247.5, "protein_g": 46.5, "carbs_g": 0.0, "fat_g": 5.36}`.
- **AC-006.2:** Given una petición con un alimento del catálogo, uno de USDA y uno personalizado, When se añade, Then la
  comida tiene los tres, en ese orden, cada uno con su `source`.
- **AC-006.3:** Given un `catalog_id` que no existe en el catálogo, When se añade, Then recibe 400 con
  `{"error": "No encontramos ese alimento."}` y no se guarda nada.
- **AC-006.4:** Given un alimento que trae más de uno de `catalog_id`, `fdc_id` y `name`, o ninguno, When se añade, Then
  recibe 400 con `{"error": "Cada alimento debe ser del catálogo, de USDA o personalizado."}`. Este mensaje sustituye al
  de AC-003.7 de la 022.
- **AC-006.5:** Given un alimento del catálogo con gramos no válidos, When se añade, Then recibe el mismo 400 que en
  AC-003.4 y AC-003.5 de la 022.
- **AC-006.6:** Given un alimento del catálogo registrado con 150 g, When se cambian sus gramos a 200 con
  `PATCH /api/meals/{meal_id}/items/{item_id}`, Then sus nutrientes se recalculan con los valores por 100 g guardados en
  el alimento (`calories_kcal: 330.0`, `protein_g: 62.0`, `carbs_g: 0.0`, `fat_g: 7.14`).

### REQ-007 — Historial estable ante cambios en el catálogo
WHILE un alimento del catálogo esté registrado en una comida THE SYSTEM SHALL conservar su nombre, sus valores por
100 g y sus nutrientes tal como se guardaron, aunque el alimento cambie o desaparezca del catálogo en una carga
posterior.

- **AC-007.1:** Given un alimento del catálogo registrado en una comida, When una carga cambia su nombre y su proteína
  por 100 g, Then el diario devuelve el nombre, la proteína por 100 g y los nutrientes que se guardaron.
- **AC-007.2:** Given el caso de AC-007.1, When se cambian los gramos del alimento registrado, Then los nutrientes se
  recalculan con los valores por 100 g guardados, no con los nuevos.

### REQ-008 — Comidas existentes
THE SYSTEM SHALL seguir devolviendo, editando y quitando los alimentos de USDA y personalizados ya registrados igual que
en la 022, sin cambiar sus datos.

- **AC-008.1:** Given una comida con un alimento de USDA y uno personalizado registrados antes de esta spec, When se pide
  el diario de ese día, Then los dos se devuelven con sus campos de la 022 sin cambios y con `catalog_id: null`.
- **AC-008.2:** Given ese alimento de USDA, When se cambian sus gramos o se quita, Then responde como en REQ-006 y REQ-007
  de la 022.

### Frontend

### REQ-009 — Buscar en el catálogo desde el diálogo de añadir
WHEN el usuario pulsa «Añadir alimento» en una sección del diario THE SYSTEM SHALL abrir el diálogo «Añadir a
{sección}» con la caja «Buscar alimento» y, al enviar la búsqueda (botón «Buscar» o Intro), SHALL buscar en el
catálogo y mostrar cada resultado con su nombre en español y sus calorías, proteína, carbohidratos y grasa por 100 g,
sin etiqueta de origen, con un botón «Elegir»; el resto del diálogo (gramos, vista previa, guardar, volver a la
búsqueda, cancelar, estados y errores) se comporta como en la 022.

- **AC-009.1:** Given el diálogo abierto, When se muestra, Then se ven la descripción «Busca un alimento o crea uno
  propio.», la caja «Buscar alimento» con el ejemplo «Ej.: arroz blanco cocido, banano» y el botón «Buscar».
- **AC-009.2:** Given una búsqueda simulada del catálogo para «pollo» con «Pechuga de pollo a la plancha» (165 kcal,
  31,0 g, 0,0 g y 3,57 g por 100 g), When el usuario busca, Then la petición va a la búsqueda del catálogo (no a la de
  USDA) y se ve el resultado con «Pechuga de pollo a la plancha», «165 kcal», «31,0 g proteína», «0,0 g carbohidratos»
  y «3,6 g grasa», sin «Foundation» ni «SR Legacy».
- **AC-009.3:** Given ese resultado, When el usuario pulsa «Elegir Pechuga de pollo a la plancha», Then se ve el campo
  «Gramos» con 100 y la vista previa «165 kcal · 31,0 g proteína · 0,0 g carbohidratos · 3,6 g grasa».
- **AC-009.4:** Given el alimento elegido con 150 g en la sección Desayuno, When el usuario pulsa «Añadir», Then se
  envía `{"catalog_id": "pechuga-de-pollo-a-la-plancha", "grams": 150}` a `breakfast` con la fecha de hoy, el diálogo
  se cierra y el diario se vuelve a leer.
- **AC-009.5:** Given una búsqueda del catálogo sin resultados para «gallo pinto», When termina, Then se ve «No
  encontramos alimentos para «gallo pinto».» con el botón «Crear alimento personalizado», que abre el formulario con el
  nombre relleno.
- **AC-009.6:** Given una búsqueda que falla con un error de red o del servidor, When termina, Then se ve «No se pudo
  completar la búsqueda.» con «Reintentar», y la caja conserva el texto.
- **AC-009.7:** Given la caja vacía o con «a», When el usuario pulsa «Buscar», Then se ve el aviso de la 021
  correspondiente y no se hace ninguna petición.

### REQ-010 — Alimentos del catálogo en el diario
THE SYSTEM SHALL mostrar los alimentos del catálogo en el diario con su nombre, sus gramos y sus calorías, sin etiqueta
de origen, y SHALL seguir mostrando «Foundation», «SR Legacy» o «Personalizado» en los demás.

- **AC-010.1:** Given un diario simulado con un alimento `source: "catalog"` llamado «Arroz blanco cocido» de 150 g y
  195 kcal, When se muestra, Then se ven «Arroz blanco cocido», «150 g» y «195 kcal», y en su fila no aparece ninguna
  etiqueta de origen.
- **AC-010.2:** Given un diario simulado con un alimento de USDA de SR Legacy y uno personalizado, When se muestra, Then
  se ven «SR Legacy» y «Personalizado» en sus filas.
- **AC-010.3:** Given un alimento del catálogo en el diario, When el usuario pulsa «Editar» y guarda 200 g, Then se
  envía el cambio de gramos como en la 022 y el diario se vuelve a leer.

### REQ-011 — Redirección de `/foods`
WHEN un usuario abre la ruta `/foods` THE SYSTEM SHALL llevarlo a `/diary` sin mostrar la pantalla «Alimentos» de la
021.

- **AC-011.1:** Given un usuario con sesión y onboarding completado, When abre `/foods`, Then termina en `/diary` y ve
  la pantalla «Diario».
- **AC-011.2:** Given la aplicación, When se recorre la navegación, Then no hay ninguna entrada ni enlace a `/foods`.

### REQ-012 — Páginas legales
THE SYSTEM SHALL conservar en la sección «Datos nutricionales» de «Términos de servicio» la atribución de los valores a
USDA FoodData Central y el aviso de valores aproximados, sin mencionar alimentos añadidos a mano, y SHALL dejar de decir
en la «Política de privacidad» que Voyage AI recibe el texto de las búsquedas de alimentos.

- **AC-012.1:** Given la página «Términos de servicio», When se muestra, Then la sección «Datos nutricionales» conserva
  la atribución «Datos: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.» y el aviso
  «Los valores nutricionales son aproximados y pueden variar según el alimento y su preparación.», y no contiene la
  frase «Algunos alimentos de comida local se añadieron a mano a partir de otras tablas de composición de alimentos.».
- **AC-012.2:** Given la página «Política de privacidad», When se muestra, Then el punto de Voyage AI ya no menciona las
  búsquedas de alimentos y sigue mencionando las preguntas al coach.
- **AC-012.3:** Given las dos páginas, When se muestran, Then su fecha de actualización es la del cambio.

## 5. Requisitos no funcionales

### NFR-001 — Búsqueda sin proveedores externos
THE SYSTEM SHALL resolver la búsqueda del catálogo solo con los datos de la base, sin llamar al proveedor de embeddings
ni a ningún otro servicio externo, y sin límite de uso por usuario.

- **AC-N001.1:** Given un proveedor de embeddings simulado, When se hacen búsquedas válidas en el catálogo, Then no se
  le pide ninguna representación.
- **AC-N001.2:** Given un usuario que hace 31 búsquedas válidas del catálogo en un minuto, When hace la 31, Then recibe
  200.

### NFR-002 — Accesibilidad de los resultados
THE SYSTEM SHALL mantener en la búsqueda del catálogo la accesibilidad de la 021 y la 022: caja con nombre accesible,
estados anunciados a los lectores de pantalla y botones «Elegir» con el nombre del alimento.

- **AC-N002.1:** Given el diálogo de añadir, When se consulta por rol, Then hay un campo de búsqueda con nombre «Buscar
  alimento» y, con resultados, una lista «Resultados» con un botón «Elegir {nombre}» por alimento.
- **AC-N002.2:** Given los estados «Buscando…», sin resultados y error, When aparecen, Then están dentro de una región
  que se anuncia a los lectores de pantalla.

## 6. Datos y contratos visibles

**Alimento del catálogo (lo que ve el usuario y el consumidor del endpoint):**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | texto | Identificador estable: minúsculas `a-z`, dígitos y guiones, sin tildes ni «ñ», de 2 a 60 caracteres, sin guiones al principio ni al final ni dos seguidos (p. ej. `arroz-blanco-cocido`). No cambia entre cargas; es el que usan el diario y la spec 024. |
| `name` | texto | Nombre en español, de 2 a 80 caracteres, con mayúscula inicial (p. ej. «Arroz blanco cocido»). |
| `per_100g.calories_kcal` | número | Energía en kcal por 100 g, de 0 a 900. |
| `per_100g.protein_g` | número | Proteína en g por 100 g, de 0 a 100. |
| `per_100g.carbs_g` | número | Carbohidratos en g por 100 g, de 0 a 100. |
| `per_100g.fat_g` | número | Grasa en g por 100 g, de 0 a 100. |

Los cuatro valores siempre tienen dato (nunca `null`) y proteína + carbohidratos + grasa no supera 100 g.

**CSV del catálogo (lo que revisa y carga el operador):** codificación UTF-8, separador coma, una fila de cabecera y
una fila por alimento, con estas columnas:

| Columna | Obligatoria | Regla |
|---|---|---|
| `id` | sí | Formato de `id` de arriba; único en el archivo. |
| `name` | sí | Formato de `name` de arriba; único en el archivo sin distinguir mayúsculas ni tildes; no contiene como palabra «con», «frito», «frita», «fritos» ni «fritas». |
| `synonyms` | sí (puede estar vacía) | Sinónimos separados por `\|`, cada uno de 2 a 80 caracteres; ninguno igual (sin distinguir mayúsculas ni tildes) al nombre o a un sinónimo de este u otro alimento. |
| `calories_kcal`, `protein_g`, `carbs_g`, `fat_g` | sí | Número con punto decimal, dentro de los límites de arriba. |
| `source` | sí | `usda` o `manual`. |
| `fdc_id` | si `source` es `usda` | FDC ID de un alimento de la base de USDA; los cuatro valores **DEBEN** ser iguales a los de ese alimento. Vacío si `manual`. |
| `reference` | si `source` es `manual` | Texto con la fuente de los valores (p. ej. la tabla de composición usada); no se muestra al usuario. Opcional si `usda`. |

**Reglas de contenido** (las revisa el usuario en el CSV; las automatizables están en REQ-001 y REQ-003):
1. Solo alimentos simples, de un solo ingrediente. Un procesado de ingrediente simple (pan integral, queso, tortilla de
   maíz) cuenta como simple; un plato preparado o una combinación no («arroz con frijoles», «gallo pinto», «huevo
   frito»).
2. Nombres en español neutro y común («banano», «frijoles»), con los regionales como sinónimos («guineo», «porotos»).
3. Cocido en la mayoría de los casos (arroz, pasta, avena, legumbres, carnes, tubérculos) y crudo solo donde es lo
   normal comerlo así (frutas, verduras de ensalada, frutos secos); los cocidos lo indican en el nombre («cocido»,
   «cocida», «a la plancha», «al horno»). Una sola versión por alimento y nada preparado con aceite.

**Lista mínima** (AC-001.4; el CSV puede usar estos nombres o los que se acuerden en la revisión, pero debe cubrir
estos alimentos): «Arroz blanco cocido», «Arroz integral cocido», «Frijoles negros cocidos», «Frijoles rojos
cocidos», «Lentejas cocidas», «Garbanzos cocidos», «Avena cocida», «Pasta cocida», «Papa cocida»,
«Plátano maduro cocido», «Tortilla de maíz», «Pan blanco», «Pan integral», «Pechuga de pollo a la plancha», «Carne de
res molida cocida», «Lomo de cerdo a la plancha», «Atún en agua», «Salmón al horno», «Huevo cocido», «Leche entera»,
«Leche descremada», «Yogur natural», «Queso blanco», «Banano», «Manzana», «Naranja», «Papaya», «Piña», «Mango»,
«Fresas», «Aguacate», «Tomate», «Lechuga», «Pepino», «Zanahoria», «Brócoli cocido», «Maní», «Almendras» y «Aceite de
oliva».

**Carga (lo que ve el operador):**
- Entrada: la ruta del CSV del catálogo. Requiere la migración aplicada y la base de USDA cargada (para comprobar los
  FDC ID y los valores).
- Antes de escribir muestra el entorno y la base de destino (sin contraseña) y, si la base no es local y no se indicó
  `--yes`, pregunta «La base de datos NO es local. ¿Escribir en ella? [s/N]: », con las mismas respuestas afirmativas,
  el mismo criterio de base local y el mismo mensaje de cancelación que la importación de la 021 («Carga cancelada: no
  se ha escrito nada.», código 1).
- Salida: el resumen (añadidos, actualizados, sin cambios, quitados) o un error que nombra el archivo y, si aplica, la
  columna, la fila, el identificador y la regla. Con cualquier error, el catálogo no cambia.

**`GET /api/catalog/search?q={consulta}`** (requiere `Authorization: Bearer {token}`):

- `q`: texto de 2 a 100 caracteres después de quitar los espacios de los extremos.
- 200:
  ```json
  {
    "results": [
      {
        "id": "pechuga-de-pollo-a-la-plancha",
        "name": "Pechuga de pollo a la plancha",
        "per_100g": { "calories_kcal": 165.0, "protein_g": 31.0, "carbs_g": 0.0, "fat_g": 3.57 }
      }
    ]
  }
  ```
  Hasta 20 resultados en el orden de REQ-004. Lista vacía si no hay coincidencias. Cualquier parámetro distinto de `q`
  se ignora.
- 400 `{"error": "Escribe qué alimento quieres buscar."}`, `{"error": "La búsqueda debe tener al menos 2 caracteres."}`
  o `{"error": "La búsqueda no puede superar los 100 caracteres."}`.
- 401: el error de sesión de los demás endpoints protegidos.

**Cambios en `/api/meals` respecto a la 022:**
- `POST /api/meals` acepta en `items` un tercer tipo de alimento: `{"catalog_id": texto, "grams": número}`. Los otros
  dos (`fdc_id` y personalizado) no cambian.
- Cada alimento de la respuesta lleva un campo nuevo, `catalog_id` (texto o `null`): el identificador del catálogo en
  los de `source: "catalog"` y `null` en los demás. Los de `source: "catalog"` llevan `fdc_id: null` y
  `data_type: null`, `name` es el nombre del catálogo al añadirlo y `per_100g` sus valores del catálogo al añadirlo.
- `source` admite `"catalog"`, `"usda"` y `"custom"`.

| Caso | Código | Mensaje |
|---|---|---|
| `catalog_id` que no existe en el catálogo | 400 | `No encontramos ese alimento.` |
| Alimento con más de uno de `catalog_id`, `fdc_id` y `name`, o sin ninguno | 400 | `Cada alimento debe ser del catálogo, de USDA o personalizado.` |

El resto de límites y mensajes de la 022 no cambia.

**Pantalla «Diario» (cambios respecto a la 022):**

| Elemento | Texto |
|---|---|
| Descripción del diálogo de añadir | «Busca un alimento o crea uno propio.» |
| Ejemplo en la caja de búsqueda | «Ej.: arroz blanco cocido, banano» |
| Resultado de la búsqueda | Nombre; «{n} kcal», «{g} g proteína», «{g} g carbohidratos», «{g} g grasa» por 100 g; botón «Elegir» (nombre accesible «Elegir {nombre}»); sin etiqueta de origen |
| Alimento del catálogo en el diario | Nombre; «{gramos} g»; «{n} kcal»; botones «Editar» y «Quitar»; sin etiqueta de origen |

Los demás textos (estado inicial, «Buscando…», sin resultados, errores, 400 de validación) son los de la 021 y la 022.

**Rutas:** `/foods` redirige a `/diary`.

**Páginas legales:** «Términos de servicio», sección «Datos nutricionales»: su texto no cambia respecto a la 022 (la
atribución a USDA y el aviso de valores aproximados), porque el catálogo no tiene alimentos de origen `manual`; no se
añade ninguna frase sobre alimentos añadidos a mano. «Política de privacidad»: el punto de
Voyage AI vuelve a mencionar solo las preguntas al coach. La fecha de actualización de las dos pasa a la del cambio.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Qué pasa con `/foods`: se retira, se redirige o se mantiene como herramienta para curar el catálogo? | Redirige a `/diary` y la pantalla «Alimentos» deja de usarse. El endpoint `GET /api/foods/search` y la tabla de USDA se conservan sin cambios (son la fuente del catálogo); para buscar FDC ID durante la curación sirve el propio FoodData Central (REQ-011). | Aprobado |
| Q2 | La API de `/api/meals`, ¿sigue aceptando alimentos de USDA por `fdc_id` aunque la pantalla ya no los use? | Sí: se siguen aceptando para no romper la API; solo cambia el mensaje de «Cada alimento debe ser…». Retirarlos pasa al backlog (REQ-006, AC-006.4). | Aprobado |
| Q3 | ¿Cómo se garantiza que los macros salen de USDA «sin modificar»? | El CSV lleva los cuatro valores escritos (para que el usuario los vea al revisarlo) y el FDC ID de origen; la carga rechaza la fila si no coinciden exactamente con los de ese alimento en USDA (REQ-003, AC-003.5). | Aprobado |
| Q4 | ¿Cómo se documentan los alimentos añadidos a mano (comida local que USDA no tiene)? | Origen `manual` con una columna `reference` obligatoria con la fuente de los valores (p. ej. la tabla de composición del INCAP o la etiqueta del producto), que no se muestra al usuario; Términos de servicio añade una frase genérica sobre ellos (REQ-012). | Aprobado. Revisado tras el review (F13): el catálogo no tiene filas `manual`, así que Términos de servicio no añade la frase; el formato `manual` sigue admitido por la carga. |
| Q5 | Si un alimento desaparece del CSV, ¿la carga lo quita del catálogo? | Sí: el catálogo queda igual al archivo; lo ya registrado en comidas no cambia porque guarda su copia (REQ-002, AC-002.3 y AC-002.4). | Aprobado |
| Q6 | ¿Cómo funciona la búsqueda: por texto, por similitud con Voyage o ambas? ¿Con límite de uso? | Solo texto, sin Voyage y sin límite de uso: cada palabra de la consulta debe coincidir con el inicio de una palabra del nombre o de un sinónimo, sin distinguir mayúsculas, tildes ni «ñ»/«n»; hasta 20 resultados (REQ-004, NFR-001). | Aprobado, con el cambio en Q6: una palabra de la consulta también coincide si, quitándole una «s» o «es» final, queda como inicio de palabra (así «huevos», «bananos» o «frijoles» funcionan). Las erratas siguen fuera. |
| Q7 | ¿La búsqueda del diálogo se lanza al pulsar «Buscar» (como hoy) o mientras se escribe? | Al pulsar «Buscar» o Intro, como en la 022; la búsqueda mientras se escribe queda fuera de alcance (backlog). | Aprobado |
| Q8 | ¿Qué identificador tiene cada alimento del catálogo? | Un texto estable legible (`arroz-blanco-cocido`), que no cambia entre cargas y que usará la 024 como lista cerrada. | Aprobado |
| Q9 | ¿Cuántos alimentos y qué control automático del contenido? Las reglas de «simple», «cocido» y «una versión» no son comprobables del todo con un test. | Entre 250 y 350 alimentos; los tests comprueban formato, unicidad de nombres y sinónimos, límites, la lista mínima de la sección 6 y que ningún nombre contenga «con» ni «frito/a/os/as»; el resto lo revisa el usuario en el CSV. | Aprobado |
| Q10 | ¿Cuándo revisa el usuario el CSV? | En el gate de `review`, junto con el resto de la feature; la carga en producción se hace después del merge, como paso manual del runbook. | Aprobado |
| Q11 | ¿Cómo se ven los alimentos del catálogo en los resultados y en el diario? | Solo con su nombre, sin etiqueta de origen; los de USDA ya registrados siguen con «Foundation» o «SR Legacy» y los personalizados con «Personalizado» (REQ-009 y REQ-010). | Aprobado |
| Q12 | Las páginas legales: ¿se ajustan a que el diario ya no envía búsquedas a Voyage y a que hay datos añadidos a mano? | Sí: la Política de privacidad deja de mencionar las búsquedas de alimentos en el punto de Voyage AI, y «Datos nutricionales» añade la frase sobre los alimentos añadidos a mano (REQ-012). | Aprobado. Revisado tras el review (F13): se mantiene el cambio de la Política de privacidad y se quita la frase de «Datos nutricionales», porque no hay alimentos añadidos a mano. |

Todas las preguntas están resueltas y sus respuestas incorporadas a los requisitos. Q6 se aprobó con un cambio, que
recoge la regla de plurales de REQ-004 (AC-004.12 a AC-004.16).

## 8. Glosario

- **Catálogo:** la lista propia de alimentos genéricos en español de esta spec, cargada desde el CSV.
- **Alimento del catálogo:** un alimento simple con identificador, nombre, sinónimos y cuatro valores por 100 g.
- **Alimento simple:** de un solo ingrediente; puede estar procesado (pan, queso) pero no es un plato ni una
  combinación.
- **Sinónimo:** otro nombre, normalmente regional, por el que se encuentra un alimento («guineo» para «Banano»).
- **Origen `usda` / `manual`:** si los valores del alimento se copian de un alimento de USDA (por su FDC ID) o se
  escriben a mano a partir de otra fuente.
- **Carga:** el proceso, ejecutado a mano, que valida el CSV y deja el catálogo de la base igual al del archivo.
- **Operador:** la persona que ejecuta la carga (el dueño del proyecto).
- **Base de USDA:** los alimentos de Foundation y SR Legacy importados en la spec 021.


## Comentarios del usuario

- Review F1 (yuca-cocida): «1. La opcion dos. 2. Si». La opción 2 es quitar «Yuca cocida» de la lista mínima de la spec y del catálogo hasta tener una fuente verificable; la pregunta 2 era corregir también F2 a F6 (contenido del CSV) en la misma ronda.

- Review F13 (frase de Términos de servicio sobre alimentos añadidos a mano): «A». La opción A es arreglar F13, F14, F16 y F17 en una sola ronda; para F13, quitar la frase.
