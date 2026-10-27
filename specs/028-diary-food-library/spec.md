# Spec 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Feature:** `028-diary-food-library` · **Tipo:** feature
- **Ámbitos:** `backend`, `frontend`

## 1. Contexto y problema

Desde las specs 022 a 026, el usuario registra sus comidas buscando en el catálogo propio (spec 023), creando alimentos
personalizados o con una foto (specs 024 y 025). Hay cuatro fricciones:

- **Los personalizados no se reutilizan.** Un alimento personalizado (por ejemplo, «Gallo pinto» con sus macros) vive
  solo en la comida donde se creó. Para volver a registrarlo otro día hay que escribir otra vez su nombre y sus cuatro
  valores por 100 g (decisión Q4 de la 022, que lo dejó para el backlog).
- **No hay atajos para lo habitual.** Quien desayuna lo mismo cada día tiene que buscar cada alimento cada vez: no hay
  alimentos recientes ni favoritos.
- **La búsqueda es rígida.** Hay que pulsar «Buscar» o Intro; una errata («aroz», «guevos») no encuentra nada (AC-004.16
  de la 023), y algunos plurales tampoco («nueces» no encuentra «Nuez»).
- **La propuesta de foto está incompleta.** Desde «Añadir otro alimento» de la propuesta no se puede crear un alimento
  personalizado (backlog de la 025), y la búsqueda está duplicada entre el diálogo «Añadir a {sección}» y la propuesta.
  Además, la propuesta lee los valores del formulario de una forma que el lint marca como incompatible (aviso
  `react(incompatible-library)`), y el cambio directo que se probó en la 025 dejaba los totales desactualizados.

Esta spec añade una **biblioteca de alimentos** del usuario («tus alimentos»): los personalizados se guardan para
reutilizarlos, los últimos alimentos registrados aparecen como **recientes** y el usuario puede marcar **favoritos**.
Una sola búsqueda, compartida por el diálogo de añadir y la propuesta de foto, busca a la vez en el catálogo y en los
alimentos propios **mientras se escribe**, con tolerancia a erratas y a más plurales.

Esta spec sustituye, de la 023: AC-004.16 (las erratas ya coinciden, con las reglas de REQ-006), y el botón «Buscar» de
REQ-009 (AC-009.1 y AC-009.7: la búsqueda se lanza mientras se escribe o con Intro). De la 022 sustituye la decisión Q4
(los personalizados ya no viven solo en su comida). Lo demás de esas specs se mantiene.

## 2. Historia de usuario

Como **usuario con sesión que lleva su diario de comidas**, quiero **volver a registrar mis alimentos personalizados sin
reescribirlos, tener a mano los que uso a menudo (recientes y favoritos) y encontrar un alimento mientras escribo aunque
me equivoque en una letra** para **registrar mis comidas en pocos toques**.

Como **usuario que registra una comida con foto**, quiero **crear un alimento personalizado y usar mis alimentos
guardados desde la propuesta** para **completar la propuesta sin salir de ella**.

## 3. Alcance

**Incluye:**
- Backend:
  - Biblioteca de alimentos propios por usuario: cada alimento personalizado que se registra en una comida se guarda (o
    actualiza, si ya hay uno con el mismo nombre) en la biblioteca del usuario, con un límite de 500.
  - Añadir a una comida un alimento propio por su identificador (`custom_food_id`), que copia su nombre y sus valores
    por 100 g como cualquier personalizado.
  - Borrar un alimento propio de la biblioteca sin cambiar las comidas ya registradas.
  - Búsqueda conjunta en el catálogo y en los alimentos propios del usuario, con las reglas de la 023 más tolerancia a
    erratas y el plural en «-ces».
  - Las mismas reglas de coincidencia nuevas en `GET /api/catalog/search` de la 023.
  - Alimentos recientes (los 10 últimos distintos que el usuario tiene registrados) con los gramos de su último
    registro.
  - Favoritos: marcar y desmarcar alimentos del catálogo y propios, y consultarlos, con un límite de 100.
  - La migración de las estructuras nuevas, que además crea la biblioteca a partir de los personalizados ya registrados
    (Q2); es aditiva y no se aplica sola (paso manual documentado para producción, Art. P4).
- Frontend:
  - Un componente de búsqueda compartido por el diálogo «Añadir a {sección}» y por las búsquedas de la propuesta de
    foto, con búsqueda mientras se escribe (sin botón «Buscar») y los estados de la 021 a la 023.
  - Con la caja vacía o con menos de 2 caracteres, las listas «Favoritos» y «Recientes».
  - Resultados del catálogo y propios (estos con la etiqueta «Personalizado»), con un botón para marcar o quitar el
    favorito y, en los propios, para borrarlos de la biblioteca con confirmación.
  - Elegir un alimento propio o reciente y registrarlo con sus gramos.
  - En la propuesta de foto: «Crear alimento personalizado» desde «Añadir otro alimento» y desde la búsqueda de un
    alimento sin coincidencia, y la posibilidad de elegir alimentos propios, recientes y favoritos.
  - Totales y nutrientes de la propuesta siempre al día al editar gramos, resolver, añadir o quitar alimentos, sin el
    aviso `react(incompatible-library)` del lint en la propuesta.
  - Retirada del código de la pantalla «Alimentos» de la 021, que no tiene ruta desde la 023 (Q7); `/foods` sigue
    redirigiendo a `/diary`.
  - Actualización de la Política de privacidad (alimentos propios y favoritos).

**Fuera de alcance:**
- Editar un alimento propio desde una pantalla: para cambiar sus valores basta con volver a crearlo con el mismo nombre
  (REQ-001). Tampoco hay una pantalla propia «Mis alimentos» fuera de los diálogos del diario.
- Crear un alimento propio sin registrarlo en una comida.
- Recetas o platos compuestos de varios alimentos, medidas caseras, copiar comidas entre días.
- Marcar o quitar favoritos desde las filas del diario (solo desde la búsqueda, los recientes y los favoritos).
- Compartir alimentos entre usuarios.
- Búsqueda por similitud de significado y cualquier tolerancia distinta de la de REQ-006.
- Retirar `GET /api/foods/search`, la base de USDA o los alimentos de USDA por `fdc_id` en `/api/meals`.
- Cambiar los alimentos de USDA o del catálogo ya registrados.

## 4. Requisitos funcionales

### Backend · alimentos propios

### REQ-001 — Guardar en la biblioteca los personalizados que se registran
WHEN un usuario con sesión añade a una comida un alimento personalizado con nombre (`POST /api/meals` con `name`, como en
la 022) THE SYSTEM SHALL registrarlo como hasta ahora y SHALL guardarlo en la biblioteca del usuario: si ya tiene un
alimento propio con el mismo nombre (sin distinguir mayúsculas ni tildes, sin espacios en los extremos y con los
espacios repetidos contados como uno), SHALL actualizar su nombre y sus cuatro valores por 100 g con los nuevos; si no,
SHALL crear uno. El alimento registrado en la comida SHALL devolver `custom_food_id` con el identificador de ese
alimento propio.

