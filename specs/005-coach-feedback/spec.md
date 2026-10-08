# Spec 005 — Valoración 👍/👎 de las respuestas del coach como puntuación en Langfuse

- **Feature:** `005-coach-feedback` · **Tipo:** feature
- **Ámbito:** ambos

## 1. Contexto y problema

Desde la feature 004, cada pregunta al coach de IA que se procesa genera una traza `coach-ask` en Langfuse Cloud con sus pasos (embedding, recuperación y generación) y dos puntuaciones automáticas: `outcome` y `best_chunk_distance`. Esas puntuaciones dicen **qué pasó** técnicamente, pero no **si la respuesta le sirvió al usuario**. Hoy no hay forma de saber qué respuestas se perciben como buenas o malas, que es la señal que falta para calibrar el umbral de relevancia, el prompt o el corpus con datos reales.

Además, la spec 004 (Q1) dejó pendiente actualizar la política de privacidad para informar de que las preguntas al coach se envían a Langfuse. Esta feature toca el frontend, así que incluye ese texto.

Esta feature añade dos botones (👍 y 👎) bajo cada respuesta del coach. El voto se adjunta como puntuación a la traza de esa respuesta en Langfuse. Igual que en 004, la observabilidad es accesoria: si Langfuse no está configurado o falla, el coach sigue funcionando y los botones simplemente no aparecen o el fallo no molesta al usuario.

Los nombres que aparecen en Langfuse van en inglés, como en la spec 004 (Q8 de 004).

## 2. Historia de usuario

Como **usuario del coach de IA**, quiero **marcar con 👍 o 👎 cada respuesta del coach** para **indicar si me resultó útil**, y como **operador de fitnerd**, quiero **ver ese voto como puntuación en la traza de Langfuse** para **detectar respuestas malas y mejorar el coach con datos reales**.

## 3. Alcance

**Incluye:**
- Un identificador opaco de valoración (`feedback_id`) en la respuesta correcta (`200`) de `POST /api/coach/ask` cuando la pregunta tiene traza en Langfuse.
- Un endpoint nuevo `POST /api/coach/feedback` para enviar el voto de una respuesta.
- La puntuación `user_feedback` en la traza de Langfuse de esa respuesta, con el último voto del usuario.
- Los botones 👍/👎 bajo cada respuesta del coach en la página del coach, con estado seleccionado, cambio de voto y mensaje de error.
- La actualización de la política de privacidad: Langfuse (y Voyage AI) como proveedores, qué datos reciben y cómo se borran; la fecha de actualización; y la corrección del voseo de esa página (Q8).

**Fuera de alcance:**
- Comentarios de texto libre junto al voto (Q4).
- Retirar un voto ya enviado (sí se puede cambiar; Q3).
- Votar respuestas de conversaciones anteriores: el historial vive solo en memoria del navegador y se pierde al recargar.
- Guardar los votos en la base de datos de fitnerd o mostrarlos en otra pantalla.
- Votar mensajes de error (`429`, `503`) o los mensajes del propio usuario.
- La corrección del voseo de la página de términos y del resto de la app (incluido el mensaje `429` del coach, que va en un commit de copy aparte según el `state.json`).
- Datasets, evaluaciones y experimentos en Langfuse; trazar el análisis de progreso.
- Borrado automático de las trazas de Langfuse al eliminar una cuenta (se hace a mano; Q7).
- Cualquier cambio en las preguntas, respuestas, validaciones, límites o mensajes actuales de `POST /api/coach/ask`, salvo el campo nuevo `feedback_id`.

## 4. Requisitos funcionales

> En todos los AC del backend, "el destino de observabilidad" es un sustituto de prueba de Langfuse que registra lo que recibe; ningún test llama a Langfuse real. "Proveedores simulados" son sustitutos de Voyage, de la búsqueda de fragmentos y de Claude. En los AC del frontend, la red se simula en la capa de API del coach.

