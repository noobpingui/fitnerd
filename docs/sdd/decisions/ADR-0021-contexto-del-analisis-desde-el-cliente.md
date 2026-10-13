# ADR-0021: Contexto del análisis de progreso calculado en el cliente y sugerencia de calorías calculada en el servidor

- **Estado:** Aceptada · 2026-10-13 (aprobada por el usuario con el plan de la feature `010-progress-analysis-context`)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate de plan.

## Contexto
La spec 010 pide que el análisis de progreso (`POST /api/body-metrics/analysis`) reciba los indicadores de Métricas (spec 009) y las calorías de Macros (spec 007) **con los mismos valores y textos que ve el usuario ese día**, y que el sistema calcule con una regla fija un ajuste de calorías que se envía al modelo y se muestra en pantalla. Los indicadores y las calorías se calculan hoy solo en el frontend, como funciones puras (`insights.ts`, `macros/calculations.ts`), y "hoy" es la fecha del dispositivo.

Opciones consideradas:
1. **Portar a Python** los indicadores, el cálculo de Mifflin-St Jeor y el formato de números. Duplica dos specs enteras; el redondeo de `Intl.NumberFormat`/`Math.round` (mitades hacia arriba) y el de Python (`round`, mitades a par) divergen en los bordes, y el servidor no conoce la fecha del dispositivo.
2. **Calcularlo todo en el cliente**, incluida la sugerencia, y que el servidor solo pegue el texto. La regla de negocio nueva quedaría fuera de `services/` y el texto del modelo y el bloque en pantalla dependerían de dos cálculos distintos.
3. **Híbrido:** el cliente envía los indicadores ya formateados (los mismos textos que pinta Métricas, producidos por la misma función), el estado del ritmo como código, el ritmo bruto y las calorías de Macros; el servidor valida el cuerpo, añade el perfil desde la base (sexo, edad, altura, actividad y meta), calcula la sugerencia y la devuelve en la respuesta junto al análisis.

## Decisión
Opción 3.
- El frontend extrae el cálculo y el formato de los indicadores de `BodyMetricsPage` a funciones puras que usan tanto la página como el constructor del cuerpo de la petición, de modo que lo que se envía es literalmente lo que se ve.
- El servidor no confía en el cliente para nada que identifique o describa al usuario: el perfil, la edad (desde `users.date_of_birth`) y el historial salen de la base filtrados por el `user_id` del token. Los textos de indicadores se validan con una lista blanca de caracteres y una longitud máxima; los números, con rangos; la fecha `today` del cliente se acepta solo a ±1 día de la fecha UTC del servidor.
- La regla del ajuste (punto medio de la meta, 7700 kcal/kg, redondeo a 50, tope de 500 y suelo por sexo) vive en `backend/services/calorie_suggestion.py`, se calcula una sola vez por análisis y alimenta tanto el mensaje al modelo como el campo `calorie_suggestion` de la respuesta.

## Consecuencias
- (+) Una sola fuente de verdad para indicadores y calorías: lo que recibe el modelo coincide con lo que ve el usuario, sin duplicar specs 007 y 009 en Python.
- (+) La regla nueva se prueba con pytest sin Postgres, y el bloque de la pantalla y el texto del modelo usan la misma cifra.
- (−) El servidor confía en los indicadores y calorías que envía el cliente. Un cliente manipulado solo puede alterar su propio análisis (los datos se envían al modelo en nombre del mismo usuario y el límite de 2 análisis por día sigue en el servidor); se acota con validación de formato y rangos.
- (−) El endpoint, que antes no tenía cuerpo, pasa a exigir uno (400 si es inválido) cuando el usuario tiene perfil y mediciones.
