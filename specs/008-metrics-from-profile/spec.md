# Spec 008 — Mediciones de Métricas coherentes con el perfil

- **Feature:** `008-metrics-from-profile` · **Tipo:** feature
- **Ámbito:** ambos

## 1. Contexto y problema

En la rama de rediseño, las mediciones de Métricas (peso, % de grasa y % de masa muscular) solo se registran desde la página de perfil. Cada vez que el usuario guarda un cambio de peso o de composición en "Datos físicos", la app crea una medición nueva. La pantalla Métricas (`/body-metrics`) muestra después los indicadores de progreso calculados a partir de esas mediciones.

Hoy esto tiene tres problemas de integridad de los datos:

1. **Mediciones duplicadas:** si el usuario guarda el perfil dos veces el mismo día, quedan dos mediciones con la misma fecha. Eso distorsiona la media móvil, el ritmo, la racha y el recuento de registros.
2. **Sin forma de corregir:** la app no permite corregir ni borrar una medición, aunque el servidor ya permite borrarla. Un error de tecleo se queda para siempre en las gráficas.
3. **Peso contradictorio:** el peso del perfil (el que usan el home y Macros) y la última medición de peso (la que usa Métricas) pueden no coincidir. Por ejemplo, si se corrige o se borra la última medición, el perfil sigue con el valor anterior.

Además, "hoy" es la fecha del servidor (UTC), no la del usuario. Alguien en Costa Rica que guarda a las 20:00 registra la medición en el día siguiente.

Esta spec cubre solo la integridad de las mediciones (bloque A). La especificación y los tests de los indicadores de Métricas (bloque B) van en una feature aparte (Q14).

## 2. Historia de usuario

Como **usuario con el onboarding completado**, quiero **tener una sola medición por día, poder corregir o borrar las que registré mal y que el peso de mi perfil coincida siempre con mi última medición** para **confiar en las gráficas e indicadores de mi progreso y en las calorías que me calcula la app**.

## 3. Alcance

**Incluye:**
- Una sola medición por usuario y día: guardar una medición de un día que ya tiene una la actualiza en lugar de crear otra.
- Usar como "hoy" la fecha del dispositivo del usuario al registrar desde el perfil.
- Corregir una medición existente (peso, % de grasa y % de masa muscular) y borrarla, desde un historial en la pantalla Métricas.
- Mantener el peso del perfil igual al de la última medición de peso cuando se crea, se corrige o se borra una medición.
- Consolidar las mediciones duplicadas que ya existen (varias del mismo usuario en el mismo día) en una sola por día.
- Validar en el servidor los rangos de las mediciones con los mismos límites que la app, y la fecha de la medición.
- Que Métricas, el perfil, el home y Macros reflejen sin recargar las correcciones y los borrados.

**Fuera de alcance:**
- **Bloque B, indicadores de Métricas (feature aparte, solo de frontend; Q14):** especificar como comportamiento observable y cubrir con tests los KPI de peso y de % de grasa con su cambio en 30 días, el ritmo semanal frente a la meta (con los rangos por meta, Q9), la media móvil de 7 días (incluidas las mediciones anteriores al periodo, Q8), la composición corporal, el IMC, el FFMI y la constancia (racha, últimos 30 días, total y último registro), el rótulo "en 30 días" (Q10) y el cambio de "1 registros" a "1 registro". Esta feature no cambia cómo se calculan ni cómo se muestran esos indicadores; solo cambian los datos de los que parten.
- Registrar mediciones desde Métricas o con una fecha pasada: se siguen registrando solo desde el perfil, con la fecha de hoy.
- Cambiar la fecha de una medición existente (Q7).
- Ver o editar las notas de una medición: no aparecen en la app y se conservan tal cual (Q12).
- Registrar el peso del onboarding como medición (sigue fuera de alcance, como en la spec 006).
- Cambiar el análisis del coach de IA, el gráfico o el diseño general de Métricas (salvo la sección "Historial" nueva).
- Mover el cálculo de los indicadores al servidor.
- Hacer atómico el guardado del perfil y el de la medición (Q6).
- Sincronizar el perfil con las mediciones como parte de la consolidación de duplicados: el perfil se sincroniza en el siguiente cambio de mediciones (Q5).

## 4. Requisitos funcionales

