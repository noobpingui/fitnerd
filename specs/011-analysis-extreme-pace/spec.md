# Spec 011 — Ritmo poco realista por una medición errónea sin bloquear el análisis con IA

- **Feature:** `011-analysis-extreme-pace` · **Tipo:** fix
- **Ámbito:** ambos

## 1. Contexto y problema

En Métricas (`/body-metrics`), la tarjeta "Ritmo" (spec 009) calcula el ritmo semanal de cambio de peso con las mediciones de las últimas 4 semanas, y el análisis con IA (spec 010) recibe ese ritmo para sugerir un ajuste de calorías.

Las mediciones aceptan cualquier peso entre 29,9 y 300 kg. Si el usuario registra un peso muy erróneo (por ejemplo, 98 kg en vez de 80 kg, un salto de 18 kg en pocos días), el ritmo calculado sale disparatado (unos ±12,6 kg por semana). Hoy pasa esto:

- la tarjeta "Ritmo" muestra ese valor con un estado de meta normal ("Más rápido que tu meta", "Más lento que tu meta"…), como si fuera un progreso real;
- al pedir el análisis, el servidor rechaza la petición con un error 400 y la pantalla muestra "Error (400): Los datos del análisis no son válidos.". El usuario no puede pedir ningún análisis y no sabe por qué ni qué hacer (hallazgo F1 de la review de la spec 010).

Esta corrección hace que la app reconozca un ritmo poco realista, se lo explique al usuario, le señale en el Historial qué medición parece errónea y le diga cómo arreglarlo (corregirla o borrarla), sin bloquear el análisis y sin que el servidor calcule una sugerencia de calorías con datos absurdos.

## 2. Historia de usuario

Como **usuario que registra su peso y se equivocó en una medición**, quiero **que Métricas y el análisis del IA Coach me avisen de que mi ritmo no es realista y me señalen qué medición revisar** para **arreglar el dato desde el Historial y seguir pudiendo pedir un análisis**.

## 3. Alcance

**Incluye:**
- Definir cuándo un ritmo es poco realista (REQ-001, Q1).
- Mostrarlo en la tarjeta "Ritmo" con un estado propio (REQ-002, Q3).
- Mostrar un aviso con qué hacer en "Análisis del coach", con la fecha de la medición sospechosa (REQ-003, Q8).
- Permitir generar el análisis en ese caso, sin sugerencia de calorías y con la IA informada de que el ritmo no es fiable (REQ-004, REQ-005, Q2).
- Que el servidor nunca calcule una sugerencia de calorías con un ritmo poco realista, aunque el cliente lo envíe como ritmo normal, y que acepte un ritmo marcado como poco realista sea cual sea su valor (REQ-006, Q6).
- Mantener el rechazo de datos absurdos o mal formados, con un mensaje que diga qué hacer (REQ-007, Q4, Q6).
- Recuperación normal en cuanto el usuario corrige o borra la medición (REQ-008).
- Señalar en el Historial la medición de peso sospechosa (REQ-009, Q5, Q7, Q8).

**Fuera de alcance:**
- Cambiar el rango de pesos que aceptan las mediciones o pedir confirmación al registrar un peso muy distinto del anterior.
- Cambiar el cálculo del ritmo (ventana de 28 días, mínimo de 3 registros en 10 días), los rangos de ritmo por meta (spec 009) o la regla de la sugerencia de calorías (spec 010).
- Cambiar el límite de 2 análisis cada 24 horas, el rechazo sin perfil (409) o el resto de errores del análisis.
- Corregir o borrar mediciones: ya existe en el Historial (spec 008).
- Desplegar automáticamente el Historial ("Mostrar más") hasta la medición señalada.
- Datos existentes: no se modifican; las reglas se aplican al calcular.

## 4. Requisitos funcionales

