# Spec 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Feature:** `016-past-date-measurements` · **Tipo:** feature
- **Ámbitos:** backend, frontend

## 1. Contexto y problema

Hoy las mediciones corporales (peso, % de grasa y % de masa muscular) solo se registran desde "Datos físicos" del perfil, y siempre con la fecha de hoy del dispositivo (spec 008). En Métricas (`/body-metrics`) solo se pueden corregir o borrar las que ya existen. Si el usuario olvida registrarse un día, no puede añadir esa medición después.

Esto tiene dos consecuencias:

- El historial queda con huecos que el usuario no puede rellenar, y los indicadores que dependen de él (ritmo, tendencia, racha, análisis con IA) quedan incompletos. Por ejemplo, el ritmo semanal necesita al menos 3 pesos en los últimos 28 días que abarquen 10 días o más (spec 009). Por eso no se pudo probar en producción la spec 011.
- El servidor ya admite una fecha en el registro, pero la app no ofrece ninguna forma de elegirla.

Además, esta feature resuelve el hallazgo F2 de la review de la spec 008. Al guardar un cambio de peso desde el perfil, la medición de hoy se registra y el peso del perfil se sincroniza con la medición de peso de fecha más reciente. Si existe una medición de fecha **posterior** a la de hoy en el dispositivo (por ejemplo, una guardada con la fecha UTC del servidor o tras un cambio de zona horaria), el peso del perfil vuelve sin aviso al de esa medición. Y como la app no vuelve a leer el perfil tras registrar una medición, sigue mostrando el valor escrito hasta que se recarga la página.

## 2. Historia de usuario

Como **usuario que registra su progreso**, quiero **añadir desde Métricas una medición de un día pasado que olvidé registrar** para **tener un historial completo y que mis indicadores, mi racha y el análisis del coach sean fieles a mi progreso real**.

## 3. Alcance

**Incluye:**
- Un botón "Registrar medición" en Métricas que abre un formulario con fecha, peso, % de grasa y % de masa muscular (REQ-001).
- Validar la fecha en el formulario (no futura, como mucho un año atrás) y los valores, con los mismos límites que la corrección de la spec 008 (REQ-002).
- Registrar la medición con la regla de una medición por día: si ya hay una en esa fecha, se actualiza (REQ-003), con un aviso previo en el formulario (REQ-004).
- Rechazar en el servidor las fechas de más de un año de antigüedad (REQ-005).
- Mantener el peso del perfil igual al de la medición de peso con la fecha más reciente, no al de la última guardada (REQ-006).
- Que el historial, los indicadores, el gráfico, la racha y el análisis con IA reflejen las mediciones con fecha pasada (REQ-007).
- Que Métricas, el perfil, el home y Macros reflejen cualquier registro de medición sin recargar, también los que se hacen desde el perfil (REQ-008, segunda parte de 008 F2).
- Avisar al guardar desde el perfil cuando el peso del perfil queda con el de una medición de fecha posterior a hoy (REQ-009, primera parte de 008 F2).
- Ajustar los textos de Métricas que dicen que las mediciones solo se registran desde el perfil (REQ-010).

**Fuera de alcance:**
- Cambiar la fecha de una medición existente (sigue igual que en la spec 008, Q7).
- Registrar desde el perfil con una fecha distinta de hoy: "Datos físicos" sigue registrando la medición de hoy.
- Ver o editar las notas de una medición.
- Cambiar cómo se calculan los indicadores (ritmo, tendencia, composición, racha), el ritmo poco realista (spec 011), la sugerencia de calorías (spec 010) o el límite de análisis con IA.
- Cambiar los rangos de valores permitidos de las mediciones (spec 008).
- Desplegar el Historial ("Mostrar más") hasta la medición recién registrada.
- Registrar varias mediciones de una vez o importarlas desde un archivo.
- Datos existentes: no se modifican. Las mediciones de más de un año que ya existan se conservan, y se pueden corregir y borrar como hasta ahora.

## 4. Requisitos funcionales

