# Spec 001 — Endpoint de salud del backend con chequeo de base de datos

- **Feature:** `001-health-endpoint` · **Tipo:** feature
- **Ámbito:** backend

## 1. Contexto y problema

Hoy el backend de fitnerd no ofrece ninguna forma sencilla de saber si está vivo y si puede hablar con su base de datos. Quien opera la app (el orquestador de contenedores, un monitor externo de disponibilidad o el propio desarrollador) solo puede comprobarlo llamando a endpoints de negocio, que exigen autenticación y dependen de datos concretos.

Se necesita un endpoint público y de solo lectura que responda "todo bien" cuando el backend atiende peticiones y la base de datos responde, y que devuelva un error de servicio no disponible cuando la base de datos no responde. Además, esta feature es la prueba en seco del harness SDD en el backend.

## 2. Historia de usuario

Como **operador de fitnerd (monitor de disponibilidad, orquestador de contenedores o desarrollador)**, quiero **consultar un endpoint de salud que confirme que el backend y su base de datos responden** para **detectar caídas rápido y sin credenciales ni datos de negocio**.

## 3. Alcance

**Incluye:**
- Un endpoint `GET /api/health`, público (sin autenticación).
- Comprobación de que la base de datos responde en el momento de la petición.
- Respuesta `200` con el cuerpo `{"status": "ok", "database": "ok"}` cuando la base de datos responde.
- Respuesta `503` con el formato de error estándar del backend cuando la base de datos no responde.

**Fuera de alcance:**
- Comprobar otras dependencias (Redis, S3, Voyage, Anthropic, Google).
- Métricas, versión de la app, tiempos de respuesta u otros datos de diagnóstico en la respuesta.
- Cambios en el frontend, en la configuración de Docker/Caddy o en el workflow de CI para usar el endpoint.
- Rate limiting específico del endpoint.
- Un tiempo máximo de espera propio del chequeo, distinto del que ya tenga la conexión a la base de datos (Q3, resuelta).
- Cambiar el texto del mensaje de error `405` que ya devuelve el backend para métodos no permitidos.

## 4. Requisitos funcionales

### REQ-001 — Salud correcta cuando la base de datos responde
WHEN un cliente envía `GET /api/health` y la base de datos responde THE SYSTEM SHALL devolver el código HTTP `200` con el cuerpo JSON `{"status": "ok", "database": "ok"}`.

- **AC-001.1:** Given la base de datos disponible, When un cliente hace `GET /api/health`, Then la respuesta tiene código `200` y `Content-Type` `application/json`.
- **AC-001.2:** Given la base de datos disponible, When un cliente hace `GET /api/health`, Then el cuerpo JSON es exactamente `{"status": "ok", "database": "ok"}` (sin campos adicionales).

### REQ-002 — Servicio no disponible cuando la base de datos no responde
IF la base de datos no responde (falla la conexión o falla la consulta de comprobación) durante una petición `GET /api/health` THEN THE SYSTEM SHALL devolver el código HTTP `503` con el cuerpo JSON `{"error": "Base de datos no disponible"}`.

- **AC-002.1:** Given una base de datos que falla al conectar, When un cliente hace `GET /api/health`, Then la respuesta tiene código `503` y el cuerpo JSON es exactamente `{"error": "Base de datos no disponible"}`.
- **AC-002.2:** Given una base de datos que acepta la conexión pero falla al ejecutar la consulta de comprobación, When un cliente hace `GET /api/health`, Then la respuesta tiene código `503` y el cuerpo JSON es exactamente `{"error": "Base de datos no disponible"}`.
- **AC-002.3:** Given una petición anterior que devolvió `503` por fallo de la base de datos, When la base de datos vuelve a responder y un cliente hace `GET /api/health`, Then la respuesta tiene código `200` y el cuerpo `{"status": "ok", "database": "ok"}` (el resultado no queda cacheado).

### REQ-003 — Acceso público
THE SYSTEM SHALL atender `GET /api/health` sin exigir autenticación.

- **AC-003.1:** Given una petición sin cabecera `Authorization`, When un cliente hace `GET /api/health` con la base de datos disponible, Then la respuesta tiene código `200` (no `401`).
- **AC-003.2:** Given una petición con una cabecera `Authorization` con un token inválido, When un cliente hace `GET /api/health` con la base de datos disponible, Then la respuesta tiene código `200` (el token se ignora).