> **Convenciones de esta sección.**
> - "Hoy" es la fecha del dispositivo; en los AC es el lunes 12 de octubre de 2026.
> - **Perfil base:** el de la spec 010 (hombre, 30 años, 180 cm, kg y cm, actividad `high`, meta `lose`).
> - **Mediciones "salto arriba":** pesos de 80, 80 y 98 kg el 2026-10-01, el 2026-10-06 y el 2026-10-11. Ritmo +12,6 kg/sem; peso de la última medición, 98 kg (+12,9 % por semana).
> - **Mediciones "salto abajo":** pesos de 98, 80 y 80 kg en esas mismas fechas. Ritmo -12,6 kg/sem; última medición, 80 kg (-15,75 % por semana).
> - **Mediciones "límite":** pesos de 96, 98 y 100 kg el 2026-09-27, el 2026-10-04 y el 2026-10-11. Ritmo +2 kg/sem; última medición, 100 kg (+2 % por semana).
> - **Mediciones "justo encima":** como "límite", pero con 100,2 kg el 2026-10-11. Ritmo +2,1 kg/sem; última medición, 100,2 kg (+2,1 % por semana).
> - **Mediciones "empate":** pesos de 80, 80, 98 y 98 kg el 2026-09-27, el 2026-10-02, el 2026-10-07 y el 2026-10-11. Ritmo +10,8 kg/sem (poco realista); la mediana es 89 kg y las cuatro se alejan 9 kg de ella.
> - "Ritmo poco realista" es el estado definido en REQ-001.
> - "Medición sospechosa" es la definida en REQ-009.
> - "El modelo de IA recibe" tiene el mismo sentido que en la spec 010.

### REQ-001 — Ritmo poco realista

WHEN la app calcula el ritmo semanal de peso y hay ritmo (no es "Faltan registros para calcularlo" ni "Sin registros recientes") THE SYSTEM SHALL considerarlo poco realista si su valor absoluto supera el 2 % del peso de la última medición de peso por semana (Q1). Un ritmo de exactamente el 2 % no es poco realista.

Las comprobaciones de la spec 009 van antes: si el ritmo es "Sin registros recientes" o "Faltan registros para calcularlo", se mantiene ese estado.

- **AC-001.1:** Given el perfil base y las mediciones "salto arriba", When se calcula el ritmo, Then es poco realista.
- **AC-001.2:** Given el perfil base y las mediciones "salto abajo", When se calcula el ritmo, Then es poco realista.
- **AC-001.3:** Given el perfil base y las mediciones "límite", When se calcula el ritmo, Then no es poco realista y el estado es el que corresponde según la spec 009: "Más lento que tu meta" (con meta `lose`, subir de peso es ir en la dirección contraria).
- **AC-001.4:** Given el perfil base y las mediciones "justo encima", When se calcula el ritmo, Then es poco realista.
- **AC-001.5:** Given mediciones de 80, 80 y 98 kg el 2026-08-20, el 2026-08-25 y el 2026-08-30 (última medición con más de 28 días), When se calcula el ritmo, Then el estado es "Sin registros recientes" y no "poco realista".
- **AC-001.6:** Given el perfil base y las mediciones "en ritmo" de la spec 010 (ritmo -0,5 kg/sem), When se calcula el ritmo, Then no es poco realista y el estado es "En ritmo con tu meta".

### REQ-002 — Tarjeta "Ritmo" con ritmo poco realista

WHILE el ritmo es poco realista THE SYSTEM SHALL mostrar en la tarjeta "Ritmo" el valor calculado, en la unidad del perfil y con el formato de siempre, y en lugar del estado frente a la meta el estado "Revisa tus mediciones", con el tono de advertencia (Q3).

- **AC-002.1:** Given el perfil base y las mediciones "salto arriba", When el usuario abre Métricas, Then la tarjeta "Ritmo" muestra "+12,6 kg/sem" y "Revisa tus mediciones" con tono de advertencia, y no muestra ninguno de los estados frente a la meta.
- **AC-002.2:** Given el perfil base en lb y las mediciones "salto abajo", When el usuario abre Métricas, Then la tarjeta "Ritmo" muestra "-27,8 lb/sem" y "Revisa tus mediciones".
- **AC-002.3:** Given el perfil base y las mediciones "límite", When el usuario abre Métricas, Then la tarjeta "Ritmo" muestra "+2 kg/sem" y "Más lento que tu meta", como hoy.

### REQ-003 — Aviso en "Análisis del coach"

