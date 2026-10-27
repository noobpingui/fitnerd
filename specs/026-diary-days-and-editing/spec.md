# Spec 026 — Diario: navegar entre días, editar días pasados y pulir la edición

- **Feature:** `026-diary-days-and-editing` · **Tipo:** feature
- **Ámbitos:** backend, frontend

## 1. Contexto y problema

El diario de comidas (specs 022 a 025) solo muestra el día de hoy. Si el usuario olvida registrar la cena de ayer, no
puede hacerlo desde la pantalla, y el servidor solo deja añadir alimentos a fechas entre el día anterior y el siguiente
a la de su reloj (ventana pensada para absorber la diferencia de huso, no para editar el pasado). Además:

- si la pantalla queda abierta al pasar la medianoche, sigue mostrando el día anterior;
- no se puede borrar una comida entera desde la pantalla, aunque la API ya lo permite;
- quitar un alimento por error obliga a buscarlo y añadirlo otra vez;
- al superar un objetivo, la barra solo se llena, con el mismo color que cuando falta, y el único aviso es el texto
  «X por encima del objetivo»;
- cerrar el diálogo de foto con una propuesta la descarta sin preguntar, aunque el análisis ya contó para el límite de
  10 por hora.

Esta spec sustituye, de la 022, el mensaje y los límites de REQ-004 (AC-004.2), la decisión Q5 («solo hoy en la
pantalla»), el texto de AC-010.3 para días distintos de hoy y el aspecto de la barra de AC-014.2; y de la 025, REQ-013
(cerrar con una propuesta sin pedir confirmación). Lo demás de esas specs se mantiene.

## 2. Historia de usuario

Como **usuario con sesión que lleva su diario de comidas**, quiero **moverme entre los días, corregir lo que registré
en días pasados, borrar una comida entera, deshacer un alimento quitado por error y ver de un vistazo qué objetivo he
superado** para **mantener el diario completo y correcto sin miedo a perder datos**.

## 3. Alcance

**Incluye:**
- Ampliar la ventana de fechas en la que el servidor deja añadir alimentos: desde 366 días antes hasta 1 día después de
  la fecha de su reloj, con un mensaje de error nuevo.
- En la pantalla «Diario»: botones de día anterior y siguiente, un botón «Hoy», un selector de fecha y el día mostrado
  en la dirección de la página, desde 365 días antes de hoy hasta hoy (fecha local del dispositivo).
- En cualquier día mostrado: añadir alimentos (del catálogo, personalizados o con foto), editar gramos, quitar
  alimentos y borrar comidas, todo sobre ese día.
- Que la pantalla pase sola al nuevo día al llegar la medianoche si estaba mostrando hoy.
- Botón para borrar una comida entera, con confirmación.
- «Deshacer» durante 10 segundos tras quitar un alimento.
- Barras de progreso en ámbar al superar el objetivo, en las cuatro (calorías, proteína, carbohidratos y grasa).
- Confirmación antes de descartar una propuesta del análisis de foto.

**Fuera de alcance:**
- Objetivos históricos: todos los días se comparan con el objetivo actual de Macros, calculado con el perfil de hoy.
- Registrar comidas de días futuros desde la pantalla (más allá de la tolerancia de 1 día del servidor).
- Ver o editar desde la pantalla días de hace más de 365 días (la API los sigue permitiendo para consultar, editar y
  quitar, como en la 022).
- Deshacer el borrado de una comida entera (se pide confirmación antes) y deshacer cambios de gramos.
- Calendario con marcas de los días que tienen registros, resúmenes semanales o copiar una comida a otro día.
- Cambios en el modelo de datos: no hay migración.
- Cambios en `POST /api/meals/analyze` y en el límite de 10 análisis por hora.

## 4. Requisitos funcionales

### REQ-001 — Ventana de fechas al añadir alimentos
THE SYSTEM SHALL aceptar al añadir alimentos (`POST /api/meals`) cualquier fecha `date` desde 366 días antes hasta 1 día
después de la fecha actual del reloj del servidor, ambos incluidos. IF la fecha está fuera de esa ventana THEN THE
SYSTEM SHALL responder 400 con `{"error": "Solo puedes registrar comidas de hoy o del último año."}` sin guardar nada.

