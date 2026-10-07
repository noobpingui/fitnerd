# Spec 004 — Observabilidad del coach de IA con Langfuse Cloud

- **Feature:** `004-coach-observability` · **Tipo:** feature
- **Ámbito:** backend

## 1. Contexto y problema

El coach de IA de fitnerd responde cada pregunta en tres fases: calcula el embedding de la pregunta (Voyage), recupera los fragmentos de transcripción más parecidos y descarta los que superan el umbral de distancia de relevancia, y, si queda alguno, genera la respuesta con Claude. Si ningún fragmento pasa el umbral, responde con el mensaje fijo "No tengo informacion relacionada con ese tema en especifico." sin llamar a Claude.

Hoy no hay forma de ver qué pasó en una pregunta concreta: qué fragmentos salieron y a qué distancia, si el umbral (0,7) está bien calibrado, cuánto tardó cada fase, cuántos tokens consumió ni cuánto costó. El único rastro es un `logger.exception` cuando falla un proveedor. Eso impide calibrar el umbral con datos reales, detectar preguntas sin respuesta frecuentes y controlar el gasto.

Esta feature envía, por cada pregunta al coach, una traza a Langfuse Cloud (servicio externo de observabilidad de LLM elegido por el usuario) con un paso por fase y puntuaciones automáticas. La observabilidad es accesoria: si Langfuse no está configurado o falla, el coach se comporta exactamente igual que hoy.

Todos los nombres que aparecen en Langfuse (traza, pasos, puntuaciones, sus valores y los campos de metadatos) van en inglés (Q8).

## 2. Historia de usuario

Como **desarrollador y operador de fitnerd**, quiero **ver en Langfuse una traza de cada pregunta al coach con sus fases, fragmentos recuperados, tokens, coste, latencia y resultado** para **calibrar el umbral de relevancia, detectar huecos del corpus y controlar el gasto, sin afectar a los usuarios ni exponer sus datos personales**.

## 3. Alcance

**Incluye:**
- Una traza en Langfuse por cada pregunta al coach que llega a procesarse (supera la validación y el límite de uso; ver REQ-001 y Q5).
- Tres pasos dentro de la traza: embedding, recuperación y generación (esta última solo cuando se llama a Claude).
- Dos puntuaciones automáticas por traza: el resultado de la pregunta (`outcome`) y la distancia del mejor fragmento (`best_chunk_distance`).
- La identificación del usuario en la traza solo por su ID interno.
- El registro de los fallos de proveedor dentro de la traza.
- La activación por configuración: sin credenciales de Langfuse no se envía nada.
- La tolerancia a fallos y lentitud de Langfuse sin cambiar la respuesta del coach ni su tiempo de respuesta de forma apreciable.

**Fuera de alcance:**
- Feedback del usuario en la UI (pulgar arriba/abajo u otros) y cualquier cambio en el frontend.
- La actualización de los textos legales (privacidad) para mencionar el envío de preguntas a Langfuse: se hará en una feature posterior que toque el frontend (Q1).
- El análisis de progreso con IA de métricas corporales (también usa Claude, pero no se traza en esta feature).
- Datasets, evaluaciones (LLM-as-judge u otras) y experimentos en Langfuse.
- La gestión o el versionado de prompts en Langfuse.
- Agrupar las trazas por conversación (hoy el historial vive solo en el frontend y no hay identificador de conversación).
- Detectar cuándo el propio modelo dice que no sabe la respuesta aunque haya recibido fragmentos (Q3).
- Borrar de Langfuse las trazas de un usuario concreto.
- Reintentos persistentes o garantía de entrega de las trazas (Q10).
- Trazar el pipeline RAG de ingesta (`backend/scripts/`).
- Cualquier cambio en las respuestas, mensajes, códigos HTTP, validaciones o límites actuales del endpoint del coach.

## 4. Requisitos funcionales

> En todos los AC, "el destino de observabilidad" es un sustituto de prueba de Langfuse que registra lo que recibe; ningún test llama a Langfuse real. "Proveedores simulados" son sustitutos de Voyage, de la búsqueda de fragmentos y de Claude.

