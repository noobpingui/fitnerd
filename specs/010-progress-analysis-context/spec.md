# Spec 010 — Análisis de progreso con IA con contexto del perfil y sugerencia de calorías

- **Feature:** `010-progress-analysis-context` · **Tipo:** feature
- **Ámbito:** ambos

## 1. Contexto y problema

En la pantalla Métricas (`/body-metrics`), la sección "Análisis del coach" tiene el botón "Pídele al IA Coach que analice tu progreso". Hoy el análisis solo recibe el historial de mediciones de los últimos 12 meses (peso, % de grasa, % de masa muscular y notas). No sabe nada del usuario:

- ni su sexo, edad, altura, nivel de actividad o meta (perfil, spec 006);
- ni los indicadores de progreso que la misma pantalla ya le muestra (ritmo frente a la meta, cambio en 30 días, composición corporal y constancia, spec 009);
- ni su objetivo calórico diario (spec 007).

Por eso el análisis puede contradecir lo que el usuario ve en pantalla (por ejemplo, celebrar una bajada de peso cuando su meta es aumentar) y no le dice qué hacer cuando su ritmo no encaja con la meta. Además, las instrucciones actuales le prohíben dar cualquier consejo nutricional.

Esta feature hace que el análisis tenga en cuenta el perfil, los indicadores y las calorías del usuario, y que, cuando el ritmo real no encaje con la meta, sugiera un ajuste concreto de las calorías diarias. El ajuste lo calcula el sistema con una regla fija (no lo inventa el modelo de IA), se muestra en pantalla y el análisis lo explica.

## 2. Historia de usuario

Como **usuario con el onboarding completado que registra sus mediciones**, quiero **que el análisis del IA Coach tenga en cuenta mi perfil, mi meta y mis indicadores de progreso, y que me sugiera cuántas calorías comer si mi ritmo no encaja con mi meta** para **recibir una lectura coherente con lo que veo en Métricas y saber qué ajustar**.

## 3. Alcance

**Incluye:**
- Dar al análisis los datos del perfil: sexo, edad, altura, nivel de actividad y meta (REQ-001).
- Dar al análisis los indicadores de progreso de Métricas tal como se ven en pantalla (REQ-002) y las calorías de mantenimiento y el objetivo diario de Macros (REQ-003).
- Calcular un ajuste sugerido de las calorías diarias cuando el ritmo no encaja con la meta, con tope y suelo calórico (REQ-004, REQ-005, REQ-006).
- Mostrar la sugerencia en "Análisis del coach", junto al texto del análisis (REQ-007).
- Actualizar las reglas que sigue el modelo de IA: explicar la sugerencia sin inventar otras cifras (REQ-008).
- Rechazo del análisis cuando el usuario no tiene perfil, con un mensaje que le pide completarlo (REQ-009, Q7).
- Conservación del comportamiento actual: límite de análisis, falta de datos y errores (REQ-010), con la corrección ortográfica del mensaje de falta de datos.
- Privacidad de los datos que se envían al proveedor de IA (NFR-001).

**Fuera de alcance:**
- Cambiar el objetivo diario de Macros o del home: la sugerencia es solo informativa y no se guarda (Q8).
- Cambiar el cálculo de los indicadores (spec 009) o de calorías y macros (spec 007).
- Repartir las calorías sugeridas en macronutrientes.
- Recomendar dietas, alimentos o rutinas de ejercicio.
- Guardar o mostrar un historial de análisis anteriores.
- Cambiar el límite de análisis por usuario (2 cada 24 horas), la ventana de 12 meses del historial o el diseño del botón.
- Mostrar la sugerencia fuera de "Análisis del coach" o antes de pedir el análisis.
- Dar la sugerencia en kJ: se expresa siempre en kcal.

## 4. Requisitos funcionales

