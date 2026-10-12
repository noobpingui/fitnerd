# Spec 006 — Perfil de usuario persistido en el backend

- **Feature:** `006-user-profile` · **Tipo:** feature
- **Ámbito:** ambos

## 1. Contexto y problema

En la rama de rediseño, la app ya tiene un onboarding obligatorio (género, edad, altura, peso, nivel de actividad y meta), una página de perfil para editar esos datos y tres pantallas que los usan: el home (resumen personal), Macros (objetivo calórico y reparto de macronutrientes) y Métricas (unidad de peso, altura para la composición corporal y ritmo frente a la meta).

Hoy esas respuestas solo se **simulan en el almacenamiento del navegador**. Eso tiene tres problemas:

1. Los datos no viajan con la cuenta: en otro dispositivo o navegador, el usuario tiene que repetir el onboarding.
2. Si dos cuentas usan el mismo navegador, comparten el perfil: la segunda cuenta ve los datos de la primera y se salta el onboarding.
3. Los usuarios que ya existían no tienen un estado de onboarding real.

Además, la edad se pide como un número fijo, que con el tiempo queda desactualizado, mientras que la cuenta ya puede tener una fecha de nacimiento: las cuentas creadas con email la piden en el registro; las de Google no la tienen.

Esta feature guarda el perfil en el servidor, asociado a la cuenta, sustituye la edad por la **fecha de nacimiento de la cuenta** (la edad se calcula a partir de ella cuando hace falta) y hace que el onboarding y las pantallas que dependen del perfil lean y escriban esos datos en el servidor.

## 2. Historia de usuario

Como **usuario registrado de fitnerd**, quiero **que mis datos físicos, mi fecha de nacimiento, mi nivel de actividad y mi meta se guarden en mi cuenta** para **no repetir el onboarding en cada dispositivo y ver siempre mis propias calorías y macros, con mi edad al día, aunque otra persona use el mismo navegador**.

## 3. Alcance

**Incluye:**
- Guardar en el servidor, por usuario, el estado del onboarding (pendiente o completado, con su fecha de finalización).
- Guardar en el servidor, por usuario, el perfil: género (masculino/femenino), altura y peso con la unidad que eligió el usuario, nivel de actividad y meta.
- Usar la **fecha de nacimiento de la cuenta** (la misma que se pide en el registro con email) como dato del perfil, en lugar de una edad fija. Guardar el perfil la crea o la actualiza.
- Calcular la edad a partir de la fecha de nacimiento, en años cumplidos a la fecha actual, cada vez que hace falta (validación y cálculo de calorías).
- Un contrato HTTP autenticado para leer y guardar el perfil, con validación de rangos y mensajes de error en español.
- Que todos los usuarios existentes empiecen con el onboarding pendiente.
- Que el onboarding pida la fecha de nacimiento en lugar de la edad: prerrellenada si la cuenta ya la tiene y obligatoria si no.
- Que la página de perfil permita ver y editar la fecha de nacimiento en lugar de la edad.
- Que el frontend (control de acceso por onboarding, página de onboarding, página de perfil, home, Macros y Métricas) use el perfil del servidor en lugar del almacenamiento del navegador.
- Los estados de carga y de error del perfil en el frontend.

**Fuera de alcance:**
- Cambiar las fórmulas de calorías y macros, o calcularlas en el servidor. El cálculo sigue en el frontend, con las mismas fórmulas; la única diferencia es que la edad sale de la fecha de nacimiento.
- Migrar al servidor los datos que el diseño simulado dejó en el navegador (Q4).
- Borrar el perfil o "rehacer el onboarding" desde la app.
- Un tercer valor de género (el cálculo de gasto calórico solo admite dos).
- Guardar una edad fija (Q2).
- Registrar el peso del onboarding como medición en el historial de Métricas (Q3).
- Cambios en el registro (sigue pidiendo la fecha de nacimiento como hoy), en el login o en el contrato de `GET /api/auth/me`.
- Cambiar la fecha de nacimiento de una cuenta fuera del onboarding y de la página de perfil.
- La grasa corporal y la masa muscular: siguen siendo mediciones del historial de Métricas, no forman parte del perfil.

## 4. Requisitos funcionales

### REQ-001 — Leer el perfil propio
WHEN un usuario autenticado pide su perfil THE SYSTEM SHALL responder `200` con el estado de su onboarding, la fecha de nacimiento de su cuenta (o `null` si no la tiene) y, si existe, su perfil guardado (formato en la sección 6).

