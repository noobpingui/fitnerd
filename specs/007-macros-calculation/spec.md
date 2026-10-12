# Spec 007 — Cálculo de calorías y macros con límites de proteína y carbohidratos

- **Feature:** `007-macros-calculation` · **Tipo:** feature
- **Ámbito:** frontend

## 1. Contexto y problema

La página **Macros** (`/macros`) y la tarjeta "Objetivo de hoy" del home (`/home`) muestran el objetivo calórico diario y su reparto en carbohidratos, proteínas y grasas. Las cifras salen del perfil del usuario guardado en el servidor (spec 006). El cálculo se hizo en la fase de diseño como algo provisional y nunca se especificó: ningún criterio escrito dice qué cifras son las correctas, y solo la edad tiene tests.

Además, el cálculo actual tiene tres huecos conocidos:

- **Proteína en pesos altos:** se calcula a 2 g por kg de peso total. A una persona de 120 kg le pide 240 g diarios, una cantidad sin sentido cuando gran parte de ese peso es grasa.
- **Carbohidratos en objetivos bajos:** los carbohidratos se quedan con "lo que sobra". Con un objetivo calórico bajo pueden quedar por debajo de 100 g, o incluso en 0, y eso no es una recomendación razonable.
- **Objetivos calóricos demasiado bajos:** con perfiles pequeños, de edad avanzada o sedentarios, y una meta de pérdida de peso, el objetivo diario puede bajar a cifras que no se deben recomendar (por debajo de 1000 kcal o incluso de 500 kcal).

Esta spec fija el cálculo completo como comportamiento observable y añade tres límites: un tope de proteína, un mínimo de carbohidratos y un suelo calórico. El cálculo sigue haciéndose en el frontend, con los datos del perfil que ya devuelve el servidor.

## 2. Historia de usuario

Como **usuario con el onboarding completado**, quiero **ver un objetivo de calorías y un reparto de macros que tengan sentido aunque pese mucho o mi objetivo calórico sea bajo** para **poder seguirlos sin recibir cantidades absurdas de proteína, dietas casi sin carbohidratos ni objetivos calóricos peligrosamente bajos**.

## 3. Alcance

**Incluye:**
- Especificar el cálculo actual:
  - conversión de unidades;
  - edad a partir de la fecha de nacimiento;
  - fórmula de Mifflin-St Jeor;
  - factores de actividad y de meta;
  - proteína por peso, grasas en porcentaje y carbohidratos como resto.
- Un **suelo calórico** para el objetivo diario: 1200 kcal en mujeres y 1500 kcal en hombres.
- Un **tope de proteína** para pesos corporales altos, basado en el peso de IMC 27.
- Un **mínimo de carbohidratos** de 100 g, con la regla de qué macronutriente cede calorías para cubrirlo.
- Las reglas de redondeo y de presentación (gramos, kcal, kJ y porcentaje) en `/macros` y en el home.
- Actualizar la nota informativa de `/macros` para que explique las reglas nuevas.

**Fuera de alcance:**
- Mover el cálculo al backend o exponerlo en una API.
- Fórmulas basadas en la composición corporal (por ejemplo, Katch-McArdle con el porcentaje de grasa).
- Que el usuario personalice porcentajes, gramos por kg, factores o el suelo calórico.
- Avisar en la pantalla cuando se aplica el suelo calórico, el tope de proteína o el mínimo de carbohidratos: solo se explica en la nota informativa (Q5).
- Cambiar el diseño de `/macros` o del home más allá del texto de la nota informativa.
- Cambiar las validaciones del perfil (rangos de peso, altura y edad de la spec 006).

## 4. Requisitos funcionales

> Todos los ejemplos usan el perfil del servidor (spec 006). Salvo que se diga otra cosa, las cifras en kcal son las que ve el usuario, ya redondeadas al entero más cercano. En los ejemplos, H es `gender: "male"` y M es `gender: "female"`.