- **AC-001.1:** Given el reloj del servidor fijado en 2026-10-21 03:00 (UTC), When se añade un alimento con
  `date: "2025-10-20"`, `"2026-01-15"`, `"2026-10-21"` o `"2026-10-22"`, Then la respuesta es 201 (o 200 si la comida
  ya existía) y el alimento queda en la comida de esa fecha.
- **AC-001.2:** Given el reloj del servidor fijado en 2026-10-21 03:00 (UTC), When se añade un alimento con
  `date: "2025-10-19"` o `"2026-10-23"`, Then la respuesta es 400 con
  `{"error": "Solo puedes registrar comidas de hoy o del último año."}` y no se guarda nada.
- **AC-001.3:** Given una petición con `date` ausente, `"20-10-2026"` o `"2026-02-30"`, When se pide `POST /api/meals`,
  Then la respuesta sigue siendo 400 con `{"error": "La fecha no es válida."}`.
- **AC-001.4:** Given una comida de una fecha de hace 200 días, When el usuario cambia los gramos de uno de sus
  alimentos o lo quita, Then la operación funciona igual que en un día de hoy (sin límite de fecha, como en la 022).

### REQ-002 — Navegar entre días
THE SYSTEM SHALL mostrar en la pantalla «Diario» un día cada vez y SHALL ofrecer los botones «Día anterior» y «Día
siguiente», un botón «Hoy» y un selector de fecha para cambiar el día mostrado, limitados al intervalo desde 365 días
antes de hoy hasta hoy (fecha local del dispositivo). WHEN cambia el día mostrado THE SYSTEM SHALL pedir el diario de
ese día y mostrar su fecha, sus comidas y sus totales.

- **AC-002.1:** Given el dispositivo en 2026-10-26 y la pantalla en hoy, When el usuario pulsa «Día anterior», Then se
  ve «domingo, 25 de octubre», el diario se pide con la fecha `2026-10-25` y se muestran las comidas y los totales de
  ese día.
- **AC-002.2:** Given la pantalla en 2026-10-25 con el dispositivo en 2026-10-26, When el usuario pulsa «Día
  siguiente», Then se ve «lunes, 26 de octubre» y el diario se pide con `2026-10-26`.
- **AC-002.3:** Given la pantalla en hoy, When se muestra, Then el botón «Día siguiente» está deshabilitado y el botón
  «Hoy» no se muestra.
- **AC-002.4:** Given la pantalla en un día distinto de hoy, When el usuario pulsa «Hoy», Then se muestra el día de hoy.
- **AC-002.5:** Given el dispositivo en 2026-10-26 y la pantalla en 2025-10-26, When se muestra, Then el botón «Día
  anterior» está deshabilitado.
- **AC-002.6:** Given el dispositivo en 2026-10-26, When el usuario elige en el selector de fecha 2026-03-10, Then se
  muestra ese día; y el selector no deja elegir fechas anteriores a 2025-10-26 ni posteriores a 2026-10-26.
- **AC-002.7:** Given el dispositivo en 2026-10-26 y la pantalla en 2025-12-31, When se muestra, Then la fecha se ve
  con el año: «miércoles, 31 de diciembre de 2025»; los días del año en curso se muestran sin año.
- **AC-002.8:** Given un día distinto de hoy sin comidas, When se muestra, Then se ve «No hay nada registrado este día.»;
  y en hoy sin comidas sigue viéndose «Todavía no has registrado nada hoy.».
- **AC-002.9:** Given la respuesta del diario de 2026-10-24 retrasada, When el usuario pasa a 2026-10-23 y llega antes
  la de 2026-10-23, Then al final la pantalla muestra la fecha, las comidas y los totales de 2026-10-23, nunca los de
  2026-10-24.