- **AC-001.1:** Given un usuario autenticado que ya guardó su perfil, When pide su perfil, Then recibe `200` con `onboarding_completed: true`, `onboarding_completed_at` con una fecha-hora ISO 8601, `date_of_birth` con la fecha que guardó (`AAAA-MM-DD`) y `profile` con exactamente los valores que guardó (incluidas las unidades).
- **AC-001.2:** Given un usuario autenticado de Google que nunca guardó su perfil y no tiene fecha de nacimiento, When pide su perfil, Then recibe `200` con `{"onboarding_completed": false, "onboarding_completed_at": null, "date_of_birth": null, "profile": null}`.
- **AC-001.3:** Given un usuario que existía antes de esta feature (sin perfil), When pide su perfil por primera vez después del despliegue, Then recibe `onboarding_completed: false` y `profile: null`.
- **AC-001.4:** Given un usuario registrado con email y fecha de nacimiento `1995-05-20` que nunca guardó su perfil, When pide su perfil, Then recibe `onboarding_completed: false`, `profile: null` y `date_of_birth: "1995-05-20"`.

### REQ-002 — Guardar el perfil propio
WHEN un usuario autenticado envía un perfil completo y válido THE SYSTEM SHALL guardarlo (creándolo o reemplazando el anterior por completo), guardar la fecha de nacimiento enviada como la fecha de nacimiento de su cuenta y responder `200` con el mismo formato que la lectura.

- **AC-002.1:** Given un usuario sin perfil, When envía un perfil válido, Then recibe `200` con `profile` y `date_of_birth` iguales a lo enviado, y una lectura posterior devuelve los mismos valores.
- **AC-002.2:** Given un usuario con perfil, When envía otro perfil válido con valores distintos, Then la respuesta y una lectura posterior devuelven solo los valores nuevos.
- **AC-002.3:** Given un perfil enviado con `height_unit: "ft"`, `height_ft: 5`, `height_in: 9`, `weight_unit: "lb"` y `weight: 160`, When se guarda y después se lee, Then la lectura devuelve `height_unit: "ft"`, `height_ft: 5`, `height_in: 9`, `height_cm: null`, `weight_unit: "lb"` y `weight: 160` (sin pérdida por conversión de unidades).
- **AC-002.4:** Given un perfil enviado con `height_unit: "cm"` y `height_cm: 175.5`, When se guarda y se lee, Then devuelve `height_cm: 175.5`, `height_ft: null` y `height_in: null`.
- **AC-002.5:** Given un perfil enviado con `weight: 72.46` y `height_cm: 175.04`, When se guarda, Then la respuesta devuelve `weight: 72.5` y `height_cm: 175.0` (se redondea a un decimal).
- **AC-002.6:** Given un perfil enviado con `height_unit: "cm"` y además valores en `height_ft` o `height_in`, When se guarda, Then se ignoran los campos de la otra unidad y la respuesta los devuelve como `null` (y a la inversa con `height_unit: "ft"` y `height_cm`).
- **AC-002.7:** Given un usuario registrado con email y fecha de nacimiento `1995-05-20`, When guarda un perfil válido con `date_of_birth: "1996-03-01"`, Then la fecha de nacimiento de su cuenta pasa a ser `1996-03-01` y una lectura posterior devuelve `date_of_birth: "1996-03-01"`.
- **AC-002.8:** Given un usuario de Google sin fecha de nacimiento, When guarda un perfil válido con `date_of_birth: "2000-01-15"`, Then una lectura posterior devuelve `date_of_birth: "2000-01-15"`.
- **AC-002.9:** Given un perfil válido que incluye además un campo `age`, When se guarda, Then el campo `age` se ignora y la respuesta no lo incluye.

### REQ-003 — Completar el onboarding
WHEN un usuario con el onboarding pendiente guarda su perfil por primera vez THE SYSTEM SHALL marcar su onboarding como completado con la fecha-hora de ese guardado, y los guardados posteriores no la cambian.

- **AC-003.1:** Given un usuario con el onboarding pendiente, When guarda un perfil válido, Then la respuesta trae `onboarding_completed: true` y `onboarding_completed_at` no nulo.
- **AC-003.2:** Given un usuario que completó el onboarding, When vuelve a guardar su perfil, Then `onboarding_completed_at` conserva el valor del primer guardado.
- **AC-003.3:** Given un usuario con el onboarding pendiente, When envía un perfil inválido, Then el onboarding sigue pendiente (`onboarding_completed: false` en una lectura posterior).

