# Spec 003 — User-Agent propio en el envío de correos con Resend

- **Feature:** `003-resend-user-agent` · **Tipo:** fix
- **Ámbito:** backend

## 1. Contexto y problema
La feature 002 (recuperación de contraseña) envía los correos de restablecimiento a través del proveedor Resend. En producción todas las peticiones de envío se rechazan con HTTP `403` (Cloudflare, error 1010: firma del navegador o cliente bloqueada), porque se envían con el User-Agent genérico de la librería HTTP estándar de Python (`Python-urllib/3.x`), que el proveedor bloquea.

La consecuencia visible es que ningún usuario puede recuperar su contraseña en producción: `POST /api/auth/forgot-password` responde siempre `503` con "No se pudo enviar el correo. Inténtalo de nuevo más tarde." para las cuentas con contraseña (REQ-006 de la spec 002).

Además, hoy el fallo solo deja constancia del código HTTP, lo que hizo difícil diagnosticar la causa (el detalle "error 1010" venía en el cuerpo de la respuesta y se perdía).

Este fix hace que cada petición al proveedor de correo se identifique con un User-Agent propio de fitnerd, para que Resend la acepte, y que el cuerpo de las respuestas de error del proveedor quede registrado, recortado, en el log del servidor.

## 2. Historia de usuario
Como **usuario registrado con correo y contraseña que ha olvidado su contraseña**, quiero **que el correo de restablecimiento llegue de verdad en producción** para **poder recuperar el acceso a mi cuenta**.

Como **mantenedor de fitnerd**, quiero **ver en el log del servidor el motivo que da Resend cuando rechaza un envío** para **diagnosticar fallos futuros sin tener que reproducirlos**.

## 3. Alcance
**Incluye:**
- Que toda petición de envío de correo al proveedor Resend lleve una cabecera `User-Agent` propia de fitnerd, con un valor fijo (Q1, Q2).
- Mantener sin cambios el resto de la petición (destino, método, autenticación, tipo de contenido y cuerpo) y la forma en que el fallo llega al usuario.
- Registrar en el log del servidor el cuerpo de la respuesta de error de Resend, recortado a 200 caracteres como máximo y sin la API key; nunca se muestra al usuario (Q3).

**Fuera de alcance:**
- Cambiar de proveedor de correo o de la forma de hablar con él.
- Reintentos automáticos ante fallos del proveedor.
- Registrar en el log las respuestas correctas de Resend o el contenido de los correos enviados.
- Cambios en los transportes de desarrollo y de tests (consola y memoria), que no hacen peticiones de red.
- Cambios en los textos, códigos HTTP o límites de la recuperación de contraseña (spec 002).
- La comprobación manual en producción de que Resend acepta la petición (Q4): no se puede automatizar sin llamar al servicio real, y la constitución (Art. 5.4) lo prohíbe en los tests. Queda como paso manual tras el despliegue, que el orquestador recuerda en el cierre.

## 4. Requisitos funcionales

### REQ-001 — User-Agent propio en cada envío
WHEN el sistema envía un correo a través de Resend THE SYSTEM SHALL incluir en la petición la cabecera `User-Agent` con el valor exacto `fitnerd/1.0 (+https://fitnerd.betofallas.dev)`.

- **AC-001.1:** Given el envío por Resend configurado con una API key y el tráfico saliente interceptado en el test (sin red real), When se envía un correo, Then la petición capturada lleva la cabecera `User-Agent` con el valor exacto `fitnerd/1.0 (+https://fitnerd.betofallas.dev)`.
- **AC-001.2:** Given la misma situación que AC-001.1, When se envía un correo, Then la petición capturada lleva una única cabecera `User-Agent` y su valor no contiene `Python-urllib`.
- **AC-001.3:** Given el envío por Resend configurado con una API key y el tráfico saliente interceptado, When se envían dos correos seguidos a destinatarios distintos, Then las dos peticiones capturadas llevan la cabecera `User-Agent` con el valor de AC-001.1.

