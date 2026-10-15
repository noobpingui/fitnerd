# Spec 013 — Pulido del código y la documentación de las features 006 a 010

- **Feature:** `013-polish-006-010` · **Tipo:** refactor
- **Ámbito:** ambos

## 1. Contexto y problema

Las features 006 a 010 (perfil, macros, mediciones coherentes con el perfil, indicadores de progreso y análisis con IA con contexto) se cerraron con varios hallazgos menores y NITs en sus revisiones que se dejaron para más adelante. Esta spec los recoge en una sola pasada de pulido sin cambiar la funcionalidad de la app, salvo dos arreglos pequeños:

1. **Números enteros enormes en el cuerpo JSON** (revisión 008, F1). Si un cliente envía un entero gigante (por ejemplo, de 400 dígitos) en un campo numérico, el servidor responde 500 en lugar del 400 con el mensaje de validación que corresponde. Afecta a `PUT /api/profile` y a `POST` y `PUT /api/body-metrics`, y el mismo defecto existe en `POST /api/body-metrics/analysis` (Q1).
2. **Aviso de error al borrar una medición** (revisión 008, F3). En el Historial de Métricas, el aviso "No se pudo borrar la medición. Inténtalo de nuevo." solo desaparece al abrir otro diálogo de borrado, aunque el usuario haya pasado a corregir otra medición o la lista haya cambiado.

El resto es limpieza de código, de tests, de comentarios y de documentación: duplicados, casts innecesarios, una función sin uso, marcadores de trazabilidad que citan criterios que no prueban, ruido en la salida de los tests y una fila demasiado larga en `CLAUDE.md`.

## 2. Historia de usuario

Como **usuario de fitnerd**, quiero **que la app me responda con un mensaje claro cuando envío un dato fuera de rango y que los avisos de error desaparezcan cuando ya no aplican** para **entender qué ha pasado sin ver errores del servidor ni avisos obsoletos**.

Como **mantenedor de fitnerd**, quiero **que el código, los tests y la documentación de las features 006 a 010 estén limpios y con trazabilidad correcta** para **poder cambiarlos más adelante sin tropezar con duplicados, casts engañosos ni ruido en los tests**.

## 3. Alcance

**Incluye:**
- Respuesta 400 con el mensaje de validación del campo cuando llega un entero enorme en el perfil, en las mediciones y en la petición de análisis (Q1).
- Limpieza del aviso de error de borrado del Historial cuando deja de aplicar (Q2).
- Limpieza de código del frontend:
  - `dateUtils.ts` de Métricas deja de reexportar las utilidades de fechas compartidas; quien las use las importa de `@/lib/dates` (006 F7).
  - Tipo explícito del suelo calórico en `macros/calculations.ts`, como el resto de tablas del archivo (007 F1).
  - `macros/calculations.ts` reutiliza la conversión de altura del onboarding en lugar de repetirla (009 F2).
  - Se elimina `isWithinLastMonths`, que el código de producción ya no usa (009 F4, Q3).
  - El comentario sobre la tendencia de `TrendChart.tsx` se coloca junto al código que describe (009 F6).
  - `formatInsights` acepta solo el tipo de indicadores real, sin cast (010 F4).
  - Se quita la comprobación redundante de `analysisRequest.ts` (010 F6).
- Limpieza de código del backend:
  - Un solo mensaje "Usuario no encontrado" compartido entre perfil y mediciones (008 F5).
  - Una sola lista de estados de ritmo con ritmo compartida entre el contexto del análisis y la sugerencia de calorías (010 F3).
- Limpieza de tests:
  - Sin casts innecesarios en `calculations.test.ts` de Macros (007 F2) ni en el test de `formatInsights` (010 F4).
  - El helper `renderLoaded` de `BodyMetricsPage.test.tsx` espera algo visible del perfil cargado en lugar de vaciar microtareas (009 F7).
  - Los marcadores `SDD:` de los tests de validación del cuerpo del análisis apuntan a criterios que de verdad prueban (010 F2, Q4).
  - La salida de `npm test` no muestra el aviso de `VITE_GOOGLE_CLIENT_ID` ni el aviso de Recharts por tamaño 0 (Q5, Q6).