### REQ-004 — Validar el perfil
IF el perfil enviado falta, está incompleto o tiene algún valor fuera de lo permitido THEN THE SYSTEM SHALL responder `400` con `{"error": "<mensaje>"}` (mensajes de la sección 6) y no modificar el perfil, la fecha de nacimiento de la cuenta ni el estado del onboarding.

La edad se calcula en años cumplidos entre `date_of_birth` y la fecha actual del servidor (UTC): quien cumple años hoy ya cuenta con la edad nueva.

- **AC-004.1:** Given un perfil con `gender` ausente o distinto de `"male"`/`"female"`, When se envía, Then `400` con el mensaje "El género debe ser masculino o femenino".
- **AC-004.2:** Given un perfil con `date_of_birth` ausente, `null`, que no es texto, que no tiene el formato `AAAA-MM-DD` o que no es una fecha real (por ejemplo `"2001-02-30"`), When se envía, Then `400` con "La fecha de nacimiento no es válida".
- **AC-004.3:** Given un perfil con `date_of_birth` posterior a la fecha actual del servidor, When se envía, Then `400` con "La fecha de nacimiento no puede ser futura".
- **AC-004.4:** Given un perfil con una `date_of_birth` no futura cuya edad resultante es menor que 14 o mayor que 100 años, When se envía, Then `400` con "Debes tener entre 14 y 100 años".
- **AC-004.5:** Given un perfil con `height_unit` ausente o distinto de `"cm"`/`"ft"`, When se envía, Then `400` con "La unidad de altura debe ser cm o ft".
- **AC-004.6:** Given `height_unit: "cm"` y `height_cm` ausente, no numérico, menor que 100 o mayor que 250, When se envía, Then `400` con "La altura debe estar entre 100 y 250 cm".
- **AC-004.7:** Given `height_unit: "ft"` y `height_ft` ausente, no entero o fuera de 3–8, o `height_in` no entero o fuera de 0–11, When se envía, Then `400` con "La altura debe estar entre 3 y 8 ft, y las pulgadas entre 0 y 11". Si `height_in` falta, se toma como 0 y el perfil es válido.
- **AC-004.8:** Given un perfil con `weight_unit` ausente o distinto de `"kg"`/`"lb"`, When se envía, Then `400` con "La unidad de peso debe ser kg o lb".
- **AC-004.9:** Given `weight_unit: "kg"` y `weight` ausente, no numérico, menor que 30 o mayor que 300, When se envía, Then `400` con "El peso debe estar entre 30 y 300 kg".
- **AC-004.10:** Given `weight_unit: "lb"` y `weight` ausente, no numérico, menor que 66 o mayor que 660, When se envía, Then `400` con "El peso debe estar entre 66 y 660 lb".
- **AC-004.11:** Given un perfil con `activity_level` ausente o fuera de `low`, `moderate`, `high`, `very_high`, `athlete`, When se envía, Then `400` con "El nivel de actividad no es válido".
- **AC-004.12:** Given un perfil con `goal` ausente o fuera de `lose`, `lose_slow`, `maintain`, `gain_slow`, `gain`, When se envía, Then `400` con "La meta no es válida".
- **AC-004.13:** Given una petición de guardado sin cuerpo JSON o con un cuerpo que no es un objeto, When se envía, Then `400` con "Los datos del perfil no son válidos".
- **AC-004.14:** Given un usuario con un perfil y una fecha de nacimiento guardados, When envía un perfil inválido (incluso si solo es inválida la fecha de nacimiento), Then una lectura posterior devuelve el perfil y la fecha de nacimiento anteriores sin cambios.
- **AC-004.15:** Given los valores límite (una fecha de nacimiento con la que se cumplen 14 años exactamente hoy; una con la que se cumplieron 100 años y aún no 101; altura 100 y 250 cm, 3 ft 0 in y 8 ft 11 in; peso 30 y 300 kg, 66 y 660 lb), When se envían, Then se aceptan con `200`.
- **AC-004.16:** Given una fecha de nacimiento con la que se cumplen 14 años mañana, When se envía, Then `400` con "Debes tener entre 14 y 100 años".

### REQ-005 — Acceso solo con sesión
IF la petición de lectura o de guardado del perfil no trae un token válido THEN THE SYSTEM SHALL responder `401` sin leer ni modificar ningún perfil ni ninguna fecha de nacimiento.