### REQ-001 — Identificador de valoración en la respuesta del coach
WHEN `POST /api/coach/ask` responde `200` y la pregunta tiene una traza abierta en el destino de observabilidad THE SYSTEM SHALL incluir en el cuerpo, junto a `answer`, un campo `feedback_id` con un texto opaco que identifica esa respuesta. IF la observabilidad está inactiva o no se pudo abrir la traza THEN THE SYSTEM SHALL devolver `feedback_id` con valor `null`. Esto aplica a las tres respuestas `200` posibles: respuesta generada, "sin información" y rechazo del modelo (Q2).

- **AC-001.1:** Given la observabilidad activa y proveedores simulados que devuelven "Haz 3 series de 10.", When un usuario pregunta, Then la respuesta es `200` con `answer` "Haz 3 series de 10." y un `feedback_id` de texto no vacío.
- **AC-001.2:** Given la observabilidad activa y una búsqueda sin fragmentos bajo el umbral, When un usuario pregunta, Then la respuesta es `200` con `answer` "No tengo informacion relacionada con ese tema en especifico." y un `feedback_id` de texto no vacío.
- **AC-001.3:** Given la observabilidad activa y una generación simulada que rechaza la petición, When un usuario pregunta, Then la respuesta es `200` con `answer` "No pude generar una respuesta para esa pregunta." y un `feedback_id` de texto no vacío.
- **AC-001.4:** Given la observabilidad inactiva, When un usuario pregunta, Then la respuesta es `200` con el `answer` de hoy y `feedback_id` `null`.
- **AC-001.5:** Given la observabilidad activa y un destino que falla al abrir la traza, When un usuario pregunta, Then la respuesta es `200` con el `answer` de hoy y `feedback_id` `null`.
- **AC-001.6:** Given la observabilidad activa, When el mismo usuario hace dos preguntas, Then cada respuesta lleva un `feedback_id` distinto.
- **AC-001.7:** Given la observabilidad activa y un proveedor que falla, When un usuario pregunta, Then la respuesta es `503` con el mismo cuerpo de hoy (`{"error": …}`), sin `feedback_id`.

### REQ-002 — Enviar un voto
WHEN un usuario autenticado envía a `POST /api/coach/feedback` un `feedback_id` válido que se le entregó a él y un `rating` `up` o `down` THE SYSTEM SHALL responder `204` sin cuerpo y añadir a la traza correspondiente una puntuación booleana `user_feedback` con valor `1` para `up` y `0` para `down` (Q1).

- **AC-002.1:** Given la observabilidad activa y un `feedback_id` recibido por el usuario en una respuesta del coach, When envía `rating` `up` con ese `feedback_id`, Then la respuesta es `204` y el destino recibe una puntuación `user_feedback` booleana con valor `1` sobre la traza de esa respuesta.
- **AC-002.2:** Given lo mismo que AC-002.1, When envía `rating` `down`, Then la respuesta es `204` y el destino recibe `user_feedback` con valor `0` sobre esa traza.
- **AC-002.3:** Given dos respuestas del coach con `feedback_id` distintos, When el usuario vota `up` la primera y `down` la segunda, Then cada puntuación se asocia a la traza de su propia respuesta.

### REQ-003 — Cambiar el voto
WHEN un usuario vuelve a votar una respuesta que ya había votado THE SYSTEM SHALL sustituir la puntuación anterior, de forma que la traza conserve una sola puntuación `user_feedback` con el último valor (Q3).

- **AC-003.1:** Given un usuario que votó `up` una respuesta, When vota `down` la misma respuesta, Then la respuesta es `204` y los dos envíos al destino usan la misma identidad de puntuación para esa traza, con valor final `0`.
- **AC-003.2:** Given un usuario que votó `up` una respuesta, When vuelve a votar `up`, Then la respuesta es `204` y la traza sigue teniendo una sola puntuación `user_feedback` con valor `1`.