### REQ-001 — Una traza por pregunta procesada
WHEN un usuario autenticado envía una pregunta al coach que supera la validación y el límite de uso, y la observabilidad está activa (REQ-009), THE SYSTEM SHALL enviar al destino de observabilidad exactamente una traza con el nombre `coach-ask`, cuya entrada es el texto de la pregunta, cuya salida es el texto exacto que recibe el usuario y que identifica al usuario por su ID interno.

- **AC-001.1:** Given la observabilidad activa, el usuario con ID interno `42` y proveedores simulados que devuelven fragmentos bajo el umbral y la respuesta "Haz 3 series de 10.", When el usuario pregunta "¿Cuántas series hago?", Then el destino recibe exactamente una traza llamada `coach-ask` con entrada "¿Cuántas series hago?", salida "Haz 3 series de 10." e identificador de usuario `42`.
- **AC-001.2:** Given la observabilidad activa y dos preguntas consecutivas del mismo usuario, When se procesan, Then el destino recibe dos trazas distintas, una por pregunta.
- **AC-001.3:** Given la observabilidad activa, When se envía una pregunta vacía o de más de 500 caracteres (respuesta `400`), Then el destino no recibe ninguna traza (Q5).
- **AC-001.4:** Given la observabilidad activa y un usuario que ya alcanzó el límite de 20 preguntas por hora, When envía otra pregunta (respuesta `429`), Then el destino no recibe ninguna traza (Q5).

### REQ-002 — Paso de embedding
WHEN se procesa una pregunta con la observabilidad activa THE SYSTEM SHALL incluir en la traza un paso `embedding` con el texto que se envió a Voyage para la búsqueda (la pregunta, o la pregunta anterior del usuario seguida de la actual cuando hay historial), el modelo de embedding configurado, su duración y, cuando el proveedor lo informe, el número de tokens consumidos.

- **AC-002.1:** Given una pregunta "¿Y el descanso?" sin historial, When se procesa, Then la traza contiene un paso `embedding` con entrada "¿Y el descanso?", el nombre del modelo de embedding configurado y una hora de inicio y fin.
- **AC-002.2:** Given un historial cuya última pregunta del usuario es "¿Cuántas series hago?" y la pregunta actual "¿Y el descanso?", When se procesa, Then la entrada del paso `embedding` es "¿Cuántas series hago? ¿Y el descanso?".
- **AC-002.3:** Given un proveedor de embedding simulado que informa 12 tokens consumidos, When se procesa la pregunta, Then el paso `embedding` registra 12 tokens.

### REQ-003 — Paso de recuperación
WHEN se procesa una pregunta con la observabilidad activa y el embedding se obtuvo THE SYSTEM SHALL incluir en la traza un paso `retrieval` con el número máximo de fragmentos pedidos (`limit`), el umbral de distancia aplicado (`threshold`), la lista de todos los fragmentos candidatos devueltos por la búsqueda (`candidates`, pasen o no el umbral), cada uno con `video_title`, `chunk_text` (texto completo; Q2), `distance` y `passed_threshold` (verdadero o falso), y el número de fragmentos que pasaron el umbral (`passed_count`).

- **AC-003.1:** Given una búsqueda simulada que devuelve 3 candidatos con distancias 0,35, 0,62 y 0,81 y el umbral 0,7, When se procesa la pregunta, Then el paso `retrieval` registra `limit` 5, `threshold` 0,7, los 3 candidatos con su `video_title`, `chunk_text` completo y `distance`, con `passed_threshold` verdadero en los dos primeros y falso en el tercero, y `passed_count` 2.
- **AC-003.2:** Given una búsqueda simulada que devuelve 2 candidatos con distancias 0,75 y 0,9, When se procesa la pregunta, Then el paso `retrieval` registra ambos candidatos con `passed_threshold` falso y `passed_count` 0.
- **AC-003.3:** Given una búsqueda simulada que no devuelve candidatos (corpus vacío), When se procesa la pregunta, Then el paso `retrieval` registra una lista `candidates` vacía y `passed_count` 0.

### REQ-004 — Paso de generación
WHEN se llama a Claude para generar la respuesta con la observabilidad activa THE SYSTEM SHALL incluir en la traza un paso `generation` con el modelo usado, los mensajes enviados al modelo (historial más el mensaje con los fragmentos y la pregunta, sin el system prompt; Q1), el texto generado, los tokens de entrada y de salida que informa el proveedor y su duración, de forma que Langfuse calcule el coste en USD a partir del modelo y los tokens (Q4).