WHILE el ritmo es poco realista THE SYSTEM SHALL mostrar en "Análisis del coach", antes y después de pedir un análisis, el aviso: "Tu ritmo de las últimas 4 semanas ({ritmo}) no es realista: puede que la medición del {fecha} esté mal. Revísala en el Historial y corrígela o bórrala para recibir una sugerencia de calorías.", donde {ritmo} es el valor que muestra la tarjeta "Ritmo" y {fecha} es la fecha de la medición sospechosa (REQ-009), con el mismo formato de fecha que usa el Historial (Q8).

WHEN el ritmo deja de ser poco realista THE SYSTEM SHALL dejar de mostrar el aviso.

- **AC-003.1:** Given el perfil base y las mediciones "salto arriba", When el usuario abre Métricas, Then ve en "Análisis del coach" el aviso con "(+12,6 kg/sem)" y con la fecha del 2026-10-11 en el formato del Historial, y el botón para pedir el análisis sigue habilitado.
- **AC-003.2:** Given el perfil base en lb y las mediciones "salto abajo", When el usuario abre Métricas, Then el aviso muestra "(-27,8 lb/sem)" y la fecha del 2026-10-01 en el formato del Historial.
- **AC-003.3:** Given el caso de AC-003.1, When el análisis se genera, Then el aviso sigue visible junto al texto del análisis.
- **AC-003.4:** Given el perfil base y las mediciones "límite", When el usuario abre Métricas, Then no ve el aviso.
- **AC-003.5:** Given el perfil base y las mediciones "empate", When el usuario abre Métricas, Then el aviso muestra la fecha del 2026-10-11 (la misma medición que marca el Historial).
- **AC-003.6:** Given el perfil base, las mediciones "salto arriba" y además una medición de 120 kg el 2026-09-01 (fuera de los 28 días del ritmo), When el usuario abre Métricas, Then el aviso muestra la fecha del 2026-10-11 y no la del 2026-09-01.

### REQ-004 — Análisis con ritmo poco realista

WHEN el usuario con perfil pide un análisis y el ritmo es poco realista THE SYSTEM SHALL generar el análisis (respuesta 200), contándolo contra el límite de análisis como cualquier otro (Q2), y además:

- no calcular ninguna sugerencia de calorías ni mostrar el bloque "Ajuste de calorías sugerido";
- enviar al modelo de IA el ritmo con el valor de la tarjeta y el estado "Revisa tus mediciones", y en lugar de la sugerencia, el texto "No se sugiere un ajuste de calorías: el ritmo no es realista y probablemente alguna medición de peso es errónea.";
- no mostrar "Los datos del análisis no son válidos." ni ningún otro error.

- **AC-004.1:** Given el perfil base y las mediciones "salto arriba", When pide un análisis, Then recibe el texto del análisis, no ve "Ajuste de calorías sugerido" ni ningún mensaje de error.
- **AC-004.2:** Given el caso de AC-004.1, When se envía al modelo de IA, Then este recibe el ritmo "+12,6 kg/sem" con el estado "Revisa tus mediciones" y el texto "No se sugiere un ajuste de calorías: el ritmo no es realista y probablemente alguna medición de peso es errónea.", y no recibe ningún ajuste ni calorías sugeridas.
- **AC-004.3:** Given el caso de AC-004.1, When el análisis se genera, Then el intento cuenta contra el límite de 2 análisis cada 24 horas.
- **AC-004.4:** Given el perfil base y las mediciones "salto abajo", When pide un análisis, Then el análisis se genera sin "Ajuste de calorías sugerido".

### REQ-005 — Reglas del análisis con ritmo poco realista

THE SYSTEM SHALL dar al modelo de IA instrucciones que, cuando el estado del ritmo sea "Revisa tus mediciones", le pidan:

- no interpretar ese ritmo ni el cambio de peso asociado como un progreso real;
- explicar que alguna medición de peso parece errónea y recomendar revisarla en el Historial para corregirla o borrarla;
- no proponer ninguna cifra de calorías.

Las demás reglas de la spec 010 (REQ-008) se mantienen.

- **AC-005.1:** Given cualquier análisis, When se envía al modelo de IA, Then las instrucciones indican que, con el estado "Revisa tus mediciones", no trate el ritmo como progreso real, recomiende revisar la medición en el Historial para corregirla o borrarla y no proponga cifras de calorías.
- **AC-005.2:** Given cualquier análisis, When se envía al modelo de IA, Then las instrucciones siguen prohibiendo recetar dietas, alimentos concretos y rutinas de ejercicio, y siguen pidiendo español neutro sin voseo.

