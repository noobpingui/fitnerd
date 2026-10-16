# Spec 015 — Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod

- **Feature:** `015-onboarding-profile-rhf` · **Tipo:** refactor
- **Ámbitos:** frontend

## 1. Contexto y problema

La app recoge los datos físicos del usuario en dos sitios:

- el **onboarding** (`/onboarding`), un asistente de una pregunta por pantalla: género, fecha de nacimiento, altura, peso, nivel de actividad y meta;
- el formulario **Datos físicos** del perfil (`/profile`), con esos mismos datos a la vista más el % de grasa corporal y el % de masa muscular opcionales.

Los dos formularios se construyeron con estado local y comparten un módulo de validación propio. El resto de formularios de la app (login, registro, recuperación de contraseña, feedback y edición de mediciones) usa react-hook-form con zod, como exige la constitución (Art. P2.3 de la Parte II; antes Art. 6.8). La spec 006 aceptó esta desviación en su plan y la dejó como deuda.

Además, las reglas de validación están **duplicadas**: los límites de altura y peso se comprueban en los formularios y otra vez, con reglas que no coinciden del todo, al validar el cuerpo que se envía al servidor. Hoy las dos fuentes discrepan en un caso: el formulario acepta pies o pulgadas con decimales, pero el cuerpo enviado exige enteros, así que el guardado falla con el mensaje genérico de error. Esta feature lo resuelve exigiendo enteros en los dos formularios (Q2, resuelta).

Esta feature salda la deuda: los dos formularios pasan a react-hook-form con zod, con **un único conjunto de reglas** compartido por ambos, y conservan el comportamiento visible actual. También recoge en la spec un comportamiento que existía sin especificar (hallazgo F8 de la revisión de la 006): el perfil muestra "Indica tu fecha de nacimiento" cuando la fecha está vacía, mientras que el onboarding no muestra ningún mensaje.

## 2. Historia de usuario

Como **usuario de fitnerd**, quiero **que el onboarding y el formulario de datos físicos del perfil se comporten exactamente igual que ahora y apliquen las mismas reglas a los mismos datos** para **no encontrarme con que un valor que se acepta en una pantalla se rechaza en la otra o al guardar**.

Como **mantenedor**, quiero **que las reglas de validación de los datos físicos estén definidas una sola vez y que los dos formularios sigan la convención de la app** para **cambiar un límite en un solo sitio sin riesgo de que las pantallas diverjan**.

## 3. Alcance

**Incluye:**
- Migrar el asistente de onboarding y el formulario Datos físicos del perfil a react-hook-form con zod (Art. P2.3).
- Un único conjunto de reglas de validación de fecha de nacimiento, altura y peso, compartido por los dos formularios, que sustituya a las reglas duplicadas actuales. El módulo de validación propio desaparece si queda sin uso.
- Conservar el comportamiento visible: mismos campos, mismos textos y mensajes de error, mismas conversiones de unidades, mismo flujo de pasos del onboarding, mismo flujo de guardado del perfil (perfil, medición del día, "Cambios guardados", "Descartar") y mismo cuerpo enviado al servidor.
- Especificar y cubrir con test el mensaje "Indica tu fecha de nacimiento" del perfil con la fecha vacía (006 F8).
- Resolver la discrepancia de pies y pulgadas con decimales: los dos formularios exigen enteros en pies y pulgadas (Q2, AC-003.5). Es el único cambio de comportamiento visible de la feature.
- Conservar todos los casos de prueba existentes de la fecha de nacimiento (spec 006: vacía, futura, menos de 14, más de 100, límites exactos y fecha normal), con sus mismos valores, su "hoy" fijo y sus marcadores de trazabilidad de la 006, aplicados al conjunto de reglas compartido. Ningún caso se pierde ni se relaja; si el archivo de tests del módulo antiguo desaparece con él, se trata como un traslado y no como un borrado (Q1, Art. B5.3).

**Fuera de alcance:**
- Cualquier cambio en el backend o en el contrato de `GET`/`PUT /api/profile` y `POST /api/body-metrics`.
- Cambiar textos, límites, diseño o pasos de los formularios, salvo la exigencia de enteros en ft/in (Q2).
- Mejorar el mensaje de altura en ft/in cuando lo que falla son las pulgadas (hoy dice "Entre 3 y 8 ft"); se mantiene y se anota en el backlog.
- Otros formularios de la app y el cálculo de calorías y macros.
- Mediciones con fecha pasada desde el perfil.

## 4. Requisitos funcionales

Salvo que se diga otra cosa, "hoy" es la fecha local del dispositivo y los ejemplos usan hoy = 11-10-2026.