### REQ-002 — El resto de la petición no cambia
WHEN el sistema envía un correo a través de Resend THE SYSTEM SHALL mantener el mismo destino, método, autenticación, tipo de contenido y cuerpo que antes de este fix.

- **AC-002.1:** Given el envío por Resend configurado con la API key `re_test_123` y el tráfico saliente interceptado, When se envía un correo, Then la petición capturada es un `POST` a `https://api.resend.com/emails` con las cabeceras `Authorization: Bearer re_test_123` y `Content-Type: application/json`.
- **AC-002.2:** Given la misma situación que AC-002.1 y un correo con remitente `fitnerd <no-reply@example.com>`, destinatario `ana@example.com`, asunto `Asunto`, texto `Texto` y HTML `<p>Texto</p>`, When se envía, Then el cuerpo de la petición capturada es el JSON `{"from": "fitnerd <no-reply@example.com>", "to": ["ana@example.com"], "subject": "Asunto", "text": "Texto", "html": "<p>Texto</p>"}`.

### REQ-003 — Tratamiento de errores del proveedor sin cambios
IF Resend rechaza la petición con un código HTTP de error, o no se puede contactar con él, THEN THE SYSTEM SHALL tratarlo como un fallo de envío de correo, igual que antes de este fix, sin incluir la API key en el mensaje del fallo.

- **AC-003.1:** Given el envío por Resend configurado con una API key y el tráfico saliente interceptado para responder `403`, When se envía un correo, Then el envío falla como fallo de envío de correo cuyo mensaje indica el código `403` y no contiene la API key.
- **AC-003.2:** Given el envío por Resend configurado con una API key y el tráfico saliente interceptado para simular que no hay conexión, When se envía un correo, Then el envío falla como fallo de envío de correo cuyo mensaje no contiene la API key.
- **AC-003.3:** Given el envío por Resend sin API key configurada, When se intenta enviar un correo, Then el envío falla como fallo de envío de correo y no se hace ninguna petición de red.

### REQ-004 — Registro del cuerpo de error de Resend en el log del servidor
IF Resend responde con un código HTTP de error THEN THE SYSTEM SHALL escribir en el log del servidor una entrada con ese código y con el cuerpo de la respuesta recortado a sus primeros 200 caracteres como máximo, sin que la entrada contenga la API key, y sin que ese cuerpo forme parte del mensaje del fallo ni de la respuesta al usuario.

- **AC-004.1:** Given el envío por Resend configurado con una API key y el tráfico saliente interceptado para responder `403` con el cuerpo `error code: 1010`, When se envía un correo, Then el envío falla como fallo de envío de correo y el log del servidor capturado en el test contiene una entrada que incluye `403` y `error code: 1010`.
- **AC-004.2:** Given la misma situación que AC-004.1 pero con un cuerpo de respuesta formado por 200 caracteres `a` seguidos de 300 caracteres `b`, When se envía un correo, Then la entrada del log contiene los 200 caracteres `a` y no contiene ningún carácter `b`.
- **AC-004.3:** Given el envío por Resend configurado con la API key `re_test_123` y el tráfico saliente interceptado para responder `401` con un cuerpo que contiene el texto `re_test_123`, When se envía un correo, Then ninguna entrada del log del servidor capturado en el test contiene `re_test_123`.
- **AC-004.4:** Given la misma situación que AC-004.1, When se envía un correo, Then el mensaje del fallo de envío de correo no contiene `error code: 1010`.
- **AC-004.5:** Given el envío por Resend configurado con una API key y el tráfico saliente interceptado para responder `500` con el cuerpo vacío, When se envía un correo, Then el envío falla como fallo de envío de correo (no con otro error) y el log del servidor contiene una entrada que incluye `500`.
- **AC-004.6:** Given una cuenta con contraseña y el envío por Resend fallando con `403` y el cuerpo `error code: 1010`, When se hace `POST /api/auth/forgot-password` con el correo de esa cuenta, Then la respuesta es `503` con `{"error": "No se pudo enviar el correo. Inténtalo de nuevo más tarde."}` y el cuerpo de la respuesta no contiene `1010`.