- **AC-004.1:** Given el modelo configurado `claude-sonnet-5` y un proveedor de generación simulado que devuelve "Haz 3 series de 10." con 850 tokens de entrada y 40 de salida, When se procesa una pregunta con fragmentos que pasan el umbral, Then la traza contiene un paso `generation` con modelo `claude-sonnet-5`, 850 tokens de entrada, 40 de salida, salida "Haz 3 series de 10." y una hora de inicio y fin.
- **AC-004.2:** Given un historial de 2 mensajes y una pregunta con fragmentos que pasan el umbral, When se procesa, Then la entrada del paso `generation` contiene los 2 mensajes del historial seguidos del mensaje con los fragmentos y la pregunta, en ese orden, y no contiene el system prompt.
- **AC-004.3:** Given una búsqueda en la que ningún fragmento pasa el umbral, When se procesa la pregunta, Then la traza no contiene ningún paso `generation`.
- **AC-004.4:** Given un proveedor de generación simulado que rechaza la petición por seguridad, When se procesa la pregunta, Then el paso `generation` existe, registra los tokens informados y su salida está vacía.

### REQ-005 — Puntuación del resultado
WHEN termina el procesamiento de una pregunta con la observabilidad activa THE SYSTEM SHALL añadir a la traza una puntuación categórica `outcome` con uno de estos valores (Q3, Q8):
- `answered`: Claude generó la respuesta que recibió el usuario;
- `dont_know`: ningún fragmento pasó el umbral y el usuario recibió el mensaje fijo de "sin información";
- `refused`: Claude rechazó generar la respuesta y el usuario recibió el mensaje "No pude generar una respuesta para esa pregunta.";
- `error`: falló un proveedor y el usuario recibió el error `503`.

- **AC-005.1:** Given fragmentos que pasan el umbral y una generación simulada correcta, When se procesa la pregunta, Then la traza tiene la puntuación `outcome` = `answered`.
- **AC-005.2:** Given una búsqueda sin fragmentos bajo el umbral, When se procesa la pregunta, Then la traza tiene la puntuación `outcome` = `dont_know`.
- **AC-005.3:** Given una generación simulada que rechaza la petición, When se procesa la pregunta, Then la traza tiene la puntuación `outcome` = `refused`.
- **AC-005.4:** Given un proveedor de embedding simulado que falla, When se procesa la pregunta, Then la traza tiene la puntuación `outcome` = `error`.

### REQ-006 — Puntuación de la distancia del mejor fragmento
WHEN la búsqueda de fragmentos devuelve al menos un candidato con la observabilidad activa THE SYSTEM SHALL añadir a la traza una puntuación numérica `best_chunk_distance` con la menor distancia entre todos los candidatos, haya pasado o no el umbral. IF la búsqueda no devuelve candidatos o no llega a ejecutarse THEN THE SYSTEM SHALL no añadir esa puntuación.

- **AC-006.1:** Given candidatos con distancias 0,62, 0,35 y 0,81, When se procesa la pregunta, Then la traza tiene la puntuación `best_chunk_distance` = 0,35.
- **AC-006.2:** Given candidatos con distancias 0,75 y 0,9 (ninguno pasa el umbral), When se procesa la pregunta, Then la traza tiene la puntuación `best_chunk_distance` = 0,75.
- **AC-006.3:** Given una búsqueda sin candidatos, When se procesa la pregunta, Then la traza no tiene la puntuación `best_chunk_distance`.
- **AC-006.4:** Given un proveedor de embedding simulado que falla, When se procesa la pregunta, Then la traza no tiene la puntuación `best_chunk_distance`.

### REQ-007 — Registro de fallos de proveedor
IF falla un proveedor externo (Voyage, la búsqueda de fragmentos o Claude) mientras se procesa una pregunta con la observabilidad activa THEN THE SYSTEM SHALL enviar igualmente la traza, marcar como error el paso que falló con el tipo de error y su mensaje recortado a 200 caracteres, sin traza de pila (Q6), no incluir los pasos posteriores y responder al usuario exactamente como hoy (`503` con el mismo mensaje).