- **AC-001.1:** Given un usuario sin alimentos propios, When pide `POST /api/meals` con `items: [{"name": "Gallo pinto",
  "grams": 200, "per_100g": {"calories_kcal": 180, "protein_g": 6, "carbs_g": 30, "fat_g": 4}}]`, Then recibe 201, el
  alimento de la respuesta tiene `source: "custom"` y un `custom_food_id` entero, y la biblioteca del usuario tiene un
  alimento «Gallo pinto» con esos cuatro valores y ese identificador.
- **AC-001.2:** Given el alimento propio de AC-001.1, When el usuario registra otro día `{"name": "  gallo PINTO ",
  "grams": 150, "per_100g": {"calories_kcal": 170, "protein_g": 7, "carbs_g": 28, "fat_g": 3}}`, Then la biblioteca
  sigue con un solo alimento con ese identificador, ahora llamado «gallo PINTO» (el nombre registrado, sin los espacios
  de los extremos, como en la 022) y con 170, 7, 28 y 3 por 100 g, y la respuesta lleva el mismo `custom_food_id`.
- **AC-001.3:** Given el caso de AC-001.2, When se pide el diario del día de AC-001.1, Then el alimento registrado ese
  día conserva el nombre «Gallo pinto», sus valores por 100 g y sus nutrientes originales.
- **AC-001.4:** Given un usuario con «Piña colada» en su biblioteca, When registra un personalizado «Pina colada», Then
  se actualiza el mismo alimento propio (las tildes no distinguen nombres).
- **AC-001.5:** Given dos usuarios A y B, When los dos registran un personalizado «Gallo pinto», Then cada uno tiene su
  propio alimento en su biblioteca, con identificadores distintos y sus propios valores.
- **AC-001.6:** Given una petición con dos personalizados con el mismo nombre y valores distintos, When se añade, Then la
  biblioteca tiene un solo alimento con ese nombre, con los valores del último de la petición, y los dos alimentos de
  la comida llevan su `custom_food_id`.
- **AC-001.7:** Given una petición con un personalizado no válido (por ejemplo, macros que suman más de 100 g), When se
  añade, Then recibe el 400 de la 022 y la biblioteca no cambia.
- **AC-001.8:** Given dos peticiones simultáneas del mismo usuario que registran un personalizado «Avena con leche» que
  aún no está en su biblioteca, When terminan las dos, Then las dos responden 201 y la biblioteca tiene un solo
  alimento con ese nombre.
- **AC-001.9:** Given una comida con un alimento del catálogo y otro de USDA, When se pide el diario, Then los dos llevan
  `custom_food_id: null`.
- **AC-001.10:** Given un usuario con «Gallo pinto» en su biblioteca, When registra un personalizado «Gallo    pinto»
  (con varios espacios entre las palabras), Then se actualiza el mismo alimento propio y la respuesta lleva su
  `custom_food_id`.

### REQ-002 — Límite de alimentos propios
IF un usuario que ya tiene 500 alimentos propios registra un personalizado cuyo nombre no coincide con ninguno de ellos
THEN THE SYSTEM SHALL responder 400 con `{"error": "Ya tienes 500 alimentos propios. Borra alguno para crear otro."}` y
SHALL NOT guardar ningún alimento de la petición.

- **AC-002.1:** Given un usuario con 500 alimentos propios, When registra un personalizado con un nombre nuevo, Then
  recibe 400 con ese mensaje y ni la comida ni la biblioteca cambian.
- **AC-002.2:** Given un usuario con 500 alimentos propios, When registra un personalizado con el nombre de uno de ellos,
  Then recibe 201 y ese alimento propio se actualiza.
- **AC-002.3:** Given un usuario con 499 alimentos propios, When registra en una sola petición dos personalizados con
  nombres nuevos, Then recibe el 400 de REQ-002 y no se guarda nada.

### REQ-003 — Añadir un alimento propio a una comida
WHEN un usuario con sesión pide `POST /api/meals` con un alimento `{"custom_food_id": entero, "grams": número}` de su
biblioteca THE SYSTEM SHALL añadirlo a la comida como un personalizado (`source: "custom"`), con el nombre y los valores
por 100 g que el alimento propio tiene en ese momento copiados, los nutrientes calculados como en la 022 y su
`custom_food_id`. Cada alimento de `items` SHALL traer exactamente uno de `catalog_id`, `fdc_id`, `name` y
`custom_food_id`.

- **AC-003.1:** Given el alimento propio «Gallo pinto» con 180 kcal, 6 g, 30 g y 4 g por 100 g, When el usuario pide
  `POST /api/meals` con `items: [{"custom_food_id": <su id>, "grams": 250}]`, Then recibe 201 con un alimento con
  `source: "custom"`, `name: "Gallo pinto"`, `custom_food_id` igual a ese id, `catalog_id: null`, `fdc_id: null` y
  `nutrients` igual a `{"calories_kcal": 450.0, "protein_g": 15.0, "carbs_g": 75.0, "fat_g": 10.0}`.
- **AC-003.2:** Given un `custom_food_id` que no existe, que es de otro usuario, o que no es un entero entre 1 y
  2.147.483.647, When se añade, Then recibe 400 con `{"error": "No encontramos ese alimento."}` y no se guarda nada.
- **AC-003.3:** Given un alimento que trae `custom_food_id` junto con `name`, `catalog_id` o `fdc_id`, When se añade,
  Then recibe 400 con `{"error": "Cada alimento debe ser del catálogo, de USDA o personalizado."}`.
- **AC-003.4:** Given el alimento registrado en AC-003.1, When el usuario actualiza después ese alimento propio con otros
  valores (REQ-001) o cambia los gramos del registrado, Then el registrado conserva sus valores por 100 g copiados y sus
  nutrientes se recalculan con ellos.
- **AC-003.5:** Given un alimento propio con `custom_food_id` y gramos no válidos, When se añade, Then recibe el mismo 400
  de gramos que en la 022.

### REQ-004 — Borrar un alimento propio
WHEN un usuario con sesión pide `DELETE /api/food-library/custom/{custom_food_id}` de un alimento de su biblioteca THE
SYSTEM SHALL quitarlo de la biblioteca y de sus favoritos y responder 204; los alimentos ya registrados en comidas SHALL
conservar su nombre, sus valores y sus nutrientes, y SHALL devolver desde entonces `custom_food_id: null`.
IF el alimento no existe, es de otro usuario o el identificador no es un entero válido THEN THE SYSTEM SHALL responder
404 con `{"error": "No encontramos ese alimento."}`.