### REQ-006 — El servidor no calcula sugerencias con un ritmo poco realista

WHEN el servidor recibe una petición de análisis cuyo ritmo viene marcado como poco realista THE SYSTEM SHALL aceptarla (200) sea cual sea el valor absoluto del ritmo, incluso por encima de 10 kg/sem (Q6), sin sugerencia de calorías, y enviar al modelo de IA el estado "Revisa tus mediciones" y el texto de REQ-004 en lugar de la sugerencia. El servidor respeta la marca aunque el ritmo no supere el 2 %.

IF el servidor recibe un ritmo semanal no marcado como poco realista, con un estado frente a la meta ("En ritmo con tu meta", "Más lento que tu meta", "Más rápido que tu meta" o "Fuera del rango de tu meta"), cuyo valor absoluto supera el 2 % del peso de la última medición recibida y no supera los 10 kg/sem, THEN THE SYSTEM SHALL tratarlo como ritmo poco realista: responder 200 sin sugerencia de calorías y enviar al modelo de IA el estado "Revisa tus mediciones" y el texto de REQ-004 en lugar de la sugerencia.

- **AC-006.1:** Given un usuario con el perfil base cuya petición de análisis trae el estado "Más rápido que tu meta", un ritmo de +5 kg/sem y una última medición de 80 kg (6,25 % por semana), When el servidor la procesa, Then responde 200 sin sugerencia de calorías y el modelo de IA recibe el estado "Revisa tus mediciones" y no recibe ningún ajuste.
- **AC-006.2:** Given la misma petición con el estado "En ritmo con tu meta", When el servidor la procesa, Then responde 200 sin sugerencia de calorías (tampoco la de "mantén {objetivo} kcal al día").
- **AC-006.3:** Given una petición con el estado "Más rápido que tu meta", un ritmo de +1,6 kg/sem y una última medición de 80 kg (exactamente 2 % por semana), When el servidor la procesa, Then calcula la sugerencia de calorías como en la spec 010.
- **AC-006.4:** Given un usuario con el perfil base y una petición que marca el ritmo como poco realista con +12,6 kg/sem y una última medición de 98 kg, When el servidor la procesa, Then responde 200 sin sugerencia de calorías, no la rechaza con 400 y el modelo de IA recibe el estado "Revisa tus mediciones".
- **AC-006.5:** Given un usuario con el perfil base y una petición que marca el ritmo como poco realista con -45 kg/sem, When el servidor la procesa, Then responde 200 sin sugerencia de calorías.
- **AC-006.6:** Given un usuario con el perfil base y una petición que marca el ritmo como poco realista con -0,5 kg/sem y una última medición de 80 kg, When el servidor la procesa, Then responde 200 sin sugerencia de calorías y el modelo de IA recibe el estado "Revisa tus mediciones".

### REQ-007 — Rechazo de datos absurdos o mal formados

IF la petición de análisis trae datos mal formados (por ejemplo, un ritmo que no es un número, marcado o no como poco realista) o un ritmo no marcado como poco realista de más de 10 kg/sem en valor absoluto (Q6), THEN THE SYSTEM SHALL rechazarla con un error 400 y el mensaje "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo." (Q4), sin llamar al modelo de IA y sin contar el intento contra el límite.

La comprobación de perfil (409) sigue yendo antes que esta.

- **AC-007.1:** Given un usuario con perfil y una petición con el estado "Más rápido que tu meta" (sin marca de poco realista) y un ritmo de +12,6 kg/sem, When el servidor la procesa, Then responde 400 con "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo.", no llama al modelo de IA y el intento no cuenta contra el límite.
- **AC-007.2:** Given un usuario con perfil y una petición con un ritmo que no es un número, When el servidor la procesa, Then responde 400 con ese mensaje.
- **AC-007.3:** Given un usuario con perfil y una petición que marca el ritmo como poco realista con un ritmo que no es un número, When el servidor la procesa, Then responde 400 con ese mensaje y no llama al modelo de IA.
- **AC-007.4:** Given un usuario sin perfil y una petición mal formada, When el servidor la procesa, Then responde 409 con "Completa tu perfil para poder generar un análisis.".
- **AC-007.5:** Given que la petición de análisis responde 400 con ese mensaje, When el usuario mira "Análisis del coach", Then ve "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo." y no ve "Los datos del análisis no son válidos.".
- **AC-007.6:** Given el perfil base y las mediciones "salto arriba" en la versión actual de la app, When el usuario pide un análisis, Then la respuesta no es 400 (el caso se trata como en REQ-004).