- **AC-002.10:** Given un día que se está cargando o cuya carga falló, When se muestra la pantalla, Then los controles
  de navegación siguen visibles y usables, junto a «Cargando el diario…» o al error con «Reintentar».

### REQ-003 — Día mostrado en la dirección de la página
THE SYSTEM SHALL reflejar el día mostrado en la dirección de la página como `/diary?date=AAAA-MM-DD`, sin parámetro
cuando el día es hoy, y SHALL abrir la pantalla en el día que indique ese parámetro. IF el parámetro no es una fecha
válida o está fuera del intervalo de REQ-002 THEN THE SYSTEM SHALL mostrar hoy y quitar el parámetro de la dirección.

- **AC-003.1:** Given el dispositivo en 2026-10-26, When el usuario abre `/diary?date=2026-10-20`, Then se muestra el
  martes 20 de octubre y el diario se pide con `2026-10-20`.
- **AC-003.2:** Given la pantalla en hoy, When el usuario pasa al día anterior, Then la dirección es
  `/diary?date=2026-10-25`; y al volver a hoy, la dirección es `/diary`, sin parámetro.
- **AC-003.3:** Given el dispositivo en 2026-10-26, When el usuario abre `/diary?date=2026-02-30`,
  `/diary?date=ayer`, `/diary?date=2026-10-27` o `/diary?date=2025-10-25`, Then se muestra hoy y la dirección queda
  `/diary`.
- **AC-003.4:** Given el usuario en 2026-10-20, When pasa a 2026-10-19 y después a 2026-10-18, Then el historial del
  navegador no gana una entrada por cada día (el botón «Atrás» del navegador sale del diario, no recorre los días).

### REQ-004 — Editar el día mostrado
WHILE la pantalla muestra un día THE SYSTEM SHALL aplicar a ese día todas las acciones del diario: «Añadir alimento»,
«Cargar imagen», «Editar», «Quitar» y «Borrar comida», con las mismas reglas que en hoy.

- **AC-004.1:** Given la pantalla en 2026-10-20, When el usuario añade un alimento del catálogo a «Cena», Then la
  petición de guardar lleva `date: "2026-10-20"` y, tras guardarse, la cena de ese día lo muestra y los totales de ese
  día cambian.
- **AC-004.2:** Given la pantalla en 2026-10-20, When el usuario guarda la propuesta de una foto en «Almuerzo», Then se
  guarda en el almuerzo del 2026-10-20.
- **AC-004.3:** Given la pantalla en 2026-10-20 con un alimento en «Desayuno», When el usuario cambia sus gramos o lo
  quita, Then el desayuno de ese día muestra el cambio y el diario de hoy no cambia.
- **AC-004.4:** Given un diálogo de añadir abierto en 2026-10-20, When el servidor responde 400 con
  «Solo puedes registrar comidas de hoy o del último año.», Then el diálogo muestra ese mensaje y no se cierra.

### REQ-005 — Cambio de día a medianoche
WHILE la pantalla muestra el día de hoy WHEN la fecha local del dispositivo cambia THE SYSTEM SHALL mostrar el nuevo
día, como mucho un minuto después de la medianoche o en cuanto la pestaña vuelva a estar visible. WHILE la pantalla
muestra otro día THE SYSTEM SHALL seguir mostrándolo y SHALL actualizar los límites de navegación al nuevo hoy.

- **AC-005.1:** Given el dispositivo en 2026-10-26 23:59:30 y la pantalla en hoy, When el reloj pasa a 2026-10-27
  00:01, Then se ve «martes, 27 de octubre» y el diario se pide con `2026-10-27`.
- **AC-005.2:** Given la pantalla en hoy y la pestaña oculta desde 2026-10-26 22:00, When vuelve a estar visible el
  2026-10-27 a las 08:00, Then se muestra el 27 de octubre sin esperar.
- **AC-005.3:** Given el dispositivo en 2026-10-26 23:59:30 y la pantalla en 2026-10-20, When el reloj pasa a
  2026-10-27 00:01, Then sigue mostrándose el 20 de octubre y «Día siguiente» lleva hasta el 27 de octubre.