## 5. Requisitos no funcionales
No aplican requisitos no funcionales adicionales: ningún test llama a Resend real (constitución, Art. 5.4), lo que ya cubren los AC al exigir el tráfico saliente interceptado.

## 6. Datos y contratos visibles
Contrato con el proveedor externo Resend (único consumidor afectado):

| Elemento | Valor |
|---|---|
| Método y URL | `POST https://api.resend.com/emails` (sin cambios) |
| `Authorization` | `Bearer` seguido de la API key (sin cambios) |
| `Content-Type` | `application/json` (sin cambios) |
| `User-Agent` | `fitnerd/1.0 (+https://fitnerd.betofallas.dev)` (**nuevo**) |
| Cuerpo | `from`, `to` (lista con un destinatario), `subject`, `text`, `html` (sin cambios) |

Log del servidor (**nuevo**, solo visible para quien opera el backend): ante una respuesta de error de Resend, una entrada con el código HTTP y el cuerpo de la respuesta recortado a 200 caracteres como máximo, sin la API key. Ante un fallo de conexión no hay cuerpo que registrar y no cambia nada.

Para el usuario final no cambia ningún contrato: `POST /api/auth/forgot-password` mantiene las respuestas `200`, `400`, `429` y `503` y los mensajes definidos en la spec 002; el cuerpo de error de Resend nunca aparece en ellas. Tampoco hay variables de entorno nuevas.

## 7. Preguntas abiertas
| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | ¿Qué valor exacto debe tener el User-Agent? Propuesta por defecto: `fitnerd/1.0 (+https://fitnerd.betofallas.dev)` (nombre de la app, versión y URL pública, el formato habitual de clientes identificables). | **Resuelta:** se acepta la propuesta (usuario, 2026-10-06). Incorporada en REQ-001. |
| Q2 | ¿El valor debe ser fijo o configurable por variable de entorno? Propuesta por defecto: fijo, sin variable nueva; cambiarlo es un cambio de código trivial y evita tocar `.env.example` y la configuración de producción. | **Resuelta:** fijo, sin variable nueva (usuario, 2026-10-06). Incorporada en REQ-001 y sección 6. |
| Q3 | ¿Se aprovecha el fix para registrar en el log el cuerpo de la respuesta de error de Resend (por ejemplo, el código 1010 de Cloudflare) y facilitar diagnósticos futuros? Propuesta por defecto: no; queda fuera de alcance y el mensaje del fallo sigue indicando solo el código HTTP. | **Resuelta:** sí, registrar el cuerpo recortado (usuario, 2026-10-06): solo en el log del servidor, recortado a 200 caracteres, sin la API key y sin mostrarlo nunca al usuario (el 503 sigue siendo genérico). Incorporada en REQ-004. |
| Q4 | ¿La comprobación en producción (pedir un restablecimiento real y confirmar que llega el correo) queda como paso manual tras el despliegue, fuera de los AC automatizados? Propuesta por defecto: sí, como paso manual que el orquestador recuerda en el cierre. | **Resuelta:** sí, paso manual tras el despliegue (usuario, 2026-10-06). Recogida en "Fuera de alcance". |

## 8. Glosario
- **User-Agent:** cabecera HTTP con la que un cliente se identifica ante el servidor al que llama.
- **Error 1010 de Cloudflare:** rechazo de una petición porque la firma del cliente (por ejemplo, su User-Agent) está bloqueada por el sitio de destino.
- **Resend:** proveedor externo de envío de correo transaccional que usa fitnerd (ADR-0014).
- **Log del servidor:** registro interno del backend, visible solo para quien lo opera; nunca se devuelve al usuario.