### REQ-008 — Recuperación al corregir o borrar la medición

WHEN el usuario corrige o borra desde el Historial la medición errónea y el ritmo deja de ser poco realista THE SYSTEM SHALL volver a mostrar en la tarjeta "Ritmo" el estado que corresponda según la spec 009, dejar de mostrar el aviso de REQ-003 y la marca de REQ-009 y, en el siguiente análisis, calcular la sugerencia de calorías como en la spec 010.

- **AC-008.1:** Given el perfil base y las mediciones "salto arriba", When el usuario corrige la medición del 2026-10-11 de 98 a 79,5 kg, Then la tarjeta "Ritmo" ya no muestra "Revisa tus mediciones", "Análisis del coach" ya no muestra el aviso y ninguna fila del Historial lleva la marca de medición sospechosa.
- **AC-008.2:** Given el perfil base y las mediciones "salto arriba", When el usuario borra la medición del 2026-10-11, Then la tarjeta "Ritmo" muestra "—" con "Faltan registros para calcularlo", no muestra "Revisa tus mediciones" y ninguna fila del Historial lleva la marca.
- **AC-008.3:** Given el caso de AC-008.1, When pide un análisis, Then la respuesta incluye la sugerencia de calorías que corresponda según la spec 010.

### REQ-009 — Medición sospechosa en el Historial

WHILE el ritmo es poco realista THE SYSTEM SHALL señalar en el Historial una sola medición sospechosa: entre las mediciones con peso que se usan para calcular el ritmo (las de los 28 días anteriores a la última medición de peso, incluida esta), la que más se aleja, en valor absoluto, de la mediana de sus pesos; si varias empatan, la más reciente (Q7). La fila de esa medición muestra, junto al peso, la marca "Revisa este peso" con el tono de advertencia (Q8), y sus botones de corregir y borrar siguen disponibles.

WHILE el ritmo no es poco realista THE SYSTEM SHALL no mostrar la marca en ninguna fila.

La marca solo se ve si la fila está visible en el Historial; no se despliega "Mostrar más" automáticamente.

- **AC-009.1:** Given el perfil base y las mediciones "salto arriba", When el usuario abre Métricas, Then la fila del 2026-10-11 del Historial muestra "Revisa este peso" y las del 2026-10-01 y el 2026-10-06 no.
- **AC-009.2:** Given el perfil base y las mediciones "salto abajo", When el usuario abre Métricas, Then la fila del 2026-10-01 muestra "Revisa este peso" y las demás no.
- **AC-009.3:** Given el perfil base y las mediciones "empate", When el usuario abre Métricas, Then solo la fila del 2026-10-11 muestra "Revisa este peso".
- **AC-009.4:** Given el perfil base, las mediciones "salto arriba" y además una medición de 120 kg el 2026-09-01 (fuera de los 28 días del ritmo), When el usuario abre Métricas, Then solo la fila del 2026-10-11 muestra "Revisa este peso" y la del 2026-09-01 no.
- **AC-009.5:** Given el perfil base, las mediciones "salto arriba" y además una medición sin peso (solo % de grasa) el 2026-10-09, When el usuario abre Métricas, Then la fila del 2026-10-09 no muestra la marca y la del 2026-10-11 sí.
- **AC-009.6:** Given el perfil base y las mediciones "límite", When el usuario abre Métricas, Then ninguna fila del Historial muestra "Revisa este peso".
- **AC-009.7:** Given mediciones de 80, 80 y 98 kg el 2026-08-20, el 2026-08-25 y el 2026-08-30 ("Sin registros recientes"), When el usuario abre Métricas, Then ninguna fila muestra "Revisa este peso".
- **AC-009.8:** Given el perfil base en lb y las mediciones "salto arriba", When el usuario abre Métricas, Then la fila del 2026-10-11 muestra "Revisa este peso" (la elección no depende de la unidad).
- **AC-009.9:** Given el caso de AC-009.1, When el usuario mira la fila marcada, Then sigue teniendo los botones "Corregir medición del …" y "Borrar medición del …".