> **Convenciones de esta sección.**
> - "Hoy" es la fecha del dispositivo; en los AC del frontend es el lunes 12 de octubre de 2026. En los AC del backend, la fecha actual del servidor (UTC) también es el 2026-10-12, salvo que se diga otra cosa.
> - Los pesos se guardan en kg y se muestran en la unidad del perfil, con las mismas reglas de conversión y formato de la spec 008 (1 lb = 0,45359237 kg; un decimal; coma decimal).
> - `{fecha}` usa el formato de fechas que ya usa Métricas (por ejemplo, "5 oct 2026").
> - "El formulario de registro" es el que abre el botón "Registrar medición" (REQ-001).

### REQ-001 — Registrar una medición desde Métricas

WHEN el usuario pulsa "Registrar medición" en `/body-metrics` THE SYSTEM SHALL mostrar un formulario con el título "Registrar medición" y los campos "Fecha", "Peso ({unidad})", "% Grasa corporal" y "% Masa muscular", con la fecha de hoy y los demás campos vacíos, y los botones "Guardar" y "Cancelar". El botón "Registrar medición" está visible tanto si el usuario tiene mediciones como si no.

- **AC-001.1:** Given un usuario con mediciones y un perfil en kg, When abre `/body-metrics`, Then ve el botón "Registrar medición".
- **AC-001.2:** Given un usuario sin mediciones, When abre `/body-metrics`, Then ve el estado vacío "Aún no tienes mediciones" y el botón "Registrar medición".
- **AC-001.3:** Given un perfil en kg, When pulsa "Registrar medición", Then ve un formulario con el título "Registrar medición", el campo "Fecha" con el valor `2026-10-12`, los campos "Peso (kg)", "% Grasa corporal" y "% Masa muscular" vacíos, y los botones "Guardar" y "Cancelar".
- **AC-001.4:** Given un perfil en lb, When pulsa "Registrar medición", Then el campo de peso se llama "Peso (lb)".
- **AC-001.5:** Given el formulario de registro con valores escritos, When pulsa "Cancelar", Then el formulario se cierra, no se envía nada al servidor y el historial no cambia.
- **AC-001.6:** Given el formulario de registro abierto, When el usuario lo mira, Then ve el texto "Si la fecha es anterior a tu última medición de peso, el peso de tu perfil no cambia.".
- **AC-001.7:** Given un usuario sin perfil (sin unidad de peso), When pulsa "Registrar medición", Then el campo de peso se llama "Peso (kg)".

### REQ-002 — Validar el formulario de registro

IF la fecha o los valores del formulario de registro no son válidos THEN THE SYSTEM SHALL mostrar el mensaje correspondiente de la sección 6 junto al campo y mantener "Guardar" deshabilitado. La fecha es válida si no es posterior a hoy y no es anterior a hoy menos 365 días; los valores siguen las reglas del formulario de corrección de la spec 008.

- **AC-002.1:** Given el formulario de registro, When el usuario elige la fecha `2026-10-13`, Then ve "La fecha no puede ser futura" y "Guardar" está deshabilitado.
- **AC-002.2:** Given el formulario de registro, When el usuario elige la fecha `2025-10-11`, Then ve "Solo puedes registrar mediciones del último año" y "Guardar" está deshabilitado.
- **AC-002.3:** Given el formulario de registro con un peso válido, When el usuario elige la fecha `2025-10-12` (hoy menos 365 días) o `2026-10-12` (hoy), Then no ve ningún error de fecha y "Guardar" está habilitado.
- **AC-002.4:** Given el formulario de registro, When el usuario borra la fecha, Then ve "Elige una fecha" y "Guardar" está deshabilitado.
- **AC-002.5:** Given el formulario de registro, When los tres valores están vacíos, Then ve "Registra al menos un valor" y "Guardar" está deshabilitado.
- **AC-002.6:** Given el formulario de registro, When el usuario escribe un peso fuera de rango (301 en kg o 661 en lb), una grasa fuera de 3–60 o una masa muscular fuera de 10–70, Then ve, respectivamente, "Entre 30 y 300 kg" (o "Entre 66 y 660 lb"), "Entre 3 y 60 %" o "Entre 10 y 70 %", y "Guardar" está deshabilitado.
- **AC-002.7:** Given el campo "Fecha" del formulario de registro, When el usuario lo mira, Then no permite elegir fechas posteriores a `2026-10-12` ni anteriores a `2025-10-12`.