### REQ-001 — Datos de entrada en unidades métricas y edad

THE SYSTEM SHALL calcular con el peso en kg, la altura en cm y la edad en años cumplidos a la fecha actual del dispositivo, convirtiendo desde las unidades que eligió el usuario (1 lb = 0,45359237 kg; 1 in = 2,54 cm; 1 ft = 12 in) sin redondear el resultado de la conversión.

Quien cumple años hoy ya cuenta con la edad nueva.

- **AC-001.1:** Given un perfil H con `height_unit: "ft"`, `height_ft: 5`, `height_in: 11`, `weight_unit: "lb"`, `weight: 176.4`, 30 años cumplidos, actividad `low` y meta `lose`, When se calcula, Then el mantenimiento es 2139 kcal y el objetivo diario 1711 kcal.
- **AC-001.2:** Given un perfil H de 180 cm, 80 kg, actividad `low`, meta `lose` y `date_of_birth: "1996-10-12"`, When se calcula el 11 de octubre de 2026, Then usa 29 años: el mantenimiento es 2142 kcal y el objetivo 1714 kcal.
- **AC-001.3:** Given el mismo perfil de AC-001.2, When se calcula el 12 de octubre de 2026 (día del cumpleaños), Then usa 30 años: el mantenimiento es 2136 kcal y el objetivo 1709 kcal.

### REQ-002 — Calorías de mantenimiento

THE SYSTEM SHALL calcular las calorías de mantenimiento como la tasa metabólica basal de Mifflin-St Jeor multiplicada por el factor del nivel de actividad (sección 6), y mostrarlas redondeadas al entero más cercano. La tasa basal es 10 × kg + 6,25 × cm − 5 × edad, más 5 en hombres o menos 161 en mujeres.

Ni el suelo calórico ni los límites de los macronutrientes cambian el mantenimiento.

- **AC-002.1:** Given un perfil H de 30 años, 180 cm y 80 kg, When se calcula con actividad `low`, `high` y `athlete`, Then el mantenimiento es 2136, 2759 y 3382 kcal, respectivamente.
- **AC-002.2:** Given un perfil M de 40 años, 160 cm y 60 kg, When se calcula con actividad `low`, `moderate` y `very_high`, Then el mantenimiento es 1487, 1704 y 2137 kcal, respectivamente.

### REQ-003 — Objetivo calórico diario

THE SYSTEM SHALL calcular el objetivo diario como las calorías de mantenimiento sin redondear multiplicadas por el factor de la meta (sección 6), con el suelo calórico de REQ-004, y mostrarlo redondeado al entero más cercano.

Ni el tope de proteína ni el mínimo de carbohidratos cambian el objetivo diario.

- **AC-003.1:** Given un perfil H de 30 años, 180 cm, 80 kg y actividad `low` (mantenimiento de 2136 kcal), When se calcula con las metas `lose`, `lose_slow`, `maintain`, `gain_slow` y `gain`, Then el objetivo es 1709, 1922, 2136, 2350 y 2563 kcal, respectivamente.

### REQ-004 — Suelo calórico

IF el objetivo diario calculado según REQ-003 es inferior al suelo calórico del sexo del usuario (1200 kcal en mujeres y 1500 kcal en hombres) THEN THE SYSTEM SHALL usar el suelo como objetivo diario, cualquiera que sea la meta y aunque el suelo supere las calorías de mantenimiento, y repartir los macronutrientes sobre ese objetivo.

El suelo solo afecta al objetivo diario: el mantenimiento se sigue mostrando sin suelo (REQ-002).