> Salvo que se diga otra cosa, los pesos de las mediciones están en kg, que es como los guarda el servidor. En las pantallas, los pesos se muestran en la unidad del perfil: 1 lb = 0,45359237 kg, con un decimal. Los números se muestran con coma decimal y sin decimales si son enteros (por ejemplo, "78,4", "78" y "-0,6"). En los AC del frontend, la fecha del dispositivo es el lunes 12 de octubre de 2026, salvo que se diga otra cosa.

### REQ-001 — Una sola medición por día

WHEN un usuario autenticado registra una medición con una fecha en la que ya tiene una medición THE SYSTEM SHALL actualizar esa medición en lugar de crear otra y responder `200` con la medición resultante. Los valores que se envían sustituyen a los que había, y los que no se envían (o se envían como `null`) se conservan. Si no tenía ninguna medición en esa fecha, la crea y responde `201`, como hasta ahora.

- **AC-001.1:** Given un usuario sin mediciones el 2026-10-12, When registra `{"weight": 80, "recorded_at": "2026-10-12"}`, Then recibe `201` y su historial tiene una medición del 2026-10-12 con peso 80.
- **AC-001.2:** Given un usuario con una medición del 2026-10-12 con peso 80 y grasa 20, When registra `{"weight": 79.5, "recorded_at": "2026-10-12"}`, Then recibe `200` con el mismo `id` que la medición existente, peso 79,5 y grasa 20, y su historial sigue teniendo una sola medición del 2026-10-12.
- **AC-001.3:** Given un usuario con una medición del 2026-10-12 con peso 80, When registra `{"body_fat_percentage": 18, "muscle_mass_percentage": 40, "recorded_at": "2026-10-12"}`, Then la medición del 2026-10-12 queda con peso 80, grasa 18 y masa muscular 40.
- **AC-001.4:** Given un usuario con una medición del 2026-10-11, When registra una medición del 2026-10-12, Then recibe `201` y su historial tiene dos mediciones, una por cada día.
- **AC-001.5:** Given que el usuario A tiene una medición del 2026-10-12, When el usuario B registra una medición del 2026-10-12, Then se crea una medición nueva para B (`201`) y la de A no cambia.
- **AC-001.6:** Given una petición de registro sin `recorded_at`, When se envía, Then la medición se registra con la fecha actual del servidor (UTC), con la misma regla de un registro por día.
- **AC-001.7:** Given cualquier secuencia de registros, correcciones y borrados de un usuario, When se lee su historial, Then no hay dos mediciones con la misma fecha.

### REQ-002 — Validar las mediciones

IF una medición que se registra o se corrige falta, no tiene ningún valor o tiene algún valor fuera de lo permitido THEN THE SYSTEM SHALL responder `400` con `{"error": …}` y el mensaje correspondiente de la sección 6 y no crear, modificar ni borrar ninguna medición ni el perfil.

- **AC-002.1:** Given un registro sin peso, sin % de grasa y sin % de masa muscular (ausentes o `null`), When se envía, Then `400` con "Debe registrar al menos un valor (peso, % de grasa o % de masa muscular)".
- **AC-002.2:** Given un registro con `weight` no numérico (incluido un número como texto, como `"80"`), menor que 29,9 o mayor que 300, When se envía, Then `400` con "El peso debe estar entre 29,9 y 300 kg".
- **AC-002.3:** Given un registro con `body_fat_percentage` no numérico, menor que 3 o mayor que 60, When se envía, Then `400` con "El porcentaje de grasa corporal debe estar entre 3 y 60".
- **AC-002.4:** Given un registro con `muscle_mass_percentage` no numérico, menor que 10 o mayor que 70, When se envía, Then `400` con "El porcentaje de masa muscular debe estar entre 10 y 70".
- **AC-002.5:** Given un registro con `recorded_at` que no es texto, que no tiene el formato `AAAA-MM-DD` o que no es una fecha real (por ejemplo `"2026-02-30"`), When se envía, Then `400` con "La fecha de la medición no es válida".
- **AC-002.6:** Given un registro con `recorded_at` posterior en más de un día a la fecha actual del servidor (UTC), When se envía, Then `400` con "La fecha de la medición no puede ser futura". Con la fecha del servidor en el 2026-10-12, `"2026-10-13"` se acepta y `"2026-10-14"` se rechaza.
- **AC-002.7:** Given una petición de registro o de corrección sin cuerpo JSON o con un cuerpo que no es un objeto, When se envía, Then `400` con "Los datos de la medición no son válidos".
- **AC-002.8:** Given los valores límite (peso 29,9 y 300; grasa 3 y 60; masa muscular 10 y 70), When se registran, Then se aceptan.
- **AC-002.9:** Given una medición del 2026-10-12 con peso 80, When se registra para el 2026-10-12 un peso de 400, Then `400` y la medición sigue con peso 80.
- **AC-002.10:** Given una medición guardada antes de esta feature con un valor fuera de los rangos nuevos (por ejemplo, grasa 2), When el usuario lee su historial, Then la medición aparece con ese valor sin cambios.