- **AC-004.1:** Given un alimento propio favorito y registrado en una comida, When el usuario lo borra, Then recibe 204,
  ya no aparece en la búsqueda, en los recientes ni en los favoritos, y el diario devuelve el alimento registrado con
  su nombre, sus valores, sus nutrientes y `custom_food_id: null`.
- **AC-004.2:** Given un alimento propio del usuario B, When el usuario A pide borrarlo, Then recibe 404 y el alimento de
  B no cambia.
- **AC-004.3:** Given un identificador que no existe o `abc`, When se pide el borrado, Then recibe 404 con ese mensaje.
- **AC-004.4:** Given un alimento propio borrado, When el usuario registra después un personalizado con el mismo nombre,
  Then se crea un alimento propio nuevo, con otro identificador.

### REQ-005 — Personalizados ya registrados
WHEN se aplica la migración de esta spec THE SYSTEM SHALL crear, para cada usuario, un alimento propio por cada nombre
distinto (con la regla de nombres de REQ-001) de sus personalizados ya registrados, con el nombre y los valores por
100 g de su registro más reciente, y SHALL vincular a él esos registros, que devolverán su `custom_food_id`. Los
alimentos de USDA y del catálogo no cambian. Esta creación inicial no aplica el límite de REQ-002.

- **AC-005.1:** Given un usuario con «Gallo pinto» registrado el 1 de octubre (180 kcal por 100 g) y «gallo pinto» el
  5 de octubre (170 kcal por 100 g) antes de la migración, When se aplica, Then su biblioteca tiene un solo alimento,
  «gallo pinto», con los valores del 5 de octubre, y los dos registros devuelven su `custom_food_id` sin cambiar sus
  nombres, valores ni nutrientes.
- **AC-005.2:** Given dos usuarios con un personalizado del mismo nombre, When se aplica la migración, Then cada uno
  tiene su propio alimento propio.
- **AC-005.3:** Given una base sin personalizados registrados, When se aplica la migración, Then ninguna biblioteca tiene
  alimentos.

### Backend · búsqueda

### REQ-006 — Reglas de coincidencia: erratas y plural en «-ces»
THE SYSTEM SHALL buscar con las reglas de REQ-004 de la 023 (cada palabra de la consulta coincide con el inicio de una
palabra del nombre o de un mismo sinónimo, sin distinguir mayúsculas, tildes, diéresis ni «ñ»/«n», con sus formas
reducidas sin «s» o «es» final), con dos añadidos:
1. **Plural en «-ces»:** si una palabra de la consulta termina en «ces», tiene además la forma que resulta de cambiar
   «ces» final por «z», si queda con al menos 3 caracteres.
2. **Erratas:** IF ningún alimento coincide con la consulta THEN THE SYSTEM SHALL repetir la búsqueda con tolerancia: una
   forma de una palabra de la consulta coincide también si su **distancia de edición** con la palabra del alimento, o
   con algún inicio de esa palabra, es como mucho 1 cuando la forma tiene de 4 a 7 caracteres y como mucho 2 cuando
   tiene 8 o más; las formas de menos de 4 caracteres no tienen tolerancia. Los resultados de esta segunda búsqueda se
   ordenan por la suma de distancias de sus palabras (de menor a mayor) y después por nombre.

La **distancia de edición** es el número mínimo de operaciones de una letra (insertar, borrar, cambiar o intercambiar
dos letras contiguas) para pasar de un texto a otro, ya sin mayúsculas ni tildes. Estas reglas valen para la búsqueda
conjunta (REQ-007) y para `GET /api/catalog/search` de la 023.

- **AC-006.1:** Given «Arroz blanco cocido» en el catálogo, When se busca `q=aroz`, `q=arrox` o `q=arorz`, Then aparece en
  los tres casos.
- **AC-006.2:** Given «Huevo cocido» en el catálogo, When se busca `q=guevos` o `q=huevoz`, Then aparece en los dos casos
  (sustituye a AC-004.16 de la 023).
- **AC-006.3:** Given «Pechuga de pollo a la plancha», When se busca `q=pechga de polo`, Then aparece.
- **AC-006.4:** Given «Almendras», When se busca `q=almendars`, Then aparece (8 o más caracteres: hasta 2).
- **AC-006.5:** Given «Arroz blanco cocido» y «Arroz integral cocido», When se busca `q=arroz blanko`, Then aparece
  «Arroz blanco cocido» y no «Arroz integral cocido».
- **AC-006.6:** Given «Pechuga de pollo a la plancha» y un alimento llamado «Cacao en polvo», When se busca `q=pollo`,
  Then aparece la pechuga y no el cacao (con coincidencias exactas no se aplica tolerancia).
- **AC-006.7:** Given «Pan blanco», When se busca `q=pam`, Then no aparece (menos de 4 caracteres: sin tolerancia).
- **AC-006.8:** Given «Frijoles negros cocidos», When se busca `q=ijol`, Then no aparece (la tolerancia compara con el
  inicio de la palabra, no con su interior).
- **AC-006.9:** Given «Huevo cocido», «Hueva de pescado» (solo para la prueba) y «Hueso de res» (solo para la prueba),
  When se busca `q=huevi`, Then aparecen «Hueva de pescado» y después «Huevo cocido» (los dos a distancia 1, por nombre)
  y no aparece «Hueso de res» (distancia 2 en una palabra de 5 letras).
- **AC-006.10:** Given «Nuez» en el catálogo (solo para la prueba), When se busca `q=nueces`, Then aparece.
- **AC-006.11:** Given la consulta `q=zzxqv`, When se busca, Then la respuesta es 200 con `results` vacío.
- **AC-006.12:** Given el catálogo de la prueba de AC-006.1, When se busca `q=aroz` en `GET /api/catalog/search`, Then
  aparece «Arroz blanco cocido» con el formato de respuesta de la 023, sin cambios.

### REQ-007 — Búsqueda conjunta en el catálogo y en los alimentos propios
WHEN un usuario con sesión pide `GET /api/food-library/search?q={consulta}` con una consulta válida THE SYSTEM SHALL
responder 200 con hasta 20 alimentos, del catálogo y de su biblioteca (nunca de la de otro usuario), que coinciden con
las reglas de REQ-006, ordenados por los grupos de la 023 (igual a la consulta, nombre que empieza por la consulta,
resto) o, en la búsqueda con tolerancia, por distancia; dentro de cada grupo, por nombre en orden alfabético y, con el
mismo nombre, primero el del catálogo. Cada resultado SHALL indicar si es del catálogo o propio y si es favorito del
usuario. Los alimentos propios no tienen sinónimos. La validación de la consulta y los mensajes de 400 son los de
REQ-005 de la 023.