### REQ-003 — Guardar la medición registrada

WHEN el usuario pulsa "Guardar" en el formulario de registro con datos válidos THE SYSTEM SHALL registrar una medición con la fecha elegida, el peso convertido a kg y redondeado a un decimal y solo los valores que el usuario rellenó. Si ya hay una medición en esa fecha, se actualiza con la regla de la spec 008: los valores enviados sustituyen a los que había y los que no se envían se conservan. Al terminar con éxito, el formulario se cierra y el historial muestra la medición en el orden que le corresponde por fecha.

- **AC-003.1:** Given un perfil en kg y el formulario de registro con fecha `2026-10-05`, peso 80 y grasa 20, When pulsa "Guardar", Then el servidor recibe `{"recorded_at": "2026-10-05", "weight": 80, "body_fat_percentage": 20}`, sin `muscle_mass_percentage`.
- **AC-003.2:** Given un perfil en lb, When registra un peso de 160 lb, Then el servidor recibe `weight: 72.6`.
- **AC-003.3:** Given el formulario de registro con solo la grasa rellena (18), When pulsa "Guardar", Then el servidor recibe `body_fat_percentage: 18` y la fecha, y no recibe `weight` ni `muscle_mass_percentage`.
- **AC-003.4:** Given mediciones del 2026-10-11 y del 2026-10-01, When registra con éxito una medición del 2026-10-05, Then el formulario se cierra y el historial muestra las filas en el orden 2026-10-11, 2026-10-05, 2026-10-01.
- **AC-003.5:** Given que el registro está en curso, When el usuario mira el botón, Then está deshabilitado y dice "Guardando…", y un segundo clic no envía otro registro.
- **AC-003.6:** Given que el registro falla, When termina, Then el formulario sigue abierto con los valores escritos y muestra "No se pudo guardar la medición. Inténtalo de nuevo.".
- **AC-003.7:** Given un usuario autenticado sin mediciones el 2026-10-05, When el servidor recibe `{"weight": 80, "recorded_at": "2026-10-05"}`, Then responde `201` con la medición del 2026-10-05.
- **AC-003.8:** Given una medición del 2026-10-05 con peso 80 y grasa 20, When el servidor recibe `{"weight": 79, "recorded_at": "2026-10-05"}`, Then responde `200` con el mismo `id`, peso 79 y grasa 20, y el historial sigue con una sola medición del 2026-10-05.
- **AC-003.9:** Given un usuario sin mediciones, When registra con éxito una medición del 2026-10-05 desde el formulario, Then desaparece el estado vacío y se muestran los indicadores y el historial con esa medición.

### REQ-004 — Aviso cuando la fecha elegida ya tiene una medición

WHILE la fecha elegida en el formulario de registro coincide con la de una medición existente del usuario THE SYSTEM SHALL mostrar el aviso "Ya tienes una medición del {fecha}. Los valores que escribas sustituirán a los de ese día; los campos vacíos se conservan.".

- **AC-004.1:** Given una medición del 2026-10-05, When el usuario elige la fecha `2026-10-05` en el formulario de registro, Then ve el aviso con la fecha del 2026-10-05.
- **AC-004.2:** Given una medición del 2026-10-05, When el usuario elige la fecha `2026-10-06`, Then no ve el aviso.
- **AC-004.3:** Given el aviso visible, When el usuario lo mira, Then "Guardar" sigue habilitado si los datos son válidos (el aviso no bloquea el registro).

### REQ-005 — Límite hacia atrás de la fecha en el servidor

IF un registro de medición llega con una `recorded_at` anterior en más de 366 días a la fecha actual del servidor (UTC) THEN THE SYSTEM SHALL responder `400` con "La fecha de la medición no puede tener más de un año de antigüedad" y no crear ni modificar ninguna medición ni el perfil. El día de margen respecto a los 365 días de la app evita rechazar registros válidos por la diferencia de zona horaria. Se mantienen las reglas de la spec 008: formato `AAAA-MM-DD`, fecha real y como mucho un día posterior a la fecha del servidor.

