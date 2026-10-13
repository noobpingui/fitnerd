# Spec 009 — Indicadores de progreso de Métricas especificados y con tests

- **Feature:** `009-metrics-indicators` · **Tipo:** feature
- **Ámbito:** frontend

## 1. Contexto y problema

La pantalla Métricas (`/body-metrics`) muestra, a partir de las mediciones del usuario (peso, % de grasa y % de masa muscular), varios indicadores de progreso:

- tres tarjetas principales: "Peso", "Ritmo" y "% Grasa", con su cambio en 30 días y la comparación del ritmo con la meta del perfil;
- la línea "Tendencia (7 días)" del gráfico "Evolución";
- la sección "Composición corporal" (masa grasa, masa magra, IMC y FFMI);
- la sección "Constancia" (racha, últimos 30 días, total y último registro).

Estos indicadores se diseñaron en la fase de diseño del rediseño y nunca se especificaron: sus reglas (ventanas de días, mínimos de registros, rangos de ritmo por meta, redondeos) solo existen en el código, y casi no tienen tests. Además tienen tres defectos visibles:

1. La tendencia de 7 días ignora las mediciones anteriores al periodo elegido en el gráfico (1M, 3M o 1A), así que sus primeros puntos se calculan con menos datos de los que hay.
2. "Últimos 30 días" dice "1 registros" cuando hay una sola medición.
3. Mientras el perfil no está disponible, el IMC y el FFMI se calculan con una altura de 0 y muestran un valor sin sentido.

Además, el usuario decidió dos cambios de comportamiento:

- con la meta "Mantener peso", un ritmo fuera de rango ya no se rotula "Más rápido que tu meta", sino "Fuera del rango de tu meta" (Q4);
- si la última medición de peso tiene más de 28 días, el ritmo deja de mostrarse y aparece "Sin registros recientes" (Q6).

Esta feature es el bloque B separado de la feature 008 (pregunta Q14 de esa spec). La 008 garantizó la integridad de las mediciones de las que parten estos indicadores (una por día, corregibles y borrables). Esta spec define los indicadores como comportamiento observable, corrige los defectos anteriores y deja cada regla cubierta por tests. Las decisiones Q8, Q9 y Q10 de la spec 008 se incorporan aquí (Q1–Q3 de la sección 7).

> Nota de trazabilidad: `BodyMetricsPage.test.tsx` ya contiene marcadores `SDD: REQ-012 AC-012.3`, que pertenecen a la spec 006 ("Métricas usa el perfil del servidor"). Esta spec numera sus requisitos de REQ-001 a REQ-010 y no define ningún REQ-012.

## 2. Historia de usuario

Como **usuario con el onboarding completado que registra sus mediciones**, quiero **ver en Métricas indicadores de progreso correctos y coherentes (peso, ritmo frente a mi meta, tendencia, composición corporal y constancia)** para **saber si voy bien encaminado hacia mi meta sin tener que interpretar los datos en bruto**.

## 3. Alcance

**Incluye:**
- KPI "Peso" y KPI "% Grasa": último valor y cambio "en 30 días".
- KPI "Ritmo": ritmo semanal de cambio de peso y su comparación con la meta del perfil, con los rangos por meta confirmados (Q2), el texto "Fuera del rango de tu meta" para la meta de mantener (Q4) y el estado "Sin registros recientes" cuando la última medición de peso tiene más de 28 días (Q6).
- Línea "Tendencia (7 días)" del gráfico de peso, calculada también con las mediciones anteriores al periodo elegido (Q1).
- Sección "Composición corporal": masa grasa, masa magra, IMC y FFMI, y su descripción.
- Sección "Constancia": racha de semanas, registros de los últimos 30 días (con "1 registro" en singular), total y fecha del último registro.
- Qué muestran los indicadores mientras el perfil no está disponible (Q5).

**Fuera de alcance:**
- Registrar, corregir o borrar mediciones y el historial (feature 008).
- Mover el cálculo de los indicadores al servidor.
- El análisis del coach de IA ("Análisis del coach").
- Cambiar el diseño del gráfico, sus selectores de métrica y de periodo, el periodo por defecto o el mensaje "Sin registros de … en este periodo.".
- Usar el % de masa muscular en algún indicador (sigue apareciendo solo en el gráfico y en el historial).
- Indicadores nuevos o cambiar el orden de las secciones de Métricas.
- Cambiar el rótulo "en 30 días" cuando la referencia tiene menos de 30 días (Q3: se mantiene).
- Ocultar o marcar como antiguo el cambio "en 30 días" de las tarjetas "Peso" y "% Grasa" cuando la última medición es antigua: siguen calculándose respecto a la última medición (Q6 solo afecta al ritmo).