- **AC-005.1:** Given una petición de lectura del perfil sin token, When se envía, Then recibe `401`.
- **AC-005.2:** Given una petición de guardado del perfil sin token o con un token inválido, When se envía, Then recibe `401` y ningún perfil ni fecha de nacimiento cambia.

### REQ-006 — Control de acceso por onboarding en la app
WHILE el usuario autenticado navega por cualquier pantalla de la app (todas salvo `/onboarding`, el login, el registro, la recuperación de contraseña y las páginas legales) THE SYSTEM SHALL decidir si mostrarla según el estado del onboarding que devuelve el servidor.

- **AC-006.1:** Given un usuario cuyo perfil en el servidor tiene `onboarding_completed: false`, When abre `/home` (o cualquier otra pantalla protegida), Then es redirigido a `/onboarding`.
- **AC-006.2:** Given un usuario con `onboarding_completed: true`, When abre `/macros`, Then ve la pantalla de Macros.
- **AC-006.3:** Given que la lectura del perfil aún no ha terminado, When el usuario abre una pantalla protegida, Then se muestra un indicador de carga y no se redirige a `/onboarding` ni se muestra el contenido de la pantalla.
- **AC-006.4:** Given que la lectura del perfil falla (error de red o del servidor, distinto de `401`), When el usuario abre una pantalla protegida, Then ve el mensaje "No se pudo cargar tu perfil." y un botón "Reintentar", y no es redirigido a `/onboarding`.
- **AC-006.5:** Given el mensaje de error de AC-006.4, When el usuario pulsa "Reintentar" y la lectura ahora responde con el onboarding completado, Then ve la pantalla que había abierto.

### REQ-007 — La pantalla de onboarding solo para quien lo tiene pendiente
WHEN un usuario con el onboarding completado abre `/onboarding` THE SYSTEM SHALL redirigirlo a `/home`.

- **AC-007.1:** Given un usuario con `onboarding_completed: true`, When abre `/onboarding`, Then es redirigido a `/home`.
- **AC-007.2:** Given un usuario con `onboarding_completed: false`, When abre `/onboarding`, Then ve la primera pregunta del onboarding.

### REQ-008 — Terminar el onboarding guarda el perfil en el servidor
WHEN el usuario pulsa "Comenzar" en la última pregunta del onboarding THE SYSTEM SHALL enviar sus respuestas, incluida la fecha de nacimiento, al servidor y, solo si se guardan, llevarlo a `/home`.

- **AC-008.1:** Given un usuario que respondió todas las preguntas, When pulsa "Comenzar", Then el servidor recibe el perfil con sus respuestas, la fecha de nacimiento en formato `AAAA-MM-DD` y las unidades que eligió (por ejemplo, `height_unit: "ft"` con `height_ft` y `height_in`, o `weight_unit: "lb"`), y no recibe ningún campo `age`.
- **AC-008.2:** Given que el guardado responde con éxito, When termina, Then el usuario llega a `/home`, ve su resumen y no vuelve a ser redirigido a `/onboarding`.
- **AC-008.3:** Given que el guardado está en curso, When el usuario mira el botón, Then está deshabilitado y dice "Guardando…", y un segundo clic no envía otro guardado.
- **AC-008.4:** Given que el guardado falla, When termina, Then el usuario sigue en la última pregunta con sus respuestas intactas y ve el mensaje "No se pudo guardar tu perfil. Inténtalo de nuevo.", y puede volver a pulsar "Comenzar".

### REQ-009 — Pregunta de fecha de nacimiento en el onboarding
WHEN el onboarding llega a la pregunta de la edad THE SYSTEM SHALL pedir la fecha de nacimiento en lugar de la edad, prerrellenada con la fecha de nacimiento de la cuenta si existe, y no dejar avanzar hasta que sea válida.

- **AC-009.1:** Given un usuario cuya lectura del perfil trae `date_of_birth: "1995-05-20"`, When llega a la segunda pregunta del onboarding, Then ve el título "¿Cuál es tu fecha de nacimiento?" con un campo de fecha que ya muestra el 20/05/1995, y el botón "Siguiente" está habilitado.
- **AC-009.2:** Given un usuario cuya lectura del perfil trae `date_of_birth: null`, When llega a esa pregunta, Then el campo de fecha está vacío y el botón "Siguiente" está deshabilitado hasta que introduce una fecha válida.
- **AC-009.3:** Given que el usuario introduce una fecha futura, When la escribe, Then ve "La fecha de nacimiento no puede ser futura" y "Siguiente" está deshabilitado.
- **AC-009.4:** Given que el usuario introduce una fecha con la que tiene menos de 14 o más de 100 años (incluida una fecha prerrellenada de la cuenta en esa situación), When se muestra, Then ve "Debes tener entre 14 y 100 años" y "Siguiente" está deshabilitado.
- **AC-009.5:** Given un usuario con una fecha prerrellenada, When la cambia por otra válida y termina el onboarding, Then el servidor recibe la fecha nueva.
- **AC-009.6:** Given un usuario en el onboarding, When mira las preguntas, Then ninguna pide la edad como número.