- **AC-004.1:** Given un perfil M de 50 años, 160 cm, 60 kg, actividad `low` y meta `lose` (objetivo calculado de 1141 kcal), When se calcula, Then el mantenimiento es 1427 kcal y el objetivo diario 1200 kcal. Las proteínas son 120 g y 480 kcal, las grasas 33 g y 300 kcal y los carbohidratos 105 g y 420 kcal.
- **AC-004.2:** Given un perfil H de 60 años, 166 cm, 60 kg, actividad `low` y meta `lose` (objetivo calculado de 1289 kcal), When se calcula, Then el mantenimiento es 1611 kcal y el objetivo diario 1500 kcal. Las proteínas son 120 g y 480 kcal, las grasas 42 g y 375 kcal y los carbohidratos 161 g y 645 kcal.
- **AC-004.3:** Given un perfil M de 100 años, 150 cm, 45 kg, actividad `low` y meta `maintain` (mantenimiento de 872 kcal), When se calcula, Then el objetivo diario es 1200 kcal aunque supere el mantenimiento, y el mantenimiento se sigue mostrando como 872 kcal (sin suelo). Las proteínas son 90 g y 360 kcal, las grasas 33 g y 300 kcal y los carbohidratos 135 g y 540 kcal.
- **AC-004.5:** Given el perfil de AC-004.3, When se calcula con las metas `lose`, `lose_slow`, `maintain`, `gain_slow` y `gain`, Then el objetivo diario es 1200 kcal en todas ellas y el mantenimiento es 872 kcal en todas ellas.
- **AC-004.4:** Given un perfil M de 40 años, 160 cm, 60 kg, actividad `moderate` y meta `lose`, When se calcula, Then el objetivo diario es 1363 kcal, porque está por encima del suelo y no se modifica.

### REQ-005 — Reparto estándar de macronutrientes

WHILE el reparto estándar deja al menos 100 g de carbohidratos THE SYSTEM SHALL asignar al objetivo diario:
- a las proteínas, 2 g por kg de peso de referencia (REQ-006);
- a las grasas, el 25 % del objetivo;
- a los carbohidratos, el resto del objetivo.

- **AC-005.1:** Given un perfil H de 30 años, 180 cm, 80 kg, actividad `low` y meta `lose` (objetivo de 1709 kcal), When se calcula, Then las proteínas son 160 g y 640 kcal, las grasas 47 g y 427 kcal y los carbohidratos 160 g y 642 kcal.

### REQ-006 — Tope de proteína para pesos altos

IF el peso del usuario supera el que corresponde a un IMC de 27 para su altura (27 × altura en metros²) THEN THE SYSTEM SHALL calcular la proteína con ese peso de IMC 27 como peso de referencia, en lugar del peso real.

- **AC-006.1:** Given un perfil H de 30 años, 180 cm, 120 kg, actividad `high` y meta `maintain` (objetivo de 3379 kcal; peso de IMC 27 = 87,48 kg), When se calcula, Then las proteínas son 175 g y 700 kcal (no 240 g), las grasas 94 g y 845 kcal y los carbohidratos 459 g y 1834 kcal.
- **AC-006.2:** Given un perfil igual al de AC-006.1 pero con `weight_unit: "lb"` y `weight: 264.6`, When se calcula, Then las proteínas son 175 g.
- **AC-006.3:** Given un perfil H de 180 cm y 90 kg, When se calcula, Then las proteínas son 175 g (se usa el peso de IMC 27). Given un perfil H de 180 cm y 85 kg, Then las proteínas son 170 g (por debajo del tope se usa el peso real).

### REQ-007 — Mínimo de carbohidratos

IF el reparto estándar (REQ-005) deja menos de 100 g de carbohidratos THEN THE SYSTEM SHALL asignar 100 g (400 kcal) a los carbohidratos y cubrir la diferencia en este orden, de modo que los tres sigan sumando el objetivo diario:
1. reduciendo las grasas, como mucho hasta el 20 % del objetivo diario;
2. si no basta, reduciendo las proteínas.