### REQ-001 — Reglas de la fecha de nacimiento, iguales en los dos formularios
THE SYSTEM SHALL aceptar en el onboarding y en el perfil solo una fecha de nacimiento completa, no futura y que dé una edad de entre 14 y 100 años (ambos incluidos), y SHALL mostrar en los dos formularios el mismo mensaje para cada motivo de rechazo.

- **AC-001.1:** Given hoy = 11-10-2026, When el usuario introduce `2012-10-11` (14 años justos) o `1925-10-12` (100 años) en la fecha de nacimiento del onboarding o del perfil, Then no se muestra ningún mensaje de error bajo el campo y el botón de avance ("Siguiente" en el onboarding, "Guardar cambios" en el perfil, si hay otros cambios pendientes) está habilitado.
- **AC-001.2:** Given hoy = 11-10-2026, When el usuario introduce `2026-10-12` en cualquiera de los dos formularios, Then se muestra "La fecha de nacimiento no puede ser futura" y el botón de avance está deshabilitado.
- **AC-001.3:** Given hoy = 11-10-2026, When el usuario introduce `2012-10-12` (13 años) o `1925-10-11` (101 años) en cualquiera de los dos formularios, Then se muestra "Debes tener entre 14 y 100 años" y el botón de avance está deshabilitado.
- **AC-001.4:** Given la pregunta de la fecha del onboarding, When el campo está vacío, Then no se muestra ningún mensaje de error y "Siguiente" está deshabilitado.

### REQ-002 — Fecha de nacimiento vacía en el perfil (006 F8)
IF la fecha de nacimiento del formulario Datos físicos está vacía THEN THE SYSTEM SHALL mostrar bajo el campo el mensaje "Indica tu fecha de nacimiento", marcar el campo como inválido y deshabilitar "Guardar cambios".

- **AC-002.1:** Given el perfil cargado con una fecha de nacimiento válida, When el usuario vacía el campo "Fecha de nacimiento", Then se muestra "Indica tu fecha de nacimiento", el campo tiene `aria-invalid="true"` y "Guardar cambios" está deshabilitado.
- **AC-002.2:** Given el perfil cargado y la fecha vacía con su mensaje visible, When el usuario introduce una fecha válida, Then el mensaje desaparece y "Guardar cambios" queda habilitado.

### REQ-003 — Reglas de la altura, iguales en los dos formularios
THE SYSTEM SHALL aceptar en los dos formularios una altura de entre 100 y 250 cm, o de entre 3 y 8 ft más entre 0 y 11 in, donde las pulgadas vacías cuentan como 0. IF la altura no es válida THEN THE SYSTEM SHALL deshabilitar "Siguiente" en el onboarding (sin mensaje) y, en el perfil, mostrar "Entre 100 y 250 cm" (unidad cm) o "Entre 3 y 8 ft" (unidad ft/in, también cuando fallan las pulgadas), marcar los campos de altura como inválidos y deshabilitar "Guardar cambios".

- **AC-003.1:** Given la unidad cm, When el usuario escribe `100` o `250` en el onboarding o en el perfil, Then la altura es válida ("Siguiente" habilitado en el onboarding; ningún mensaje de altura en el perfil).
- **AC-003.2:** Given la unidad cm, When el usuario escribe `99`, `251` o deja el campo vacío, Then en el onboarding "Siguiente" está deshabilitado sin mensaje, y en el perfil se muestra "Entre 100 y 250 cm" y "Guardar cambios" está deshabilitado.
- **AC-003.3:** Given la unidad ft/in, When el usuario escribe `5` ft y deja las pulgadas vacías, Then la altura es válida en los dos formularios.
- **AC-003.4:** Given la unidad ft/in, When el usuario escribe `2` ft, `9` ft o `5` ft con `12` in, Then en el onboarding "Siguiente" está deshabilitado sin mensaje, y en el perfil se muestra "Entre 3 y 8 ft" y "Guardar cambios" está deshabilitado.
- **AC-003.5:** Given la unidad ft/in, When el usuario escribe un valor con decimales en pies o en pulgadas (por ejemplo `5.5` ft), Then en el onboarding "Siguiente" está deshabilitado sin mensaje, y en el perfil se muestra "Entre 3 y 8 ft" y "Guardar cambios" está deshabilitado, de modo que nunca se intenta enviar al servidor una altura que el cuerpo del envío rechazaría (Q2).