- Ortografía: tildes en los docstrings de `test_body_metric_routes.py` (008 F4) y en los comentarios señalados en la revisión 010, F5 (Q7).
- Documentación: dividir la fila "Métricas corporales" de la tabla de áreas funcionales de `CLAUDE.md` (Q8).

**Fuera de alcance:**
- Cualquier otro cambio de comportamiento visible para el usuario.
- Los hallazgos 008 F2 (peso del perfil revertido por una medición posterior), 008 F6 (marcadores heredados con IDs ambiguos), 010 F1 (ritmo fuera de [-10, 10] kg/sem) y 010 F7 (pestañas con el bundle anterior tras el despliegue) (Q10).
- La tilde que falta en el mensaje visible "No se pudo generar el analisis en este momento…" del análisis con IA (Q9).
- Las violaciones de ruff previas y otros comentarios sin tilde que no estén citados en la revisión 010 F5 ni en líneas que esta spec ya modifique (Q7).
- Otros avisos en la salida de los tests distintos de los dos citados (Q6).

## 4. Requisitos funcionales

### REQ-001 — Entero enorme en el perfil
IF el cuerpo de `PUT /api/profile` trae un número entero cuyo valor está muy por encima o por debajo del rango permitido de un campo numérico (por ejemplo, de 400 dígitos) THEN THE SYSTEM SHALL responder 400 con el mismo mensaje de validación que daría para un valor fuera de rango de ese campo y no modificar el perfil.

- **AC-001.1:** Given un usuario con sesión y un cuerpo de perfil válido salvo `height_unit: "cm"` y `height_cm` igual a 10^400 (entero de 401 dígitos), When envía `PUT /api/profile`, Then recibe 400 con `{"error": "La altura debe estar entre 100 y 250 cm"}`.
- **AC-001.2:** Given un usuario con sesión y un cuerpo de perfil válido salvo `weight_unit: "kg"` y `weight` igual a 10^400, When envía `PUT /api/profile`, Then recibe 400 con `{"error": "El peso debe estar entre 30 y 300 kg"}`.
- **AC-001.3:** Given un usuario con sesión y un cuerpo de perfil válido salvo `weight_unit: "lb"` y `weight` igual a -10^400, When envía `PUT /api/profile`, Then recibe 400 con `{"error": "El peso debe estar entre 66 y 660 lb"}`.
- **AC-001.4:** Given un usuario con un perfil ya guardado, When envía `PUT /api/profile` con `weight` igual a 10^400 y después consulta `GET /api/profile`, Then el perfil devuelto es igual al que tenía antes de la petición.
- **AC-001.5:** Given un usuario con sesión, When envía `PUT /api/profile` con un cuerpo cuyo `weight` es un entero de 5000 dígitos, Then recibe 400 con `{"error": "Los datos del perfil no son válidos"}` y nunca 500.

### REQ-002 — Entero enorme en las mediciones
IF el cuerpo de `POST /api/body-metrics` o de `PUT /api/body-metrics/{id}` trae un número entero enorme (por ejemplo, de 400 dígitos) en `weight`, `body_fat_percentage` o `muscle_mass_percentage` THEN THE SYSTEM SHALL responder 400 con el mensaje de validación de ese campo y no crear ni modificar ninguna medición ni el peso del perfil.

- **AC-002.1:** Given un usuario con sesión, When envía `POST /api/body-metrics` con `weight` igual a 10^400, Then recibe 400 con `{"error": "El peso debe estar entre 29,9 y 300 kg"}` y su lista de mediciones no cambia.
- **AC-002.2:** Given un usuario con sesión, When envía `POST /api/body-metrics` con `body_fat_percentage` igual a 10^400, Then recibe 400 con `{"error": "El porcentaje de grasa corporal debe estar entre 3 y 60"}`.
- **AC-002.3:** Given un usuario con sesión, When envía `POST /api/body-metrics` con `muscle_mass_percentage` igual a -10^400, Then recibe 400 con `{"error": "El porcentaje de masa muscular debe estar entre 10 y 70"}`.
- **AC-002.4:** Given un usuario con una medición propia de 80 kg y un perfil con peso 80 kg, When envía `PUT /api/body-metrics/{id}` de esa medición con `weight` igual a 10^400, Then recibe 400 con `{"error": "El peso debe estar entre 29,9 y 300 kg"}`, la medición sigue con 80 kg y el peso del perfil no cambia.
- **AC-002.5:** Given un usuario con sesión, When envía `POST /api/body-metrics` con un cuerpo cuyo `weight` es un entero de 5000 dígitos, Then recibe 400 con `{"error": "Los datos de la medición no son válidos"}` y nunca 500.