### REQ-003 — Corregir una medición

WHEN un usuario autenticado corrige una de sus mediciones THE SYSTEM SHALL sustituir su peso, su % de grasa y su % de masa muscular por los enviados (un campo ausente o `null` queda sin valor), conservar su fecha y sus notas, y responder `200` con la medición corregida.

- **AC-003.1:** Given una medición del 2026-10-05 con peso 80, grasa 20 y masa muscular 40, When el usuario la corrige con `{"weight": 79, "body_fat_percentage": 19}`, Then recibe `200` con peso 79, grasa 19, masa muscular `null` y `recorded_at` `"2026-10-05"`.
- **AC-003.2:** Given una medición con notas `"tras vacaciones"`, When se corrige, Then conserva las notas.
- **AC-003.3:** Given una corrección que incluye `recorded_at: "2026-10-01"`, When se envía, Then la fecha de la medición no cambia.
- **AC-003.4:** Given una corrección sin ningún valor (los tres ausentes o `null`), When se envía, Then `400` con "Debe registrar al menos un valor (peso, % de grasa o % de masa muscular)" y la medición no cambia.
- **AC-003.5:** Given un identificador que no existe o que pertenece a otro usuario, When se intenta corregir, Then `404` con "Registro no encontrado" y ninguna medición cambia.

### REQ-004 — Borrar una medición

WHEN un usuario autenticado borra una de sus mediciones THE SYSTEM SHALL eliminarla y responder `204`.

- **AC-004.1:** Given una medición del usuario, When la borra, Then recibe `204` y deja de aparecer en su historial.
- **AC-004.2:** Given un identificador que no existe o que pertenece a otro usuario, When se intenta borrar, Then `404` con "Registro no encontrado" y ninguna medición se borra.

### REQ-005 — El peso del perfil sigue a la última medición de peso

WHEN un usuario con perfil registra, corrige o borra una medición y, como resultado, el peso de su **última medición de peso** (la de fecha más reciente que tiene peso) difiere en más de 0,05 kg del peso de su perfil (convertido a kg) THE SYSTEM SHALL cambiar el peso del perfil por el de esa medición, convertido a la unidad de peso del perfil y redondeado a un decimal. Si el resultado queda fuera del rango del perfil (spec 006: 30–300 kg o 66–660 lb), se ajusta al límite más cercano.

El cambio no modifica ningún otro dato del perfil (unidades, altura, actividad ni meta), la fecha de nacimiento ni el estado del onboarding.

- **AC-005.1:** Given un perfil en kg con peso 80 y una última medición del 2026-10-11 con peso 80, When el usuario corrige esa medición a 78,4, Then una lectura del perfil devuelve `weight: 78.4` y `weight_unit: "kg"`.
- **AC-005.2:** Given un perfil en lb con peso 173,1 (78,5 kg) y mediciones del 2026-10-05 (80 kg) y del 2026-10-11 (78,5 kg), When el usuario borra la del 2026-10-11, Then el perfil devuelve `weight: 176.4` (80 kg = 176,4 lb) y `weight_unit: "lb"`.
- **AC-005.3:** Given un perfil en kg con peso 78,5 y mediciones del 2026-10-05 (80 kg) y del 2026-10-11 (78,5 kg), When el usuario borra la del 2026-10-11, Then el perfil devuelve `weight: 80`.
- **AC-005.4:** Given mediciones del 2026-10-05 (80 kg) y del 2026-10-11 (78,5 kg) y un perfil con peso 78,5 kg, When el usuario corrige la del 2026-10-05 a 81, Then el peso del perfil sigue siendo 78,5.
- **AC-005.5:** Given un perfil en lb con peso 173 (78,47 kg) y una última medición de 78,5 kg, When se registra cualquier medición de una fecha anterior, Then el peso del perfil sigue siendo 173 (la diferencia es de 0,05 kg o menos).
- **AC-005.6:** Given un perfil con peso 80 kg y una sola medición con peso, When el usuario la borra, Then el peso del perfil sigue siendo 80.
- **AC-005.7:** Given una última medición del 2026-10-11 con peso 78 y grasa 20 y una medición del 2026-10-05 con peso 80, When el usuario corrige la del 2026-10-11 dejando solo la grasa (peso `null`), Then el peso del perfil pasa a 80.
- **AC-005.8:** Given un perfil en kg con peso 31, When el usuario registra una medición de hoy con peso 29,9, Then el peso del perfil pasa a 30 (límite del rango del perfil).
- **AC-005.9:** Given un usuario sin perfil (onboarding pendiente), When registra una medición, Then la medición se guarda, el usuario sigue sin perfil y el onboarding sigue pendiente.
- **AC-005.10:** Given un usuario con el onboarding completado, When cualquiera de sus mediciones cambia el peso del perfil, Then `onboarding_completed_at`, `date_of_birth` y los demás campos del perfil devuelven los mismos valores que antes.