> **Convenciones de esta sección.**
> - "Hoy" es la fecha del dispositivo, como en la spec 009. Salvo que se diga otra cosa, en los AC hoy es el lunes 12 de octubre de 2026.
> - **Perfil base:** hombre (`gender: "male"`), `date_of_birth: "1996-10-12"` (30 años), 180 cm, unidades kg y cm, actividad `high` y meta `lose`. El peso del perfil es el de la última medición de peso (spec 008).
> - **Mediciones "más lento":** pesos de 80, 79,8, 79,6 y 79,4 kg el 2026-09-20, el 2026-09-27, el 2026-10-04 y el 2026-10-11. Ritmo: -0,2 kg/sem (-0,25 % por semana), "Más lento que tu meta" con meta `lose`.
> - **Mediciones "en ritmo":** las de AC-003.1 de la spec 009 (80, 79,5, 79 y 78,5 kg en las mismas fechas). Ritmo: -0,5 kg/sem (-0,64 % por semana).
> - "El modelo de IA recibe" se refiere a la información que el sistema envía al proveedor de IA para generar un análisis.
> - Las cifras de kcal se muestran como enteros, con el mismo formato que Macros.

### REQ-001 — Perfil en el contexto del análisis

WHEN el usuario con perfil pide un análisis THE SYSTEM SHALL enviar al modelo de IA, además del historial de mediciones, el sexo, la edad en años cumplidos a hoy, la altura, el nivel de actividad y la meta del usuario, con los nombres que usa la app (por ejemplo, "Perder peso" y "Alto").

- **AC-001.1:** Given el perfil base y las mediciones "más lento", When pide un análisis, Then el modelo de IA recibe el sexo "hombre", la edad "30 años", la altura "180 cm", el nivel de actividad "Alto" y la meta "Perder peso".
- **AC-001.2:** Given el perfil base con `date_of_birth: "1996-10-13"`, When pide un análisis el 2026-10-12, Then el modelo de IA recibe "29 años".
- **AC-001.3:** Given el perfil base con altura de 5 ft 11 in y unidad de peso lb, When pide un análisis, Then el modelo de IA recibe la altura en pies y pulgadas ("5 ft 11 in") y los pesos en lb (Q6).
- **AC-001.4:** Given el perfil base con meta `gain_slow` y actividad `athlete`, When pide un análisis, Then el modelo de IA recibe la meta "Aumentar peso lentamente" y el nivel de actividad "Atleta".

### REQ-002 — Indicadores de progreso en el contexto del análisis

WHEN el usuario con perfil pide un análisis THE SYSTEM SHALL enviar al modelo de IA los indicadores de progreso con los mismos valores y textos que muestra Métricas en ese momento (spec 009), en la unidad de peso del perfil (Q5):

- peso actual y su cambio en 30 días;
- % de grasa actual y su cambio en 30 días;
- ritmo semanal y su estado frente a la meta ("En ritmo con tu meta", "Más lento que tu meta", "Más rápido que tu meta" o "Fuera del rango de tu meta"), o el motivo por el que no hay ritmo ("Faltan registros para calcularlo" o "Sin registros recientes");
- masa grasa, masa magra, IMC y FFMI;
- racha, registros de los últimos 30 días, total de registros y fecha del último registro.

Un indicador que en pantalla muestra "—" se envía como no disponible y no con un valor inventado.