### REQ-003 — Entero enorme en la petición de análisis
IF el cuerpo de `POST /api/body-metrics/analysis` de un usuario con perfil y mediciones trae un número entero enorme en `rate_kg_per_week` o en `latest_weight_kg` THEN THE SYSTEM SHALL responder 400 con `"No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."`, sin llamar al modelo de IA y sin contar el intento contra el límite de análisis (Q1).

- **AC-003.1:** Given un usuario con perfil y mediciones y un cuerpo de análisis válido con `pace_status` "on_track" salvo `rate_kg_per_week` igual a 10^400, When pide un análisis, Then recibe 400 con `{"error": "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."}`, no se llama al modelo de IA y no se registra ningún análisis.
- **AC-003.2:** Given el mismo caso con `rate_kg_per_week` válido y `latest_weight_kg` igual a 10^400, When pide un análisis, Then recibe la misma respuesta 400 y no se llama al modelo de IA.
- **AC-003.3:** Given un cuerpo de análisis con `pace_status` "unrealistic" y `latest_weight_kg` igual a -10^400, When pide un análisis, Then recibe la misma respuesta 400 y no se llama al modelo de IA.

### REQ-004 — Validación del cuerpo del análisis (comportamiento que se conserva)
IF el cuerpo de `POST /api/body-metrics/analysis` de un usuario con perfil y mediciones no es válido THEN THE SYSTEM SHALL responder 400 con `"No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."`, sin llamar al modelo de IA y sin registrar el análisis. Este requisito describe el comportamiento actual (spec 010) para que los tests de validación tengan un criterio propio al que apuntar (Q4).

- **AC-004.1:** Given un usuario con perfil y mediciones, When pide un análisis sin cuerpo, Then recibe el 400 descrito, no se llama al modelo de IA y no se registra ningún análisis.
- **AC-004.2:** Given un usuario con perfil y mediciones, When pide un análisis con una fecha `today` a dos días o más de la fecha del servidor, Then recibe el 400 descrito.
- **AC-004.3:** Given un usuario con perfil y mediciones, When pide un análisis con una fecha `today` a un día de la fecha del servidor, Then el análisis se genera y se llama una vez al modelo de IA.
- **AC-004.4:** Given un usuario con perfil y mediciones, When pide un análisis con un texto de indicador que contiene un salto de línea, Then recibe el 400 descrito.
- **AC-004.5:** Given un usuario con perfil y mediciones, When pide un análisis con un `pace_status` que no está en la lista cerrada de estados, Then recibe el 400 descrito.
- **AC-004.6:** Given un usuario con perfil y mediciones, When pide un análisis con `target_kcal` igual a 2200.5 o igual al texto "2200", Then recibe el 400 descrito.
- **AC-004.7:** Given un usuario con sesión, perfil y una medición, When envía `POST /api/body-metrics/analysis` con un `pace_status` desconocido, Then la respuesta HTTP es 400 con `{"error": "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."}` y el número de análisis registrados no cambia.

### REQ-005 — El aviso de error de borrado desaparece cuando deja de aplicar
WHILE el Historial de Métricas muestra el aviso "No se pudo borrar la medición. Inténtalo de nuevo.", WHEN el usuario abre otro diálogo de borrado, empieza a corregir cualquier medición o la lista de mediciones cambia, THE SYSTEM SHALL dejar de mostrar el aviso (Q2).