## 4. Requisitos funcionales

> **Convenciones de esta sección.**
> - Las mediciones guardan el peso en kg. En pantalla, los pesos (incluidos los cambios, el ritmo, la masa grasa y la masa magra) se muestran en la unidad de peso del perfil: 1 lb = 0,45359237 kg, redondeado a un decimal. Los cálculos se hacen en kg y se convierten al final.
> - Los números se muestran con coma decimal, como mucho un decimal y sin decimales si son enteros ("78,5", "80"). Los cambios y el ritmo llevan signo cuando no son cero ("-2,5", "+1,5", "0").
> - Salvo que se diga otra cosa, en los AC la fecha del dispositivo es el lunes 12 de octubre de 2026, el perfil está en kg con 175 cm de altura y meta `lose`, y `{fecha}` es una fecha en el formato de fechas que ya usa Métricas.
> - "Medición de peso" es una medición que tiene peso; "medición de grasa", una que tiene % de grasa.

### REQ-001 — KPI "Peso"

WHEN el usuario con mediciones de peso abre `/body-metrics` THE SYSTEM SHALL mostrar en la tarjeta "Peso" el peso de su última medición de peso (la de fecha más reciente) y, si hay una medición de peso de referencia distinta, el cambio frente a ella con el texto "{cambio} {unidad} en 30 días". La referencia es la medición de peso más reciente con fecha igual o anterior a 30 días antes de la última medición de peso; si no hay ninguna, es la primera medición de peso. Si la referencia es la propia última medición, no se muestra cambio. Sin mediciones de peso, la tarjeta muestra "—".

- **AC-001.1:** Given mediciones de peso del 2026-09-01 (82), del 2026-09-10 (81) y del 2026-10-11 (78,5), When abre `/body-metrics`, Then la tarjeta "Peso" muestra "78,5 kg" y "-2,5 kg en 30 días" (la referencia es la del 2026-09-10, la más reciente con fecha igual o anterior al 2026-09-11).
- **AC-001.2:** Given mediciones de peso del 2026-09-11 (80) y del 2026-10-11 (78,5), When abre `/body-metrics`, Then la tarjeta "Peso" muestra "-1,5 kg en 30 días" (una medición de exactamente 30 días antes sirve de referencia).
- **AC-001.3:** Given mediciones de peso del 2026-09-25 (80) y del 2026-10-11 (78,5), las únicas, When abre `/body-metrics`, Then la tarjeta "Peso" muestra "-1,5 kg en 30 días" (con menos de 30 días de historial, la referencia es la primera medición y el rótulo no cambia, Q3).
- **AC-001.4:** Given una sola medición de peso, del 2026-10-11 (78,5), When abre `/body-metrics`, Then la tarjeta "Peso" muestra "78,5 kg" y ningún texto de cambio.
- **AC-001.5:** Given el caso de AC-001.2 con un perfil en lb, When abre `/body-metrics`, Then la tarjeta "Peso" muestra "173,1 lb" y "-3,3 lb en 30 días".
- **AC-001.6:** Given mediciones del 2026-10-05 (peso 79) y del 2026-10-11 (solo grasa 20), When abre `/body-metrics`, Then la tarjeta "Peso" muestra "79 kg" (la última medición de peso, no la última medición).
- **AC-001.7:** Given solo mediciones sin peso, When abre `/body-metrics`, Then la tarjeta "Peso" muestra "—" y ningún texto de cambio.
- **AC-001.8:** Given mediciones de peso del 2026-09-10 (80) y del 2026-10-11 (80), When abre `/body-metrics`, Then la tarjeta "Peso" muestra "80 kg" y "0 kg en 30 días".
- **AC-001.9:** Given mediciones de peso del 2026-08-17 (80), del 2026-08-24 (79,5), del 2026-08-31 (79) y del 2026-09-07 (78,5), When abre `/body-metrics`, Then la tarjeta "Peso" muestra "78,5 kg" y "-1,5 kg en 30 días" (el cambio se sigue calculando respecto a la última medición de peso aunque sea antigua, Q6).

### REQ-002 — KPI "% Grasa"

WHEN el usuario con mediciones de grasa abre `/body-metrics` THE SYSTEM SHALL mostrar en la tarjeta "% Grasa" el % de grasa de su última medición de grasa con el texto "{valor} %" y, con la misma regla de referencia de REQ-001 aplicada a las mediciones de grasa, el cambio con el texto "{cambio} pts en 30 días". Sin mediciones de grasa, la tarjeta muestra "—".