### REQ-004 — Validación de la petición de voto
IF el cuerpo de `POST /api/coach/feedback` no trae `feedback_id` como texto no vacío, o `rating` no es exactamente `up` o `down`, THEN THE SYSTEM SHALL responder `400` con `{"error": "…"}` y no enviar nada al destino.

- **AC-004.1:** Given un usuario autenticado, When envía un cuerpo sin `feedback_id`, Then la respuesta es `400` con `{"error": "Falta el identificador de la respuesta"}` y el destino no recibe nada.
- **AC-004.2:** Given un usuario autenticado y un `feedback_id` válido, When envía `rating` `"meh"`, Then la respuesta es `400` con `{"error": "La valoración debe ser 'up' o 'down'"}` y el destino no recibe nada.
- **AC-004.3:** Given un usuario autenticado y un `feedback_id` válido, When envía un cuerpo sin `rating`, Then la respuesta es `400` con `{"error": "La valoración debe ser 'up' o 'down'"}`.
- **AC-004.4:** Given un usuario autenticado, When envía un cuerpo vacío o que no es JSON, Then la respuesta es `400` (no `500`) con un cuerpo `{"error": …}`.

### REQ-005 — Solo el destinatario de la respuesta puede votarla
IF el `feedback_id` no fue emitido por fitnerd, está alterado o se emitió para otro usuario THEN THE SYSTEM SHALL responder `404` con `{"error": "No se encontró la respuesta que quieres valorar"}` y no enviar nada al destino (Q5). Los `feedback_id` no caducan (Q6).

- **AC-005.1:** Given un `feedback_id` emitido para el usuario `42`, When el usuario `7` lo envía con `rating` `up`, Then la respuesta es `404` con ese mensaje y el destino no recibe ninguna puntuación.
- **AC-005.2:** Given un usuario autenticado, When envía `feedback_id` `"abc"` (inventado), Then la respuesta es `404` con ese mensaje y el destino no recibe nada.
- **AC-005.3:** Given un `feedback_id` válido del usuario al que se le ha cambiado un carácter, When lo envía, Then la respuesta es `404`.

### REQ-006 — Autenticación
IF la petición a `POST /api/coach/feedback` no lleva un token de sesión válido THEN THE SYSTEM SHALL responder `401` igual que el resto de endpoints protegidos y no enviar nada al destino.

- **AC-006.1:** Given una petición sin cabecera de autorización, When se envía un voto, Then la respuesta es `401` y el destino no recibe nada.

### REQ-007 — Límite de votos
IF un usuario ya envió 60 votos en la última hora THEN THE SYSTEM SHALL responder `429` con `{"error": "Alcanzaste el límite de 60 valoraciones por hora. Vuelve a intentarlo en un rato."}` y no enviar nada al destino (Q9). Las peticiones rechazadas con `400`, `401` o `404` no cuentan para el límite.

- **AC-007.1:** Given un usuario que ya envió 60 votos válidos en la última hora, When envía otro, Then la respuesta es `429` con ese mensaje y el destino no recibe la puntuación.
- **AC-007.2:** Given un usuario que envió 59 votos válidos en la última hora, When envía otro, Then la respuesta es `204`.
- **AC-007.3:** Given un usuario con 60 votos en la última hora, When otro usuario envía un voto, Then la respuesta para este último es `204` (el límite es por usuario).
- **AC-007.4:** Given un usuario que envió 60 peticiones rechazadas con `404`, When envía un voto válido, Then la respuesta es `204`.

### REQ-008 — El voto no depende de que Langfuse funcione
WHEN el destino de observabilidad falla o está inactivo al registrar un voto válido THE SYSTEM SHALL responder igualmente `204`, registrar el fallo como aviso en el log del backend sin credenciales y no devolver error al usuario.