- **AC-002.1:** Given el perfil base y las mediciones "más lento", When pide un análisis, Then el modelo de IA recibe el peso actual "79,4 kg", el cambio en 30 días "-0,6 kg", el ritmo "-0,2 kg/sem" y el estado "Más lento que tu meta".
- **AC-002.2:** Given el perfil base y las mediciones "en ritmo" con un % de grasa de 20 en la del 2026-10-11, When pide un análisis, Then el modelo de IA recibe el estado "En ritmo con tu meta", el % de grasa "20 %", la masa grasa "15,7 kg", la masa magra "62,8 kg", el IMC "24,2" y el FFMI "19,4".
- **AC-002.3:** Given mediciones de peso del 2026-10-02, del 2026-10-06 y del 2026-10-11 (caso de AC-003.4 de la spec 009), When pide un análisis, Then el modelo de IA recibe que el ritmo no está disponible con el motivo "Faltan registros para calcularlo" y ningún estado de meta.
- **AC-002.4:** Given mediciones de peso cuya última es del 2026-09-07 (caso de AC-003.10 de la spec 009), When pide un análisis, Then el modelo de IA recibe que el ritmo no está disponible con el motivo "Sin registros recientes".
- **AC-002.5:** Given mediciones solo de peso, When pide un análisis, Then el modelo de IA recibe el % de grasa, la masa grasa, la masa magra y el FFMI como no disponibles, y no recibe ningún valor numérico para ellos.
- **AC-002.6:** Given mediciones de los días 2026-10-12, 2026-10-05 y 2026-09-28, When pide un análisis, Then el modelo de IA recibe la racha "3 semanas", "3 registros" en los últimos 30 días, "3 en total" y el último registro del 2026-10-12.
- **AC-002.7:** Given el caso de AC-002.1 con el perfil en lb, When pide un análisis, Then el modelo de IA recibe el peso actual "175 lb" y el ritmo "-0,4 lb/sem".

### REQ-003 — Calorías en el contexto del análisis

WHEN el usuario con perfil pide un análisis THE SYSTEM SHALL enviar al modelo de IA sus calorías de mantenimiento y su objetivo diario, con los mismos valores que muestra Macros ese día (spec 007).

- **AC-003.1:** Given el perfil base con peso 79,4 kg (mediciones "más lento"), When pide un análisis, Then el modelo de IA recibe un mantenimiento de 2750 kcal y un objetivo diario de 2200 kcal.
- **AC-003.2:** Given un perfil de mujer de 50 años, 160 cm, 60,2 kg, actividad `low` y meta `lose` (objetivo elevado al suelo calórico), When pide un análisis, Then el modelo de IA recibe un objetivo diario de 1200 kcal.

### REQ-004 — Ajuste sugerido de calorías

WHEN el usuario con perfil pide un análisis y el estado del ritmo es "Más lento que tu meta", "Más rápido que tu meta" o "Fuera del rango de tu meta" THE SYSTEM SHALL calcular un ajuste de las calorías diarias así (Q2):

1. ritmo objetivo (kg/sem) = punto medio del rango de la meta (tabla de la sección 6) × peso de la última medición de peso en kg / 100;
2. ajuste bruto (kcal/día) = (ritmo objetivo − ritmo real en kg/sem) × 7700 / 7;
3. ajuste = ajuste bruto redondeado al múltiplo de 50 más cercano (en caso de empate, al de menor valor absoluto), limitado a un máximo de 500 kcal en valor absoluto;
4. calorías sugeridas = objetivo diario (el que muestra Macros, ya redondeado) + ajuste, con el límite de REQ-005.

El ajuste y las calorías sugeridas se envían al modelo de IA y se muestran en pantalla (REQ-007).

IF el ajuste del paso 3 es 0 THEN THE SYSTEM SHALL tratar el caso como "en ritmo" (REQ-006).