### REQ-004 — Reglas del peso, iguales en los dos formularios
THE SYSTEM SHALL aceptar en los dos formularios un peso de entre 30 y 300 kg o de entre 66 y 660 lb, decimales incluidos. IF el peso no es válido THEN THE SYSTEM SHALL deshabilitar "Siguiente" en el onboarding (sin mensaje) y, en el perfil, mostrar "Entre 30 y 300 kg" o "Entre 66 y 660 lb" según la unidad, marcar el campo como inválido y deshabilitar "Guardar cambios".

- **AC-004.1:** Given la unidad kg, When el usuario escribe `30`, `300` o `72.5`, Then el peso es válido en los dos formularios.
- **AC-004.2:** Given la unidad kg, When el usuario escribe `29.9`, `300.1` o deja el campo vacío, Then en el onboarding "Siguiente" está deshabilitado sin mensaje, y en el perfil se muestra "Entre 30 y 300 kg" y "Guardar cambios" está deshabilitado.
- **AC-004.3:** Given la unidad lb, When el usuario escribe `66` o `660`, Then el peso es válido; When escribe `65.9` o `660.1`, Then en el perfil se muestra "Entre 66 y 660 lb" y en el onboarding "Siguiente" está deshabilitado.

### REQ-005 — Composición corporal opcional en el perfil
THE SYSTEM SHALL aceptar en el perfil el % de grasa corporal vacío o entre 3 y 60, y el % de masa muscular vacío o entre 10 y 70. IF alguno está fuera de rango THEN THE SYSTEM SHALL mostrar "Entre 3 y 60 %" o "Entre 10 y 70 %" bajo ese campo, marcarlo como inválido y deshabilitar "Guardar cambios".

- **AC-005.1:** Given el perfil cargado, When el usuario deja vacíos los dos campos o escribe `3`/`60` en grasa y `10`/`70` en músculo, Then no se muestra ningún mensaje bajo esos campos.
- **AC-005.2:** Given el perfil cargado, When el usuario escribe `61` en "% Grasa corporal (opcional)", Then se muestra "Entre 3 y 60 %" y "Guardar cambios" está deshabilitado.
- **AC-005.3:** Given el perfil cargado, When el usuario escribe `9` en "% Masa muscular (opcional)", Then se muestra "Entre 10 y 70 %" y "Guardar cambios" está deshabilitado.

### REQ-006 — Conversión de unidades
WHEN el usuario cambia la unidad de altura o de peso en cualquiera de los dos formularios THE SYSTEM SHALL convertir el valor escrito si es válido (altura a cm enteros o a ft e in enteros, con 12 in convertidas en 1 ft más; peso redondeado a un decimal) y, si no es válido, SHALL cambiar solo la unidad y conservar el texto escrito.

- **AC-006.1:** Given `175` cm, When el usuario elige "ft / in", Then los campos muestran `5` ft y `9` in; When vuelve a "cm", Then el campo muestra `175`.
- **AC-006.2:** Given `182` cm, When el usuario elige "ft / in", Then los campos muestran `6` ft y `0` in.
- **AC-006.3:** Given `72` kg, When el usuario elige "lb", Then el campo muestra `158.7`; Given `160` lb, When elige "kg", Then muestra `72.6`.
- **AC-006.4:** Given `1750` cm (no válido), When el usuario elige "ft / in", Then la unidad pasa a ft/in sin convertir nada; Given `20` kg (no válido), When elige "lb", Then el campo de peso sigue mostrando `20` con la unidad lb.

### REQ-007 — Flujo del asistente de onboarding
THE SYSTEM SHALL conservar el flujo actual del onboarding: seis preguntas en orden (género, fecha de nacimiento, altura, peso, nivel de actividad, meta), el indicador "N de 6", el avance automático al elegir una opción en género y nivel de actividad, el avance con "Siguiente" o con Enter en las preguntas de fecha, altura y peso, la meta confirmada con "Comenzar", y "Atrás" sin perder lo respondido.

- **AC-007.1:** Given la pregunta del género, When el usuario elige "Masculino", Then pasa sola a "¿Cuál es tu fecha de nacimiento?" y el indicador muestra "2 de 6".
- **AC-007.2:** Given la pregunta de la altura con `175` cm escrito, When el usuario pulsa Enter en el campo, Then pasa a "¿Cuánto pesas?".
- **AC-007.3:** Given el usuario respondió la altura (`175` cm) y está en la pregunta del peso, When pulsa "Atrás", Then vuelve a "¿Cuánto mides?" con `175` en el campo y "Siguiente" habilitado.
- **AC-007.4:** Given la pregunta de la meta, When el usuario elige una opción, Then la pantalla no avanza sola y "Comenzar" queda habilitado.
- **AC-007.5:** Given la cuenta tiene fecha de nacimiento `1995-05-20`, When el usuario llega a la pregunta de la fecha, Then el campo aparece prerrellenado con esa fecha y "Siguiente" está habilitado; Given la fecha prerrellenada es `1900-01-01`, Then el mensaje "Debes tener entre 14 y 100 años" se ve sin que el usuario toque el campo.

