# ADR-0038: Contexto personal del coach: datos de la cuenta leídos en el servidor, datos de pantalla del cliente descartados en bloque y nombre anonimizado en las trazas

- **Estado:** Propuesta · 2026-11-02 (plan de la feature `034-coach-personal-context`; ampliada en las revisiones 1 y
  2 del plan)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate de review (Art. P5.2).

## Contexto
La spec 034 pide que el AI Coach (`POST /api/coach/ask`) reciba con cada pregunta el nombre, el perfil, las calorías y
macros de `/home` y los indicadores de Métricas del usuario, para adaptar a su caso lo que dice el corpus. Hay tres
problemas de diseño:

1. Las calorías, macros e indicadores solo se calculan en el frontend (specs 007 y 009). El análisis de progreso ya
   resolvió lo mismo con ADR-0021 (el cliente envía los textos ya formateados y el servidor los valida y añade el
   perfil), pero allí un cuerpo no válido es un 400; en el coach, la spec pide descartarlo en silencio (Q7).
2. La Política de privacidad dice que Langfuse nunca recibe el nombre, pero la traza del coach guarda la entrada, los
   mensajes enviados al modelo y la respuesta, y ahora el nombre viaja en el mensaje y el modelo puede usarlo en la
   respuesta (NFR-003).
3. El usuario puede desactivar el uso de sus datos (REQ-010) sin migraciones ni cambios en la cuenta.

## Decisión
- **Mismo reparto que ADR-0021.** El nombre, el perfil y la edad se leen siempre en el servidor, filtrados por el
  `user_id` del token (`CoachPersonalContextReader`). El cliente envía en `personal_context` solo la fecha del
  dispositivo, las calorías y gramos de macros y los indicadores con los mismos textos que pinta Métricas
  (`buildAnalysisRequest` y `calculateMacros`, las mismas funciones que pintan las pantallas). La validación de
  indicadores es la del análisis, extraída a funciones públicas de `services/progress_analysis_context.py` y
  reutilizada.
- **Descarte en bloque, sin error.** Si `personal_context` falta o algo no cumple el formato o los rangos, se ignora
  entero y el coach responde con el nombre y el perfil; nunca hay 400 por esos datos. Sin perfil, los datos del cliente
  se ignoran aunque sean válidos.
- **Bloque delimitado en el turno nuevo.** El contexto personal va en el mensaje de la pregunta actual, entre
  `<datos_del_usuario>` y `</datos_del_usuario>`, nunca en el historial. El nombre se normaliza para el prompt
  (espacios colapsados, sin caracteres de control ni `<`/`>`), y las instrucciones piden tratarlo como dato.
- **Anonimización en la traza.** Antes de entregar cualquier valor al `Tracer` (entrada de la traza, entradas y salidas
  de los pasos y salida final), `CoachService` sustituye cada aparición del nombre como palabra completa, sin
  distinguir mayúsculas, por `[nombre]` (`redact_name`, recursivo sobre textos, listas y diccionarios). El usuario
  recibe la respuesta sin cambios. El identificador interno sigue en la traza. La anonimización se aplica **también
  con el interruptor desactivado**: el historial que reenvía el cliente puede traer el nombre en respuestas de cuando
  estaba activado («Hola, Carlos: …»), así que el servicio lee solo el nombre de la cuenta
  (`CoachPersonalContextReader.read_first_name`) y lo usa únicamente para `redact_name`; no lo añade al mensaje del
  modelo (revisión 1 de la review, F1).
- **Interruptor sin estado en el servidor.** La preferencia vive en `localStorage` del navegador; la petición lleva
  `use_personal_context`. Si no viene (o es `null`), el contexto está activo (Q5); cualquier valor que no sea `true`
  lo desactiva. Desactivado, el servidor no lee el perfil ni los datos del cliente, solo el nombre para anonimizar la
  traza, y el mensaje al modelo es el de antes de la feature.
- **Fallo al leer la cuenta = 503.** Si el lector falla (por ejemplo, la base no responde), con el contexto activado o
  desactivado, el coach responde el 503 de siempre («No se pudo generar una respuesta en este momento…»), sin abrir
  traza y con el error en el log. No se responde sin contexto porque, sin el nombre, no se puede garantizar que la
  traza salga anonimizada (revisión 1 de la review, F7).