- **AC-004.1:** Given el perfil base y las mediciones "más lento" (objetivo diario de 2200 kcal), When pide un análisis, Then el ajuste es -450 kcal y las calorías sugeridas son 1750 kcal.
- **AC-004.2:** Given el perfil base con peso 77 kg y mediciones de 80, 79, 78 y 77 kg el 2026-09-20, el 2026-09-27, el 2026-10-04 y el 2026-10-11 (ritmo -1 kg/sem, "Más rápido que tu meta"; objetivo de 2170 kcal), When pide un análisis, Then el ajuste es +450 kcal y las calorías sugeridas son 2620 kcal.
- **AC-004.3:** Given el perfil base con meta `maintain`, peso 80,9 kg y mediciones de 80, 80,3, 80,6 y 80,9 kg en esas fechas (ritmo +0,3 kg/sem, "Fuera del rango de tu meta"; objetivo de 2773 kcal), When pide un análisis, Then el ajuste es -350 kcal y las calorías sugeridas son 2423 kcal.
- **AC-004.4:** Given el perfil base con meta `gain`, peso 78,5 kg y las mediciones "en ritmo" (ritmo -0,5 kg/sem, "Más lento que tu meta"; objetivo de 3283 kcal; ajuste bruto de +873,8 kcal), When pide un análisis, Then el ajuste es +500 kcal (tope) y las calorías sugeridas son 3783 kcal.
- **AC-004.5:** Given un ajuste bruto de -325 kcal, When se redondea, Then el ajuste es -300 kcal; y con un ajuste bruto de -330 kcal, -350 kcal.
- **AC-004.6:** Given un ajuste bruto de +20 kcal con un estado "Más lento que tu meta", When se calcula, Then no hay ajuste y se trata como en ritmo (REQ-006).
- **AC-004.7:** Given el caso de AC-004.1, When pide un análisis, Then el modelo de IA recibe el ajuste "-450 kcal" y las calorías sugeridas "1750 kcal".

### REQ-005 — Suelo calórico en la sugerencia

IF las calorías sugeridas de REQ-004 quedan por debajo del suelo calórico del sexo del usuario (1200 kcal en mujeres y 1500 kcal en hombres, spec 007) THEN THE SYSTEM SHALL sugerir el suelo y tomar como ajuste la diferencia entre el suelo y el objetivo diario (Q3).

IF el objetivo diario ya es el suelo y el ajuste es negativo THEN THE SYSTEM SHALL no sugerir ningún cambio de calorías e indicar que el objetivo ya está en el mínimo recomendado.

- **AC-005.1:** Given el perfil base con actividad `low` y las mediciones "más lento" (objetivo de 1703 kcal; 1703 − 450 = 1253), When pide un análisis, Then las calorías sugeridas son 1500 kcal y el ajuste es -203 kcal.
- **AC-005.2:** Given el perfil de AC-003.2 (objetivo de 1200 kcal, el suelo) y mediciones de 60,5, 60,4, 60,3 y 60,2 kg el 2026-09-20, el 2026-09-27, el 2026-10-04 y el 2026-10-11 (ritmo -0,1 kg/sem, "Más lento que tu meta"), When pide un análisis, Then no hay calorías sugeridas distintas del objetivo y el modelo de IA recibe que el objetivo ya está en el mínimo recomendado de 1200 kcal.
- **AC-005.3:** Given el caso de AC-004.2 (ajuste positivo), When pide un análisis, Then el suelo no interviene y las calorías sugeridas son 2620 kcal.

### REQ-006 — Sin sugerencia de cambio

WHEN el usuario con perfil pide un análisis y el estado del ritmo es "En ritmo con tu meta" (o el ajuste de REQ-004 es 0) THE SYSTEM SHALL no sugerir ningún cambio e indicar que mantenga su objetivo diario actual.

WHEN el usuario pide un análisis y no hay ritmo ("Faltan registros para calcularlo" o "Sin registros recientes") THE SYSTEM SHALL no calcular ninguna sugerencia de calorías (Q4).

- **AC-006.1:** Given el perfil base con peso 78,5 kg y las mediciones "en ritmo" (objetivo de 2189 kcal), When pide un análisis, Then no hay ajuste y el modelo de IA recibe que el ritmo encaja con la meta y que debe mantener 2189 kcal al día.
- **AC-006.2:** Given el caso de AC-002.3 (faltan registros), When pide un análisis, Then no hay sugerencia de calorías y el modelo de IA no recibe ningún ajuste ni calorías sugeridas.
- **AC-006.3:** Given el caso de AC-002.4 (sin registros recientes), When pide un análisis, Then no hay sugerencia de calorías.

### REQ-007 — Sugerencia visible en "Análisis del coach"

WHEN el análisis se genera THE SYSTEM SHALL mostrar en "Análisis del coach", junto al texto del análisis, un bloque titulado "Ajuste de calorías sugerido" según el caso (Q1):