### REQ-008 — Envío del onboarding
WHEN el usuario pulsa "Comenzar" con todas las respuestas válidas THE SYSTEM SHALL enviar una sola vez el perfil completo con los campos de la unidad elegida (los de la otra unidad a `null`, pulgadas vacías como `0`, nunca la edad), mostrar "Guardando…" con el botón deshabilitado mientras se guarda, llevar al usuario a `/home` al terminar y, si falla, mostrar "No se pudo guardar tu perfil. Inténtalo de nuevo." conservando las respuestas y permitiendo reintentar.

- **AC-008.1:** Given el usuario respondió `5` ft con las pulgadas vacías y `160` lb, When pulsa "Comenzar", Then el cuerpo enviado contiene `height_unit: "ft"`, `height_cm: null`, `height_ft: 5`, `height_in: 0`, `weight_unit: "lb"`, `weight: 160` y no contiene `age`.
- **AC-008.2:** Given el usuario respondió en cm y kg (`175`, `72`), When pulsa "Comenzar", Then el cuerpo enviado contiene `height_cm: 175`, `height_ft: null`, `height_in: null`, `weight: 72` y la fecha de nacimiento introducida.
- **AC-008.3:** Given un guardado en curso, When el usuario vuelve a pulsar el botón, Then el botón muestra "Guardando…", está deshabilitado y solo se ha enviado un guardado.

### REQ-009 — Guardado del formulario Datos físicos
THE SYSTEM SHALL conservar el guardado actual del perfil: "Guardar cambios" solo habilitado si hay cambios y todo es válido; "Descartar" visible solo con cambios y restaura los últimos valores guardados; al guardar, primero el perfil completo y, solo si cambió el peso (más de 0,05 kg) o la composición, una medición de hoy en kg con un decimal que incluye la grasa o el músculo solo si se cambiaron; "Cambios guardados" durante 3 segundos o hasta el siguiente cambio; y los mensajes de error del perfil y de la medición.

- **AC-009.1:** Given el perfil recién cargado, When el usuario no cambia nada, Then "Guardar cambios" está deshabilitado y "Descartar" no aparece.
- **AC-009.2:** Given el usuario cambió la meta y el peso, When pulsa "Descartar", Then los campos vuelven a los valores cargados, "Descartar" desaparece y "Guardar cambios" está deshabilitado.
- **AC-009.3:** Given el perfil en kg (`72.5`), When el usuario cambia solo la unidad a lb y guarda, Then se envía el perfil con `weight_unit: "lb"` y no se registra ninguna medición.
- **AC-009.4:** Given el perfil con `20` % de grasa ya guardado, When el usuario cambia solo el % de masa muscular a `40` y guarda, Then la medición enviada incluye `muscle_mass_percentage: 40` y no incluye `body_fat_percentage`.
- **AC-009.5:** Given un guardado correcto, When aparece "Cambios guardados", Then desaparece a los 3 segundos; y si antes el usuario modifica cualquier campo, desaparece en ese momento.
- **AC-009.6:** Given un guardado correcto con el peso cambiado a `80`, When el usuario vuelve a cambiar el peso a `79.5` y guarda, Then se registra una segunda medición con `79.5` (los valores guardados de referencia se actualizaron tras el primer guardado).

### REQ-010 — Errores visibles desde la carga en el perfil
WHEN el formulario Datos físicos se carga con datos que no cumplen las reglas THE SYSTEM SHALL mostrar los mensajes correspondientes de inmediato, sin esperar a que el usuario edite el campo ni intente guardar.

- **AC-010.1:** Given el servidor devuelve un perfil sin fecha de nacimiento, When se muestra el formulario, Then "Indica tu fecha de nacimiento" ya está visible bajo el campo.
- **AC-010.2:** Given el usuario escribe `500` en el peso (kg), When todavía no ha pulsado "Guardar cambios", Then "Entre 30 y 300 kg" ya está visible.

## 5. Requisitos no funcionales

No aplican requisitos no funcionales nuevos. La equivalencia de reglas entre los dos formularios se exige como comportamiento observable en REQ-001, REQ-003 y REQ-004, y la ausencia de regresiones la garantizan los tests existentes de las specs 006, 008 y 009, que deben seguir pasando (Art. B5.3).