- **AC-005.1:** Given la fecha del servidor 2026-10-12, When se registra una medición con `recorded_at: "2025-10-11"` (366 días antes), Then se acepta.
- **AC-005.2:** Given la fecha del servidor 2026-10-12, When se registra una medición con `recorded_at: "2025-10-10"` (367 días antes), Then `400` con "La fecha de la medición no puede tener más de un año de antigüedad" y el historial y el perfil del usuario no cambian.
- **AC-005.3:** Given la fecha del servidor 2026-10-12, When se registra una medición con `recorded_at: "2026-10-14"`, Then sigue respondiendo `400` con "La fecha de la medición no puede ser futura".
- **AC-005.4:** Given una medición existente del 2025-01-15 (de antes de esta feature), When el usuario la corrige o la borra, Then la corrección (`200`) o el borrado (`204`) funcionan como en la spec 008.
- **AC-005.5:** Given una medición existente del 2025-01-15, When el usuario lee su historial, Then la medición aparece sin cambios.

### REQ-006 — El peso del perfil sigue a la medición de peso de fecha más reciente

WHEN un usuario con perfil registra una medición con peso de cualquier fecha THE SYSTEM SHALL dejar el peso del perfil igual al de su medición de peso de **fecha más reciente** (con las reglas de conversión, redondeo, tolerancia de 0,05 kg y ajuste al rango del perfil de la spec 008), independientemente del orden en que se guardaron las mediciones.

- **AC-006.1:** Given un perfil en kg con peso 78 y una medición del 2026-10-11 con peso 78, When registra una medición del 2026-10-05 con peso 80, Then el perfil sigue con `weight: 78`.
- **AC-006.2:** Given un perfil en kg con peso 78 y una única medición del 2026-10-01 con peso 78, When registra una medición del 2026-10-05 con peso 77, Then el perfil pasa a `weight: 77`.
- **AC-006.3:** Given un perfil en lb con peso 172 y una medición del 2026-10-11 con peso 78 kg, When registra una medición del 2026-10-05 con peso 80 kg, Then el perfil sigue con `weight: 172` y `weight_unit: "lb"`.
- **AC-006.4:** Given una medición del 2026-10-11 con peso 78 y un perfil con peso 78 kg, When registra una medición del 2026-10-05 con solo grasa (sin peso), Then el peso del perfil sigue siendo 78.
- **AC-006.5:** Given un usuario con el onboarding completado, When registra una medición con fecha pasada, Then `onboarding_completed_at`, `date_of_birth` y los demás campos del perfil distintos del peso devuelven los mismos valores que antes.
- **AC-006.6:** Given un usuario sin perfil, When registra una medición con fecha pasada, Then la medición se guarda y el usuario sigue sin perfil.

### REQ-007 — Los indicadores, la racha y el análisis reflejan las mediciones con fecha pasada

WHEN el usuario registra con éxito una medición con fecha pasada THE SYSTEM SHALL recalcular sin recargar el historial, los indicadores de progreso, el gráfico, la composición corporal, la constancia y el contexto del análisis con IA a partir del conjunto completo de mediciones, con las reglas de las specs 009, 010 y 011 y sin distinguir cuándo se guardó cada medición.

- **AC-007.1:** Given un perfil y una sola medición de peso, del 2026-10-11 (80 kg), y la tarjeta "Ritmo" con "Faltan registros para calcularlo", When registra pesos de 81 kg el 2026-10-01 y de 80,5 kg el 2026-10-06, Then la tarjeta "Ritmo" muestra un valor de ritmo en lugar de "Faltan registros para calcularlo".
- **AC-007.2:** Given el caso de AC-007.1 después de los dos registros, When el usuario pide el análisis del coach, Then la petición de análisis incluye el ritmo calculado con las tres mediciones.
- **AC-007.3:** Given mediciones del 2026-10-12 y del 2026-09-28 y la racha en "1 semana", When registra una medición del 2026-10-07, Then la racha muestra "3 semanas".
- **AC-007.4:** Given una medición del 2026-10-11, When registra una medición del 2026-10-05, Then "Último registro" sigue mostrando la fecha del 2026-10-11 y "Últimos 30 días" suma un registro.
- **AC-007.5:** Given una medición del 2026-10-11 con peso 78, When registra una medición del 2026-10-05 con peso 80, Then el KPI "Peso" sigue mostrando "78 kg".
- **AC-007.6:** Given una medición del 2026-10-11 con peso y sin grasa, When registra una medición del 2026-10-05 con peso 80 y grasa 20, Then la sección "Composición corporal" dice "Según tu medición del {fecha}" con la fecha del 2026-10-05.
- **AC-007.7:** Given el gráfico de "Evolución" en el periodo de 1 mes, When registra una medición del 2026-10-05, Then el gráfico incluye un punto en esa fecha.