- **AC-005.1:** Given el Historial con el aviso de error visible tras un borrado fallido, When el usuario pulsa "Corregir medición del …" en cualquier fila, Then el aviso deja de verse.
- **AC-005.2:** Given el Historial con el aviso de error visible, When la lista de mediciones que recibe el Historial cambia (por ejemplo, se guarda una corrección, se registra una medición nueva o la medición que no se pudo borrar ya no está), Then el aviso deja de verse.
- **AC-005.3:** Given el Historial con el aviso de error visible, When el usuario pulsa "Borrar medición del …" en cualquier fila, Then el aviso deja de verse y se abre el diálogo de borrado (comportamiento actual que se conserva).
- **AC-005.4:** Given el Historial con el aviso de error visible, When el usuario pulsa "Mostrar más" y la lista de mediciones no cambia, Then el aviso sigue visible.

## 5. Requisitos no funcionales

### NFR-001 — Sin cambios de comportamiento fuera de REQ-001 a REQ-005
THE SYSTEM SHALL comportarse igual que antes de esta feature en todo lo que no cubren REQ-001 a REQ-005.

- **AC-N001.1:** Given el backend con esta feature aplicada, When se ejecuta la suite completa de pytest, Then todos los tests pasan.
- **AC-N001.2:** Given el frontend con esta feature aplicada, When se ejecuta la suite completa de `npm test`, Then todos los tests pasan.
- **AC-N001.3:** Given los tests existentes que esta feature modifica, When se comparan con su versión anterior, Then ninguna aserción se ha quitado ni debilitado, salvo las de los tests de `isWithinLastMonths` que se eliminan junto con la función (Q3), y ningún test se ha marcado como `skip`, `only` o `todo`.
- **AC-N001.4:** Given el frontend, When se ejecutan `npm run lint`, `npx tsc -b` y `npm run build`, Then terminan sin errores nuevos; y Given el backend, When se ejecuta el ratchet de ruff, Then no aparecen violaciones nuevas.

### NFR-002 — Código sin duplicados ni casts innecesarios
THE SYSTEM SHALL tener el código de las features 006 a 010 libre de los duplicados, reexportaciones, casts y código sin uso señalados en sus revisiones.

- **AC-N002.1:** Given el código del frontend, When se busca la reexportación de `parseLocalDate` o `todayIsoDate` desde `features/body-metrics/dateUtils.ts`, Then no existe, y todos los archivos que usan esas funciones las importan de `@/lib/dates`.
- **AC-N002.2:** Given `macros/calculations.ts`, When se lee la declaración del suelo calórico por sexo, Then tiene una anotación de tipo explícita del mismo estilo que el resto de tablas del archivo.
- **AC-N002.3:** Given `macros/calculations.test.ts`, When se busca `as Record<string, string>`, Then no hay ninguna coincidencia.
- **AC-N002.4:** Given `macros/calculations.ts`, When se busca la conversión de pies y pulgadas a centímetros, Then el archivo usa la función de conversión de altura del onboarding y no contiene una conversión propia; y los tests existentes de Macros con altura en ft siguen pasando.
- **AC-N002.5:** Given el código del frontend, When se busca `isWithinLastMonths`, Then no hay ninguna coincidencia; y Given los tests del frontend, When se buscan los marcadores `SDD: REQ-005 AC-005.1` del gráfico de tendencia de la spec 009, Then siguen existiendo y al menos uno comprueba que una medición de exactamente un mes atrás entra en el rango "1M" y una del día anterior no (Q3).
- **AC-N002.6:** Given `TrendChart.tsx`, When se lee el comentario "La tendencia solo tiene sentido en el peso…", Then está justo antes del código que decide o dibuja la línea de tendencia, y no antes del cálculo del inicio del periodo.
- **AC-N002.7:** Given `insightsView.ts` y su test, When se buscan `as Insights` y `as unknown as`, Then no hay ninguna coincidencia y `formatInsights` solo acepta el tipo de indicadores real.
- **AC-N002.8:** Given `analysisRequest.ts`, When se lee el cálculo del ritmo enviado, Then la comprobación de que el ritmo está disponible aparece una sola vez.
- **AC-N002.9:** Given el código del backend, When se busca la definición del mensaje "Usuario no encontrado" usado por perfil y mediciones, Then está definida una sola vez; y When se busca la definición de la lista de estados de ritmo con ritmo (`on_track`, `too_slow`, `too_fast`, `off_range`), Then está definida una sola vez.
- **AC-N002.10:** Given `BodyMetricsPage.test.tsx`, When se lee el helper `renderLoaded`, Then espera a que aparezca en pantalla algo que depende del perfil cargado y no contiene un bucle ni una cuenta fija de microtareas vaciadas.