- con ajuste: "{objetivo} kcal → {sugeridas} kcal al día" y "({ajuste con signo} kcal)";
- con ajuste limitado por el suelo (primer caso de REQ-005): lo anterior más "No se sugiere bajar de {suelo} kcal.";
- con el objetivo ya en el suelo (segundo caso de REQ-005): "Tu objetivo ya está en el mínimo recomendado de {suelo} kcal, así que no se sugiere bajarlo.";
- en ritmo (REQ-006): "Tu ritmo encaja con tu meta: mantén {objetivo} kcal al día.".

En todos los casos, el bloque termina con "Es una estimación basada en tu ritmo de las últimas 4 semanas y supone que sigues tu objetivo diario actual.". Si no hay ritmo (REQ-006, segundo caso) o el análisis se rechaza por falta de perfil (REQ-009), el bloque no aparece. El bloque desaparece o se sustituye cada vez que se genera un análisis nuevo, igual que el texto.

- **AC-007.1:** Given el caso de AC-004.1, When el análisis se genera, Then el usuario ve "Ajuste de calorías sugerido", "2200 kcal → 1750 kcal al día", "(-450 kcal)" y el texto de estimación.
- **AC-007.2:** Given el caso de AC-004.2, When el análisis se genera, Then ve "2170 kcal → 2620 kcal al día" y "(+450 kcal)".
- **AC-007.3:** Given el caso de AC-005.1, When el análisis se genera, Then ve "1703 kcal → 1500 kcal al día", "(-203 kcal)" y "No se sugiere bajar de 1500 kcal.".
- **AC-007.4:** Given el caso de AC-005.2, When el análisis se genera, Then ve "Tu objetivo ya está en el mínimo recomendado de 1200 kcal, así que no se sugiere bajarlo." y no ve ninguna flecha "→".
- **AC-007.5:** Given el caso de AC-006.1, When el análisis se genera, Then ve "Tu ritmo encaja con tu meta: mantén 2189 kcal al día.".
- **AC-007.6:** Given el caso de AC-002.3 (faltan registros), When el análisis se genera, Then ve el texto del análisis y no ve "Ajuste de calorías sugerido".
- **AC-007.7:** Given que el análisis falla (error 503) o se alcanza el límite (429), When el usuario mira la sección, Then no ve "Ajuste de calorías sugerido" y ve el mensaje de error como hoy.
- **AC-007.8:** Given el caso de AC-004.1 con el perfil en lb, When el análisis se genera, Then el bloque sigue en kcal: "2200 kcal → 1750 kcal al día".

### REQ-008 — Reglas del análisis sobre la sugerencia

THE SYSTEM SHALL dar al modelo de IA instrucciones que:

- le permitan comentar el perfil, la meta, los indicadores y las calorías recibidos, y le pidan coherencia con el estado del ritmo recibido;
- cuando haya ajuste, le pidan explicar la sugerencia con las cifras recibidas y le prohíban proponer otras cifras de calorías;
- cuando no haya sugerencia por falta de ritmo, le pidan decir que faltan datos recientes para ajustar las calorías;
- mantengan la prohibición de recetar dietas, alimentos concretos o rutinas de ejercicio, y de inventar datos;
- le pidan responder en español neutro, sin voseo ni regionalismos, en un par de párrafos como mucho.

- **AC-008.1:** Given cualquier análisis con perfil, When se envía al modelo de IA, Then las instrucciones indican que use solo las cifras de calorías recibidas y que no proponga otras.
- **AC-008.2:** Given cualquier análisis, When se envía al modelo de IA, Then las instrucciones prohíben recetar dietas, alimentos concretos y rutinas de ejercicio.
- **AC-008.3:** Given cualquier análisis, When se envía al modelo de IA, Then las instrucciones piden español neutro sin voseo y no están escritas con voseo.
- **AC-008.4:** Given el caso de AC-002.3 (sin ritmo), When se envía al modelo de IA, Then la información enviada indica que no hay datos recientes suficientes para sugerir un ajuste de calorías.