- **AC-008.1:** Given un destino que lanza un error en cada envío y un `feedback_id` válido del usuario, When envía `rating` `up`, Then la respuesta es `204`.
- **AC-008.2:** Given lo mismo que AC-008.1, When se procesa el voto, Then el log del backend registra un aviso de que la valoración no se pudo enviar a Langfuse, sin incluir las claves de Langfuse.
- **AC-008.3:** Given un `feedback_id` válido y la observabilidad desactivada después de emitirlo, When el usuario envía un voto, Then la respuesta es `204` y no se intenta enviar nada.

### REQ-009 — Botones de valoración en la página del coach
WHEN la página del coach muestra una respuesta del coach que llegó con un `feedback_id` no nulo THE SYSTEM SHALL mostrar debajo de esa respuesta dos botones, 👍 con nombre accesible "Respuesta útil" y 👎 con nombre accesible "Respuesta no útil", ninguno seleccionado al principio. IF la respuesta llegó con `feedback_id` `null` THEN THE SYSTEM SHALL no mostrar los botones. Los mensajes del usuario nunca llevan botones.

- **AC-009.1:** Given una respuesta del coach con `feedback_id` `"f1"`, When se muestra en la conversación, Then debajo aparecen los botones "Respuesta útil" y "Respuesta no útil", ambos con `aria-pressed="false"`.
- **AC-009.2:** Given una respuesta del coach con `feedback_id` `null`, When se muestra, Then no aparece ningún botón de valoración.
- **AC-009.3:** Given una conversación con un mensaje del usuario y una respuesta del coach con `feedback_id`, When se muestra, Then hay exactamente un par de botones de valoración, asociado a la respuesta del coach.
- **AC-009.4:** Given dos respuestas del coach con `feedback_id`, When se muestran, Then cada una tiene su propio par de botones y votar una no cambia el estado de la otra.

### REQ-010 — Votar desde la página del coach
WHEN el usuario pulsa uno de los botones de valoración THE SYSTEM SHALL enviar el voto con el `feedback_id` de esa respuesta y el `rating` correspondiente, desactivar los dos botones de esa respuesta mientras se envía y, cuando el envío termina con éxito, marcar como seleccionado (`aria-pressed="true"`) el botón pulsado y como no seleccionado el otro. WHEN el usuario pulsa el botón ya seleccionado THE SYSTEM SHALL no enviar nada.

- **AC-010.1:** Given una respuesta con `feedback_id` `"f1"` sin votar, When el usuario pulsa "Respuesta útil", Then se envía `{"feedback_id": "f1", "rating": "up"}` y, al completarse, "Respuesta útil" tiene `aria-pressed="true"` y "Respuesta no útil" `aria-pressed="false"`.
- **AC-010.2:** Given una respuesta con `feedback_id` `"f1"` votada como útil, When el usuario pulsa "Respuesta no útil", Then se envía `{"feedback_id": "f1", "rating": "down"}` y, al completarse, la selección pasa a "Respuesta no útil".
- **AC-010.3:** Given un envío de voto en curso, When se observa la respuesta, Then sus dos botones de valoración están desactivados.
- **AC-010.4:** Given una respuesta votada como útil, When el usuario vuelve a pulsar "Respuesta útil", Then no se envía ninguna petición y la selección no cambia.
- **AC-010.5:** Given una respuesta con `feedback_id` `"f1"`, When el usuario vota, Then el historial que se manda en la siguiente pregunta al coach sigue conteniendo solo `role` y `content` por mensaje (sin `feedback_id` ni voto).

### REQ-011 — Error al votar en la página del coach
IF el envío del voto falla (cualquier error de red o código distinto de `204`) THEN THE SYSTEM SHALL mantener la selección que había antes del intento, volver a activar los botones y mostrar bajo esa respuesta el texto "No se pudo enviar tu valoración. Inténtalo de nuevo." para un fallo general, o el mensaje `error` del servidor para un `429`.