### REQ-006 — Consolidar las mediciones duplicadas que ya existen

WHEN se despliega esta feature THE SYSTEM SHALL dejar una sola medición por usuario y fecha. En cada grupo de mediciones del mismo usuario y fecha, cada campo (peso, % de grasa, % de masa muscular y notas) toma el valor de la medición **registrada más tarde** que tenga ese campo con valor, y el resto de las mediciones del grupo se eliminan.

- **AC-006.1:** Given un usuario con dos mediciones del 2026-10-10: la primera registrada con peso 80 y grasa 20, y la segunda, registrada después, con peso 79,8 y sin grasa, When se aplica la consolidación, Then el usuario tiene una sola medición del 2026-10-10 con peso 79,8 y grasa 20.
- **AC-006.2:** Given un usuario con una sola medición por fecha, When se aplica la consolidación, Then sus mediciones no cambian.
- **AC-006.3:** Given dos usuarios con mediciones de la misma fecha, When se aplica la consolidación, Then cada uno conserva la suya y no se mezclan.

### REQ-007 — Guardar desde el perfil registra la medición del día del usuario

WHEN el usuario guarda en "Datos físicos" un cambio de peso o de composición THE SYSTEM SHALL registrar la medición con la fecha actual del dispositivo, de modo que un segundo guardado del mismo día actualice la medición de ese día en lugar de crear otra. El resto del comportamiento del formulario (qué valores se envían, mensajes y orden de los guardados) no cambia respecto a la spec 006.

- **AC-007.1:** Given la fecha del dispositivo 2026-10-12, When el usuario cambia el peso y pulsa "Guardar cambios", Then el servidor recibe la medición con `recorded_at: "2026-10-12"`.
- **AC-007.2:** Given un usuario que ya guardó hoy un peso de 80 kg, When cambia el peso a 79,5 kg y vuelve a guardar, Then el servidor recibe una medición con `recorded_at` de hoy y peso 79,5, se muestra "Cambios guardados" y el historial de Métricas tiene una sola fila de hoy, con 79,5 kg.
- **AC-007.3:** Given el formulario de "Datos físicos", When el usuario lo mira, Then la descripción de la sección dice "Se usan para calcular tus calorías y macros. Cada cambio de peso o composición se guarda como la medición de hoy en tu progreso; si ya hay una de hoy, se actualiza."

### REQ-008 — Historial de mediciones en Métricas

WHEN el usuario con mediciones abre `/body-metrics` THE SYSTEM SHALL mostrar, entre "Análisis del coach" y "Constancia", una sección "Historial" con sus mediciones ordenadas de la más reciente a la más antigua. Cada fila muestra la fecha, el peso en la unidad del perfil, el % de grasa y el % de masa muscular (o "—" si la medición no tiene ese valor), y los botones para corregirla y borrarla. Al principio se muestran las 10 más recientes; el botón "Mostrar más" añade las 10 siguientes y desaparece cuando ya se ven todas.