## 6. Datos y contratos visibles

**Campos (sin cambios):**

| Formulario | Campo | Regla |
|---|---|---|
| Ambos | Género | Masculino / Femenino; obligatorio |
| Ambos | Fecha de nacimiento | Fecha completa, no futura, edad 14–100 años |
| Ambos | Altura | cm: 100–250 · ft/in: 3–8 ft y 0–11 in, solo enteros (cambio de esta feature, Q2), pulgadas vacías = 0 |
| Ambos | Peso | kg: 30–300 · lb: 66–660, admite decimales |
| Ambos | Nivel de actividad | Bajo, Moderado, Alto, Muy alto, Atleta; obligatorio |
| Ambos | Meta | Perder peso, Perder peso lentamente, Mantener peso, Aumentar peso lentamente, Aumentar peso; obligatoria |
| Perfil | % Grasa corporal (opcional) | Vacío o 3–60 |
| Perfil | % Masa muscular (opcional) | Vacío o 10–70 |

**Mensajes visibles (textos exactos, sin cambios salvo que se indique):**

| Situación | Onboarding | Perfil |
|---|---|---|
| Fecha vacía o incompleta | (sin mensaje; "Siguiente" deshabilitado) | "Indica tu fecha de nacimiento" si está vacía (recogido ahora, 006 F8) |
| Fecha futura | "La fecha de nacimiento no puede ser futura" | igual |
| Edad fuera de 14–100 | "Debes tener entre 14 y 100 años" | igual |
| Altura no válida | (sin mensaje) | "Entre 100 y 250 cm" / "Entre 3 y 8 ft" |
| Peso no válido | (sin mensaje) | "Entre 30 y 300 kg" / "Entre 66 y 660 lb" |
| Grasa / músculo no válidos | — | "Entre 3 y 60 %" / "Entre 10 y 70 %" |
| Fallo al guardar el perfil | "No se pudo guardar tu perfil. Inténtalo de nuevo." | "No se pudieron guardar los cambios. Inténtalo de nuevo." |
| Fallo al guardar la medición | — | "No se pudo guardar la medición. Inténtalo de nuevo." |
| Guardado correcto | (navega a `/home`) | "Cambios guardados" (3 s) |
| Guardando | "Guardando…" | "Guardando…" |

**Contratos (sin cambios):** el cuerpo de `PUT /api/profile` sigue siendo `date_of_birth`, `gender`, `height_unit`, `height_cm`, `height_ft`, `height_in`, `weight_unit`, `weight`, `activity_level` y `goal`, sin claves extra y nunca `age`; el de `POST /api/body-metrics` desde el perfil sigue siendo `weight` (kg, un decimal), `recorded_at` (hoy) y, solo si cambiaron, `body_fat_percentage` y `muscle_mass_percentage`.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | **Resuelta (propuesta aceptada; incorporada en Alcance).** El módulo de validación que se elimina tiene su propio archivo de tests (casos de la fecha de nacimiento de la spec 006: vacía, futura, menos de 14, más de 100, límites exactos y fecha normal). La constitución prohíbe borrar o debilitar tests existentes (Art. B5.3). ¿Cómo se tratan? | Trasladar cada caso, con sus mismos valores, hoy fijo y marcadores `SDD:` de la 006, a los tests del conjunto de reglas compartido; el archivo antiguo solo se elimina junto con su módulo y ningún caso se pierde ni se relaja. Se deja constancia en el plan como traslado, no como borrado. | Si, aceptadas |
| Q2 | **Resuelta (propuesta aceptada; incorporada en REQ-003, AC-003.5 y sección 6).** Hoy el formulario acepta pies o pulgadas con decimales (p. ej. `5.5` ft), pero el cuerpo que se envía al servidor exige enteros, así que el guardado falla con el mensaje genérico de error. Al unificar las reglas hay que elegir una. ¿Cuál? | Exigir enteros en pies y pulgadas en los dos formularios: el onboarding no deja avanzar y el perfil muestra "Entre 3 y 8 ft" (AC-003.5). Es el único cambio de comportamiento visible de la feature. | Si, aceptadas |

## 8. Glosario

- **Onboarding:** asistente de una pregunta por pantalla que completa el perfil tras el registro (`/onboarding`).
- **Datos físicos:** sección del perfil (`/profile`) con los mismos datos editables en un único formulario.
- **Botón de avance:** "Siguiente" o "Comenzar" en el onboarding; "Guardar cambios" en el perfil.
- **Medición de hoy:** registro de peso y composición con la fecha local del dispositivo que el perfil crea o actualiza al guardar un cambio medible (spec 008).