- **AC-007.1:** Given un proveedor de generación simulado que lanza un error con el mensaje "overloaded", When se procesa una pregunta con fragmentos que pasan el umbral, Then la traza contiene los pasos `embedding` y `retrieval` correctos y un paso `generation` marcado como error cuyo mensaje contiene el tipo de error y "overloaded", y la respuesta al usuario es `503` con `{"error": "No se pudo generar una respuesta en este momento. Intenta de nuevo en unos minutos."}`.
- **AC-007.2:** Given un proveedor de embedding simulado que lanza un error, When se procesa la pregunta, Then la traza contiene solo el paso `embedding`, marcado como error, y ningún paso `retrieval` ni `generation`.
- **AC-007.3:** Given un proveedor que lanza un error con un mensaje de 500 caracteres, When se procesa la pregunta, Then el mensaje de error registrado en el paso tiene como máximo 200 caracteres y no contiene una traza de pila.

### REQ-008 — El coach responde igual con o sin observabilidad
THE SYSTEM SHALL devolver al usuario la misma respuesta (código HTTP y cuerpo) con la observabilidad activa, inactiva o fallando que la que devuelve hoy para la misma pregunta, historial y comportamiento de los proveedores.

- **AC-008.1:** Given la observabilidad inactiva y proveedores simulados que devuelven "Haz 3 series de 10.", When un usuario pregunta, Then la respuesta es `200` con `{"answer": "Haz 3 series de 10."}` y no se intenta enviar nada al destino.
- **AC-008.2:** Given un destino de observabilidad que lanza un error en cada envío y proveedores simulados que devuelven "Haz 3 series de 10.", When un usuario pregunta, Then la respuesta es `200` con `{"answer": "Haz 3 series de 10."}`.
- **AC-008.3:** Given un destino de observabilidad que lanza un error en cada envío y una búsqueda sin fragmentos bajo el umbral, When un usuario pregunta, Then la respuesta es `200` con `{"answer": "No tengo informacion relacionada con ese tema en especifico."}`.
- **AC-008.4:** Given un destino de observabilidad que lanza un error en cada envío y un proveedor de generación simulado que falla, When un usuario pregunta, Then la respuesta es `503` con el mismo cuerpo que AC-007.1 (el fallo del destino no la convierte en otro error).
- **AC-008.5:** Given un destino de observabilidad que lanza un error en cada envío, When un usuario pregunta, Then el fallo queda registrado en el log del backend como aviso, sin incluir las credenciales de Langfuse.

### REQ-009 — Activación por configuración
THE SYSTEM SHALL activar la observabilidad solo cuando están configuradas la clave pública y la clave secreta de Langfuse, sin ningún interruptor adicional, y SHALL mantenerla siempre inactiva en el entorno de tests (Q9). WHEN no se configura la URL del servidor de Langfuse THE SYSTEM SHALL usar la de Langfuse Cloud en la región de EE. UU. (`https://us.cloud.langfuse.com`).

- **AC-009.1:** Given que falta la clave pública o la clave secreta de Langfuse (o las dos), When un usuario pregunta al coach, Then no se envía ninguna traza, la respuesta es la de hoy y no se registra ningún error por la falta de configuración en cada pregunta.
- **AC-009.2:** Given ambas claves configuradas, When un usuario pregunta al coach, Then se envía la traza descrita en REQ-001.
- **AC-009.3:** Given la configuración de tests, When se ejecuta la suite, Then la observabilidad está inactiva aunque el entorno tenga claves de Langfuse definidas.
- **AC-009.4:** Given ambas claves configuradas y sin URL de servidor configurada, When se carga la configuración del backend, Then la URL del servidor de Langfuse es `https://us.cloud.langfuse.com`.
- **AC-009.5:** Given ambas claves configuradas y la URL de servidor `https://cloud.langfuse.com`, When se carga la configuración del backend, Then la URL del servidor de Langfuse es `https://cloud.langfuse.com`.

### REQ-010 — Etiqueta de entorno
WHEN se envía una traza THE SYSTEM SHALL etiquetarla con el entorno en el que corre el backend: `production` o `development` (Q7).