- **AC-008.1:** Given mediciones del 2026-10-05 (80 kg, grasa 20) y del 2026-10-11 (78,5 kg, sin grasa), y un perfil en kg, When abre `/body-metrics`, Then la sección "Historial" muestra primero la fila del 2026-10-11 con "78,5 kg" y "—" en grasa, y después la del 2026-10-05 con "80 kg" y "20 %".
- **AC-008.2:** Given el mismo caso con un perfil en lb, When abre `/body-metrics`, Then la fila del 2026-10-11 muestra "173,1 lb" y la del 2026-10-05, "176,4 lb".
- **AC-008.3:** Given 23 mediciones, When abre `/body-metrics`, Then ve 10 filas y el botón "Mostrar más"; al pulsarlo ve 20; al pulsarlo otra vez ve 23 y el botón desaparece.
- **AC-008.4:** Given 10 mediciones o menos, When abre `/body-metrics`, Then ve todas y no hay botón "Mostrar más".
- **AC-008.5:** Given la fila de la medición del 2026-10-11, When el usuario la mira, Then tiene un botón con el nombre accesible "Corregir medición del {fecha}" y otro con "Borrar medición del {fecha}", con la fecha en el formato de fechas de Métricas.
- **AC-008.6:** Given un usuario sin mediciones, When abre `/body-metrics`, Then sigue viendo "Aún no tienes mediciones" y no se muestra la sección "Historial".
- **AC-008.7:** Given un usuario con mediciones, When abre `/body-metrics`, Then la sección "Historial" aparece después de "Análisis del coach" y antes de "Constancia".

### REQ-009 — Corregir una medición desde el historial

WHEN el usuario pulsa el botón de corregir de una fila THE SYSTEM SHALL mostrar un formulario con el peso (en la unidad del perfil), el % de grasa y el % de masa muscular de esa medición, validar los valores con los límites de la sección 6 y, al pulsar "Guardar", enviar la corrección al servidor.

- **AC-009.1:** Given la medición del 2026-10-05 (80 kg, grasa 20, sin masa muscular) y un perfil en kg, When pulsa "Corregir medición del {fecha}", Then ve los campos "Peso (kg)" con 80, "% Grasa corporal" con 20 y "% Masa muscular" vacío, y los botones "Guardar" y "Cancelar".
- **AC-009.2:** Given el formulario de AC-009.1, When cambia el peso a 79 y pulsa "Guardar", Then el servidor recibe la corrección de esa medición con `weight: 79`, `body_fat_percentage: 20` y `muscle_mass_percentage: null`, el formulario se cierra y la fila muestra "79 kg".
- **AC-009.3:** Given un perfil en lb y una medición de 78,5 kg (se muestra 173,1 lb), When el usuario cambia solo la grasa y guarda, Then el servidor recibe `weight: 78.5` (el peso en kg no cambia por la conversión).
- **AC-009.4:** Given un perfil en lb, When el usuario escribe 160 en el peso y guarda, Then el servidor recibe el peso en kg redondeado a un decimal (`weight: 72.6`).
- **AC-009.5:** Given el formulario, When el usuario vacía los tres campos, Then ve "Registra al menos un valor" y "Guardar" está deshabilitado.
- **AC-009.6:** Given el formulario, When el usuario escribe un peso fuera de rango (por ejemplo, 301 en kg o 661 en lb), una grasa fuera de 3–60 o una masa muscular fuera de 10–70, Then ve, respectivamente, "Entre 30 y 300 kg" (o "Entre 66 y 660 lb"), "Entre 3 y 60 %" o "Entre 10 y 70 %", y "Guardar" está deshabilitado.
- **AC-009.7:** Given que la corrección está en curso, When el usuario mira el botón, Then está deshabilitado y dice "Guardando…".
- **AC-009.8:** Given que la corrección falla, When termina, Then el formulario sigue abierto con los valores que escribió el usuario y muestra "No se pudo guardar la medición. Inténtalo de nuevo.".
- **AC-009.9:** Given el formulario con cambios, When el usuario pulsa "Cancelar", Then el formulario se cierra, no se envía nada y la fila muestra los valores originales.

### REQ-010 — Borrar una medición desde el historial

WHEN el usuario pulsa el botón de borrar de una fila THE SYSTEM SHALL pedir confirmación y, solo si la confirma, borrar la medición.

- **AC-010.1:** Given la fila del 2026-10-11, When pulsa "Borrar medición del {fecha}", Then ve un diálogo con el título "¿Borrar la medición del {fecha}?", el texto "Esta acción no se puede deshacer." y los botones "Borrar" y "Cancelar".
- **AC-010.2:** Given el diálogo, When pulsa "Cancelar", Then el diálogo se cierra, no se envía nada al servidor y la fila sigue en el historial.
- **AC-010.3:** Given el diálogo, When pulsa "Borrar" y el borrado responde con éxito, Then el diálogo se cierra y la fila desaparece del historial.
- **AC-010.4:** Given el diálogo, When pulsa "Borrar" y el borrado falla, Then ve "No se pudo borrar la medición. Inténtalo de nuevo." y la fila sigue en el historial.
- **AC-010.5:** Given que el borrado está en curso, When el usuario mira el botón "Borrar" del diálogo, Then está deshabilitado y un segundo clic no envía otro borrado.
- **AC-010.6:** Given un usuario con una sola medición, When la borra, Then ve el estado vacío "Aún no tienes mediciones".