### REQ-010 — La página de perfil muestra los datos del servidor
WHEN el usuario abre `/profile` THE SYSTEM SHALL precargar el formulario de datos físicos con el perfil y la fecha de nacimiento guardados en el servidor, en las unidades que eligió.

- **AC-010.1:** Given un perfil guardado con `date_of_birth: "1998-04-03"`, `height_unit: "ft"`, `height_ft: 5`, `height_in: 9`, `weight_unit: "lb"`, `weight: 160`, actividad `high` y meta `lose_slow`, When abre `/profile`, Then el formulario muestra el campo "Fecha de nacimiento" con el 03/04/1998, 5 ft 9 in, 160 lb, "Alto" y "Perder peso lentamente", además del género guardado.
- **AC-010.2:** Given otro usuario distinto que guardó otros datos en el mismo navegador, When este usuario abre `/profile`, Then el formulario muestra solo los datos de este usuario.
- **AC-010.3:** Given el formulario de datos físicos, When el usuario lo mira, Then no hay ningún campo "Edad" numérico.

### REQ-011 — Guardar cambios desde la página de perfil
WHEN el usuario pulsa "Guardar cambios" en el formulario de datos físicos con cambios válidos THE SYSTEM SHALL guardar el perfil completo, incluida la fecha de nacimiento, en el servidor y, si cambió el peso, la grasa o la masa muscular, registrar además la medición de hoy como hasta ahora.

- **AC-011.1:** Given un usuario que cambia solo la meta, When pulsa "Guardar cambios", Then el servidor recibe el perfil completo con la nueva meta y la fecha de nacimiento que ya tenía, no se registra ninguna medición y se muestra "Cambios guardados".
- **AC-011.2:** Given un usuario que cambia el peso, When pulsa "Guardar cambios", Then el servidor recibe el perfil con el nuevo peso y se registra una medición de hoy con ese peso en kg, y se muestra "Cambios guardados".
- **AC-011.3:** Given un usuario que cambia solo la fecha de nacimiento por otra válida, When pulsa "Guardar cambios", Then el servidor recibe el perfil con la fecha nueva, no se registra ninguna medición y se muestra "Cambios guardados".
- **AC-011.4:** Given un usuario que escribe una fecha de nacimiento futura, o una con la que tiene menos de 14 o más de 100 años, When la escribe, Then ve debajo del campo "La fecha de nacimiento no puede ser futura" o "Debes tener entre 14 y 100 años", respectivamente, y "Guardar cambios" está deshabilitado.
- **AC-011.5:** Given que el guardado del perfil falla, When termina, Then se muestra "No se pudieron guardar los cambios. Inténtalo de nuevo.", el formulario conserva los valores que escribió el usuario y no aparece "Cambios guardados".
- **AC-011.6:** Given que el perfil se guarda pero el registro de la medición falla, When termina, Then se muestra "No se pudo guardar la medición. Inténtalo de nuevo." y no aparece "Cambios guardados".
- **AC-011.7:** Given un guardado correcto, When el usuario va después a `/home` o `/macros`, Then ve las cifras calculadas con los datos nuevos, sin recargar la página.

### REQ-012 — Home, Macros y Métricas usan el perfil del servidor
THE SYSTEM SHALL calcular y mostrar el home, Macros y Métricas a partir del perfil guardado en el servidor, con los mismos cálculos y textos que hoy, usando como edad los años cumplidos a la fecha actual según la fecha de nacimiento.