### NFR-003 — Ortografía de comentarios y docstrings
THE SYSTEM SHALL tener en español correcto, con tildes y sin regionalismos, los docstrings y comentarios citados en las revisiones 008 F4 y 010 F5 (Q7).

- **AC-N003.1:** Given `backend/tests/test_routes/test_body_metric_routes.py`, When se buscan en sus docstrings las palabras "unicas", "restriccion", "medicion", "mediciones" sin tilde donde la lleven, "invalido" o "valido", Then no hay ninguna coincidencia sin tilde.
- **AC-N003.2:** Given `backend/services/progress_analysis_service.py`, `frontend/src/features/body-metrics/components/ProgressAnalysis.tsx` y `frontend/src/features/body-metrics/api.ts`, When se buscan "prolijo", "tecnicos" y "se envia", Then no hay ninguna coincidencia.
- **AC-N003.3:** Given las líneas de comentario o docstring que esta feature añade o modifica por otro motivo (según el diff de la feature), When se revisan, Then están en español correcto, con tildes; los comentarios sin tilde de líneas que la feature no toca no cambian.

### NFR-004 — Trazabilidad de los tests de validación del análisis
THE SYSTEM SHALL tener los tests de validación del cuerpo del análisis marcados con los criterios que de verdad comprueban (Q4).

- **AC-N004.1:** Given los tests de validación del cuerpo del análisis (cuerpo ausente, fecha fuera de margen, fecha a un día, salto de línea, estado de ritmo desconocido, kcal no enteras y el 400 de la ruta), When se leen sus marcadores, Then llevan `SDD: 013` con el AC de REQ-004 que prueban y ninguno cita `REQ-002 AC-002.1`, `REQ-004 AC-004.1` ni `NFR-001 AC-N001.1` de la spec 010.

### NFR-005 — Salida de los tests del frontend sin ruido
THE SYSTEM SHALL ejecutar la suite del frontend sin imprimir en stderr el aviso de `VITE_GOOGLE_CLIENT_ID` sin configurar ni el aviso de Recharts por un gráfico de ancho o alto 0, sin cambiar lo que la app muestra al usuario (Q5, Q6).

- **AC-N005.1:** Given el frontend, When se ejecuta `npm test`, Then la salida no contiene el texto "VITE_GOOGLE_CLIENT_ID no esta configurado".
- **AC-N005.2:** Given el frontend, When se ejecuta `npm test`, Then la salida no contiene el aviso de Recharts sobre `width(0)` y `height(0)`.
- **AC-N005.3:** Given la app en el navegador sin `VITE_GOOGLE_CLIENT_ID`, When se abre una pantalla de acceso, Then el botón de Google no aparece y la consola sigue mostrando el aviso para el desarrollador, como hoy (Q5).

### NFR-006 — Fila de Métricas del CLAUDE.md legible
THE SYSTEM SHALL describir el área "Métricas corporales" de `CLAUDE.md` con una fila corta en la tabla de áreas funcionales y el detalle fuera de la tabla, sin perder información (Q8).