- **AC-005.4:** Given la pantalla en hoy (2026-10-26) con el diálogo «Añadir a Cena» abierto, When pasa la medianoche
  y después el usuario guarda, Then el diálogo no se cierra por el cambio de día y el alimento se guarda con
  `date: "2026-10-26"`, el día en que se abrió.

### REQ-006 — Borrar una comida entera
WHERE una sección del día tiene alimentos THE SYSTEM SHALL mostrar el botón «Borrar comida». WHEN el usuario lo pulsa
THE SYSTEM SHALL pedir confirmación y, solo si confirma, borrar la comida con todos sus alimentos y volver a leer el
diario del día.

- **AC-006.1:** Given «Cena» con 3 alimentos, When se muestra, Then hay un botón «Borrar comida» con nombre accesible
  «Borrar Cena»; y una sección sin alimentos no lo muestra.
- **AC-006.2:** Given «Cena» del 2026-10-20 con 3 alimentos, When el usuario pulsa «Borrar comida», Then se abre una
  confirmación con el título «¿Borrar Cena?», el texto «Se quitarán los 3 alimentos de Cena. No se puede deshacer.» y
  los botones «Borrar» y «Cancelar»; con 1 alimento, el texto es «Se quitará el alimento de Cena. No se puede
  deshacer.».
- **AC-006.3:** Given la confirmación abierta, When el usuario pulsa «Borrar», Then se pide borrar esa comida, la
  sección muestra «Sin alimentos.» y los totales del día ya no incluyen sus alimentos.
- **AC-006.4:** Given la confirmación abierta, When el usuario pulsa «Cancelar» o la cierra, Then no se hace ninguna
  petición y la comida sigue igual.
- **AC-006.5:** Given la confirmación abierta, When el borrado falla por un error de red o del servidor, Then la
  confirmación sigue abierta con «No se pudo borrar la comida. Vuelve a intentarlo.» y la comida no cambia.
- **AC-006.6:** Given una comida ya borrada desde otra pestaña, When el usuario confirma el borrado y el servidor
  responde 404, Then no se muestra error, la confirmación se cierra y el diario se vuelve a leer.
- **AC-006.7:** Given un borrado en curso, When aún no llega la respuesta, Then el botón «Borrar» está deshabilitado y
  no se envía una segunda petición.

### REQ-007 — Deshacer al quitar un alimento
WHEN el usuario quita un alimento THE SYSTEM SHALL quitarlo del diario y mostrar durante 10 segundos el aviso
«Quitaste {nombre}.» con el botón «Deshacer». WHEN el usuario pulsa «Deshacer» THE SYSTEM SHALL devolver el alimento a
la misma comida y día, en la misma posición y con el mismo nombre, gramos, valores por 100 g y nutrientes que tenía.

- **AC-007.1:** Given «Desayuno» con «Avena cocida», «Plátano» y «Leche entera», When el usuario quita «Plátano»,
  Then desaparece de la lista, los totales se actualizan y en esa sección se ve «Quitaste Plátano.» con «Deshacer».
- **AC-007.2:** Given el aviso de AC-007.1, When se vuelve a leer el diario desde el servidor, Then «Plátano» ya no
  está (el alimento se quita de verdad al pulsar «Quitar», no al terminar el aviso).
- **AC-007.3:** Given el aviso de AC-007.1, When el usuario pulsa «Deshacer», Then «Plátano» vuelve a aparecer entre
  «Avena cocida» y «Leche entera», con los mismos gramos, calorías y macros, los totales vuelven a los de antes y el
  aviso desaparece.
- **AC-007.4:** Given un alimento personalizado o del catálogo quitado, When se deshace, Then se restauran los valores
  por 100 g que tenía guardados, aunque el catálogo haya cambiado desde entonces.
- **AC-007.5:** Given «Cena» con un solo alimento, When el usuario lo quita y pulsa «Deshacer», Then la cena vuelve a
  existir con ese alimento.