- **AC-012.1:** Given un perfil del servidor con meta `lose` y peso 160 lb, When el usuario abre `/home`, Then ve "Meta: Perder peso", "Peso actual" con "160 lb" y el objetivo calórico que resulta de esos datos con el cálculo actual.
- **AC-012.2:** Given un perfil del servidor, When el usuario abre `/macros`, Then ve el objetivo diario y los gramos de cada macronutriente que resultan de esos datos con el cálculo actual.
- **AC-012.3:** Given un perfil del servidor con `weight_unit: "lb"`, When el usuario abre `/body-metrics` con mediciones, Then los pesos se muestran en lb y el ritmo se compara con la meta del perfil.
- **AC-012.4:** Given `date_of_birth: "1998-10-12"` y que la fecha actual es el 11 de octubre de 2026, When el usuario abre `/macros`, Then las cifras son las del cálculo actual con 27 años; y Given la misma fecha de nacimiento y que la fecha actual es el 12 de octubre de 2026, Then son las del cálculo con 28 años, sin que el usuario haya editado nada.

### REQ-013 — El navegador deja de ser la fuente del perfil
THE SYSTEM SHALL dejar de leer y de escribir el perfil y el estado del onboarding en el almacenamiento del navegador.

- **AC-013.1:** Given un navegador con datos del perfil simulado de la fase de diseño y un usuario cuyo servidor dice `onboarding_completed: false`, When abre `/home`, Then es redirigido a `/onboarding` (los datos simulados se ignoran).
- **AC-013.2:** Given un usuario que completa el onboarding, When termina, Then el almacenamiento del navegador no contiene sus respuestas del perfil.

## 5. Requisitos no funcionales

### NFR-001 — Aislamiento entre usuarios
THE SYSTEM SHALL permitir a cada usuario leer y modificar solo su propio perfil y su propia fecha de nacimiento, identificado por su sesión y nunca por un dato enviado por el cliente.

- **AC-N001.1:** Given dos usuarios A y B con perfiles distintos, When A lee su perfil, Then recibe solo el perfil y la fecha de nacimiento de A.
- **AC-N001.2:** Given dos usuarios A y B, When A guarda un perfil incluyendo en el cuerpo un identificador de usuario de B, Then se modifican el perfil y la fecha de nacimiento de A, y los de B quedan igual.

### NFR-002 — Cambio de cuenta en el mismo navegador
THE SYSTEM SHALL no mostrar a un usuario el perfil, la fecha de nacimiento ni el estado de onboarding de otra cuenta que haya usado antes el mismo navegador.

- **AC-N002.1:** Given que el usuario A (con onboarding completado) cierra sesión, When el usuario B (con onboarding pendiente) inicia sesión en el mismo navegador sin recargar la página, Then B es redirigido a `/onboarding` y no ve datos de A (tampoco su fecha de nacimiento prerrellenada).

## 6. Datos y contratos visibles

**Endpoints** (consumidor: el frontend; ambos exigen sesión):

| Método y ruta | Cuerpo | Respuesta correcta | Errores |
|---|---|---|---|
| `GET /api/profile` | — | `200` con el objeto de abajo | `401` sin sesión |
| `PUT /api/profile` | perfil completo con fecha de nacimiento (abajo) | `200` con el objeto de abajo | `400` validación · `401` sin sesión |

**Respuesta (lectura y guardado):**

```json
{
  "onboarding_completed": true,
  "onboarding_completed_at": "2026-10-11T18:30:00+00:00",
  "date_of_birth": "1998-04-03",
  "profile": {
    "gender": "male",
    "height_unit": "cm",
    "height_cm": 175.0,
    "height_ft": null,
    "height_in": null,
    "weight_unit": "kg",
    "weight": 72.5,
    "activity_level": "moderate",
    "goal": "maintain"
  }
}
```

- `date_of_birth` es la fecha de nacimiento de la cuenta (`AAAA-MM-DD`) y va **siempre** en la respuesta, aunque no haya perfil, para poder prerrellenar el onboarding. Es `null` si la cuenta no la tiene (cuentas de Google que aún no completaron el onboarding).
- La respuesta **no** incluye la edad; la app la calcula a partir de `date_of_birth`.
- Sin perfil: `{"onboarding_completed": false, "onboarding_completed_at": null, "date_of_birth": <fecha o null>, "profile": null}`.

**Cuerpo del guardado:** un objeto plano con `date_of_birth` y los mismos campos que `profile`. Se ignora cualquier campo adicional (incluidos `age` e identificadores de usuario).

```json
{
  "date_of_birth": "1998-04-03",
  "gender": "male",
  "height_unit": "ft",
  "height_ft": 5,
  "height_in": 9,
  "weight_unit": "lb",
  "weight": 160,
  "activity_level": "high",
  "goal": "lose_slow"
}
```