### REQ-011 — Las pantallas reflejan los cambios sin recargar

WHEN una corrección o un borrado desde el historial termina con éxito THE SYSTEM SHALL mostrar los datos actualizados en Métricas (historial, indicadores y gráfico), en el perfil, en el home y en Macros sin recargar la página.

- **AC-011.1:** Given una última medición de 78,5 kg y un perfil con ese peso, When el usuario la corrige a 78 en el historial, Then el KPI "Peso" de Métricas muestra "78 kg" sin recargar.
- **AC-011.2:** Given el caso de AC-005.3, When después del borrado el usuario va a `/profile`, Then el campo "Peso" del formulario de "Datos físicos" muestra 80.
- **AC-011.3:** Given el caso de AC-005.3, When después del borrado el usuario va a `/home`, Then "Peso actual" muestra "80 kg".
- **AC-011.4:** Given una medición del 2026-10-11 con grasa 20 que es la última con grasa, y otra del 2026-10-05 con grasa 22, When el usuario borra la del 2026-10-11 y va a `/profile`, Then el campo "% Grasa corporal" muestra 22.

## 5. Requisitos no funcionales

### NFR-001 — Acceso solo con sesión y aislamiento entre usuarios

THE SYSTEM SHALL exigir sesión para registrar, listar, corregir y borrar mediciones, y permitir a cada usuario ver y modificar solo sus propias mediciones y su propio perfil, identificado por su sesión y nunca por un dato enviado por el cliente.

- **AC-N001.1:** Given una petición de corrección o de borrado sin token o con un token inválido, When se envía, Then recibe `401` y ninguna medición ni perfil cambia.
- **AC-N001.2:** Given dos usuarios A y B, When A corrige o borra una medición de B usando su identificador, Then recibe `404` y la medición de B y el perfil de B no cambian.
- **AC-N001.3:** Given dos usuarios A y B, When A registra una medición incluyendo en el cuerpo un identificador de usuario de B, Then la medición se registra para A, y las mediciones y el perfil de B no cambian.

## 6. Datos y contratos visibles

**Endpoints** (consumidor: el frontend; todos exigen sesión):

| Método y ruta | Cuerpo | Respuesta correcta | Errores |
|---|---|---|---|
| `GET /api/body-metrics` | — | `200` con la lista de mediciones, de la más reciente a la más antigua (sin cambios) | `401` |
| `POST /api/body-metrics` | medición (abajo) | `201` si se crea · `200` si actualiza la medición de esa fecha | `400` · `401` |
| `PUT /api/body-metrics/{id}` (nuevo) | corrección (abajo) | `200` con la medición corregida | `400` · `401` · `404` |
| `DELETE /api/body-metrics/{id}` | — | `204` (sin cambios) | `401` · `404` |

La medición en las respuestas mantiene el formato actual:

```json
{
  "id": "6f1c…",
  "weight": 78.5,
  "body_fat_percentage": 20.0,
  "muscle_mass_percentage": null,
  "notes": null,
  "recorded_at": "2026-10-12"
}
```

**Registro (`POST`):** `weight`, `body_fat_percentage`, `muscle_mass_percentage` y `notes` son opcionales; `recorded_at` es opcional (`AAAA-MM-DD`, por defecto la fecha actual del servidor en UTC). Si ya existe una medición del usuario en esa fecha, los campos enviados con valor la sustituyen y los ausentes o `null` se conservan.

**Corrección (`PUT`):** `weight`, `body_fat_percentage` y `muscle_mass_percentage`; un campo ausente o `null` queda sin valor. Se ignoran `recorded_at`, `notes`, `id` y cualquier otro campo.

| Campo | Tipo | Valores permitidos | Mensaje si no es válido |
|---|---|---|---|
| `weight` | número, en kg | 29,9–300 | "El peso debe estar entre 29,9 y 300 kg" |
| `body_fat_percentage` | número | 3–60 | "El porcentaje de grasa corporal debe estar entre 3 y 60" |
| `muscle_mass_percentage` | número | 10–70 | "El porcentaje de masa muscular debe estar entre 10 y 70" |
| `recorded_at` | texto `AAAA-MM-DD` | fecha real, como mucho un día posterior a la fecha actual del servidor (UTC) | "La fecha de la medición no es válida" · "La fecha de la medición no puede ser futura" |
| (los tres valores) | — | al menos uno con valor | "Debe registrar al menos un valor (peso, % de grasa o % de masa muscular)" |