- **AC-002.1:** Given mediciones de grasa del 2026-09-10 (22) y del 2026-10-11 (20), When abre `/body-metrics`, Then la tarjeta "% Grasa" muestra "20 %" y "-2 pts en 30 días".
- **AC-002.2:** Given mediciones de grasa del 2026-09-10 (18,5) y del 2026-10-11 (20), When abre `/body-metrics`, Then la tarjeta "% Grasa" muestra "+1,5 pts en 30 días".
- **AC-002.3:** Given una sola medición de grasa, When abre `/body-metrics`, Then la tarjeta "% Grasa" muestra su valor y ningún texto de cambio.
- **AC-002.4:** Given mediciones solo de peso, When abre `/body-metrics`, Then la tarjeta "% Grasa" muestra "—" y ningún texto de cambio.
- **AC-002.5:** Given un perfil en lb y las mediciones de AC-002.1, When abre `/body-metrics`, Then la tarjeta "% Grasa" muestra "20 %" y "-2 pts en 30 días" (el % de grasa no depende de la unidad de peso).

### REQ-003 — KPI "Ritmo"

WHEN el usuario abre `/body-metrics` THE SYSTEM SHALL mostrar en la tarjeta "Ritmo" el ritmo semanal de cambio de peso con el texto "{ritmo} {unidad}/sem". El ritmo es la pendiente de la recta de mejor ajuste (mínimos cuadrados) de las mediciones de peso con fecha desde 28 días antes de la última medición de peso hasta ella (ambas incluidas), expresada por semana. Si en esa ventana hay menos de 3 mediciones de peso o entre la primera y la última hay menos de 10 días, la tarjeta muestra "—" y "Faltan registros para calcularlo".

IF la última medición de peso tiene fecha anterior a 28 días antes de hoy (fecha del dispositivo) THEN THE SYSTEM SHALL mostrar en la tarjeta "Ritmo" "—" y "Sin registros recientes", sin calcular el ritmo y sin estado de meta (Q6). Una última medición de peso de exactamente 28 días antes de hoy todavía es reciente. Esta condición tiene prioridad sobre "Faltan registros para calcularlo", y las mediciones sin peso no la evitan.

- **AC-003.1:** Given mediciones de peso del 2026-09-20 (80), del 2026-09-27 (79,5), del 2026-10-04 (79) y del 2026-10-11 (78,5), When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "-0,5 kg/sem".
- **AC-003.2:** Given el caso de AC-003.1 con un perfil en lb, When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "-1,1 lb/sem".
- **AC-003.3:** Given mediciones de peso del 2026-10-01 (80), del 2026-10-06 (79,5) y del 2026-10-11 (79), When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "-0,7 kg/sem" (3 mediciones que cubren exactamente 10 días bastan).
- **AC-003.4:** Given mediciones de peso del 2026-10-02 (80), del 2026-10-06 (79,5) y del 2026-10-11 (79), When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "—" y "Faltan registros para calcularlo" (cubren 9 días).
- **AC-003.5:** Given dos mediciones de peso, del 2026-09-20 y del 2026-10-11, When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "—" y "Faltan registros para calcularlo".
- **AC-003.6:** Given mediciones de peso del 2026-09-13 (81,4), del 2026-09-27 (80) y del 2026-10-11 (78,6), When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "-0,7 kg/sem" (una medición de exactamente 28 días antes entra en la ventana).
- **AC-003.7:** Given mediciones de peso del 2026-09-12 (81,4), del 2026-09-27 (80) y del 2026-10-11 (78,6), When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "—" y "Faltan registros para calcularlo" (la del 2026-09-12, 29 días antes, queda fuera y solo quedan 2).
- **AC-003.8:** Given mediciones de peso del 2026-09-20, del 2026-09-27, del 2026-10-04 y del 2026-10-11, todas con 80, When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "0 kg/sem".
- **AC-003.9:** Given mediciones de AC-003.1 y otra del 2026-10-12 solo con grasa, When abre `/body-metrics`, Then la tarjeta "Ritmo" sigue mostrando "-0,5 kg/sem" (las mediciones sin peso no cuentan).
- **AC-003.10:** Given mediciones de peso del 2026-08-17 (80), del 2026-08-24 (79,5), del 2026-08-31 (79) y del 2026-09-07 (78,5) y meta `lose`, When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "—" y "Sin registros recientes", y ningún estado de meta (la última medición de peso es de 35 días antes de hoy).
- **AC-003.11:** Given mediciones de peso del 2026-08-24 (80), del 2026-08-31 (79,5), del 2026-09-07 (79) y del 2026-09-14 (78,5), When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "-0,5 kg/sem" (una última medición de peso de exactamente 28 días antes de hoy sigue siendo reciente).
- **AC-003.12:** Given mediciones de peso del 2026-08-23 (80), del 2026-08-30 (79,5), del 2026-09-06 (79) y del 2026-09-13 (78,5), When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "—" y "Sin registros recientes" (29 días antes de hoy).
- **AC-003.13:** Given dos mediciones de peso, del 2026-08-20 y del 2026-09-07, When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "—" y "Sin registros recientes", y no "Faltan registros para calcularlo".
- **AC-003.14:** Given las mediciones de AC-003.10 y otra del 2026-10-11 solo con grasa, When abre `/body-metrics`, Then la tarjeta "Ritmo" sigue mostrando "—" y "Sin registros recientes".