- **AC-007.1:** Given el catálogo con «Arroz blanco cocido» y un alimento propio del usuario «Arroz con pollo de mamá»,
  When busca `q=arroz`, Then aparecen los dos, cada uno con su `kind` (`"catalog"` y `"custom"`).
- **AC-007.2:** Given un alimento propio «Gallo pinto» del usuario B, When el usuario A busca `q=gallo`, Then no aparece.
- **AC-007.3:** Given un alimento propio llamado «Arroz blanco cocido», igual que uno del catálogo, When se busca
  `q=arroz blanco cocido`, Then aparecen los dos, primero el del catálogo.
- **AC-007.4:** Given un alimento del catálogo marcado como favorito por el usuario, When busca y aparece, Then lleva
  `favorite: true`, y los demás `favorite: false`.
- **AC-007.5:** Given 15 alimentos del catálogo y 10 propios que coinciden, When se busca, Then la respuesta tiene
  exactamente 20.
- **AC-007.6:** Given un usuario con sesión, When busca sin `q`, con `q=a` o con 101 caracteres, Then recibe los 400 de
  AC-005.1 a AC-005.3 de la 023.
- **AC-007.7:** Given un alimento propio «Gallo pinto», When se busca `q=galo pinto`, Then aparece (la tolerancia vale
  también para los propios).

### Backend · recientes y favoritos

### REQ-008 — Alimentos recientes
WHEN un usuario con sesión pide `GET /api/food-library/recent` THE SYSTEM SHALL responder 200 con hasta 10 alimentos
distintos, del catálogo o de su biblioteca, que tiene registrados en cualquier día de su diario, ordenados por el
momento en que se añadieron (el más reciente primero), cada uno con sus valores actuales, si es favorito y
`last_grams`, los gramos de su registro más reciente. Un alimento del catálogo cuenta por su identificador y uno propio
por su `custom_food_id`. SHALL NOT incluir alimentos de USDA, alimentos del catálogo que ya no están en el catálogo,
personalizados sin `custom_food_id` ni alimentos ya quitados del diario.

- **AC-008.1:** Given un usuario que añadió, en este orden, «Banano» (120 g), «Gallo pinto» propio (200 g) y otra vez
  «Banano» (150 g), When pide los recientes, Then recibe primero «Banano» con `last_grams: 150.0` y después «Gallo pinto»
  con `last_grams: 200.0`, sin repetir «Banano».
- **AC-008.2:** Given un usuario con 12 alimentos distintos registrados, When pide los recientes, Then recibe los 10 más
  recientes.
- **AC-008.3:** Given un registro de «Banano» del que después se cambiaron los gramos a 180, When pide los recientes,
  Then «Banano» lleva `last_grams: 180.0` y su posición no cambia por la edición.
- **AC-008.4:** Given un usuario con un alimento de USDA registrado, uno del catálogo que una carga posterior quitó del
  catálogo y uno propio borrado de la biblioteca, When pide los recientes, Then no aparece ninguno de los tres.
- **AC-008.5:** Given un alimento registrado y después quitado del diario (sin deshacer), When pide los recientes, Then no
  aparece si no tiene otro registro.
- **AC-008.6:** Given un usuario sin comidas, When pide los recientes, Then recibe 200 con `results` vacío.
- **AC-008.7:** Given dos usuarios, When A pide sus recientes, Then no aparece nada que solo registró B.
- **AC-008.8:** Given un alimento propio registrado con unos valores y actualizado después (REQ-001), When se piden los
  recientes, Then aparece con los valores actuales del alimento propio.

### REQ-009 — Marcar y quitar favoritos
WHEN un usuario con sesión pide `PUT /api/food-library/favorites/catalog/{catalog_id}` o
`PUT /api/food-library/favorites/custom/{custom_food_id}` THE SYSTEM SHALL marcar ese alimento como favorito y responder
204, también si ya lo era (sin duplicarlo). WHEN pide `DELETE` sobre las mismas rutas THE SYSTEM SHALL quitarlo de sus
favoritos y responder 204, también si no lo era.
IF el alimento no existe en el catálogo, no es de su biblioteca o el identificador no es válido THEN THE SYSTEM SHALL
responder 404 con `{"error": "No encontramos ese alimento."}`.
IF el usuario ya tiene 100 favoritos y marca uno nuevo THEN THE SYSTEM SHALL responder 400 con
`{"error": "Ya tienes 100 favoritos. Quita alguno para añadir otro."}`.

- **AC-009.1:** Given un usuario sin favoritos, When pide `PUT …/favorites/catalog/banano` dos veces, Then recibe 204 las
  dos veces y sus favoritos tienen «Banano» una sola vez.
- **AC-009.2:** Given «Banano» favorito, When pide `DELETE …/favorites/catalog/banano` dos veces, Then recibe 204 las dos
  veces y ya no está en sus favoritos.
- **AC-009.3:** Given un `catalog_id` que no existe, o un alimento propio de otro usuario, When pide marcarlo, Then recibe
  404 con ese mensaje.
- **AC-009.4:** Given un usuario con 100 favoritos, When marca uno nuevo, Then recibe 400 con ese mensaje; y When vuelve a
  marcar uno que ya es favorito, Then recibe 204.
- **AC-009.5:** Given que A marca «Banano» como favorito, When B pide sus favoritos, Then «Banano» no aparece.

### REQ-010 — Lista de favoritos
WHEN un usuario con sesión pide `GET /api/food-library/favorites` THE SYSTEM SHALL responder 200 con sus favoritos, del
catálogo y propios, con sus valores actuales, ordenados por nombre en orden alfabético (sin distinguir mayúsculas ni
tildes). SHALL NOT incluir alimentos del catálogo que ya no están en el catálogo; si vuelven en una carga posterior,
vuelven a aparecer.

- **AC-010.1:** Given los favoritos «Yogur natural» (catálogo), «Gallo pinto» (propio) y «Avena cocida» (catálogo), When
  los pide, Then recibe «Avena cocida», «Gallo pinto» y «Yogur natural», en ese orden, cada uno con su `kind` y
  `favorite: true`.
- **AC-010.2:** Given un favorito del catálogo que una carga quita del catálogo, When pide los favoritos, Then no aparece;
  y When otra carga lo devuelve, Then vuelve a aparecer.
- **AC-010.3:** Given un usuario sin favoritos, When los pide, Then recibe 200 con `results` vacío.

### REQ-011 — Sesión
IF una petición a cualquier ruta de `/api/food-library` no trae un token de sesión válido THEN THE SYSTEM SHALL responder
401 como el resto de endpoints protegidos.

- **AC-011.1:** Given una petición sin cabecera de autorización o con un token caducado, When pide la búsqueda, los
  recientes, los favoritos, marcar o quitar un favorito o borrar un alimento propio, Then recibe 401.