- **AC-007.1:** Given un perfil M de 60 años, 170 cm, 75 kg, actividad `low` y meta `lose` (objetivo de 1297 kcal; el reparto estándar dejaría 93 g de carbohidratos), When se calcula, Then los carbohidratos son 100 g y 400 kcal, las proteínas 150 g y 600 kcal y las grasas 33 g y 297 kcal.
- **AC-007.2:** Given un perfil M de 80 años, 175 cm, 80 kg, actividad `low` y meta `lose` (objetivo de 1279 kcal; el reparto estándar dejaría 80 g de carbohidratos), When se calcula, Then los carbohidratos son 100 g y 400 kcal y las grasas 28 g y 256 kcal (el 20 % del objetivo). Las proteínas son 156 g y 624 kcal, menos que los 160 g del reparto estándar.
- **AC-007.3:** Given un perfil M de 50 años, 175 cm, 80 kg, actividad `low` y meta `lose` (el reparto estándar deja 107 g de carbohidratos), When se calcula, Then se aplica el reparto estándar: proteínas 160 g y 640 kcal, grasas 40 g y 356 kcal, carbohidratos 107 g y 428 kcal.
- **AC-007.4:** Given un perfil M de 80 años, 165 cm, 75 kg, actividad `low` y meta `lose` (objetivo calculado de 1171 kcal, elevado al suelo de 1200 kcal), When se calcula, Then el objetivo diario es 1200 kcal. Los carbohidratos son 100 g y 400 kcal, las grasas 27 g y 240 kcal y las proteínas 140 g y 560 kcal.

### REQ-008 — Coherencia del reparto

THE SYSTEM SHALL garantizar, para cualquier perfil válido según la spec 006, que:
- ningún macronutriente tiene gramos ni kcal negativos;
- el objetivo diario nunca es inferior al suelo calórico del sexo del usuario;
- las kcal de los tres macronutrientes, antes de redondear, suman el objetivo diario sin redondear.

Cada macronutriente se muestra así:
- sus kcal, redondeadas al entero más cercano;
- sus gramos, como sus kcal sin redondear divididas entre 4 (carbohidratos y proteínas) o entre 9 (grasas), redondeados al entero más cercano;
- su porcentaje, como sus kcal sin redondear divididas entre el objetivo sin redondear.

- **AC-008.1:** Given cada combinación de los valores límite del perfil (H y M; 14 y 100 años; 100 y 250 cm; 30 y 300 kg; las cinco actividades; las cinco metas), When se calcula, Then:
  - ningún macronutriente tiene gramos o kcal negativos;
  - el objetivo diario es como mínimo 1200 kcal (M) o 1500 kcal (H);
  - la suma de las kcal sin redondear de los tres difiere del objetivo sin redondear en menos de 0,001 kcal.
- **AC-008.2:** Given cualquiera de los perfiles de los AC anteriores, When se calcula, Then la suma de los porcentajes sin redondear de los tres macronutrientes es 1, con una tolerancia de 0,000001.

### REQ-009 — Presentación en Macros y en el home

WHEN el usuario abre `/macros` THE SYSTEM SHALL mostrar, según REQ-001 a REQ-008, el objetivo diario, el mantenimiento y, por cada macronutriente, sus gramos, su energía y su porcentaje del total redondeado al entero.

WHEN el usuario abre `/home` THE SYSTEM SHALL mostrar el mismo objetivo diario y los mismos gramos de cada macronutriente que `/macros`.

Al cambiar la unidad a kJ, cada valor se muestra como su valor en kcal ya redondeado, multiplicado por 4,184 y redondeado al entero más cercano.

- **AC-009.1:** Given el perfil de AC-006.1 (120 kg), When el usuario abre `/macros`, Then ve el objetivo diario de 3379 kcal, "Proteínas" con 175 g, "Grasas" con 94 g y "Carbohidratos" con 459 g.
- **AC-009.2:** Given el perfil de AC-007.2, When el usuario abre `/macros`, Then ve:
  - "Carbohidratos" con 100 g y el 31 % del total;
  - "Proteínas" con 156 g y el 49 % del total;
  - "Grasas" con 28 g y el 20 % del total.