### REQ-004 — Ritmo frente a la meta

WHEN la tarjeta "Ritmo" muestra un ritmo y el perfil tiene meta THE SYSTEM SHALL mostrar debajo un estado que compara el ritmo, expresado en % del peso de la última medición de peso por semana, con el rango esperado de la meta (tabla de la sección 6, límites incluidos):

- dentro del rango: "En ritmo con tu meta";
- en las metas de perder o aumentar peso, fuera del rango por quedarse corto en la dirección de la meta (incluido ir en la dirección contraria): "Más lento que tu meta";
- en esas metas, fuera del rango por pasarse en la dirección de la meta: "Más rápido que tu meta";
- en la meta de mantener, fuera del rango por cualquiera de los dos lados: "Fuera del rango de tu meta" (Q4), con el mismo aviso visual que "Más lento que tu meta" y "Más rápido que tu meta".

- **AC-004.1:** Given las mediciones de AC-003.1 (-0,5 kg/sem con 78,5 kg, es decir, -0,64 % por semana) y meta `lose`, When abre `/body-metrics`, Then ve "En ritmo con tu meta".
- **AC-004.2:** Given las mismas mediciones y meta `lose_slow`, When abre `/body-metrics`, Then ve "Más rápido que tu meta".
- **AC-004.3:** Given las mismas mediciones y meta `gain`, When abre `/body-metrics`, Then ve "Más lento que tu meta".
- **AC-004.4:** Given las mismas mediciones y meta `maintain`, When abre `/body-metrics`, Then ve "Fuera del rango de tu meta", con el mismo aviso visual que "Más rápido que tu meta", y no ve "Más rápido que tu meta" ni "Más lento que tu meta".
- **AC-004.5:** Given mediciones de peso semanales constantes (ritmo 0) y meta `maintain`, When abre `/body-metrics`, Then ve "En ritmo con tu meta".
- **AC-004.6:** Given un ritmo de -0,3 % por semana y meta `lose`, When se evalúa el estado, Then es "Más lento que tu meta"; y con -1,2 % por semana, "Más rápido que tu meta".
- **AC-004.7:** Given un ritmo de +0,3 % por semana y meta `lose`, When se evalúa el estado, Then es "Más lento que tu meta" (va en la dirección contraria a la meta).
- **AC-004.8:** Given un ritmo de +0,3 % por semana y meta `gain_slow`, When se evalúa el estado, Then es "Más rápido que tu meta"; y con +0,05 % por semana, "Más lento que tu meta".
- **AC-004.9:** Given un ritmo exactamente igual a cada límite de la tabla de la sección 6 (por ejemplo, -1 % y -0,5 % por semana con meta `lose`, o -0,2 % y +0,2 % con `maintain`), When se evalúa el estado, Then es "En ritmo con tu meta".
- **AC-004.10:** Given que la tarjeta "Ritmo" muestra "—" por falta de registros (caso de AC-003.4), When el usuario la mira, Then ve "Faltan registros para calcularlo" y ningún estado de meta.
- **AC-004.11:** Given que el perfil no está disponible (Q5), When la tarjeta "Ritmo" muestra un ritmo, Then no muestra ningún estado de meta ni "Faltan registros para calcularlo".
- **AC-004.12:** Given un ritmo de +0,3 % por semana y meta `maintain`, When se evalúa el estado, Then es "Fuera del rango de tu meta"; y con -0,3 % por semana, también "Fuera del rango de tu meta".
- **AC-004.13:** Given que la tarjeta "Ritmo" muestra "—" y "Sin registros recientes" (REQ-003, Q6), When el usuario la mira, Then no ve ningún estado de meta.