### REQ-012 — Deshacer al quitar un alimento propio
WHEN el usuario deshace la acción de quitar un alimento personalizado (`POST /api/meals/restore` de la 026) THE SYSTEM
SHALL restaurarlo como en la 026 con el mismo `custom_food_id` si ese alimento propio sigue en su biblioteca, o con
`custom_food_id: null` si lo borró entretanto.

- **AC-012.1:** Given un alimento propio registrado y quitado con `undo=1`, When se restaura con su `restore_token`, Then
  el alimento restaurado lleva el mismo `custom_food_id` y vuelve a contar en los recientes.
- **AC-012.2:** Given el caso de AC-012.1 en el que el usuario borró el alimento propio antes de restaurar, When se
  restaura, Then el alimento vuelve con su nombre, valores y nutrientes y `custom_food_id: null`.

### Frontend · búsqueda compartida

### REQ-013 — Buscar mientras se escribe
WHILE el usuario escribe en la caja «Buscar alimento» del diálogo «Añadir a {sección}» o de la propuesta de foto THE
SYSTEM SHALL lanzar la búsqueda conjunta (REQ-007) 300 ms después de la última tecla si el texto, sin los espacios de los
extremos, tiene de 2 a 100 caracteres, y SHALL mostrar solo los resultados del texto actual. WHEN el usuario pulsa Intro
THE SYSTEM SHALL buscar en el momento (sin esperar) o, si el texto no es válido, SHALL mostrar el aviso de la 021 sin
hacer ninguna petición. Ya no hay botón «Buscar». Los estados «Buscando…», sin resultados y error con «Reintentar» son
los de la 023.

- **AC-013.1:** Given el diálogo abierto, When el usuario escribe «arroz» y pasan 300 ms sin teclear, Then se hace una
  sola petición de búsqueda con «arroz» y se ven sus resultados; y no se ve ningún botón «Buscar».
- **AC-013.2:** Given el diálogo, When el usuario escribe «a», «ar», «arr» con menos de 300 ms entre teclas, Then no se
  hace ninguna petición hasta 300 ms después de la última, y esa petición es con «arr».
- **AC-013.3:** Given una búsqueda de «pollo» que tarda en responder, When el usuario cambia el texto a «arroz» y llega
  primero la respuesta de «arroz» y después la de «pollo», Then se ven los resultados de «arroz».
- **AC-013.4:** Given la caja con «a», When pasan 300 ms, Then no se hace ninguna petición ni se ve ningún aviso; y When
  pulsa Intro, Then se ve «La búsqueda debe tener al menos 2 caracteres.» sin petición.
- **AC-013.5:** Given la caja vacía, When pulsa Intro, Then se ve «Escribe qué alimento quieres buscar.» sin petición.
- **AC-013.6:** Given la caja con «arroz» y antes de que pasen 300 ms, When pulsa Intro, Then se hace la búsqueda en el
  momento y no se repite al cumplirse los 300 ms.
- **AC-013.7:** Given una búsqueda sin resultados para «gallo pinto», When termina, Then se ve «No encontramos alimentos
  para «gallo pinto».» con «Crear alimento personalizado», que abre el formulario con el nombre relleno.
- **AC-013.8:** Given una búsqueda que falla, When termina, Then se ve «No se pudo completar la búsqueda.» con
  «Reintentar», y la caja conserva el texto.
- **AC-013.9:** Given la propuesta de foto y el diálogo de añadir, When se busca en cada uno, Then los dos muestran la
  misma caja, los mismos estados y el mismo formato de resultados.

### REQ-014 — Favoritos y recientes con la caja vacía
WHILE la caja de búsqueda está vacía o tiene menos de 2 caracteres THE SYSTEM SHALL mostrar la lista «Favoritos» (si
tiene alguno) y la lista «Recientes» (si tiene alguno), cada alimento con su nombre, sus macros por 100 g y su botón
«Elegir»; si no hay ninguno de los dos, SHALL mostrar «Busca un alimento para ver sus calorías y macros por 100 g.».
IF no se pueden cargar THEN THE SYSTEM SHALL mostrar «No se pudieron cargar tus alimentos.» con «Reintentar», y la
búsqueda SHALL seguir funcionando.

- **AC-014.1:** Given un usuario con «Avena cocida» en favoritos y «Banano» (150 g) en recientes, When abre el diálogo,
  Then ve el encabezado «Favoritos» con «Avena cocida» y el encabezado «Recientes» con «Banano».
- **AC-014.2:** Given un usuario sin favoritos ni recientes, When abre el diálogo, Then no ve esos encabezados y ve «Busca
  un alimento para ver sus calorías y macros por 100 g.».
- **AC-014.3:** Given el diálogo con favoritos visibles, When escribe «arroz» y llegan sus resultados, Then dejan de verse
  las listas de favoritos y recientes; y When borra el texto, Then vuelven a verse.
- **AC-014.4:** Given la carga de recientes y favoritos falla, When abre el diálogo, Then ve «No se pudieron cargar tus
  alimentos.» con «Reintentar», y al escribir «arroz» se ven sus resultados.
- **AC-014.5:** Given el diálogo de añadir de la sección Desayuno, When el usuario elige «Banano» en «Recientes», Then el
  campo «Gramos» muestra 150 (sus `last_grams`) y la vista previa corresponde a 150 g; y When elige un alimento desde
  «Favoritos» o desde los resultados, Then muestra 100.
- **AC-014.6:** Given un alimento añadido desde el diálogo, When el usuario vuelve a abrir el diálogo, Then se vuelven a
  pedir los recientes y aparece el primero.

### REQ-015 — Resultados del catálogo y propios, y favoritos
THE SYSTEM SHALL mostrar en los resultados, en «Favoritos» y en «Recientes» los alimentos del catálogo sin etiqueta de
origen y los propios con la etiqueta «Personalizado», y en cada uno un botón de favorito con nombre accesible «Añadir
{nombre} a favoritos» o «Quitar {nombre} de favoritos» que indica si está pulsado. WHEN el usuario lo pulsa THE SYSTEM
SHALL marcar o quitar el favorito (REQ-009) y actualizar las listas. IF falla THEN THE SYSTEM SHALL mostrar «No se pudo
actualizar tus favoritos.» y dejar el botón como estaba.

- **AC-015.1:** Given un resultado del catálogo «Banano» y uno propio «Gallo pinto», When se muestran, Then solo «Gallo
  pinto» lleva «Personalizado» y los dos tienen un botón «Elegir {nombre}».
- **AC-015.2:** Given «Banano» no favorito, When el usuario pulsa «Añadir Banano a favoritos», Then se pide marcar
  `catalog/banano`, el botón pasa a «Quitar Banano de favoritos» y está pulsado, y «Banano» aparece en «Favoritos» al
  vaciar la caja.