- **AC-007.6:** Given el aviso visible, When pasan 10 segundos sin pulsar «Deshacer», Then el aviso desaparece y el
  alimento queda quitado.
- **AC-007.7:** Given el aviso de un alimento quitado, When el usuario quita otro alimento (de cualquier sección), Then
  el aviso pasa a ser el del segundo y el primero ya no se puede deshacer.
- **AC-007.8:** Given el aviso visible, When el usuario cambia de día o sale de la pantalla, Then el aviso desaparece
  y el alimento queda quitado.
- **AC-007.9:** Given el aviso visible, When «Deshacer» falla por un error de red o del servidor, Then se ve «No se pudo
  deshacer. Vuelve a intentarlo.» y el botón «Deshacer» sigue disponible hasta que termine el aviso.
- **AC-007.10:** Given que tras quitar el alimento la comida llegó a 50 alimentos, When el usuario pulsa «Deshacer»,
  Then se ve «Una comida no puede tener más de 50 alimentos.» y no se restaura nada.
- **AC-007.11:** Given un «Deshacer» en curso, When aún no llega la respuesta, Then el botón «Deshacer» está
  deshabilitado y no se envía una segunda petición.

### REQ-008 — Aviso ámbar al superar un objetivo
WHEN el total del día de calorías, proteína, carbohidratos o grasa supera su objetivo THE SYSTEM SHALL mostrar su barra
de progreso llena y en color ámbar de aviso, en lugar del color principal, sin iconos, alertas emergentes ni el color
rojo de error, manteniendo el texto «X por encima del objetivo».

- **AC-008.1:** Given un total de 2150 kcal frente a un objetivo de 2000, When se muestra, Then se ve
  «2150 / 2000 kcal» con «150 kcal por encima del objetivo» y la barra de calorías llena y en ámbar.
- **AC-008.2:** Given proteína 160 g frente a 150 g, carbohidratos 210 g frente a 200 g y grasa 70 g frente a 67 g,
  When se muestra, Then las tres barras están en ámbar, cada una con su texto «… por encima del objetivo».
- **AC-008.3:** Given un total igual al objetivo (2000 / 2000 kcal) o por debajo, When se muestra, Then la barra usa
  el color principal, no el ámbar, y se ve «Quedan 0 kcal» o lo que quede.
- **AC-008.4:** Given un objetivo superado, When se muestra, Then no aparece ningún elemento con rol `alert` por esa
  causa ni ningún texto o barra con el color de error.

### REQ-009 — Confirmar antes de descartar una propuesta de foto
WHEN el usuario pulsa «Cancelar», pulsa Escape o pulsa fuera del diálogo de foto mientras se muestra una propuesta sin
guardar THE SYSTEM SHALL pedir confirmación antes de cerrarlo y SHALL cerrarlo sin guardar nada solo si confirma.

- **AC-009.1:** Given una propuesta en pantalla, When el usuario pulsa «Cancelar», Then se ve la confirmación
  «¿Descartar la propuesta?» con el texto «Perderás los alimentos propuestos. El análisis ya cuenta para el límite de
  10 por hora.» y los botones «Descartar» y «Seguir revisando», y el diálogo de foto sigue abierto.
- **AC-009.2:** Given la confirmación, When el usuario pulsa «Descartar», Then el diálogo se cierra, no se hace
  ninguna petición para guardar y el diario no cambia.
- **AC-009.3:** Given la confirmación, When el usuario pulsa «Seguir revisando» o pulsa Escape, Then vuelve a la
  propuesta con todo lo que había editado (gramos cambiados, alimentos quitados o añadidos).
- **AC-009.4:** Given una propuesta en pantalla, When el usuario pulsa Escape o pulsa fuera del diálogo, Then se ve la
  misma confirmación en lugar de cerrarse.
- **AC-009.5:** Given el diálogo sin foto, con una foto sin analizar, con un análisis en curso, con un error del
  análisis o con «No reconocimos alimentos en la foto.», When el usuario pulsa «Cancelar», Then se cierra sin pedir
  confirmación, como en la 025.