### REQ-005 — Tendencia de 7 días en el gráfico de peso

WHILE el gráfico "Evolución" muestra el peso THE SYSTEM SHALL dibujar, para cada medición de peso del periodo elegido (1M, 3M o 1A: desde la misma fecha de hace 1, 3 o 12 meses hasta hoy), un punto de la línea "Tendencia (7 días)" con el promedio de los pesos de las mediciones de ese día y de los 6 días anteriores, **incluidas las anteriores al inicio del periodo** (Q1), en la unidad del perfil y redondeado a un decimal. Las mediciones anteriores al periodo cuentan para el promedio pero no se dibujan. Con el % de grasa o el % de masa muscular no se dibuja tendencia.

- **AC-005.1:** Given el periodo 1M (desde el 2026-09-12) y mediciones de peso del 2026-09-08 (82), del 2026-09-10 (81) y del 2026-09-13 (80), When se calcula la tendencia, Then el punto del 2026-09-13 vale 81 (promedio de las tres) y no hay puntos del 2026-09-08 ni del 2026-09-10.
- **AC-005.2:** Given mediciones de peso del 2026-09-06 (90) y del 2026-09-13 (80), When se calcula la tendencia, Then el punto del 2026-09-13 vale 80 (una medición de 7 días antes ya no cuenta).
- **AC-005.3:** Given mediciones de peso del 2026-10-05 (80), del 2026-10-08 (79) y del 2026-10-11 (78,5), When se calcula la tendencia, Then los puntos valen 80 el 2026-10-05, 79,5 el 2026-10-08 y 79,2 el 2026-10-11.
- **AC-005.4:** Given mediciones de peso del 2026-10-08 (80) y del 2026-10-11 (81) y un perfil en lb, When se calcula la tendencia, Then el punto del 2026-10-11 vale 177,5.
- **AC-005.5:** Given mediciones del 2026-10-08 (peso 80) y del 2026-10-11 (solo grasa), When se calcula la tendencia, Then solo hay un punto, el del 2026-10-08, que vale 80.
- **AC-005.6:** Given que el gráfico muestra el % de grasa, When el usuario lo mira, Then no se dibuja la línea de tendencia ni aparece la leyenda "Tendencia (7 días)".

### REQ-006 — Composición corporal

WHEN el usuario con mediciones abre `/body-metrics` THE SYSTEM SHALL mostrar en "Composición corporal", a partir de su última medición con peso y % de grasa a la vez:

- "Masa grasa" = peso × % de grasa / 100, en la unidad del perfil;
- "Masa magra" = peso − masa grasa, en la unidad del perfil;
- "FFMI" = masa magra en kg / (altura del perfil en m)², con un decimal;
- la descripción "Según tu medición del {fecha}.", con la fecha de esa medición.

Si no hay ninguna medición con peso y % de grasa, los tres valores muestran "—" y la descripción es "Registra tu % de grasa en el perfil para ver tu masa grasa y magra.".

- **AC-006.1:** Given una medición del 2026-10-05 con peso 80 y grasa 20, When abre `/body-metrics`, Then ve "Masa grasa" con "16 kg", "Masa magra" con "64 kg", "FFMI" con "20,9" y "Según tu medición del {fecha del 2026-10-05}.".
- **AC-006.2:** Given el caso de AC-006.1 y otra medición posterior, del 2026-10-11, solo con peso 78,5, When abre `/body-metrics`, Then la masa grasa, la masa magra, el FFMI y la descripción siguen siendo los de la medición del 2026-10-05.
- **AC-006.3:** Given el caso de AC-006.1 con un perfil en lb, When abre `/body-metrics`, Then ve "35,3 lb" en "Masa grasa" y "141,1 lb" en "Masa magra", y el FFMI sigue siendo "20,9".
- **AC-006.4:** Given el caso de AC-006.1 con un perfil cuya altura es 5 ft 9 in, When abre `/body-metrics`, Then el FFMI es "20,8".
- **AC-006.5:** Given mediciones de peso y ninguna con % de grasa, When abre `/body-metrics`, Then "Masa grasa", "Masa magra" y "FFMI" muestran "—" y la descripción es "Registra tu % de grasa en el perfil para ver tu masa grasa y magra.".
- **AC-006.6:** Given una medición del 2026-10-11 con grasa 20 y sin peso, y otra del 2026-10-05 con peso 80 y sin grasa, When abre `/body-metrics`, Then "Masa grasa", "Masa magra" y "FFMI" muestran "—" (no se combinan valores de mediciones distintas).