## 5. Requisitos no funcionales

No aplican requisitos no funcionales nuevos. Se mantienen NFR-001 y NFR-002 de la spec 010 (datos personales enviados al proveedor de IA y datos del propio usuario).

## 6. Datos y contratos visibles

**Endpoint:** `POST /api/body-metrics/analysis`, con sesión. Se conservan las respuestas 200, 401, 409, 429 y 503 de la spec 010. Cambios:

- La petición puede indicar que el ritmo es poco realista; el servidor la acepta y responde 200 sin sugerencia de calorías (`calorie_suggestion` vacía), sea cual sea el valor del ritmo, siempre que sea un número. La forma exacta en que el cliente lo indica la decide el plan.
- El 400 por datos mal formados o fuera de límites cambia de mensaje: `{"error": "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."}` (Q4).

**Umbrales:**

| Concepto | Valor |
|---|---|
| Ritmo poco realista | valor absoluto del ritmo semanal > 2 % del peso de la última medición de peso por semana (Q1) |
| Límite del servidor para un ritmo **no** marcado como poco realista | 10 kg/sem en valor absoluto; por encima, 400 (Q6) |
| Límite del servidor para un ritmo marcado como poco realista | ninguno; solo se exige que sea un número (Q6) |
| Medición sospechosa | la medición con peso de la ventana del ritmo que más se aleja de la mediana de esos pesos; en empate, la más reciente (Q7) |

**Textos visibles nuevos:**
- Estado de la tarjeta "Ritmo": "Revisa tus mediciones" (tono de advertencia).
- Aviso en "Análisis del coach": "Tu ritmo de las últimas 4 semanas ({ritmo}) no es realista: puede que la medición del {fecha} esté mal. Revísala en el Historial y corrígela o bórrala para recibir una sugerencia de calorías." ({ritmo}: valor de la tarjeta "Ritmo"; {fecha}: fecha de la medición sospechosa, en el formato del Historial; Q8).
- Marca en la fila sospechosa del Historial: "Revisa este peso" (tono de advertencia, Q8).

**Mensaje de error cambiado:** "Los datos del análisis no son válidos." pasa a "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo." (400, Q4).

**Texto nuevo enviado al modelo de IA** (en lugar de la sugerencia): "No se sugiere un ajuste de calorías: el ritmo no es realista y probablemente alguna medición de peso es errónea."

**Datos existentes:** no cambian. No se guarda nada nuevo.