- Cuerpo ausente o que no es un objeto JSON: "Los datos de la medición no son válidos".
- Medición inexistente o de otro usuario: `404` con "Registro no encontrado".
- Los números enviados como texto (`"80"`) no son válidos. Si hay varios campos inválidos, se informa de uno solo.
- El límite inferior de 29,9 kg cubre el mínimo del perfil en lb (66 lb = 29,94 kg, que la app envía redondeado a 29,9).

**Perfil (`GET /api/profile` y `PUT /api/profile`, spec 006):** el contrato no cambia. El peso que devuelve puede cambiar como consecuencia de REQ-005.

**Textos del frontend:**
- Sección nueva en Métricas: "Historial". Columnas: "Fecha", "Peso", "% Grasa", "% Músculo". Valor ausente: "—". Botón: "Mostrar más".
- Nombres accesibles de los botones de cada fila: "Corregir medición del {fecha}" y "Borrar medición del {fecha}".
- Formulario de corrección: "Peso (kg)" o "Peso (lb)", "% Grasa corporal", "% Masa muscular"; botones "Guardar" (mientras guarda: "Guardando…") y "Cancelar".
- Validación del formulario de corrección: "Registra al menos un valor"; "Entre 30 y 300 kg" o "Entre 66 y 660 lb"; "Entre 3 y 60 %"; "Entre 10 y 70 %". Son los mismos límites del formulario de "Datos físicos".
- Error al corregir: "No se pudo guardar la medición. Inténtalo de nuevo.".
- Diálogo de borrado: título "¿Borrar la medición del {fecha}?", texto "Esta acción no se puede deshacer.", botones "Borrar" y "Cancelar". Error: "No se pudo borrar la medición. Inténtalo de nuevo.".
- Descripción de "Datos físicos" en el perfil: "Se usan para calcular tus calorías y macros. Cada cambio de peso o composición se guarda como la medición de hoy en tu progreso; si ya hay una de hoy, se actualiza."
- `{fecha}` usa el formato de fechas que ya usa Métricas.

**Datos existentes:** las mediciones duplicadas del mismo usuario y día se consolidan según REQ-006. Las mediciones con valores fuera de los rangos nuevos se conservan tal cual; para corregirlas hay que introducir valores válidos. El peso de los perfiles no se toca al desplegar: se sincroniza en el siguiente registro, corrección o borrado de una medición.