- **AC-010.1:** Given el backend con la configuración de producción y la observabilidad activa, When se procesa una pregunta, Then la traza lleva el entorno `production`.
- **AC-010.2:** Given el backend con la configuración de desarrollo y la observabilidad activa, When se procesa una pregunta, Then la traza lleva el entorno `development`.

## 5. Requisitos no funcionales

### NFR-001 — Privacidad del usuario
THE SYSTEM SHALL identificar al usuario en las trazas solo por su ID interno y SHALL no incluir en ninguna traza su email, su nombre, su token de sesión ni ninguna credencial (de Langfuse, Voyage o Anthropic), salvo lo que el propio usuario escriba en el texto de su pregunta o de su historial.

- **AC-N001.1:** Given un usuario con ID interno `42`, email `ana@example.com` y nombre "Ana Pérez", When pregunta "¿Cuántas series hago?", Then ningún campo de la traza enviada (entradas, salidas, metadatos, pasos ni puntuaciones) contiene `ana@example.com`, "Ana Pérez" ni el token JWT de la petición, y el identificador de usuario es `42`.
- **AC-N001.2:** Given claves de Voyage, Anthropic y Langfuse configuradas con valores conocidos, When se procesa una pregunta (correcta o con fallo de proveedor), Then ningún campo de la traza contiene esos valores.

### NFR-002 — Sin latencia añadida apreciable
THE SYSTEM SHALL enviar las trazas en segundo plano, sin que la respuesta al usuario espere a que Langfuse las reciba; un destino lento o caído no debe alargar la respuesta de forma apreciable. La entrega es de mejor esfuerzo: se acepta perder trazas pendientes si el backend se reinicia o Langfuse está caído (Q10).

- **AC-N002.1:** Given proveedores simulados instantáneos y un destino de observabilidad que tarda 3 segundos en aceptar cada envío, When un usuario pregunta, Then la respuesta llega en menos de 0,5 segundos.
- **AC-N002.2:** Given proveedores simulados instantáneos y un destino que lanza un error inmediatamente, When un usuario pregunta, Then la respuesta llega en menos de 0,5 segundos.

### NFR-003 — Tests sin servicios externos
THE SYSTEM SHALL permitir probar todo el comportamiento de observabilidad sin llamar a Langfuse real, con un destino de observabilidad sustituible en los tests.

- **AC-N003.1:** Given la suite de tests del backend, When se ejecuta sin acceso a red, Then todos los tests de esta feature pasan.

## 6. Datos y contratos visibles

El consumidor de esta feature es el operador de fitnerd que consulta el panel de Langfuse Cloud. El contrato del endpoint `POST /api/coach/ask` **no cambia** (mismos campos, mensajes y códigos `200`, `400`, `401`, `429` y `503`).

**Traza `coach-ask`** (una por pregunta procesada):

| Campo | Contenido |
|---|---|
| Nombre | `coach-ask` |
| Usuario | ID interno del usuario (el `id` del token), como texto |
| Entorno | `production` o `development` |
| Entrada | Texto de la pregunta |
| Salida | Texto exacto que recibe el usuario; vacío si la respuesta fue `503` |

**Pasos** (en este orden; un paso solo aparece si su fase llegó a ejecutarse):

| Paso | Contenido |
|---|---|
| `embedding` | Entrada: texto enviado a Voyage. Modelo de embedding. Duración. Tokens si el proveedor los informa. Error si falló. |
| `retrieval` | `limit` (5), `threshold` (0,7), `candidates` (lista con `video_title`, `chunk_text`, `distance` y `passed_threshold`) y `passed_count`. Error si falló. |
| `generation` | Modelo de Claude, mensajes enviados (sin el system prompt; Q1), texto generado, tokens de entrada y de salida, duración. Coste en USD calculado por Langfuse a partir del modelo y los tokens (Q4). Error si falló. |

**Error de un paso:** tipo de error y mensaje recortado a 200 caracteres, sin traza de pila.

**Puntuaciones:**

| Nombre | Tipo | Valores |
|---|---|---|
| `outcome` | categórica | `answered`, `dont_know`, `refused`, `error` |
| `best_chunk_distance` | numérica | Distancia coseno del candidato más cercano (0 = idéntico, 2 = opuesto); ausente si no hubo candidatos |