## 7. Preguntas abiertas

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | ¿Desde qué ritmo se considera poco realista? **Propuesta:** más del 2 % del peso de la última medición por semana, en valor absoluto (unos 1,6 kg/sem con 80 kg; exactamente el 2 % sigue siendo realista). Es el doble del ritmo máximo de la meta "Perder peso" (1 %), así que deja margen para ritmos agresivos pero reales. Alternativas: 1,5 % o 3 % por semana, o un valor fijo (por ejemplo, 2 kg/sem). | **Resuelta** (usuario: "Todas las propuestas. Excepto, en Q6, el límite de 10 kg/sem solo aplica cuando el ritmo no se marca como poco realista; un ritmo poco realista se acepta con 200 aunque supere los 10 kg/sem y en Q5, Alternativa"): propuesta. Incorporada en REQ-001. |
| Q2 | Con un ritmo poco realista, ¿se puede pedir el análisis? **Propuesta:** sí; se genera sin sugerencia de calorías, la IA explica que alguna medición parece errónea y el intento cuenta contra el límite de 2 cada 24 horas como cualquier otro (REQ-004). Alternativa: deshabilitar el botón con el aviso hasta que el usuario corrija la medición (no gasta un análisis, pero lo deja sin análisis mientras tanto). | **Resuelta** (misma respuesta): propuesta. Incorporada en REQ-004. |
| Q3 | ¿Qué muestra la tarjeta "Ritmo" con un ritmo poco realista? **Propuesta:** el valor calculado (por ejemplo, "+12,6 kg/sem") con el estado "Revisa tus mediciones" en tono de advertencia, para que el usuario vea por qué (REQ-002). Alternativa: "—" con ese mismo estado, sin el número. | **Resuelta** (misma respuesta): propuesta. Incorporada en REQ-002. |
| Q4 | El 400 por datos mal formados solo debería verse ya con una pestaña abierta antes de un despliegue o con un cliente manipulado. ¿Se cambia su mensaje? **Propuesta:** sí, a "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo." (REQ-007), que dice qué hacer. Alternativa: mantener "Los datos del análisis no son válidos.". | **Resuelta** (misma respuesta): propuesta. Incorporada en REQ-007. |
| Q5 | ¿Se señala en el Historial cuál es la medición sospechosa? **Propuesta:** no en esta corrección; el aviso remite al Historial en general (fuera de alcance). Alternativa: marcar la medición que más se aleja de las demás (requiere definir esa regla). | **Resuelta** (misma respuesta): alternativa. Incorporada en REQ-009; la regla y la marca quedan en Q7 y Q8. |
| Q6 | ¿Se mantiene el límite del servidor de 10 kg/sem para el ritmo recibido? **Propuesta:** sí; con el umbral de Q1 la app nunca envía como ritmo normal uno de más de 8 kg/sem (2 % de 400 kg), así que el límite solo frena datos absurdos o manipulados (REQ-007). Alternativa: ampliarlo para aceptar cualquier ritmo que pueda salir de pesos entre 29,9 y 300 kg. | **Resuelta** (misma respuesta): propuesta con la aclaración del usuario: el límite de 10 kg/sem solo se aplica a un ritmo no marcado como poco realista; uno marcado se acepta con 200 aunque lo supere (siempre que sea un número). Incorporada en REQ-006 y REQ-007. |
| Q7 | (Derivada de Q5) ¿Qué medición se señala como sospechosa? **Propuesta:** solo una: entre las mediciones con peso de la ventana del ritmo (28 días hasta la última medición de peso), la que más se aleja de la mediana de esos pesos; si empatan, la más reciente (REQ-009). Con "salto arriba" marca la de 98 kg del 2026-10-11 y con "salto abajo" la de 98 kg del 2026-10-01. Alternativas: marcar la medición que, al quitarla, deja el ritmo más cerca de lo realista; o marcar todas las que se alejen de la mediana más de un umbral (por ejemplo, 5 %). | **Resuelta** (usuario: "Q7 si, Q8 propuesta y además la fecha en el aviso. AC-006.6 confirmado."): propuesta. Incorporada en REQ-009 (y en la fecha del aviso de REQ-003). |
| Q8 | (Derivada de Q5) ¿Cómo se ve la marca en el Historial? **Propuesta:** el texto "Revisa este peso" junto al peso de la fila, en tono de advertencia, sin cambiar los botones de corregir y borrar ni desplegar "Mostrar más" automáticamente si la fila no está visible (REQ-009). El aviso de "Análisis del coach" se mantiene tal cual. Alternativas: solo un icono de advertencia con texto accesible; o añadir la fecha de la medición sospechosa al aviso ("puede que la medición del {fecha} esté mal"). | **Resuelta** (usuario: "Q7 si, Q8 propuesta y además la fecha en el aviso. AC-006.6 confirmado."): propuesta y, además, la fecha de la medición sospechosa en el aviso de "Análisis del coach". Incorporada en REQ-009 (marca) y REQ-003 (fecha en el aviso, AC-003.1, AC-003.2, AC-003.5 y AC-003.6). AC-006.6 confirmado por el usuario. |

## 8. Glosario

- **Ritmo:** ritmo semanal de cambio de peso de la tarjeta "Ritmo" (spec 009), calculado con las mediciones de peso de las últimas 4 semanas.
- **Ritmo poco realista:** ritmo cuyo valor absoluto supera el 2 % del peso de la última medición de peso por semana.
- **Medición sospechosa:** la medición que el Historial señala con "Revisa este peso" mientras el ritmo es poco realista (REQ-009).
- **Mediana:** el valor central de los pesos ordenados; con un número par de pesos, la media de los dos centrales.
- **Historial:** sección de Métricas donde el usuario corrige o borra sus mediciones (spec 008).
- **Hoy:** la fecha del dispositivo del usuario.