## 7. Preguntas abiertas

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | ¿Qué rangos valida el servidor en las mediciones? Hoy acepta cualquier peso mayor que 0 y grasa y masa muscular entre 0 y 100, mientras que la app limita la grasa a 3–60 % y la masa muscular a 10–70 %. **Propuesta:** alinear el servidor con la app: grasa 3–60, masa muscular 10–70 y peso 29,9–300 kg (cubre los rangos del perfil en kg y en lb, porque 66 lb se envían como 29,9 kg). Las mediciones antiguas fuera de rango se conservan. | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q2 | ¿Dónde va el historial para corregir y borrar? **Propuesta:** en Métricas (`/body-metrics`), en una sección "Historial" entre "Análisis del coach" y "Constancia". Alternativa: en el perfil, debajo de "Datos físicos". | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q3 | ¿Qué es "hoy" al registrar desde el perfil? Hoy es la fecha UTC del servidor, que en Costa Rica cambia a las 18:00. **Propuesta:** la fecha del dispositivo del usuario; el servidor acepta como mucho un día posterior a su fecha UTC, para no rechazar zonas horarias adelantadas. | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q4 | ¿Qué se hace con las mediciones duplicadas que ya existen (varias del mismo día)? **Propuesta:** consolidarlas en una por día; cada campo toma el valor de la medición registrada más tarde que lo tenga (REQ-006). Alternativa: conservar solo la registrada más tarde, entera. | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q5 | ¿Cómo se mantiene el peso del perfil igual al de la última medición? **Propuesta:** tras cada registro, corrección o borrado, si la última medición de peso (por fecha) difiere en más de 0,05 kg del peso del perfil, el perfil toma ese peso en su unidad, con un decimal y ajustado a su rango; si no quedan mediciones de peso, el perfil no cambia. Al registrar desde el perfil, la medición se guarda con el peso nuevo, así que ambos coinciden. No se hace una sincronización inicial al desplegar. | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q6 | Si al guardar el perfil se guarda el perfil pero falla la medición, ambos pesos quedan distintos hasta que el usuario reintenta. **Propuesta:** mantener el comportamiento actual (mensaje "No se pudo guardar la medición. Inténtalo de nuevo." y reintento); hacer el guardado atómico queda fuera de alcance. | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q7 | ¿Se puede cambiar la fecha de una medición al corregirla? **Propuesta:** no. Solo se corrigen los valores; para mover una medición de día, se borra (y se registra la de hoy desde el perfil). | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q8 | La media móvil del gráfico ignora hoy las mediciones anteriores al inicio del periodo elegido (1M, 3M o 1A), así que los primeros puntos de la tendencia usan menos datos. **Propuesta:** incluirlas en el cálculo, aunque no se dibujen (AC-014.3 del borrador anterior, ya fuera de esta spec). | **Resuelta.** Se acepta la propuesta, pero pasa a la feature nueva del bloque B (indicadores) por la división de Q14; queda registrada en "Fuera de alcance". (Usuario: "1. Si, dividamos en bloque A y bloque B. 2. Todas las propuestas.") |
| Q9 | Los rangos de ritmo esperado por meta se marcaron como provisionales en la fase de diseño. **Propuesta:** confirmar los actuales (tabla de la sección 6). | **Resuelta.** Se acepta la propuesta, pero pasa a la feature nueva del bloque B (indicadores) por la división de Q14; queda registrada en "Fuera de alcance". (Usuario: "1. Si, dividamos en bloque A y bloque B. 2. Todas las propuestas.") |
| Q10 | El cambio del KPI se rotula "en 30 días" aunque, con menos de 30 días de historial, se compara con la primera medición (AC-012.3 del borrador anterior, ya fuera de esta spec). **Propuesta:** mantener el texto actual. Alternativa: "desde el {fecha}" cuando la referencia tenga menos de 30 días. | **Resuelta.** Se acepta la propuesta, pero pasa a la feature nueva del bloque B (indicadores) por la división de Q14; queda registrada en "Fuera de alcance". (Usuario: "1. Si, dividamos en bloque A y bloque B. 2. Todas las propuestas.") |
| Q11 | ¿Cuántas mediciones muestra el historial? **Propuesta:** las 10 más recientes y un botón "Mostrar más" que añade 10 cada vez. | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q12 | ¿Se muestran o se editan las notas de las mediciones? Hoy la app no las muestra ni las registra. **Propuesta:** no; se conservan tal cual al corregir y al consolidar. | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q13 | Al registrar una medición en un día que ya tiene una, ¿se combinan los valores o se sustituye la medición entera? **Propuesta:** se combinan: los valores enviados sustituyen a los que había y los no enviados se conservan (así, guardar solo un peso nuevo no borra la grasa registrada ese mismo día). La respuesta es `200` si actualiza y `201` si crea. | **Resuelta.** Se acepta la propuesta (usuario: "2. Todas las propuestas."). Incorporada en los REQ y AC. |
| Q14 | (Pregunta del orquestador al revisar la spec) Con 105 AC, ¿se divide la feature? **Propuesta:** esta feature (008) queda con el bloque A, integridad de las mediciones (REQ-001 a REQ-011: una medición por día, rangos, corregir y borrar, sincronización del peso del perfil, consolidación de duplicados e historial); el bloque B, indicadores (REQ-012 a REQ-016: KPI, ritmo, media móvil de 7 días, composición/IMC/FFMI y racha, con Q8–Q10), pasa a una feature aparte, solo de frontend. | **Resuelta.** Se divide (usuario: "1. Si, dividamos en bloque A y bloque B."). Esta spec queda con REQ-001 a REQ-011 y NFR-001; el bloque B pasa a "Fuera de alcance" como feature aparte. |

## 8. Glosario

- **Medición:** registro con fecha en el historial de Métricas, con peso, % de grasa y % de masa muscular (cada uno opcional, al menos uno con valor). Hay como mucho una por usuario y día.
- **Última medición de peso:** la medición de fecha más reciente que tiene peso.
- **Consolidación:** fusión, al desplegar, de las mediciones de un mismo usuario y día en una sola (REQ-006).
- **Hoy:** la fecha del dispositivo del usuario, salvo en el servidor, donde es la fecha UTC.