- **AC-N006.1:** Given `CLAUDE.md`, When se lee la fila "Métricas corporales" de la tabla de áreas funcionales, Then su descripción ocupa como máximo 300 caracteres.
- **AC-N006.2:** Given `CLAUDE.md`, When se busca el detalle que hoy está en esa fila (una medición por usuario y día con `POST`/`PUT`/`DELETE`, peso del perfil que sigue a la última medición y ADR-0020, indicadores de la spec 009 con la regla de 28 días, análisis con IA de la spec 010 con ADR-0021, 409 sin perfil y cuerpo obligatorio en `POST /api/body-metrics/analysis`), Then cada uno de esos datos sigue apareciendo en la sección **Proyecto**.
- **AC-N006.3:** Given `CLAUDE.md`, When se lee lo que hay justo después de la tabla de áreas funcionales, Then hay una lista titulada "Métricas corporales, en detalle" con un punto por tema (mediciones y peso del perfil; indicadores de la spec 009; análisis con IA de la spec 010), y el resto de secciones de `CLAUDE.md` distintas de **Proyecto** no cambian. Lo escribe el doc-keeper en la etapa docs.

## 6. Datos y contratos visibles

No hay campos, endpoints ni mensajes nuevos. Los contratos que cambian son estos:

| Endpoint | Entrada | Antes | Después |
|---|---|---|---|
| `PUT /api/profile` | `height_cm` entero enorme | 500 | 400 `{"error": "La altura debe estar entre 100 y 250 cm"}` |
| `PUT /api/profile` | `weight` entero enorme (kg) | 500 | 400 `{"error": "El peso debe estar entre 30 y 300 kg"}` |
| `PUT /api/profile` | `weight` entero enorme (lb) | 500 | 400 `{"error": "El peso debe estar entre 66 y 660 lb"}` |
| `POST`/`PUT /api/body-metrics` | `weight` entero enorme | 500 | 400 `{"error": "El peso debe estar entre 29,9 y 300 kg"}` |
| `POST`/`PUT /api/body-metrics` | `body_fat_percentage` entero enorme | 500 | 400 `{"error": "El porcentaje de grasa corporal debe estar entre 3 y 60"}` |
| `POST`/`PUT /api/body-metrics` | `muscle_mass_percentage` entero enorme | 500 | 400 `{"error": "El porcentaje de masa muscular debe estar entre 10 y 70"}` |
| `POST /api/body-metrics/analysis` | `rate_kg_per_week` o `latest_weight_kg` entero enorme | 500 | 400 `{"error": "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."}` |

En `PUT /api/body-metrics/{id}` se conserva el orden actual: una medición inexistente o de otro usuario responde 404 antes de validar el cuerpo.

En el Historial de Métricas, el aviso "No se pudo borrar la medición. Inténtalo de nuevo." conserva su texto; solo cambia cuándo desaparece (REQ-005).

## 7. Preguntas abiertas