### REQ-009 — Análisis rechazado sin perfil

IF el usuario pide un análisis y no tiene perfil (no completó el onboarding) THEN THE SYSTEM SHALL rechazar la petición con un error 409 y el mensaje "Completa tu perfil para poder generar un análisis.", sin llamar al modelo de IA y sin contar el intento contra el límite de análisis (Q7).

Esta comprobación va antes que la de falta de mediciones y que la del límite: un usuario sin perfil recibe este mensaje aunque no tenga mediciones o ya haya hecho 2 análisis en las últimas 24 horas.

- **AC-009.1:** Given un usuario con sesión, sin perfil y con mediciones en los últimos 12 meses, When pide un análisis, Then recibe 409 con "Completa tu perfil para poder generar un análisis.", no se llama al modelo de IA y el intento no cuenta contra el límite.
- **AC-009.2:** Given un usuario sin perfil y sin mediciones en los últimos 12 meses, When pide un análisis, Then recibe 409 con "Completa tu perfil para poder generar un análisis." y no el mensaje de falta de datos.
- **AC-009.3:** Given un usuario sin perfil con 2 análisis en las últimas 24 horas, When pide otro, Then recibe 409 con "Completa tu perfil para poder generar un análisis." y no el 429.
- **AC-009.4:** Given que la petición de análisis responde 409 con ese mensaje, When el usuario mira "Análisis del coach", Then ve "Completa tu perfil para poder generar un análisis." en el lugar donde hoy se muestran los errores y no ve "Ajuste de calorías sugerido".
- **AC-009.5:** Given un usuario sin perfil que primero recibe el 409 y después completa el perfil, When pide un análisis, Then el análisis se genera (el 409 anterior no contó contra el límite).

### REQ-010 — Comportamiento que se conserva

THE SYSTEM SHALL conservar el comportamiento actual del análisis:

- el límite de 2 análisis por usuario cada 24 horas, con el mismo error 429 y su mensaje (Q10);
- sin mediciones en los últimos 12 meses, no llamar al modelo de IA, no contar contra el límite y responder con el mensaje de falta de datos, ahora con ortografía correcta (Q9): "Todavía no hay registros de métricas en los últimos 12 meses. Registra al menos uno para poder generar un análisis.";
- un fallo del proveedor de IA responde 503 con el mensaje actual y cuenta contra el límite.

- **AC-010.1:** Given un usuario con perfil que ya hizo 2 análisis en las últimas 24 horas, When pide otro, Then recibe 429 con "Alcanzaste el límite de 2 análisis cada 24 horas. Vuelve a intentarlo más tarde." y no se llama al modelo de IA.
- **AC-010.2:** Given un usuario con perfil y sin mediciones en los últimos 12 meses, When pide un análisis, Then recibe "Todavía no hay registros de métricas en los últimos 12 meses. Registra al menos uno para poder generar un análisis.", no se llama al modelo de IA, no cuenta contra el límite y no aparece "Ajuste de calorías sugerido".
- **AC-010.3:** Given un usuario con perfil y un fallo del proveedor de IA, When pide un análisis, Then recibe 503 con "No se pudo generar el analisis en este momento. Intenta de nuevo en unos minutos." y el intento cuenta contra el límite.
- **AC-010.4:** Given un usuario sin sesión, When pide un análisis, Then recibe 401.

## 5. Requisitos no funcionales

### NFR-001 — Datos personales enviados al proveedor de IA

THE SYSTEM SHALL enviar al proveedor de IA solo los datos necesarios para el análisis: nunca el nombre, el correo electrónico, la fecha de nacimiento (solo la edad) ni el identificador del usuario.

- **AC-N001.1:** Given un usuario con nombre, correo y fecha de nacimiento `1996-10-12`, When pide un análisis, Then la información enviada al modelo de IA no contiene su nombre, su correo, el texto "1996-10-12" ni su identificador, y sí contiene "30 años".

### NFR-002 — Datos del propio usuario