### REQ-007 — IMC

WHEN el usuario con mediciones abre `/body-metrics` THE SYSTEM SHALL mostrar en "IMC" el peso de su última medición de peso en kg dividido por el cuadrado de la altura del perfil en metros, con un decimal; sin mediciones de peso, "—". El IMC no necesita % de grasa.

- **AC-007.1:** Given una última medición de peso de 78,5 kg y una altura de 175 cm, When abre `/body-metrics`, Then el IMC es "25,6".
- **AC-007.2:** Given el caso de AC-006.2 (composición del 2026-10-05 con 80 kg, última medición de peso del 2026-10-11 con 78,5 kg), When abre `/body-metrics`, Then el IMC es "25,6" (usa la última medición de peso, no la de la composición).
- **AC-007.3:** Given una medición de peso de 80 kg y una altura de 5 ft 9 in, When abre `/body-metrics`, Then el IMC es "26".
- **AC-007.4:** Given solo mediciones sin peso, When abre `/body-metrics`, Then el IMC es "—".
- **AC-007.5:** Given el caso de AC-007.1 con un perfil en lb, When abre `/body-metrics`, Then el IMC sigue siendo "25,6".

### REQ-008 — Racha

WHEN el usuario con mediciones abre `/body-metrics` THE SYSTEM SHALL mostrar en "Racha" el número de semanas seguidas (de lunes a domingo) con al menos una medición, contando hacia atrás desde la semana de hoy (fecha del dispositivo). Si la semana de hoy aún no tiene mediciones, la cuenta empieza en la semana anterior; si esa tampoco tiene, la racha es 0. El texto es "1 semana" o "{n} semanas" (incluido "0 semanas"), con la ayuda "Semanas seguidas con al menos un registro".

- **AC-008.1:** Given mediciones del 2026-10-12, del 2026-10-05 y del 2026-09-28, When abre `/body-metrics`, Then "Racha" muestra "3 semanas".
- **AC-008.2:** Given mediciones del 2026-10-09 y del 2026-10-01 y ninguna esta semana, When abre `/body-metrics`, Then "Racha" muestra "2 semanas" (la semana actual sin mediciones no rompe la racha).
- **AC-008.3:** Given mediciones del 2026-10-12 y del 2026-09-28 y ninguna en la semana del 2026-10-05, When abre `/body-metrics`, Then "Racha" muestra "1 semana".
- **AC-008.4:** Given una sola medición, del 2026-09-30, When abre `/body-metrics`, Then "Racha" muestra "0 semanas".
- **AC-008.5:** Given que hoy es el domingo 2026-10-18 y hay mediciones del 2026-10-12 y del 2026-10-05, When abre `/body-metrics`, Then "Racha" muestra "2 semanas" (el lunes 12 y el domingo 18 son la misma semana).
- **AC-008.6:** Given mediciones de los días 2026-10-06, 2026-10-08 y 2026-10-11, When abre `/body-metrics`, Then "Racha" muestra "1 semana" (varias mediciones en la misma semana cuentan una vez).

### REQ-009 — Registros, total y último registro

WHEN el usuario con mediciones abre `/body-metrics` THE SYSTEM SHALL mostrar en "Constancia":

- en "Últimos 30 días", el número de mediciones con fecha entre 30 días antes de hoy (fecha del dispositivo) y hoy, ambos incluidos, con el texto "1 registro" si es una y "{n} registros" en cualquier otro caso (incluido "0 registros"), y la ayuda "{total} en total" con el número total de mediciones;
- en "Último registro", la fecha de la medición más reciente.

Cuentan todas las mediciones, tengan peso, % de grasa o % de masa muscular.

- **AC-009.1:** Given mediciones del 2026-09-11, del 2026-09-12 y del 2026-10-12, When abre `/body-metrics`, Then "Últimos 30 días" muestra "2 registros" y "3 en total".
- **AC-009.2:** Given una sola medición en los últimos 30 días y 5 en total, When abre `/body-metrics`, Then "Últimos 30 días" muestra "1 registro" (y no "1 registros") y "5 en total".
- **AC-009.3:** Given solo mediciones anteriores al 2026-09-12, When abre `/body-metrics`, Then "Últimos 30 días" muestra "0 registros".
- **AC-009.4:** Given mediciones del 2026-10-05 (solo peso) y del 2026-10-11 (solo grasa), When abre `/body-metrics`, Then "Últimos 30 días" muestra "2 registros" y "Último registro" muestra la fecha del 2026-10-11.
- **AC-009.5:** Given una sola medición, del 2026-10-11, When abre `/body-metrics`, Then "Últimos 30 días" muestra "1 registro", "1 en total" y "Último registro" muestra la fecha del 2026-10-11.