- **AC-009.6:** Given una propuesta que se está guardando, When el usuario intenta cerrar el diálogo, Then no se cierra
  ni se pide confirmación (como en la 025); y tras guardar bien, se cierra sin pedir confirmación.

## 5. Requisitos no funcionales

### NFR-001 — Accesibilidad de los controles nuevos
THE SYSTEM SHALL dar nombre accesible a los controles nuevos, anunciar el aviso de «Deshacer» sin robar el foco y
presentar las confirmaciones como diálogos accesibles.

- **AC-N001.1:** Given la pantalla «Diario», When se inspeccionan los controles de navegación, Then los botones tienen
  los nombres accesibles «Día anterior», «Día siguiente» y «Hoy», y el selector de fecha tiene la etiqueta «Elegir
  día».
- **AC-N001.2:** Given un alimento quitado, When aparece el aviso «Quitaste {nombre}.», Then está en una región con rol
  `status` y el foco no se mueve al aviso.
- **AC-N001.3:** Given la confirmación de borrar una comida o de descartar una propuesta, When se abre, Then es un
  diálogo con rol `alertdialog` cuyo nombre accesible es su título y el foco queda dentro de él.

### NFR-002 — Aislamiento entre usuarios
THE SYSTEM SHALL permitir añadir, borrar y restaurar alimentos solo en comidas del usuario de la sesión.

- **AC-N002.1:** Given una comida del usuario B, When el usuario A pide borrarla, Then recibe 404 con
  `{"error": "No encontramos esa comida."}` y la comida de B sigue intacta.
- **AC-N002.2:** Given un alimento que quitó el usuario B, When el usuario A intenta restaurarlo en una comida de B,
  Then no se restaura nada en las comidas de B y A recibe un error 404.
- **AC-N002.3:** Given una petición sin sesión, When se intenta añadir, borrar o restaurar, Then recibe 401 y no cambia
  nada.

## 6. Datos y contratos visibles

**Ventana de fechas al añadir (`POST /api/meals`):** desde la fecha del reloj del servidor menos 366 días hasta la
misma más 1 día, ambos incluidos. `GET /api/meals?date=`, `PATCH /api/meals/{id}/items/{item_id}`,
`DELETE /api/meals/{id}/items/{item_id}` y `DELETE /api/meals/{id}` siguen sin límite de fecha.

**Intervalo navegable en la pantalla:** desde la fecha local del dispositivo menos 365 días hasta esa fecha, ambos
incluidos.

**Dirección de la página:** `/diary` (hoy) o `/diary?date=AAAA-MM-DD` (otro día del intervalo). Cambiar de día
sustituye la entrada actual del historial, no añade una nueva.

**Formato de la fecha mostrada:** día de la semana, día y mes en español («lunes, 26 de octubre»); con « de AAAA» al
final si el año no es el actual.

**Restaurar un alimento quitado:** si la API necesita un contrato nuevo para deshacer, lo define el plan; el alimento
restaurado conserva nombre, origen (catálogo, USDA o personalizado), gramos, valores por 100 g, nutrientes y posición,
y queda en la comida del mismo usuario, día y tipo.

**Textos y mensajes:**

| Situación | Dónde | Texto |
|---|---|---|
| Fecha fuera de la ventana al añadir | API (400) y diálogo | `Solo puedes registrar comidas de hoy o del último año.` |
| Día distinto de hoy sin comidas | Pantalla | `No hay nada registrado este día.` |
| Hoy sin comidas | Pantalla | `Todavía no has registrado nada hoy.` (sin cambios) |
| Botones de navegación | Pantalla | `Día anterior`, `Día siguiente`, `Hoy`; selector `Elegir día` |
| Botón de borrar | Sección con alimentos | `Borrar comida` (nombre accesible `Borrar {sección}`) |
| Confirmación de borrar | Diálogo | Título `¿Borrar {sección}?`; texto `Se quitarán los {n} alimentos de {sección}. No se puede deshacer.` o, con uno, `Se quitará el alimento de {sección}. No se puede deshacer.`; botones `Borrar` y `Cancelar` |
| Fallo al borrar | Confirmación | `No se pudo borrar la comida. Vuelve a intentarlo.` |
| Alimento quitado | Sección | `Quitaste {nombre}.` con el botón `Deshacer` (10 segundos) |
| Fallo al deshacer | Sección | `No se pudo deshacer. Vuelve a intentarlo.` |
| Deshacer con la comida llena | Sección | `Una comida no puede tener más de 50 alimentos.` |
| Confirmación de descartar | Diálogo de foto | Título `¿Descartar la propuesta?`; texto `Perderás los alimentos propuestos. El análisis ya cuenta para el límite de 10 por hora.`; botones `Descartar` y `Seguir revisando` |