THE SYSTEM SHALL construir el contexto del análisis solo con el perfil y las mediciones del usuario de la sesión.

- **AC-N002.1:** Given dos usuarios con perfiles y mediciones distintos, When el primero pide un análisis, Then el modelo de IA no recibe ningún dato del perfil ni de las mediciones del segundo.

## 6. Datos y contratos visibles

**Endpoint:** `POST /api/body-metrics/analysis`, con sesión. Se conservan el campo `analysis` (texto del análisis) de la respuesta 200 y las respuestas 401, 429 y 503 con `{"error": "…"}`. Se añade la respuesta 409 con `{"error": "Completa tu perfil para poder generar un análisis."}` para usuarios sin perfil (REQ-009). La respuesta 200 añade la sugerencia de calorías cuando la hay (REQ-004 a REQ-007); la forma exacta del contrato entre frontend y backend (qué envía el cliente, si envía algo, y cómo viaja la sugerencia) la decide el plan, siempre que las cifras coincidan con las de Métricas y Macros del mismo día (REQ-002, REQ-003).

**Punto medio del rango de ritmo por meta** (en % del peso de la última medición de peso por semana; rangos de la spec 009):

| Meta (`goal`) | Texto | Rango esperado | Punto medio (ritmo objetivo) |
|---|---|---|---|
| `lose` | Perder peso | de -1 a -0,5 | -0,75 |
| `lose_slow` | Perder peso lentamente | de -0,5 a -0,25 | -0,375 |
| `maintain` | Mantener peso | de -0,2 a +0,2 | 0 |
| `gain_slow` | Aumentar peso lentamente | de +0,1 a +0,25 | +0,175 |
| `gain` | Aumentar peso | de +0,25 a +0,5 | +0,375 |

**Constantes del ajuste:**

| Concepto | Valor |
|---|---|
| Energía por kg de peso corporal | 7700 kcal |
| Redondeo del ajuste | múltiplo de 50 kcal más cercano; empates hacia el menor valor absoluto |
| Tope del ajuste | 500 kcal/día en valor absoluto |
| Suelo de las calorías sugeridas | 1200 kcal (mujeres), 1500 kcal (hombres) |

**Textos de nivel de actividad enviados al modelo:** "Bajo", "Moderado", "Alto", "Muy alto", "Atleta" (spec 007).

**Textos visibles nuevos:**
- Título del bloque: "Ajuste de calorías sugerido".
- "{objetivo} kcal → {sugeridas} kcal al día" y "({ajuste con signo} kcal)", por ejemplo "(-450 kcal)" o "(+450 kcal)".
- "No se sugiere bajar de {suelo} kcal."
- "Tu objetivo ya está en el mínimo recomendado de {suelo} kcal, así que no se sugiere bajarlo."
- "Tu ritmo encaja con tu meta: mantén {objetivo} kcal al día."
- "Es una estimación basada en tu ritmo de las últimas 4 semanas y supone que sigues tu objetivo diario actual."

**Mensaje de error nuevo:** "Completa tu perfil para poder generar un análisis." (409, REQ-009).

**Texto corregido:** "Todavía no hay registros de métricas en los últimos 12 meses. Registra al menos uno para poder generar un análisis." (antes, sin tildes y con "Carga").

**Datos existentes:** no cambian. No se guarda ni la sugerencia ni el texto del análisis.