- **AC-015.3:** Given «Gallo pinto» favorito, When el usuario pulsa «Quitar Gallo pinto de favoritos», Then se pide
  quitar `custom/{id}` y el botón pasa a «Añadir Gallo pinto a favoritos».
- **AC-015.4:** Given que marcar un favorito responde con error, When el usuario lo pulsa, Then ve «No se pudo actualizar
  tus favoritos.» y el botón sigue como antes.
- **AC-015.5:** Given que marcar un favorito responde 400 por el límite, When el usuario lo pulsa, Then ve el mensaje del
  servidor «Ya tienes 100 favoritos. Quita alguno para añadir otro.».

### REQ-016 — Elegir y registrar un alimento propio
WHEN el usuario elige un alimento propio en el diálogo «Añadir a {sección}» THE SYSTEM SHALL mostrar su nombre con
«Personalizado», el campo «Gramos» y la vista previa como con un alimento del catálogo, y al pulsar «Añadir» SHALL enviar
`{"custom_food_id": id, "grams": gramos}`.

- **AC-016.1:** Given el resultado propio «Gallo pinto» (180 kcal, 6 g, 30 g y 4 g por 100 g), When el usuario lo elige,
  escribe 250 y pulsa «Añadir», Then se envía `{"custom_food_id": <id>, "grams": 250}` a la sección y fecha del diálogo,
  el diálogo se cierra y el diario se vuelve a leer.
- **AC-016.2:** Given el formulario «Crear alimento personalizado» del diálogo, When se muestra, Then se ve el aviso «Se
  guardará en tus alimentos para usarlo otro día. Si ya tienes uno con el mismo nombre, se actualizarán sus valores.».
- **AC-016.3:** Given que el registro de un personalizado responde 400 por el límite de REQ-002, When el usuario pulsa
  «Añadir», Then ve el mensaje del servidor y el formulario conserva lo escrito.

### REQ-017 — Borrar un alimento propio desde la búsqueda
WHEN el usuario pulsa «Borrar» (nombre accesible «Borrar {nombre} de tus alimentos») en un alimento propio de los
resultados, «Favoritos» o «Recientes» THE SYSTEM SHALL pedir confirmación con el título «¿Borrar «{nombre}» de tus
alimentos?», el texto «Las comidas ya registradas no cambian.» y los botones «Borrar» y «Cancelar»; al confirmar SHALL
borrarlo (REQ-004) y quitarlo de las listas. Los alimentos del catálogo no tienen este botón.

- **AC-017.1:** Given el resultado propio «Gallo pinto», When el usuario pulsa «Borrar Gallo pinto de tus alimentos» y
  confirma, Then se pide el borrado de su id y «Gallo pinto» desaparece de los resultados, de «Favoritos» y de
  «Recientes».
- **AC-017.2:** Given la confirmación abierta, When pulsa «Cancelar», Then no se hace ninguna petición y el alimento
  sigue.
- **AC-017.3:** Given que el borrado falla, When confirma, Then ve «No se pudo borrar el alimento.» y el alimento sigue en
  la lista.
- **AC-017.4:** Given un resultado del catálogo, When se muestra, Then no tiene botón «Borrar».

### Frontend · propuesta de foto

### REQ-018 — Crear y elegir alimentos propios desde la propuesta
WHEN el usuario pulsa «Añadir otro alimento» o «Buscar» en un alimento sin coincidencia de la propuesta THE SYSTEM SHALL
mostrar la búsqueda compartida (REQ-013 a REQ-015, con «Volver a la propuesta» en lugar de «Cancelar»), en la que puede
elegir alimentos del catálogo, propios, favoritos o recientes y pulsar «Crear alimento personalizado». Al crear uno,
SHALL abrir el formulario de alimento personalizado con «Añadir a la propuesta», con el nombre de la búsqueda (o del
alimento sin coincidencia) y, al resolver un alimento sin coincidencia, sus gramos. Lo elegido o creado SHALL entrar en
la propuesta (al final, o en el lugar del alimento sin coincidencia que se resuelve).

- **AC-018.1:** Given una propuesta, When el usuario pulsa «Añadir otro alimento», Then ve la búsqueda con «Favoritos» y
  «Recientes» y el botón «Crear alimento personalizado».
- **AC-018.2:** Given esa búsqueda, When el usuario pulsa «Crear alimento personalizado», rellena «Gallo pinto», 200 g y
  sus cuatro valores y pulsa «Añadir a la propuesta», Then vuelve a la propuesta con «Gallo pinto» al final, con 200 g y
  la etiqueta «Personalizado».
- **AC-018.3:** Given un alimento sin coincidencia «Gallo pinto» de 180 g, When el usuario pulsa «Buscar» y elige el
  alimento propio «Gallo pinto», Then la fila queda resuelta en su sitio con 180 g y «Personalizado».
- **AC-018.4:** Given una propuesta con un alimento propio elegido (250 g) y un personalizado creado en la propuesta,
  When el usuario pulsa «Guardar en {sección}», Then se envía una sola petición con `{"custom_food_id": <id>,
  "grams": 250}` para el primero y el personalizado con `name` y `per_100g` para el segundo.
- **AC-018.5:** Given la búsqueda de «Añadir otro alimento», When el usuario elige «Banano» en «Recientes», Then entra en
  la propuesta con sus `last_grams`.
- **AC-018.6:** Given la búsqueda de un alimento sin coincidencia sin resultados, When el usuario pulsa «Crear alimento
  personalizado», Then el formulario muestra el nombre y los gramos de ese alimento.

### REQ-019 — Totales de la propuesta siempre al día
THE SYSTEM SHALL mostrar en cada fila de la propuesta y en el total los nutrientes de los gramos y alimentos actuales
justo después de cada cambio: editar gramos, resolver un alimento sin coincidencia, añadir otro alimento y quitar uno.

- **AC-019.1:** Given una propuesta con «Banano» de 100 g (89 kcal), When el usuario cambia los gramos a 200, Then la fila
  y el total muestran 178 kcal sin otra acción.
- **AC-019.2:** Given una propuesta con un alimento sin coincidencia de 150 g, When lo resuelve con un alimento del
  catálogo, Then su fila muestra los nutrientes de 150 g y el total los incluye.
- **AC-019.3:** Given una propuesta en la que el usuario resolvió un alimento y después cambió sus gramos, When vuelve
  de «Añadir otro alimento» sin elegir nada, Then la fila y el total muestran los gramos editados.
- **AC-019.4:** Given una propuesta con dos alimentos, When quita uno, Then el total solo incluye el otro.

### Frontend · otros

### REQ-020 — `/foods` sin pantalla propia
THE SYSTEM SHALL seguir llevando la ruta `/foods` a `/diary`, sin el código de la pantalla «Alimentos» de la 021.

- **AC-020.1:** Given un usuario con sesión y onboarding completado, When abre `/foods`, Then termina en `/diary` y ve la
  pantalla «Diario».