| Campo | Tipo | Valores permitidos | Mensaje si no es válido |
|---|---|---|---|
| `date_of_birth` | texto `AAAA-MM-DD` | fecha real, no futura, con una edad resultante de 14–100 años | "La fecha de nacimiento no es válida" (ausente, formato o fecha inexistente) · "La fecha de nacimiento no puede ser futura" · "Debes tener entre 14 y 100 años" |
| `gender` | texto | `male`, `female` | "El género debe ser masculino o femenino" |
| `height_unit` | texto | `cm`, `ft` | "La unidad de altura debe ser cm o ft" |
| `height_cm` | número (se guarda con 1 decimal) | 100–250; obligatorio si `height_unit` es `cm` | "La altura debe estar entre 100 y 250 cm" |
| `height_ft` | entero | 3–8; obligatorio si `height_unit` es `ft` | "La altura debe estar entre 3 y 8 ft, y las pulgadas entre 0 y 11" |
| `height_in` | entero | 0–11; opcional (0 si falta) si `height_unit` es `ft` | ídem |
| `weight_unit` | texto | `kg`, `lb` | "La unidad de peso debe ser kg o lb" |
| `weight` | número (se guarda con 1 decimal), en la unidad de `weight_unit` | 30–300 kg o 66–660 lb | "El peso debe estar entre 30 y 300 kg" / "El peso debe estar entre 66 y 660 lb" |
| `activity_level` | texto | `low`, `moderate`, `high`, `very_high`, `athlete` | "El nivel de actividad no es válido" |
| `goal` | texto | `lose`, `lose_slow`, `maintain`, `gain_slow`, `gain` | "La meta no es válida" |

- Cuerpo ausente o que no es un objeto JSON: "Los datos del perfil no son válidos".
- Los números enviados como texto (`"28"`) no son válidos.
- Si hay varios campos inválidos, se informa de uno solo.
- **Edad:** años cumplidos entre `date_of_birth` y la fecha actual. En el servidor, la fecha actual es la de UTC; en la app, la del dispositivo. Si en el límite de un cumpleaños ambas difieren y el servidor rechaza el guardado, la app muestra el error genérico de guardado que corresponda.
- Los rangos son los mismos que ya valida la UI del onboarding y del perfil (la edad de 14–100 años ahora se comprueba sobre la edad calculada).
- Si el mismo usuario guarda desde dos dispositivos, prevalece el último guardado.
- Guardar el perfil cambia la fecha de nacimiento de la cuenta: es un único dato, compartido con el registro.

**Mensajes del frontend (nuevos):**
- Error al cargar el perfil: "No se pudo cargar tu perfil." con el botón "Reintentar".
- Error al terminar el onboarding: "No se pudo guardar tu perfil. Inténtalo de nuevo."
- Botón del onboarding mientras guarda: "Guardando…".
- Error al guardar en la página de perfil: "No se pudieron guardar los cambios. Inténtalo de nuevo."
- Pregunta del onboarding: "¿Cuál es tu fecha de nacimiento?". Campo de la página de perfil: "Fecha de nacimiento" (sustituye a "Edad").
- Validación de la fecha en el onboarding y en el perfil: "La fecha de nacimiento no puede ser futura" y "Debes tener entre 14 y 100 años".
- Se mantienen "Cambios guardados" y "No se pudo guardar la medición. Inténtalo de nuevo.".

**Datos existentes:** todos los usuarios que ya existen quedan con el onboarding pendiente y sin perfil. Conservan la fecha de nacimiento que tuviera su cuenta, que aparece prerrellenada en el onboarding. Lo que el diseño simulado dejó en el navegador no se migra.