- **AC-011.1:** Given una respuesta sin votar y un envío simulado que falla con `500`, When el usuario pulsa "Respuesta útil", Then ningún botón queda seleccionado, los dos vuelven a estar activos y aparece "No se pudo enviar tu valoración. Inténtalo de nuevo." bajo esa respuesta.
- **AC-011.2:** Given una respuesta votada como útil y un envío simulado que falla, When el usuario pulsa "Respuesta no útil", Then "Respuesta útil" sigue seleccionado y aparece el mensaje de error.
- **AC-011.3:** Given un envío simulado que responde `429` con `{"error": "Alcanzaste el límite de 60 valoraciones por hora. Vuelve a intentarlo en un rato."}`, When el usuario vota, Then se muestra ese mensaje bajo la respuesta.
- **AC-011.4:** Given un mensaje de error visible tras un fallo, When el usuario vota de nuevo con éxito, Then el mensaje desaparece.

### REQ-012 — Política de privacidad actualizada
THE SYSTEM SHALL mostrar en la página "Política de privacidad":
- en "Con quién se comparte", una entrada para **Langfuse** que explique que las preguntas al AI Coach, las respuestas, el contenido de los vídeos usado para responder y las valoraciones 👍/👎 se envían a Langfuse para revisar la calidad del coach, identificadas solo con un identificador interno de la cuenta, nunca con el email ni el nombre;
- en "Con quién se comparte", una entrada para **Voyage AI** que explique que el texto de las preguntas al AI Coach se envía a Voyage AI para buscar el contenido relacionado (Q10);
- en "Actividad en la app", la mención de las valoraciones de las respuestas del AI Coach;
- en "Tus derechos", que al pedir la eliminación de la cuenta también se eliminan los datos enviados a Langfuse (Q7);
- como "Última actualización", la fecha en que se implementa este cambio, con el mismo formato que la actual ("D de mes de AAAA") y distinta de "2 de septiembre de 2026" (Q11).

- **AC-012.1:** Given la página de política de privacidad, When se renderiza, Then la sección "Con quién se comparte" contiene una entrada que menciona "Langfuse", "valoraciones" y que no se envían el email ni el nombre.
- **AC-012.2:** Given la página, When se renderiza, Then la sección "Con quién se comparte" contiene una entrada que menciona "Voyage AI".
- **AC-012.3:** Given la página, When se renderiza, Then la sección "Tus derechos" menciona Langfuse.
- **AC-012.4:** Given la página, When se renderiza, Then "Última actualización" muestra una fecha con el formato "D de mes de AAAA" y no muestra "2 de septiembre de 2026".

### REQ-013 — Política de privacidad sin voseo
THE SYSTEM SHALL redactar la página "Política de privacidad" completa en tuteo, sin formas de voseo (Q8).

- **AC-013.1:** Given la página de política de privacidad, When se renderiza, Then su texto no contiene ninguna de estas formas: "registrás", "iniciás", "vos mismo", "hacés", "usás", "usá ", "Podés".

## 5. Requisitos no funcionales

### NFR-001 — Privacidad del voto
THE SYSTEM SHALL no incluir en la puntuación `user_feedback` ni en ningún dato enviado a Langfuse por un voto el email, el nombre, el token de sesión del usuario ni ninguna credencial, y SHALL no exponer en el `feedback_id` el email ni el nombre del usuario.

- **AC-N001.1:** Given un usuario con email `ana@example.com`, nombre "Ana Pérez" e ID interno `42`, When recibe una respuesta del coach y la vota, Then ni el `feedback_id` ni ningún campo enviado al destino por el voto contiene `ana@example.com`, "Ana Pérez" ni el token JWT de la petición.

### NFR-002 — Sin latencia añadida apreciable
THE SYSTEM SHALL enviar la puntuación en segundo plano, sin que la respuesta `204` espere a que Langfuse la reciba. La entrega es de mejor esfuerzo, como las trazas de 004.

- **AC-N002.1:** Given un destino de observabilidad que tarda 3 segundos en aceptar cada envío, When un usuario envía un voto válido, Then la respuesta `204` llega en menos de 0,5 segundos.