### REQ-008 — Las pantallas reflejan cualquier registro sin recargar

WHEN termina con éxito el registro de una medición, desde Métricas o desde "Datos físicos" del perfil THE SYSTEM SHALL mostrar sin recargar la página los datos actualizados de las mediciones y del perfil (incluido el peso que haya quedado tras la sincronización de REQ-006) en Métricas, en el perfil, en el home y en Macros.

- **AC-008.1:** Given un perfil en kg con peso 78 y una única medición del 2026-10-01 con peso 78, When registra desde Métricas una medición del 2026-10-05 con peso 77 y va a `/profile`, Then el campo "Peso" de "Datos físicos" muestra 77.
- **AC-008.2:** Given el caso de AC-008.1, When después del registro va a `/home`, Then "Peso actual" muestra "77 kg".
- **AC-008.3:** Given que el usuario guarda desde "Datos físicos" un cambio de peso, When el registro de la medición termina con éxito, Then la app vuelve a leer el perfil y las mediciones sin recargar la página.
- **AC-008.4:** Given el caso de AC-006.1 (registro desde Métricas de una fecha anterior a la última medición de peso), When va a `/profile`, Then el campo "Peso" sigue mostrando 78.

### REQ-009 — Aviso al guardar desde el perfil si hay una medición posterior a hoy

IF al guardar un cambio de peso desde "Datos físicos" existe una medición con peso de fecha posterior a hoy THEN THE SYSTEM SHALL registrar la medición de hoy, mostrar en el campo "Peso" el peso que queda en el perfil (el de esa medición posterior) y mostrar, en lugar de "Cambios guardados", el aviso "Guardamos tu medición de hoy, pero tu peso del perfil es el de tu medición más reciente, del {fecha}. Puedes corregirla o borrarla en Métricas.", con la fecha de esa medición posterior.

- **AC-009.1:** Given hoy 2026-10-12, un perfil en kg con peso 80 y una medición del 2026-10-13 con peso 80, When el usuario cambia el peso a 79 y pulsa "Guardar cambios", Then el servidor recibe la medición con `recorded_at: "2026-10-12"` y `weight: 79`, el campo "Peso" muestra 80 sin recargar y se ve el aviso con la fecha del 2026-10-13.
- **AC-009.2:** Given el caso de AC-009.1, When el usuario mira el resultado, Then no ve "Cambios guardados".
- **AC-009.3:** Given hoy 2026-10-12 y ninguna medición posterior a hoy, When el usuario cambia el peso a 79 y guarda, Then ve "Cambios guardados", no ve el aviso y el campo "Peso" muestra 79.
- **AC-009.4:** Given el caso de AC-009.1 después de guardar, When el usuario no cambia nada más, Then el formulario no tiene cambios pendientes ("Guardar cambios" deshabilitado y sin botón "Descartar").
- **AC-009.5:** Given una medición del 2026-10-13 con peso 80 y un perfil con peso 80 kg, When el servidor recibe un registro de `{"weight": 79, "recorded_at": "2026-10-12"}`, Then responde `201` y el perfil sigue con `weight: 80`.

### REQ-010 — Textos de Métricas

THE SYSTEM SHALL mostrar en `/body-metrics` el subtítulo "Tu progreso a partir de las mediciones que registras aquí o en tu perfil." y, en el estado vacío, el texto "Registra tu peso y, si lo conoces, tu composición corporal aquí o desde tu perfil. Aquí verás cómo evolucionan.", conservando el enlace "Ir a mi perfil".