**Barras de progreso:** color principal mientras el total no supera el objetivo; ámbar de aviso (no el rojo de error)
cuando lo supera, en las cuatro barras.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Hasta qué fecha pasada se puede navegar y añadir? | Como Métricas (spec 016): la pantalla llega a 365 días antes de hoy y el servidor acepta hasta 366 antes de su fecha (tolerancia de huso) y 1 después. Mensaje fuera de ventana: «Solo puedes registrar comidas de hoy o del último año.» (REQ-001, REQ-002). | Todas las propuestas |
| Q2 | ¿El día mostrado va en la dirección de la página, para que recargar o compartir el enlace conserve el día? | Sí, `/diary?date=AAAA-MM-DD`, sin parámetro en hoy; cambiar de día no añade entradas al historial del navegador; un parámetro inválido o fuera del intervalo muestra hoy (REQ-003). | Todas las propuestas |
| Q3 | ¿Además de «Día anterior» y «Día siguiente», hay botón «Hoy» y selector de fecha? | Sí a los dos: «Hoy» solo cuando no se está en hoy, y un selector de fecha nativo limitado al intervalo (REQ-002). | Todas las propuestas |
| Q4 | ¿Cómo funciona «Deshacer»? | Aviso «Quitaste {nombre}.» con «Deshacer» durante 10 segundos en la sección; solo se puede deshacer el último alimento quitado; el alimento se quita de verdad al pulsar «Quitar» y «Deshacer» lo devuelve en la misma posición y con los valores que tenía guardados (REQ-007). | Todas las propuestas |
| Q5 | ¿Borrar una comida entera se puede deshacer? | No: se pide confirmación antes, con el texto «No se puede deshacer.» (REQ-006). | Todas las propuestas |
| Q6 | ¿Qué hace el cambio de medianoche si se está viendo otro día o hay un diálogo abierto? | Solo cambia si se está viendo hoy; en otro día se queda en ese día. Un diálogo abierto no se cierra y guarda en el día en que se abrió (REQ-005). | Todas las propuestas |
| Q7 | Aviso al superar un objetivo: ¿qué cambia exactamente? | Las cuatro barras pasan a ámbar al superar su objetivo (no al igualarlo); el texto «X por encima del objetivo» se mantiene; sin iconos, alertas ni rojo (REQ-008). | Todas las propuestas |
| Q8 | ¿Cuándo se pide confirmación al cerrar el diálogo de foto? | Solo cuando hay una propuesta sin guardar en pantalla, al pulsar «Cancelar», Escape o fuera del diálogo; en los demás estados se cierra como en la 025 (REQ-009). | Todas las propuestas |

**Estado:** Q1 a Q8 resueltas. El usuario aceptó todas las propuestas por defecto, que ya están en REQ-001 a REQ-009
y en la sección 6. No quedan preguntas abiertas.

## 8. Glosario

- **Día mostrado:** el día cuyo diario se ve en la pantalla; por defecto, hoy.
- **Hoy:** la fecha local del dispositivo del usuario.
- **Ventana de fechas al añadir:** intervalo de fechas que el servidor acepta en `POST /api/meals`, relativo a la fecha
  de su reloj.
- **Propuesta:** la lista editable de alimentos que resulta de analizar una foto (spec 025), antes de guardarla.