### NFR-003 — Tests sin servicios externos
THE SYSTEM SHALL permitir probar todo el comportamiento de esta feature sin llamar a Langfuse ni a otros servicios externos reales.

- **AC-N003.1:** Given la suite de tests del backend y la del frontend, When se ejecutan sin acceso a red, Then todos los tests de esta feature pasan.

### NFR-004 — Accesibilidad de los botones
THE SYSTEM SHALL hacer los botones de valoración operables con teclado y anunciar su estado a lectores de pantalla.

- **AC-N004.1:** Given una respuesta con botones de valoración, When se inspeccionan, Then son elementos `button` con nombre accesible ("Respuesta útil" / "Respuesta no útil") y atributo `aria-pressed`.

## 6. Datos y contratos visibles

**`POST /api/coach/ask`** (cambio: campo nuevo en la respuesta `200`; el resto del contrato no cambia):

```json
{ "answer": "Haz 3 series de 10.", "feedback_id": "f1a2b3c4" }
```

El valor de `feedback_id` del ejemplo es ilustrativo: es un texto opaco cuyo formato fija el plan. Es `null` cuando la pregunta no tiene traza en Langfuse (observabilidad inactiva o fallo al abrir la traza). El frontend lo trata como opaco: no lo interpreta ni lo reenvía en el historial.

**`POST /api/coach/feedback`** (nuevo, requiere sesión):

Cuerpo:

| Campo | Tipo | Validación |
|---|---|---|
| `feedback_id` | texto | Obligatorio, no vacío; emitido por `POST /api/coach/ask` para el mismo usuario |
| `rating` | texto | Obligatorio; `up` o `down` |

Respuestas:

| Código | Cuerpo | Cuándo |
|---|---|---|
| `204` | — | Voto aceptado (aunque Langfuse falle o esté inactivo) |
| `400` | `{"error": "Falta el identificador de la respuesta"}` | Falta `feedback_id` o no es texto no vacío |
| `400` | `{"error": "La valoración debe ser 'up' o 'down'"}` | `rating` ausente o con otro valor |
| `401` | el de hoy para endpoints protegidos | Sin sesión válida |
| `404` | `{"error": "No se encontró la respuesta que quieres valorar"}` | `feedback_id` inventado, alterado o de otro usuario |
| `429` | `{"error": "Alcanzaste el límite de 60 valoraciones por hora. Vuelve a intentarlo en un rato."}` | Más de 60 votos por usuario en una hora |

**Puntuación en Langfuse** (sobre la traza `coach-ask` de la respuesta votada):

| Nombre | Tipo | Valores |
|---|---|---|
| `user_feedback` | booleana | `1` (👍, `up`) o `0` (👎, `down`); una sola por traza, con el último voto |

**Textos de la UI** (página del coach):

| Elemento | Texto |
|---|---|
| Botón 👍 (nombre accesible) | "Respuesta útil" |
| Botón 👎 (nombre accesible) | "Respuesta no útil" |
| Error general al votar | "No se pudo enviar tu valoración. Inténtalo de nuevo." |
| Error `429` al votar | El `error` que devuelve el servidor |

**Log del backend:** si falla el envío de la puntuación a Langfuse, un aviso que indica que la valoración del coach no se pudo enviar, sin credenciales.

**Política de privacidad:** ver REQ-012 y REQ-013; la redacción exacta la decide la implementación dentro de esos requisitos.

## 7. Preguntas abiertas