- **AC-010.1:** Given un usuario con mediciones, When abre `/body-metrics`, Then ve el subtítulo "Tu progreso a partir de las mediciones que registras aquí o en tu perfil.".
- **AC-010.2:** Given un usuario sin mediciones, When abre `/body-metrics`, Then ve "Aún no tienes mediciones", el texto "Registra tu peso y, si lo conoces, tu composición corporal aquí o desde tu perfil. Aquí verás cómo evolucionan.", el enlace "Ir a mi perfil" y el botón "Registrar medición".

## 5. Requisitos no funcionales

### NFR-001 — Acceso solo con sesión y aislamiento entre usuarios

THE SYSTEM SHALL exigir sesión para registrar mediciones con cualquier fecha y registrarlas siempre para el usuario de la sesión, nunca para uno indicado por el cliente.

- **AC-N001.1:** Given una petición de registro con `recorded_at` pasada, sin token o con un token inválido, When se envía, Then recibe `401` y ninguna medición ni perfil cambia.
- **AC-N001.2:** Given dos usuarios A y B, y una medición de B del 2026-10-05, When A registra una medición del 2026-10-05 incluyendo en el cuerpo el identificador de usuario de B, Then se crea una medición nueva para A (`201`) y la medición y el perfil de B no cambian.

### NFR-002 — Accesibilidad del formulario de registro

THE SYSTEM SHALL presentar el formulario de registro como un diálogo accesible: cada campo tiene su etiqueta visible asociada y los mensajes de error y avisos se leen como texto asociado al formulario.

- **AC-N002.1:** Given el formulario de registro abierto, When se busca por rol, Then existe un diálogo con el nombre accesible "Registrar medición" y los campos se encuentran por sus etiquetas "Fecha", "Peso (kg)", "% Grasa corporal" y "% Masa muscular".
- **AC-N002.2:** Given un registro que falla, When termina, Then el mensaje "No se pudo guardar la medición. Inténtalo de nuevo." tiene el rol `alert`.

## 6. Datos y contratos visibles

**Endpoints** (consumidor: el frontend; todos exigen sesión). Solo cambia la validación de `recorded_at` en el registro:

| Método y ruta | Cambio | Respuesta correcta | Errores |
|---|---|---|---|
| `POST /api/body-metrics` | `recorded_at` no puede tener más de un año de antigüedad (REQ-005) | `201` si se crea · `200` si actualiza la medición de esa fecha (sin cambios) | `400` · `401` |
| `GET`, `PUT /{id}`, `DELETE /{id}` | sin cambios | — | — |
| `GET /api/profile` | sin cambios en el contrato; el peso puede cambiar por REQ-006 | — | — |

| Campo | Tipo | Valores permitidos | Mensaje si no es válido |
|---|---|---|---|
| `recorded_at` | texto `AAAA-MM-DD`, opcional (por defecto, la fecha del servidor en UTC) | fecha real, entre la fecha del servidor menos 366 días y la fecha del servidor más 1 día, ambas incluidas | "La fecha de la medición no es válida" · "La fecha de la medición no puede ser futura" · "La fecha de la medición no puede tener más de un año de antigüedad" (nuevo) |

Los demás campos, sus rangos y sus mensajes no cambian (spec 008, sección 6).

**Textos del frontend:**
- Botón en Métricas: "Registrar medición".
- Formulario de registro (diálogo): título "Registrar medición"; campos "Fecha", "Peso (kg)" o "Peso (lb)", "% Grasa corporal", "% Masa muscular"; botones "Guardar" (mientras guarda: "Guardando…") y "Cancelar".
- Texto de ayuda del formulario: "Si la fecha es anterior a tu última medición de peso, el peso de tu perfil no cambia."
- Validación de la fecha: "Elige una fecha" · "La fecha no puede ser futura" · "Solo puedes registrar mediciones del último año".
- Validación de los valores: "Registra al menos un valor"; "Entre 30 y 300 kg" o "Entre 66 y 660 lb"; "Entre 3 y 60 %"; "Entre 10 y 70 %" (los mismos de la corrección, spec 008).
- Aviso de fecha con medición: "Ya tienes una medición del {fecha}. Los valores que escribas sustituirán a los de ese día; los campos vacíos se conservan."
- Error al registrar: "No se pudo guardar la medición. Inténtalo de nuevo."
- Subtítulo de Métricas: "Tu progreso a partir de las mediciones que registras aquí o en tu perfil."
- Estado vacío de Métricas: "Aún no tienes mediciones" · "Registra tu peso y, si lo conoces, tu composición corporal aquí o desde tu perfil. Aquí verás cómo evolucionan." · "Ir a mi perfil" · "Registrar medición".
- Aviso del perfil (REQ-009): "Guardamos tu medición de hoy, pero tu peso del perfil es el de tu medición más reciente, del {fecha}. Puedes corregirla o borrarla en Métricas."