## 7. Preguntas abiertas

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | ¿Dónde se ve la sugerencia de calorías? **Propuesta:** en un bloque fijo "Ajuste de calorías sugerido" junto al texto del análisis, con las cifras calculadas por el sistema, y el texto de la IA la explica (REQ-007). Así la cifra es siempre exacta y comprobable. Alternativa: solo dentro del texto de la IA, sin bloque (la cifra dependería de que el modelo la copie bien). | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): propuesta. |
| Q2 | ¿Cómo se calcula el ajuste? **Propuesta:** apuntar al punto medio del rango de la meta, con 7700 kcal por kg, redondeo a múltiplos de 50 kcal y un tope de ±500 kcal/día (REQ-004 y sección 6). Alternativas: apuntar al límite más cercano del rango (ajustes más pequeños), otro tope (por ejemplo, ±300) u otro redondeo. | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): propuesta. |
| Q3 | Si la sugerencia baja del suelo calórico (1200/1500 kcal), ¿qué se hace? **Propuesta:** sugerir el suelo; y si el objetivo ya está en el suelo, no sugerir bajar y decirlo (REQ-005). Alternativa: no mostrar ninguna sugerencia en esos casos. | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): propuesta. |
| Q4 | Si no hay ritmo ("Faltan registros para calcularlo" o "Sin registros recientes"), ¿se sugiere algo? **Propuesta:** no se calcula sugerencia, no se muestra el bloque y la IA dice que faltan datos recientes (REQ-006, REQ-008). Alternativa: calcular con las mediciones disponibles aunque no cumplan los mínimos de la spec 009. | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): propuesta. |
| Q5 | ¿Qué indicadores recibe la IA? **Propuesta:** todos los de Métricas: peso y % de grasa con su cambio en 30 días, ritmo y estado, composición (masa grasa, masa magra, IMC, FFMI) y constancia (racha, registros de 30 días, total y último registro) (REQ-002). Alternativa: solo los de la idea (ritmo frente a la meta, cambio en 30 días y composición). | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): propuesta. |
| Q6 | ¿En qué unidades recibe la IA los pesos y la altura? **Propuesta:** en las del perfil del usuario (kg o lb; cm o ft/in), para que el análisis hable como la pantalla; las calorías siempre en kcal. Alternativa: siempre en kg y cm. | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): propuesta. |
| Q7 | Un usuario sin perfil (sin onboarding) puede seguir pidiendo un análisis por la API. **Propuesta:** se genera como hoy, solo con las mediciones y sin sugerencia (REQ-009). Alternativa: rechazarlo con un error que pida completar el perfil. | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): alternativa. Incorporada en REQ-009: error 409 con "Completa tu perfil para poder generar un análisis.", sin llamar a la IA ni contar contra el límite, y con prioridad sobre la falta de datos y el 429. |
| Q8 | ¿La sugerencia cambia el objetivo de Macros y del home? **Propuesta:** no; es solo informativa y no se guarda. Alternativa: un botón para aplicarla (requeriría guardar un objetivo personalizado, otra feature). | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): propuesta. |
| Q9 | El mensaje actual de falta de datos no lleva tildes ("Todavia", "metricas", "ultimos", "analisis") y dice "Carga". **Propuesta:** corregirlo a "Todavía no hay registros de métricas en los últimos 12 meses. Registra al menos uno para poder generar un análisis." Alternativa: no tocarlo en esta feature. (El mensaje del 503, también sin tilde en "analisis", se mantiene igual salvo que se indique lo contrario.) | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): propuesta. |
| Q10 | ¿Se mantiene el límite de 2 análisis cada 24 horas, aunque ahora el análisis aporte más? **Propuesta:** sí, sin cambios. | **Resuelta** (usuario: "Todas las propuestas, pero la Q7 me parece mas razonable la alternativa. Es mejor que se pida llenar el perfil y asi poder dar informacion mas precisa."): propuesta. |

## 8. Glosario

- **Ritmo real:** ritmo semanal de cambio de peso de la tarjeta "Ritmo" (spec 009), en kg/sem.
- **Ritmo objetivo:** punto medio del rango de ritmo de la meta, convertido a kg/sem con el peso de la última medición de peso.
- **Objetivo diario:** calorías diarias de Macros (spec 007), con el suelo calórico aplicado.
- **Ajuste:** diferencia en kcal/día entre las calorías sugeridas y el objetivo diario.
- **Calorías sugeridas:** objetivo diario más el ajuste, nunca por debajo del suelo calórico.
- **Suelo calórico:** 1200 kcal en mujeres y 1500 kcal en hombres.
- **Hoy:** la fecha del dispositivo del usuario.