### REQ-021 — Política de privacidad
THE SYSTEM SHALL decir en el punto «Diario de comidas:» de la Política de privacidad que también se guardan los alimentos
personalizados del usuario y los que marca como favoritos, y SHALL poner como fecha de actualización la del cambio.

- **AC-021.1:** Given la Política de privacidad, When se muestra, Then el punto «Diario de comidas:» menciona los
  alimentos personalizados que guardas y tus favoritos, y su fecha de actualización ya no es «22 de octubre de 2026».

## 5. Requisitos no funcionales

### NFR-001 — Sin proveedores externos ni límite de uso
THE SYSTEM SHALL resolver la búsqueda conjunta, los recientes y los favoritos solo con los datos de la base, sin llamar
al proveedor de embeddings ni a ningún otro servicio externo y sin límite de uso por usuario.

- **AC-N001.1:** Given un proveedor de embeddings simulado, When se hacen búsquedas conjuntas válidas, Then no se le pide
  ninguna representación.
- **AC-N001.2:** Given un usuario que hace 60 búsquedas conjuntas válidas en un minuto, When hace la 60, Then recibe 200.

### NFR-002 — Accesibilidad
THE SYSTEM SHALL mantener la accesibilidad de la 023 en la búsqueda compartida: caja con nombre «Buscar alimento»,
estados anunciados en una región que leen los lectores de pantalla, listas con nombre y botones con el nombre del
alimento; el botón de favorito SHALL indicar su estado pulsado.

- **AC-N002.1:** Given la búsqueda compartida con resultados, favoritos y recientes, When se consulta por rol, Then hay
  un campo de búsqueda «Buscar alimento», las listas «Resultados», «Favoritos» y «Recientes» y, por alimento, los
  botones «Elegir {nombre}» y el de favorito con `aria-pressed` acorde a su estado.
- **AC-N002.2:** Given los estados «Buscando…», sin resultados, error y error de carga de tus alimentos, When aparecen,
  Then están dentro de una región que se anuncia a los lectores de pantalla.

### NFR-003 — Lint de la propuesta
THE SYSTEM SHALL dejar la propuesta de foto sin el aviso `react(incompatible-library)` de `npm run lint`, sin introducir
errores de lint.

- **AC-N003.1:** Given el frontend tras el cambio, When se ejecuta `npm run lint`, Then no aparece ningún aviso
  `incompatible-library` en `PhotoReview.tsx` y no hay errores.

## 6. Datos y contratos visibles

**Alimento propio (biblioteca del usuario):**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | entero | Identificador del alimento propio (`custom_food_id`). |
| `name` | texto | Último nombre con que se registró, tal como queda en la comida (sin espacios en los extremos, como en la 022), de 1 a 100 caracteres. |
| `per_100g` | objeto | Los cuatro valores por 100 g, con los límites y mensajes de los personalizados de la 022. |

Dos alimentos propios de un mismo usuario no pueden tener el mismo nombre comparado sin mayúsculas, sin tildes, sin
espacios en los extremos y con los espacios repetidos contados como uno. Máximo 500 por usuario.

**Resultado de la biblioteca** (búsqueda conjunta, recientes y favoritos):

```json
{
  "kind": "catalog",
  "id": "arroz-blanco-cocido",
  "name": "Arroz blanco cocido",
  "per_100g": { "calories_kcal": 130.0, "protein_g": 2.69, "carbs_g": 28.17, "fat_g": 0.28 },
  "favorite": false
}
```

```json
{
  "kind": "custom",
  "id": 12,
  "name": "Gallo pinto",
  "per_100g": { "calories_kcal": 180.0, "protein_g": 6.0, "carbs_g": 30.0, "fat_g": 4.0 },
  "favorite": true
}
```

`kind` es `"catalog"` (con `id` de texto del catálogo) o `"custom"` (con `id` entero). En los recientes cada resultado
lleva además `last_grams` (número con un decimal como mucho).

**Endpoints nuevos** (todos requieren `Authorization: Bearer {token}`; 401 sin sesión válida):

| Petición | Respuesta correcta | Errores |
|---|---|---|
| `GET /api/food-library/search?q={consulta}` | 200 `{"results": [...]}`, hasta 20, orden de REQ-007 | 400 con los mensajes de consulta de la 023 |
| `GET /api/food-library/recent` | 200 `{"results": [...]}`, hasta 10, con `last_grams` | — |
| `GET /api/food-library/favorites` | 200 `{"results": [...]}`, todos, por nombre | — |
| `PUT /api/food-library/favorites/catalog/{catalog_id}` | 204 | 404 `No encontramos ese alimento.`; 400 `Ya tienes 100 favoritos. Quita alguno para añadir otro.` |
| `PUT /api/food-library/favorites/custom/{custom_food_id}` | 204 | ídem |
| `DELETE /api/food-library/favorites/catalog/{catalog_id}` | 204 (también si no era favorito) | 404 `No encontramos ese alimento.` |
| `DELETE /api/food-library/favorites/custom/{custom_food_id}` | 204 (también si no era favorito) | ídem |
| `DELETE /api/food-library/custom/{custom_food_id}` | 204 | 404 `No encontramos ese alimento.` |

**Cambios en `/api/meals`:**
- `POST /api/meals` acepta en `items` un cuarto tipo: `{"custom_food_id": entero, "grams": número}`. Cada alimento trae
  exactamente uno de `catalog_id`, `fdc_id`, `name` y `custom_food_id`; si no, 400 `Cada alimento debe ser del catálogo,
  de USDA o personalizado.` (mismo mensaje que la 023).
- Un personalizado con `name` se guarda o actualiza en la biblioteca (REQ-001).
- Cada alimento de las respuestas de `/api/meals` (diario, `POST`, `PATCH` y `POST /api/meals/restore`) lleva un campo
  nuevo, `custom_food_id` (entero o `null`): el del alimento propio vinculado en los `source: "custom"`, y `null` en los
  demás o si ese alimento propio se borró.

| Caso | Código | Mensaje |
|---|---|---|
| `custom_food_id` que no existe, de otro usuario o no válido | 400 | `No encontramos ese alimento.` |
| Personalizado con nombre nuevo y 500 alimentos propios | 400 | `Ya tienes 500 alimentos propios. Borra alguno para crear otro.` |

**`GET /api/catalog/search`:** mismo contrato que la 023; solo cambian las reglas de coincidencia (REQ-006).

**Pantallas (diálogo «Añadir a {sección}» y búsquedas de la propuesta):**