**Datos existentes:** no se modifican. Las mediciones de más de un año se conservan y se pueden corregir y borrar.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Se aceptan fechas futuras al registrar desde Métricas? | No. La app no permite elegir una fecha posterior a hoy en el dispositivo. El servidor mantiene su margen actual de un día por zona horaria (spec 008). | Si, aceptadas |
| Q2 | ¿Hasta cuándo se puede registrar hacia atrás? | Hasta 365 días antes de hoy en la app (coincide con el periodo más largo del gráfico, 1A). El servidor rechaza fechas de más de 366 días antes de su fecha UTC (un día de margen) con un mensaje nuevo. Las mediciones más antiguas que ya existan se conservan. | Si, aceptadas |
| Q3 | ¿Dónde y cómo se registra desde Métricas? | Un botón "Registrar medición" bajo el subtítulo de la página, visible también en el estado vacío, que abre un diálogo con fecha (por defecto hoy), peso, % de grasa y % de masa muscular. | Si, aceptadas |
| Q4 | Si la fecha elegida ya tiene una medición, ¿qué hace el formulario? | Muestra un aviso y, al guardar, combina los valores como el registro actual (los rellenados sustituyen y los vacíos se conservan). No se rellenan los campos con los valores de ese día; para cambiarlos todos está "Corregir" en el Historial. | Si, aceptadas |
| Q5 | 008 F2: al guardar desde el perfil, si hay una medición de peso de fecha posterior a hoy, ¿qué se hace? | Se registra la medición de hoy igualmente, el formulario muestra el peso real que queda en el perfil (el de la medición posterior) y un aviso que explica por qué y remite a Métricas para corregir o borrar esa medición. No se cambia la regla de sincronización. | Si, aceptadas |
| Q6 | Tras registrar una medición (desde Métricas o desde el perfil), ¿la app vuelve a leer el perfil? | Sí, siempre, para que el perfil, el home y Macros muestren el peso sincronizado sin recargar (segunda parte de 008 F2). | Si, aceptadas |
| Q7 | ¿Puede registrar desde Métricas un usuario sin perfil (onboarding pendiente)? | Sí, con el peso en kg; el servidor ya lo permite y el perfil no se crea (AC-006.6). | Si, aceptadas |

**Estado:** todas las preguntas están resueltas. El usuario aceptó las propuestas por defecto de Q1 a Q7 y ya están incorporadas: Q1 en REQ-002 y REQ-005; Q2 en REQ-002 y REQ-005; Q3 en REQ-001 y REQ-010; Q4 en REQ-003 y REQ-004; Q5 en REQ-009; Q6 en REQ-008; Q7 en AC-001.7 y AC-006.6.

## 8. Glosario

- **Medición con fecha pasada:** medición registrada para un día anterior al día en que se guarda.
- **Medición de peso de fecha más reciente:** la medición del usuario con peso cuya fecha es la mayor, sin importar cuándo se guardó. Es la que determina el peso del perfil (spec 008, REQ-005).
- **Formulario de registro:** el diálogo "Registrar medición" de Métricas.
- **Hoy:** la fecha del dispositivo del usuario, salvo en el servidor, donde es la fecha UTC.

## Comentarios del usuario

Sobre AC-007.6 y `composition()` (opciones: (a) corregir el AC y su test; (b) ampliar el alcance), el usuario respondió:

> A