- **AC-009.3:** Given el perfil de AC-005.1 en `/macros`, When el usuario cambia la unidad a kJ, Then el objetivo diario se muestra como 7150 kJ.
- **AC-009.4:** Given el perfil de AC-006.1, When el usuario abre `/home`, Then la tarjeta "Objetivo de hoy" muestra 3379 kcal y 459 g de carbohidratos, 175 g de proteínas y 94 g de grasas.
- **AC-009.5:** Given el perfil de AC-004.1, When el usuario abre `/macros` y `/home`, Then en ambas pantallas el objetivo diario es 1200 kcal, y `/macros` muestra un mantenimiento de 1427 kcal.

### REQ-010 — Nota informativa actualizada

WHEN el usuario abre `/macros` THE SYSTEM SHALL mostrar en la nota informativa del final de la página una explicación del cálculo que incluya el suelo calórico, el tope de proteína y el mínimo de carbohidratos. El texto exacto está en la sección 6.

- **AC-010.1:** Given un usuario en `/macros`, When mira la nota informativa, Then contiene los textos "si tu peso supera el que corresponde a un IMC de 27 para tu altura, se usa ese peso" y "con un mínimo de 100 g".
- **AC-010.2:** Given un usuario en `/macros`, When mira la nota informativa, Then sigue mencionando "Mifflin-St Jeor".
- **AC-010.3:** Given un usuario en `/macros`, When mira la nota informativa, Then contiene el texto "sin bajar de 1200 kcal en mujeres ni de 1500 kcal en hombres".

## 5. Requisitos no funcionales

No aplican requisitos no funcionales específicos: el cálculo es local e instantáneo, no maneja datos nuevos y no llama a servicios externos.

## 6. Datos y contratos visibles

No hay cambios de API: el cálculo usa el perfil que ya devuelve el servidor (spec 006).

**Factores de actividad:**

| `activity_level` | Etiqueta | Factor |
|---|---|---|
| `low` | Bajo | 1,2 |
| `moderate` | Moderado | 1,375 |
| `high` | Alto | 1,55 |
| `very_high` | Muy alto | 1,725 |
| `athlete` | Atleta | 1,9 |

**Factores de meta:**

| `goal` | Etiqueta | Factor |
|---|---|---|
| `lose` | Perder peso | 0,8 |
| `lose_slow` | Perder peso lentamente | 0,9 |
| `maintain` | Mantener peso | 1 |
| `gain_slow` | Aumentar peso lentamente | 1,1 |
| `gain` | Aumentar peso | 1,2 |

**Constantes del cálculo:**

| Concepto | Valor |
|---|---|
| Suelo calórico del objetivo diario | 1200 kcal (mujeres), 1500 kcal (hombres) |
| Proteína | 2 g por kg de peso de referencia |
| Peso de referencia | el menor entre el peso real y 27 × (altura en m)² |
| Grasas (reparto estándar) | 25 % del objetivo diario |
| Grasas (mínimo cuando se cubren carbohidratos) | 20 % del objetivo diario |
| Carbohidratos | el resto, con un mínimo de 100 g |
| Energía por gramo | carbohidratos 4 kcal, proteínas 4 kcal, grasas 9 kcal |
| Conversión de energía | 1 kcal = 4,184 kJ |

**Texto de la nota informativa de `/macros`.** Sustituye al actual, y "Mifflin-St Jeor" sigue resaltado:

> Calculado con la fórmula de Mifflin-St Jeor, una de las más precisas para estimar el gasto calórico. Parte de tu peso, altura, edad y sexo para obtener lo que tu cuerpo gasta en reposo, lo multiplica según tu nivel de actividad y lo ajusta a tu meta, sin bajar de 1200 kcal en mujeres ni de 1500 kcal en hombres. Las proteínas se fijan en 2 g por kg de peso (si tu peso supera el que corresponde a un IMC de 27 para tu altura, se usa ese peso), las grasas en el 25 % de las calorías y el resto son carbohidratos, con un mínimo de 100 g: si no llegan, se reducen primero las grasas (hasta el 20 %) y después las proteínas. Es una estimación: úsala como punto de partida y ajústala según tu progreso.