## 7. Preguntas abiertas

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | ¿Se guardan la altura y el peso **tal como los escribió el usuario, en su unidad** (cm, o ft + in; kg o lb), para que al volver a leerlos no cambien por redondeos de conversión? **Propuesta:** sí, como en la sección 6 (`height_cm` o `height_ft`/`height_in`, y `weight` en la unidad de `weight_unit`). La conversión a kg y cm para los cálculos la sigue haciendo la app. | De acuerdo con la propuesta ("todas las propuestas me parecen bien"). **Resuelta:** incorporada en REQ-002 (AC-002.3, AC-002.4) y la sección 6. |
| Q2 | La edad se guarda como un número fijo y con el tiempo queda desactualizada; además, las cuentas de email ya tienen fecha de nacimiento. ¿Qué hacemos? **Propuesta:** guardar la edad tal cual la escribe el usuario (como dice la idea) y dejar fuera de alcance recalcularla o usar la fecha de nacimiento. | No se guarda la edad: se usa la columna existente users.date_of_birth y la edad se calcula a partir de ella cuando hace falta (p. ej. Mifflin-St Jeor en Macros). El onboarding pide la fecha de nacimiento en lugar de la edad: viene prerrellenada si el usuario ya la tiene (cuentas de email) y es obligatoria si no (cuentas de Google, que no la aportan). La página de perfil permite editarla. La validación se hace sobre la edad derivada (14–100 años, como hoy); una fecha futura es un error. (Aprobado por el usuario: "sí, apúntalo así".) **Resuelta:** incorporada en REQ-001 (AC-001.4), REQ-002 (AC-002.7 a AC-002.9), REQ-004 (AC-004.2 a AC-004.4, AC-004.15, AC-004.16), REQ-009, REQ-010, REQ-011 (AC-011.3, AC-011.4), REQ-012 (AC-012.4) y la sección 6. |
| Q3 | ¿Terminar el onboarding debe registrar también el peso inicial como primera medición en Métricas? **Propuesta:** no; queda fuera de alcance. Hoy el onboarding no lo hace y la primera medición se registra desde el perfil. | De acuerdo con la propuesta ("todas las propuestas me parecen bien"). **Resuelta:** fuera de alcance (sección 3). |
| Q4 | ¿Qué pasa con los datos del perfil simulado que ya están en el navegador (por ejemplo, el tuyo de pruebas)? **Propuesta:** se ignoran y no se migran; cada usuario existente repite el onboarding una vez. | De acuerdo con la propuesta ("todas las propuestas me parecen bien"). **Resuelta:** incorporada en REQ-013 y en "Datos existentes". |
| Q5 | ¿Rutas del contrato? **Propuesta:** `GET /api/profile` y `PUT /api/profile` (guardado completo, no parcial), con la respuesta de la sección 6. El estado del onboarding va en esa misma respuesta, no en `GET /api/auth/me`. | De acuerdo con la propuesta ("todas las propuestas me parecen bien"). **Resuelta:** incorporada en la sección 6; `GET /api/auth/me` no cambia. |
| Q6 | Si no se puede cargar el perfil (servidor caído o sin red), ¿qué ve el usuario? **Propuesta:** el mensaje "No se pudo cargar tu perfil." con un botón "Reintentar", sin mandarlo al onboarding (para no hacerle repetirlo ni sobrescribir su perfil por un fallo pasajero). | De acuerdo con la propuesta ("todas las propuestas me parecen bien"). **Resuelta:** incorporada en AC-006.4 y AC-006.5. |
| Q7 | ¿Cuántos decimales se aceptan en peso y altura en cm? **Propuesta:** se acepta cualquier número dentro del rango y se guarda redondeado a 1 decimal; pies y pulgadas, solo enteros. | De acuerdo con la propuesta ("todas las propuestas me parecen bien"). **Resuelta:** incorporada en AC-002.5, AC-004.7 y la sección 6. |
| Q8 | ¿Los límites de validación del servidor son los mismos que ya usa la UI (edad 14–100; 100–250 cm; 3–8 ft y 0–11 in; 30–300 kg; 66–660 lb)? **Propuesta:** sí, idénticos. | De acuerdo con la propuesta ("todas las propuestas me parecen bien"). **Resuelta:** incorporada en REQ-004 (la edad, sobre la edad calculada a partir de la fecha de nacimiento, según Q2). |

## 8. Glosario

- **Perfil:** género, altura, peso (con sus unidades), nivel de actividad y meta del usuario, junto con la fecha de nacimiento de su cuenta. No incluye la grasa corporal ni la masa muscular, que son mediciones.
- **Fecha de nacimiento de la cuenta:** el único dato de fecha de nacimiento del usuario; es el mismo que se pide en el registro con email y el que se edita en el onboarding y en el perfil.
- **Edad:** años cumplidos entre la fecha de nacimiento y la fecha actual. No se guarda; se calcula cada vez que hace falta.
- **Onboarding pendiente / completado:** el usuario aún no ha guardado su perfil nunca / ya lo guardó al menos una vez.
- **Medición:** un registro con fecha en el historial de Métricas (peso, % de grasa, % de masa muscular).
- **Pantalla protegida:** cualquier pantalla de la app que exige sesión y onboarding completado.