| Elemento | Texto |
|---|---|
| Caja de búsqueda | Etiqueta «Buscar alimento», ejemplo «Ej.: arroz blanco cocido, banano»; sin botón «Buscar» |
| Listas con la caja vacía | Encabezados «Favoritos» y «Recientes»; sin ninguno: «Busca un alimento para ver sus calorías y macros por 100 g.» |
| Error al cargar tus alimentos | «No se pudieron cargar tus alimentos.» con «Reintentar» |
| Alimento en una lista | Nombre; «Personalizado» si es propio; «{n} kcal», «{g} g proteína», «{g} g carbohidratos», «{g} g grasa» por 100 g; «Elegir» («Elegir {nombre}»); favorito («Añadir {nombre} a favoritos» / «Quitar {nombre} de favoritos»); en los propios, «Borrar» («Borrar {nombre} de tus alimentos») |
| Error de favorito | «No se pudo actualizar tus favoritos.» (o el mensaje del servidor si es el límite) |
| Confirmación de borrado | Título «¿Borrar «{nombre}» de tus alimentos?»; texto «Las comidas ya registradas no cambian.»; botones «Borrar» y «Cancelar» |
| Error de borrado | «No se pudo borrar el alimento.» |
| Aviso del formulario personalizado | «Se guardará en tus alimentos para usarlo otro día. Si ya tienes uno con el mismo nombre, se actualizarán sus valores.» |
| Gramos al elegir | Desde «Recientes», sus `last_grams`; desde resultados o «Favoritos», 100; al resolver un alimento sin coincidencia de la propuesta, sus gramos |

Los demás textos («Buscando…», sin resultados, «No se pudo completar la búsqueda.», avisos de validación de la consulta,
formulario personalizado, propuesta) son los de las specs 021 a 026.

**Política de privacidad:** «Diario de comidas:» añade los alimentos personalizados que el usuario guarda y los que marca
como favoritos; fecha de actualización, la del cambio.

**Producción:** una migración aditiva que crea la biblioteca, los favoritos y el vínculo de los alimentos registrados, y
que rellena la biblioteca desde los personalizados existentes (REQ-005); no se aplica sola. Sin variables nuevas.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Cuándo se guarda un personalizado en «tus alimentos»: siempre, o solo si el usuario marca una casilla? ¿Y si ya hay uno con el mismo nombre? | Siempre, sin casilla, con el aviso de AC-016.2. Si el nombre coincide (sin mayúsculas, tildes ni espacios sobrantes), se actualizan sus valores con los nuevos; así se «edita» un alimento propio sin pantalla de edición (REQ-001). | acepto todas las respuestas propuestas |
| Q2 | ¿Qué pasa con los personalizados que ya están registrados en el diario? | La migración crea un alimento propio por cada nombre distinto de cada usuario, con los valores de su registro más reciente, y los vincula (REQ-005). Así «Gallo pinto» ya aparece en la búsqueda y en recientes desde el primer día. | acepto todas las respuestas propuestas |
| Q3 | Límites: ¿cuántos alimentos propios, favoritos y recientes? | 500 alimentos propios (al pasarse, 400 y no se guarda la comida), 100 favoritos y 10 recientes (REQ-002, REQ-008, REQ-009). | acepto todas las respuestas propuestas |
| Q4 | ¿Qué gestión tienen los alimentos propios? | Solo borrar, con confirmación, desde la búsqueda, «Favoritos» y «Recientes» (REQ-017). Editar se hace volviendo a crear con el mismo nombre; una pantalla «Mis alimentos» queda fuera de alcance. | acepto todas las respuestas propuestas |
| Q5 | ¿Cómo es la tolerancia a erratas? | Distancia de edición de 1 en palabras de 4 a 7 letras y de 2 en las de 8 o más, comparando también con el inicio de la palabra; solo si la búsqueda normal no encuentra nada, y ordenada por distancia. Se añade el plural «-ces» → «z». Vale también para `GET /api/catalog/search` (REQ-006). | acepto todas las respuestas propuestas |
| Q6 | ¿Cómo funciona la búsqueda mientras se escribe? | 300 ms después de la última tecla, desde 2 caracteres; Intro busca en el momento; se quita el botón «Buscar»; sin avisos de validación mientras se escribe, solo al pulsar Intro (REQ-013). | acepto todas las respuestas propuestas |
| Q7 | La pantalla `FoodsPage` (USDA, sin ruta desde la 023), ¿se adapta al componente compartido o se retira? | Se retira su código (pantalla, lista de resultados de USDA y su hook); `/foods` sigue redirigiendo a `/diary` y `GET /api/foods/search` se conserva sin cambios (REQ-020). | acepto todas las respuestas propuestas |
| Q8 | Al elegir un alimento de «Recientes», ¿qué gramos se proponen? | Los de su registro más reciente (`last_grams`); desde resultados o «Favoritos», 100 g (AC-014.5). | acepto todas las respuestas propuestas |
| Q9 | ¿Qué cuenta como «reciente»? | Los 10 últimos alimentos distintos del catálogo o propios que siguen en el diario, por el momento en que se añadieron (no por la fecha de la comida); sin USDA, sin alimentos retirados del catálogo ni propios borrados (REQ-008). | acepto todas las respuestas propuestas |
| Q10 | ¿Se avisa en la Política de privacidad? | Sí: «Diario de comidas:» menciona los alimentos personalizados guardados y los favoritos, con la fecha nueva (REQ-021). | acepto todas las respuestas propuestas |

**Estado:** las diez preguntas están resueltas; el usuario aceptó todas las propuestas por defecto. Ya estaban
recogidas en la spec y quedan así:

- Q1 → REQ-001 (AC-001.1 a AC-001.10) y AC-016.2.
- Q2 → REQ-005.
- Q3 → REQ-002, REQ-008 y REQ-009.
- Q4 → REQ-004, REQ-017 y «Fuera de alcance».
- Q5 → REQ-006 y AC-006.12.
- Q6 → REQ-013.
- Q7 → REQ-020 y «Fuera de alcance».
- Q8 → AC-014.5, AC-018.3 y AC-018.5.
- Q9 → REQ-008.
- Q10 → REQ-021.

No quedan preguntas abiertas.

## 8. Glosario

- **Alimento propio / tus alimentos:** alimento personalizado guardado en la biblioteca del usuario para reutilizarlo;
  se identifica por `custom_food_id`.
- **Biblioteca:** el conjunto de alimentos propios de un usuario.
- **Reciente:** alimento del catálogo o propio que el usuario tiene registrado en su diario, entre los 10 últimos
  distintos.
- **Favorito:** alimento del catálogo o propio que el usuario marcó para tenerlo a mano.
- **Búsqueda conjunta:** búsqueda a la vez en el catálogo y en los alimentos propios del usuario.
- **Distancia de edición:** número mínimo de operaciones de una letra (insertar, borrar, cambiar o intercambiar dos
  contiguas) para pasar de un texto a otro.
- **Búsqueda compartida:** el mismo componente de búsqueda en el diálogo de añadir y en la propuesta de foto.