Todas las preguntas están resueltas (iteración 2).

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | La idea cita el perfil y las mediciones, pero `POST /api/body-metrics/analysis` tiene el mismo defecto (500 con un entero enorme en `rate_kg_per_week` o `latest_weight_kg`). ¿Se arregla también aquí? **Propuesta:** sí, con el 400 y el mensaje actual del análisis (REQ-003). | **Resuelta:** se acepta la propuesta (usuario: "Todas las propuestas"). Incorporada en REQ-003 y en la tabla de la sección 6. |
| Q2 | ¿Cuándo debe desaparecer el aviso de error de borrado? **Propuesta:** al abrir otro diálogo de borrado (como hoy), al pulsar "Corregir" en cualquier fila y cuando cambia la lista de mediciones; no desaparece solo por tiempo ni al pulsar "Mostrar más" (REQ-005). | **Resuelta:** se acepta la propuesta (usuario: "Todas las propuestas"). Incorporada en REQ-005 (AC-005.1 a AC-005.4). |
| Q3 | Eliminar `isWithinLastMonths` obliga a borrar sus 3 tests, uno de ellos marcado como `REQ-005 AC-005.1` de la spec 009 (límite inferior de "1M"). La constitución (Art. 5.3) no permite borrar tests sin más. **Propuesta:** se borra la función con sus tests como cambio autorizado por esta spec, y el test marcado se sustituye por uno equivalente sobre el código de producción que filtra el periodo del gráfico, con el mismo marcador de la spec 009 (AC-N002.5). | **Resuelta:** se acepta la propuesta (usuario: "Todas las propuestas"). Incorporada en AC-N001.3 y AC-N002.5. |
| Q4 | La spec 010 no tiene un criterio propio para la validación del cuerpo del análisis, y por eso sus tests citaban AC que no prueban. **Propuesta:** esta spec añade REQ-004 (comportamiento que se conserva) y esos 7 tests pasan a marcarse `SDD: 013 REQ-004 AC-004.x` (NFR-004). Alternativa: marcarlos solo con el REQ más cercano de la spec 010, sin AC. | **Resuelta:** se acepta la propuesta principal, REQ-004 con marcadores `SDD: 013 REQ-004 AC-004.x` (usuario: "Todas las propuestas"). Incorporada en REQ-004 y NFR-004. |
| Q5 | Aviso de `VITE_GOOGLE_CLIENT_ID`: ¿se quita solo de la salida de los tests o también de la app? **Propuesta:** solo de los tests; la app sigue avisando en la consola del navegador al desarrollador cuando falta la variable (AC-N005.3). | **Resuelta:** se acepta la propuesta (usuario: "Todas las propuestas"). Incorporada en AC-N005.1 y AC-N005.3. |
| Q6 | Aviso de Recharts por tamaño 0: ¿solo de los tests? ¿Y otros avisos que aparezcan en la salida? **Propuesta:** solo se quita de los tests, sin cambiar los gráficos de la app; otros avisos distintos de estos dos quedan fuera de alcance. | **Resuelta:** se acepta la propuesta (usuario: "Todas las propuestas"). Incorporada en AC-N005.2 y en "Fuera de alcance". |
| Q7 | Alcance de la ortografía: ¿solo lo citado (docstrings de `test_body_metric_routes.py` y los tres comentarios de 010 F5) o todos los comentarios sin tilde de los archivos que se toquen? **Propuesta:** lo citado, más los comentarios de las líneas que esta spec ya modifique por otro motivo; el resto queda fuera. | **Resuelta:** se acepta la propuesta (usuario: "Todas las propuestas"). Incorporada en NFR-003, AC-N003.3 y "Fuera de alcance". |
| Q8 | ¿Cómo se divide la fila de Métricas del `CLAUDE.md`? **Propuesta:** la fila queda con una descripción corta (como máximo 300 caracteres) y, justo después de la tabla, una lista "Métricas corporales, en detalle" con un punto por tema (mediciones y peso del perfil; indicadores, spec 009; análisis con IA, spec 010) que conserva todos los datos actuales. Lo escribe el doc-keeper en la etapa docs. | **Resuelta:** se acepta la propuesta (usuario: "Todas las propuestas"). Incorporada en NFR-006 (AC-N006.1 a AC-N006.3). |
| Q9 | El mensaje visible del 503 del análisis dice "No se pudo generar el analisis en este momento…" sin tilde. ¿Se corrige aquí? **Propuesta:** no; queda fuera porque cambia un mensaje que la spec 010 fija literalmente (AC-010.3) y puede hacerse como cambio de copy aparte. | **Resuelta:** se acepta la propuesta (usuario: "Todas las propuestas"). Incorporada en "Fuera de alcance". |
| Q10 | ¿Se confirma que 008 F2, 008 F6, 010 F1 y 010 F7 quedan fuera? **Propuesta:** sí, fuera de alcance; la idea no los incluye. | **Resuelta:** se acepta la propuesta (usuario: "Todas las propuestas"). Incorporada en "Fuera de alcance". |

## 8. Glosario

- **Entero enorme:** número entero en el JSON tan grande en valor absoluto (por ejemplo, de 400 dígitos) que no cabe en un número de coma flotante. Los AC usan 10^400 (un 1 seguido de 400 ceros) y, para el caso extremo, un entero de 5000 dígitos.
- **Aviso de error de borrado:** el texto "No se pudo borrar la medición. Inténtalo de nuevo." que el Historial de Métricas muestra cuando falla el borrado de una medición.
- **Lista de estados de ritmo con ritmo:** los estados del ritmo semanal que llevan un ritmo numérico: "En ritmo", "Más lento", "Más rápido" y "Fuera del rango" de la meta.