### REQ-010 — Indicadores sin el perfil disponible

WHILE el perfil del usuario no está disponible (se está cargando o su carga falló) y hay mediciones THE SYSTEM SHALL mostrar los indicadores con los pesos en kg, sin estado de meta en el ritmo, y con "—" en "IMC" y "FFMI" (Q5). Cuando el perfil llega, los indicadores pasan a usar su unidad, su altura y su meta sin recargar la página.

- **AC-010.1:** Given mediciones con peso y % de grasa y un perfil cuya carga falla, When abre `/body-metrics`, Then los pesos se muestran en kg, "IMC" y "FFMI" muestran "—" (nunca "∞", "NaN" ni "0") y la masa grasa y la masa magra se muestran en kg.
- **AC-010.2:** Given las mediciones de AC-003.1 y un perfil cuya carga falla, When abre `/body-metrics`, Then la tarjeta "Ritmo" muestra "-0,5 kg/sem" sin estado de meta.
- **AC-010.3:** Given un perfil en lb que tarda en cargarse, When termina de cargarse, Then la tarjeta "Peso" pasa a mostrar el peso en lb y el IMC y el FFMI muestran su valor, sin recargar la página.

## 5. Requisitos no funcionales

No aplican requisitos no funcionales propios de esta feature: no hay endpoints nuevos ni cambios de acceso a datos (los indicadores se calculan con las mediciones y el perfil que la pantalla ya obtiene con sesión).

## 6. Datos y contratos visibles

**Sin cambios de contrato con el servidor.** Los indicadores parten de `GET /api/body-metrics` (mediciones) y `GET /api/profile` (unidad de peso, altura y meta), tal como están tras las specs 006 y 008.

**Rango de ritmo esperado por meta** (en % del peso de la última medición de peso por semana; límites incluidos; confirmados en Q2):

| Meta (`goal`) | Texto de la meta en la app | Rango esperado |
|---|---|---|
| `lose` | Perder peso | de -1 a -0,5 |
| `lose_slow` | Perder peso lentamente | de -0,5 a -0,25 |
| `maintain` | Mantener peso | de -0,2 a +0,2 |
| `gain_slow` | Aumentar peso lentamente | de +0,1 a +0,25 |
| `gain` | Aumentar peso | de +0,25 a +0,5 |

**Ventanas y mínimos:**

| Indicador | Regla |
|---|---|
| Cambio "en 30 días" (peso y grasa) | Referencia: la medición más reciente con fecha igual o anterior a 30 días antes de la última; si no hay, la primera |
| Ritmo | Mediciones de peso de los 28 días anteriores a la última (incluidos); mínimo 3 mediciones y 10 días entre la primera y la última. Si la última medición de peso es anterior a hoy menos 28 días, no se calcula ("Sin registros recientes") |
| Tendencia | Mediciones de peso del mismo día y de los 6 anteriores, también las anteriores al periodo del gráfico |
| Racha | Semanas de lunes a domingo; la semana actual sin mediciones no la rompe |
| Últimos 30 días | Mediciones con fecha entre hoy menos 30 días y hoy, ambos incluidos |

**Textos visibles:**
- Tarjetas: "Peso", "Ritmo", "% Grasa". Valor ausente: "—".
- Cambio de peso: "{cambio} kg en 30 días" o "{cambio} lb en 30 días". Cambio de grasa: "{cambio} pts en 30 días".
- Ritmo: "{ritmo} kg/sem" o "{ritmo} lb/sem"; sin datos suficientes: "Faltan registros para calcularlo"; con la última medición de peso de hace más de 28 días: "Sin registros recientes".
- Estado del ritmo: "En ritmo con tu meta", "Más lento que tu meta", "Más rápido que tu meta" y, en la meta de mantener fuera de rango, "Fuera del rango de tu meta".
- Gráfico: leyendas "Registro" y "Tendencia (7 días)" (solo con el peso).
- Composición: "Masa grasa", "Masa magra", "IMC", "FFMI" (ayuda: "Índice de masa libre de grasa"); descripciones "Según tu medición del {fecha}." y "Registra tu % de grasa en el perfil para ver tu masa grasa y magra.".
- Constancia: "Racha" ("1 semana" / "{n} semanas"; ayuda "Semanas seguidas con al menos un registro"), "Últimos 30 días" ("1 registro" / "{n} registros"; ayuda "{total} en total"), "Último registro" ({fecha}).