## 7. Preguntas abiertas

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | ¿Qué criterio usa el tope de proteína? Se propuso el peso de IMC 25; las alternativas eran un tope fijo en gramos, el peso de IMC 27–30 o un "peso ajustado". | **Resuelta:** IMC 27. La proteína se calcula con el peso de IMC 27 para la altura del usuario cuando su peso real es mayor (incorporado en REQ-006 y REQ-010). Respuesta literal: "Q1 IMC 27, Q4 suelo calórico, el resto propuesta". |
| Q2 | ¿Cuál es el mínimo de carbohidratos? Se propusieron 100 g al día. | **Resuelta:** 100 g al día, según la propuesta (REQ-007). |
| Q3 | Cuando hay que subir los carbohidratos al mínimo, ¿de dónde salen esas calorías? Se propuso: primero de las grasas, como mucho hasta el 20 % del objetivo, y después de las proteínas, sin cambiar el objetivo diario. | **Resuelta:** según la propuesta (REQ-007). |
| Q4 | Para objetivos extremadamente bajos, ¿basta con un reparto especial (20 % grasas, 80 % carbohidratos, 0 g de proteína) o se quiere un objetivo calórico mínimo? | **Resuelta:** suelo calórico en lugar del reparto especial, con 1200 kcal en mujeres y 1500 kcal en hombres (REQ-004). El reparto especial se elimina, porque con el suelo nunca hace falta. Los valores y su alcance se confirmaron en Q6. |
| Q5 | ¿Debe la pantalla avisar de forma visible cuando se aplica el tope de proteína o el mínimo de carbohidratos? Se propuso que no, y que solo lo explique la nota informativa. | **Resuelta:** según la propuesta. No hay avisos en pantalla, tampoco para el suelo calórico; solo la nota informativa (REQ-010). |
| Q6 | Sobre el suelo calórico de Q4: (a) ¿se confirman 1200 kcal para mujeres y 1500 kcal para hombres, que se sugirieron como referencia? (b) ¿Se aplica también cuando queda **por encima del mantenimiento**? Por ejemplo, una mujer de 100 años, 150 cm y 45 kg con actividad baja tiene un mantenimiento de 872 kcal y su objetivo sería 1200 kcal aunque quiera perder peso. **Propuesta:** (a) sí, 1200 y 1500 kcal; (b) sí, el suelo se aplica siempre, cualquiera que sea la meta (AC-004.3), y el mantenimiento se sigue mostrando sin suelo. Alternativa para (b): que el objetivo no supere nunca el mantenimiento (el suelo sería el menor entre 1200/1500 kcal y el mantenimiento). | **Resuelta:** (a) Sí: 1200 kcal para mujeres y 1500 kcal para hombres. (b) De acuerdo con la propuesta: el suelo se aplica siempre, cualquiera que sea la meta, y el mantenimiento se sigue mostrando sin suelo. Incorporada en REQ-004, AC-004.3 y AC-004.5. (Respuesta literal del usuario: "Q6a sí, Q6b propuesta") |

## 8. Glosario

- **Mantenimiento:** calorías diarias estimadas para mantener el peso actual (tasa metabólica basal × factor de actividad).
- **Objetivo diario:** calorías diarias recomendadas según la meta (mantenimiento × factor de meta), nunca por debajo del suelo calórico.
- **Suelo calórico:** valor mínimo del objetivo diario: 1200 kcal en mujeres y 1500 kcal en hombres.
- **Peso de referencia:** peso con el que se calcula la proteína. Es el peso real o, si el real es mayor, el de IMC 27 para la altura.
- **Reparto estándar:** proteína según el peso de referencia, 25 % de grasas y el resto de carbohidratos, sin aplicar el mínimo de carbohidratos.