- **Anonimización por partes del nombre (revisión 2, F4, spec Q11).** Además del nombre completo, se anonimiza cada
  parte de un nombre compuesto (separada por espacios o guiones) que tenga 3 letras o más y no sea una partícula de una
  lista cerrada: «de», «del», «la», «las», «los», «y», «e», «da», «das», «do», «dos», «di», «du», «van», «von», «der»
  y «le» (sin distinguir mayúsculas). Las partículas y las partes cortas («Jo», «Mª») solo se anonimizan dentro del
  nombre completo. Todos los términos se buscan con **un único patrón** de palabra completa, ordenados de más largo a
  más corto y aplicado en una sola pasada: el nombre completo da un único `[nombre]` y nunca se anonimiza dentro de un
  `[nombre]` ya puesto. No se anonimizan diminutivos ni variantes sin tildes.
- **Nombres anteriores enviados por el cliente (revisión 2, F10, spec Q12).** El servidor no guarda nombres
  anteriores. `/coach` recuerda en memoria los nombres de la cuenta que ha leído mientras hay conversación en pantalla
  y envía los distintos del actual en `previous_names` (de 1 a 5 textos con la regla del nombre de la spec 018). El
  servidor los valida (si la lista no es válida, la ignora entera, sin error) y los usa **solo** en `redact_name`, con
  la misma regla por partes, con el interruptor activado o desactivado. Nunca llegan al modelo ni a Voyage, no cambian
  el nombre del bloque (que sigue saliendo de la cuenta) y no se guardan ni se registran.
- **Historial con el interruptor desactivado (revisión 2, F5).** El historial se sigue reenviando sin cambios (no se
  vacía ni se filtra). En su lugar, la ayuda del interruptor desactivado y el punto de Anthropic de la Política de
  privacidad avisan de que los mensajes anteriores de la conversación se siguen enviando y pueden incluir esos datos.

## Consecuencias
- (+) Una sola fuente de verdad para calorías e indicadores (las funciones que pintan las pantallas), sin portar las
  specs 007 y 009 a Python; lo que identifica al usuario nunca sale del cliente.
- (+) La Política de privacidad sigue siendo cierta para Langfuse sin cambiar el adaptador ni el `Tracer`: la
  anonimización vive en el servicio, que es quien conoce el nombre.
- (−) Un cliente manipulado puede alterar las cifras con las que se personalizan sus propias respuestas; se acota con
  la validación de formato y rangos y no afecta a otros usuarios.
- (−) La anonimización es por coincidencia de palabra completa: una variante del nombre (diminutivo, sin tilde) que el
  modelo invente no se sustituye. Las instrucciones le prohíben inventar nombres.
- (−) Una parte del nombre que también es palabra común («Paz», «Rosa», «Mar») desaparece de la traza de ese usuario
  allí donde aparezca. Solo afecta a la traza, nunca a lo que ve el usuario ni a lo que recibe el modelo, y se acepta
  a cambio de que la Política («nunca tu nombre») siga siendo cierta con nombres compuestos.
- (−) Los nombres anteriores dependen de lo que la pantalla ha leído: si el nombre cambia en otra pestaña y `/coach` no
  llega a leerlo, ese nombre anterior no se anonimiza. Un cliente manipulado puede enviar palabras que no son nombres,
  pero solo afecta a su propia traza. La alternativa más fiable (un token firmado por respuesta con el nombre usado,
  como `feedback_id`) complica el contrato y queda en el backlog.
- (−) La preferencia no se comparte entre navegadores (guardarla en la cuenta necesitaría migración).
- (−) Con el interruptor desactivado, el coach hace una lectura de la cuenta por pregunta (solo el nombre) y depende de
  la base para responder. El impacto es nulo en la práctica: la búsqueda en pgvector usa la misma base, así que con la
  base caída la pregunta ya fallaba con 503.
- (−) El historial que reenvía el cliente con el interruptor desactivado puede seguir llevando al modelo datos de
  respuestas anteriores (nombre, cifras); esta ADR solo garantiza que no llegan a Langfuse. La spec lo resuelve
  avisándolo en la ayuda del interruptor y en la Política (revisión 2, F5), no filtrando el historial.