**Datos existentes:** no cambian. Los indicadores se recalculan con las mediciones que ya existen.

## 7. Preguntas abiertas

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | (Q8 de la spec 008) La tendencia de 7 días ignora las mediciones anteriores al inicio del periodo elegido, así que sus primeros puntos usan menos datos. **Propuesta:** incluirlas en el cálculo, aunque no se dibujen. | **Resuelta** en la spec 008 (usuario: "2. Todas las propuestas."). Incorporada en REQ-005 (AC-005.1, AC-005.2). |
| Q2 | (Q9 de la spec 008) Los rangos de ritmo esperado por meta se marcaron como provisionales en la fase de diseño. **Propuesta:** confirmar los actuales. | **Resuelta** en la spec 008 (usuario: "2. Todas las propuestas."). Incorporada en REQ-004 y en la tabla de la sección 6. |
| Q3 | (Q10 de la spec 008) El cambio del KPI se rotula "en 30 días" aunque, con menos de 30 días de historial, se compara con la primera medición. **Propuesta:** mantener el texto actual. | **Resuelta** en la spec 008 (usuario: "2. Todas las propuestas."). Incorporada en REQ-001 (AC-001.3). |
| Q4 | Con la meta "Mantener peso", hoy cualquier ritmo fuera de -0,2 a +0,2 % por semana se rotula "Más rápido que tu meta", aunque no tenga sentido hablar de "rápido" al mantener. **Propuesta:** en esa meta, fuera del rango, mostrar "Fuera del rango de tu meta" (con el mismo aviso visual que los otros estados fuera de rango). Alternativa: mantener "Más rápido que tu meta". | **Resuelta** (usuario: "Q4 y Q5 propuesta, Q6 alternativa"): propuesta. Incorporada en REQ-004 (AC-004.4, AC-004.12) y en la sección 6. |
| Q5 | Mientras el perfil se carga o si su carga falla, hoy el IMC y el FFMI se calculan con una altura de 0 y muestran un valor sin sentido, y los pesos salen en kg. **Propuesta:** en ese caso, pesos en kg, sin estado de meta en el ritmo y "—" en IMC y FFMI; al llegar el perfil, todo se actualiza sin recargar (REQ-010). Alternativa: no mostrar los indicadores hasta que llegue el perfil. | **Resuelta** (usuario: "Q4 y Q5 propuesta, Q6 alternativa"): propuesta. Incorporada en REQ-010 (AC-010.1 a AC-010.3) y AC-004.11. |
| Q6 | El ritmo y el cambio "en 30 días" se calculan respecto a la **última medición**, no a hoy: si el usuario no registra nada desde hace dos meses, siguen mostrando el ritmo y el cambio de entonces. **Propuesta:** mantenerlo así (la sección "Constancia" ya muestra la fecha del último registro). Alternativa: si la última medición de peso tiene más de 28 días, mostrar "—" en "Ritmo" con un texto como "Sin registros recientes". | **Resuelta** (usuario: "Q4 y Q5 propuesta, Q6 alternativa"): alternativa, con el texto "Sin registros recientes"; el límite de 28 días se cuenta desde hoy (fecha del dispositivo) y una medición de exactamente 28 días sigue siendo reciente. Solo afecta al ritmo: el cambio "en 30 días" no cambia. Incorporada en REQ-003 (AC-003.10 a AC-003.14), AC-001.9, AC-004.13 y la sección 6. |

## 8. Glosario

- **Medición de peso / de grasa:** medición que tiene peso / % de grasa (puede tener también los demás valores).
- **Última medición de peso:** la medición de fecha más reciente que tiene peso.
- **Referencia (del cambio en 30 días):** la medición más reciente con fecha igual o anterior a 30 días antes de la última; si no hay, la primera.
- **Ritmo:** cambio de peso por semana según la recta de mejor ajuste de las mediciones de peso de los 28 días anteriores a la última medición de peso; solo se muestra si esa medición es de hace 28 días o menos.
- **Tendencia (7 días):** promedio de los pesos de un día y de los 6 anteriores.
- **FFMI:** índice de masa libre de grasa, masa magra en kg / altura en m².
- **IMC:** índice de masa corporal, peso en kg / altura en m².
- **Hoy:** la fecha del dispositivo del usuario.