Todas las preguntas están **resueltas**: el usuario aceptó todas las propuestas ("todas como propone el agente"), que ya están incorporadas en los REQ y AC indicados.

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | ¿Nombre y tipo de la puntuación en Langfuse? **Propuesta:** `user_feedback`, booleana, `1` = 👍 y `0` = 👎 (REQ-002). | Todas como propone el agente. **Resuelta:** se aplica la propuesta (REQ-002, sección 6). |
| Q2 | ¿Qué respuestas se pueden votar? **Propuesta:** todas las `200` con traza, incluidas "sin información" (`dont_know`) y "rechazo" (`refused`), porque también son señal útil para calibrar el umbral. Nunca los errores `429`/`503` (REQ-001). | Todas como propone el agente. **Resuelta:** se aplica la propuesta (REQ-001, AC-001.1 a AC-001.3 y AC-001.7). |
| Q3 | ¿Se puede cambiar o retirar el voto? **Propuesta:** se puede cambiar (el último sustituye al anterior, una sola puntuación por traza); no se puede retirar (REQ-003, REQ-010). | Todas como propone el agente. **Resuelta:** se aplica la propuesta (REQ-003, REQ-010). |
| Q4 | ¿Se pide un comentario de texto con el 👎? **Propuesta:** no en esta feature (fuera de alcance). | Todas como propone el agente. **Resuelta:** fuera de alcance (sección 3). |
| Q5 | ¿Debe el backend comprobar que la respuesta votada es del usuario que vota? **Propuesta:** sí; un `feedback_id` de otro usuario, inventado o alterado devuelve `404` y no envía nada (REQ-005). | Todas como propone el agente. **Resuelta:** se aplica la propuesta (REQ-005). |
| Q6 | ¿Caduca el `feedback_id`? **Propuesta:** no; la conversación solo vive en memoria del navegador, así que en la práctica no se reutiliza tras recargar, y repetir un voto solo sobrescribe la misma puntuación (REQ-005). | Todas como propone el agente. **Resuelta:** no caduca (REQ-005). |
| Q7 | ¿Qué dice la política sobre borrar los datos de Langfuse? **Propuesta:** que, al pedir la eliminación de la cuenta, también se borran a mano las trazas asociadas en Langfuse (el borrado automático queda fuera de alcance) (REQ-012). | Todas como propone el agente. **Resuelta:** se aplica la propuesta (REQ-012, AC-012.3; sección 3). |
| Q8 | ¿Se corrige el voseo de toda la página de privacidad en esta feature? **Propuesta:** sí, toda la página (se reescribe igualmente); la página de términos y el resto de la app quedan fuera (REQ-013). | Todas como propone el agente. **Resuelta:** se aplica la propuesta (REQ-013; sección 3). |
| Q9 | ¿Límite de votos? **Propuesta:** 60 votos por usuario y hora (el coach admite 20 preguntas por hora, así que deja margen para cambiar votos), `429` con el mensaje de la sección 6, para proteger la cuota de Langfuse (REQ-007). | Todas como propone el agente. **Resuelta:** se aplica la propuesta (REQ-007, REQ-011). |
| Q10 | ¿Se añade también Voyage AI a "Con quién se comparte"? Hoy recibe el texto de las preguntas y la página no lo menciona. **Propuesta:** sí (REQ-012). | Todas como propone el agente. **Resuelta:** sí (REQ-012, AC-012.2). |
| Q11 | ¿Qué fecha de "Última actualización"? **Propuesta:** la fecha en que se implementa el cambio, escrita igual que la actual ("D de mes de AAAA") (REQ-012). | Todas como propone el agente. **Resuelta:** se aplica la propuesta (REQ-012, AC-012.4). |

## 8. Glosario

- **Traza:** registro en Langfuse de una pregunta al coach de principio a fin (ver spec 004).
- **Puntuación (score):** valor que se adjunta a una traza en Langfuse para filtrarla o agregarla.
- **Voto / valoración:** 👍 (`up`, útil) o 👎 (`down`, no útil) que el usuario da a una respuesta del coach.
- **`feedback_id`:** identificador opaco de una respuesta del coach, que el frontend devuelve al votar.
- **Destino de observabilidad:** el servicio que recibe trazas y puntuaciones (Langfuse Cloud en producción, un sustituto en los tests).