**Configuración (variables de entorno del backend):** clave pública y clave secreta de Langfuse (obligatorias para activar la observabilidad) y la URL del servidor de Langfuse, opcional, con `https://us.cloud.langfuse.com` (Langfuse Cloud, región EE. UU.) por defecto (Q9). Se documentan en `backend/.env.example`; sus nombres exactos los fija el plan.

**Paso de despliegue (Q4):** si el modelo de Claude configurado no aparece en la tabla de precios de Langfuse, se añade su precio una vez a mano en el proyecto de Langfuse; mientras falte, las trazas se envían igual, sin coste calculado.

**Mensajes de log:** cuando falla el envío a Langfuse, un aviso en el log del backend que indica que la traza del coach no se pudo enviar, sin credenciales.

## 7. Preguntas abiertas

Todas resueltas.

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | ¿Qué texto del usuario guarda la traza? **Propuesta:** la pregunta (entrada), la respuesta final (salida) y, en `generation`, los mensajes enviados a Claude (historial incluido), sin el system prompt. | **Resuelta.** Aprobada. La actualización del texto legal queda para una feature posterior que toque el frontend (fuera de alcance). Incorporada en REQ-001, REQ-004 y sección 3. |
| Q2 | ¿Se guarda el texto completo de cada fragmento candidato en `retrieval`? **Propuesta:** sí, completo. | **Resuelta.** Aprobada. Incorporada en REQ-003. |
| Q3 | ¿Cómo se clasifica el resultado? **Propuesta:** puntuación categórica con cuatro valores; la detección del "no lo sé" del propio modelo queda fuera de alcance. | **Resuelta.** Aprobada. Incorporada en REQ-005 (valores en inglés por Q8). |
| Q4 | ¿Quién calcula el coste? **Propuesta:** Langfuse, con su tabla de precios; si falta el modelo, se añade a mano una vez y la traza se envía igual. | **Resuelta.** Aprobada. Incorporada en REQ-004 y sección 6. |
| Q5 | ¿Se trazan las preguntas rechazadas por `400` o `429`? **Propuesta:** no. | **Resuelta.** Aprobada. Incorporada en AC-001.3 y AC-001.4. |
| Q6 | ¿Qué se registra de un error de proveedor? **Propuesta:** tipo y mensaje recortado a 200 caracteres, sin traza de pila. | **Resuelta.** Aprobada. Incorporada en REQ-007. |
| Q7 | ¿Se distinguen producción y desarrollo? **Propuesta:** etiqueta de entorno en el mismo proyecto; los tests nunca envían. | **Resuelta.** Aprobada. Incorporada en REQ-009 y REQ-010. |
| Q8 | ¿Valen los nombres de traza, pasos y puntuaciones? | **Resuelta.** Todo en inglés: puntuaciones `outcome` (`answered`, `dont_know`, `refused`, `error`) y `best_chunk_distance`; campos de `retrieval` en inglés. Incorporada en REQ-003, REQ-005, REQ-006 y sección 6. |
| Q9 | ¿Cómo se activa y en qué región? **Propuesta:** solo con las dos claves, URL configurable, en tests siempre inactiva. | **Resuelta.** Región de EE. UU. por defecto (`https://us.cloud.langfuse.com`). Incorporada en REQ-009 (AC-009.4 y AC-009.5) y sección 6. |
| Q10 | ¿Qué latencia y garantía de entrega se exigen? **Propuesta:** envío en segundo plano, entrega de mejor esfuerzo. | **Resuelta.** Aprobada. Incorporada en NFR-002 y sección 3. |

## 8. Glosario

- **Traza:** registro en Langfuse de una pregunta al coach, de principio a fin.
- **Paso:** fase de una traza (embedding, recuperación o generación) con su entrada, salida, duración y, si aplica, error.
- **Puntuación (score):** valor que se adjunta a una traza para filtrarla o agregarla en Langfuse.
- **Candidato:** fragmento de transcripción devuelto por la búsqueda por similitud, antes de aplicar el umbral.
- **Umbral de distancia:** distancia coseno máxima (hoy 0,7) para que un candidato se considere relevante y se envíe a Claude.
- **Destino de observabilidad:** el servicio que recibe las trazas (Langfuse Cloud en producción, un sustituto en los tests).