### REQ-004 — Solo lectura
IF un cliente usa en `/api/health` un método distinto de `GET` (o `HEAD`) THEN THE SYSTEM SHALL responder con el código HTTP `405` y el formato de error estándar del backend: un objeto JSON cuya única clave es `error`, con el mensaje de método no permitido que el backend ya usa para el resto de endpoints.

- **AC-004.1:** Given el backend en marcha, When un cliente hace `POST /api/health`, Then la respuesta tiene código `405` y un cuerpo JSON cuya única clave es `error`, con un valor de texto no vacío.

## 5. Requisitos no funcionales

### NFR-001 — Sin fuga de detalles internos
THE SYSTEM SHALL NOT incluir en la respuesta de `/api/health` detalles internos del fallo de la base de datos (mensaje de la excepción, cadena de conexión, host, usuario, trazas).

- **AC-N001.1:** Given una base de datos que falla con un error cuyo mensaje contiene un texto identificable (por ejemplo, una cadena de conexión ficticia), When un cliente hace `GET /api/health`, Then el cuerpo de la respuesta `503` no contiene ese texto y es exactamente `{"error": "Base de datos no disponible"}`.

### NFR-002 — Sin efectos secundarios en los datos
THE SYSTEM SHALL comprobar la base de datos sin crear, modificar ni borrar datos.

- **AC-N002.1:** Given la base de datos disponible con un número conocido de filas en las tablas de la app, When un cliente hace `GET /api/health`, Then tras la respuesta el número de filas de esas tablas no ha cambiado.

## 6. Datos y contratos visibles

**Endpoint:** `GET /api/health` · público · sin parámetros ni cuerpo de petición.

| Situación | Código HTTP | Cuerpo JSON |
|---|---|---|
| Base de datos responde | `200` | `{"status": "ok", "database": "ok"}` |
| Base de datos no responde (conexión o consulta) | `503` | `{"error": "Base de datos no disponible"}` |
| Método distinto de `GET`/`HEAD` | `405` | Objeto con la única clave `error` y el mensaje de método no permitido que ya usa el backend |

- El cuerpo de éxito contiene exactamente las claves `status` y `database`, ambas con el valor `"ok"`.
- El cuerpo de error sigue el formato estándar del backend (`{"error": "mensaje"}`), igual que el resto de endpoints.
- Consumidores previstos: monitor de disponibilidad externo, orquestador de contenedores y desarrolladores. No lo consume el frontend.

## 7. Preguntas abiertas

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | La idea solo fija el código `503` para el fallo, no el cuerpo. ¿Qué cuerpo devuelve? **Propuesta:** el formato de error estándar del backend `{"error": "Base de datos no disponible"}` (la constitución, Art. 6.3, exige ese formato para los errores). La alternativa sería `{"status": "error", "database": "unavailable"}`, simétrica con el éxito pero fuera del formato estándar. | **Resuelta:** propuesta por defecto (usuario, 2026-09-25). Incorporada en REQ-002, NFR-001 y la sección 6. |
| Q2 | ¿En qué idioma va el mensaje de error del `503`? Los mensajes de error actuales del backend están en inglés, pero la constitución (Art. 6.11) pide español para los textos visibles. **Propuesta:** español, `"Base de datos no disponible"`. | **Resuelta:** propuesta por defecto (usuario, 2026-09-25). Incorporada en REQ-002 (AC-002.1, AC-002.2) y AC-N001.1. |
| Q3 | ¿El chequeo debe tener un tiempo máximo de espera propio (por ejemplo, responder `503` si la base de datos tarda más de 2 s)? **Propuesta:** no en esta feature; se usa el comportamiento actual de la conexión y queda fuera de alcance. | **Resuelta:** propuesta por defecto (usuario, 2026-09-25). Queda en "Fuera de alcance". |
| Q4 | ¿El endpoint debe ser público o protegido? **Propuesta:** público, sin autenticación, porque no expone datos de usuario (Art. 7.2 no aplica) y los monitores no tienen credenciales. | **Resuelta:** propuesta por defecto (usuario, 2026-09-25). Incorporada en REQ-003. |
| Q5 | ¿Debe comprobar también Redis (usado por el rate limiting del coach)? **Propuesta:** no; solo Postgres, como dice la idea. Redis queda fuera de alcance. | **Resuelta:** propuesta por defecto (usuario, 2026-09-25). Queda en "Fuera de alcance". |

## 8. Glosario

- **Base de datos responde:** el backend puede abrir (u obtener) una conexión a Postgres y ejecutar una consulta trivial de solo lectura con éxito.
- **Operador:** cualquier sistema o persona que vigila la disponibilidad del backend (monitor externo, orquestador de contenedores, desarrollador).
