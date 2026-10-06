# Tareas 003 — User-Agent propio en el envío de correos con Resend

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-06)

## Fase A0 — Andamiaje (implementer, modo scaffold)
`ResendTransport` ya existe, pero los tests lo construyen con los parámetros nuevos `opener` y `logger`. Sin ellos, el `TypeError` sería un error de fixture y no un rojo legítimo (plan, sección 5, "Rojo esperado").
- [x] T-000 [REQ-001, REQ-004] (scaffold) Añadir a `ResendTransport` la constante `USER_AGENT` y la firma `__init__(api_key, timeout=10, opener=None, logger=None)`, que solo guarda las dependencias sin cambiar el comportamiento de `send` — `backend/utils/email_sender.py`

## Fase A — Tests (test-author)
Fakes nuevos (`FakeOpener`, `FakeLogger`, `make_transport`), locales al archivo de tests unitarios.
- [x] T-001 [REQ-001, REQ-004] (test) Fakes `FakeOpener` (guarda las `Request`; devuelve éxito, lanza `HTTPError` con cuerpo o lanza `URLError`) y `FakeLogger` (guarda las entradas ya formateadas), más el helper `make_transport` — `backend/tests/test_services/test_email_sender.py`
- [x] T-002 [REQ-001, AC-001.1] (test) La petición lleva `User-Agent` con el valor exacto de fitnerd — `backend/tests/test_services/test_email_sender.py`
- [x] T-003 [REQ-001, AC-001.2] (test) Una única cabecera `User-Agent` y sin `Python-urllib` — `backend/tests/test_services/test_email_sender.py`
- [x] T-004 [REQ-001, AC-001.3] (test) Dos envíos seguidos a destinatarios distintos mantienen el `User-Agent` — `backend/tests/test_services/test_email_sender.py`
- [x] T-005 [REQ-002, AC-002.1] (test) Método `POST`, URL de Resend, `Authorization: Bearer re_test_123` y `Content-Type: application/json` sin cambios — `backend/tests/test_services/test_email_sender.py`
- [x] T-006 [REQ-002, AC-002.2] (test) El cuerpo JSON de la petición es exactamente el de la spec — `backend/tests/test_services/test_email_sender.py`
- [x] T-007 [REQ-003, AC-003.1] (test) Un 403 lanza `EmailSendError` con el código `403` y sin la API key — `backend/tests/test_services/test_email_sender.py`
- [x] T-008 [REQ-003, AC-003.2] (test) Un fallo de conexión (`URLError`) lanza `EmailSendError` sin la API key — `backend/tests/test_services/test_email_sender.py`
- [x] T-009 [REQ-003, AC-003.3] (test) Sin API key lanza `EmailSendError` y no hay ninguna petición — `backend/tests/test_services/test_email_sender.py`
- [x] T-010 [REQ-004, AC-004.1] (test) El cuerpo `error code: 1010` de un 403 se registra en el log junto al código — `backend/tests/test_services/test_email_sender.py`
- [x] T-011 [REQ-004, AC-004.2] (test) El cuerpo registrado se recorta a 200 caracteres (200 `a` sí, ninguna `b`) — `backend/tests/test_services/test_email_sender.py`
- [x] T-012 [REQ-004, AC-004.3] (test) Un 401 cuyo cuerpo contiene la API key no la deja en ninguna entrada del log — `backend/tests/test_services/test_email_sender.py`
- [x] T-013 [REQ-004, AC-004.4] (test) El mensaje del `EmailSendError` no incluye el cuerpo de la respuesta — `backend/tests/test_services/test_email_sender.py`
- [x] T-014 [REQ-004, AC-004.5] (test) Un 500 con cuerpo vacío lanza exactamente `EmailSendError` y registra el código `500` — `backend/tests/test_services/test_email_sender.py`
- [x] T-015 [REQ-004, AC-004.6] (test) Con Resend fallando con 403 y `error code: 1010`, `POST /api/auth/forgot-password` responde 503 con el mensaje genérico y sin `1010` — `backend/tests/test_routes/test_password_reset_routes.py`

## Fase B — Implementación (implementer)
- [x] T-020 [REQ-001, AC-001.1, AC-001.2, AC-001.3] (impl) Enviar la cabecera `User-Agent: USER_AGENT` en la `Request` de `ResendTransport.send`, sin cambiar el resto de la petición, e invocar `self.opener` en lugar de `urlopen` directo — `backend/utils/email_sender.py`
- [x] T-021 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.5] (impl) Añadir `_error_snippet` (lee hasta 4096 bytes con `try`, decodifica con `errors="replace"`, quita la API key y recorta a 200) y registrar con `logger.warning("Resend respondió con HTTP %s: %s", ...)` en la rama `HTTPError` — `backend/utils/email_sender.py`
- [x] T-022 [REQ-002, REQ-003, AC-002.1, AC-002.2, AC-003.1, AC-003.2, AC-003.3, AC-004.4, AC-004.6] (impl) Mantener sin cambios el mensaje `EmailSendError("Resend respondió con HTTP <code>")` (sin cuerpo ni key), las ramas de red y la comprobación de la API key; `init_app` pasa `logger=app.logger` a `ResendTransport` — `backend/utils/email_sender.py`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-001, T-002 | T-000, T-020 |
| REQ-001 | AC-001.2 | T-001, T-003 | T-020 |
| REQ-001 | AC-001.3 | T-001, T-004 | T-020 |
| REQ-002 | AC-002.1 | T-001, T-005 | T-022 |
| REQ-002 | AC-002.2 | T-001, T-006 | T-022 |
| REQ-003 | AC-003.1 | T-001, T-007 | T-022 |
| REQ-003 | AC-003.2 | T-001, T-008 | T-022 |
| REQ-003 | AC-003.3 | T-001, T-009 | T-022 |
| REQ-004 | AC-004.1 | T-001, T-010 | T-000, T-021 |
| REQ-004 | AC-004.2 | T-001, T-011 | T-021 |
| REQ-004 | AC-004.3 | T-001, T-012 | T-021 |
| REQ-004 | AC-004.4 | T-001, T-013 | T-022 |
| REQ-004 | AC-004.5 | T-001, T-014 | T-021 |
| REQ-004 | AC-004.6 | T-015 | T-022 |

## Comentarios del usuario
Etapa tests, tras el scaffold de T-000 (2026-10-06). Copiado literalmente por el orquestador:

> A, amplía el andamiaje

Contexto de la opción (A) que el usuario elige: tras T-000, `ResendTransport.send()` seguía llamando directamente a `urllib.request.urlopen` e ignoraba `self.opener`, de modo que los tests con `FakeOpener` harían peticiones reales a `api.resend.com` (Art. 5.4). Se amplía el andamiaje (T-000): `send()` debe invocar `self.opener` (con `urllib.request.urlopen` por defecto cuando no se inyecta ninguno), sin ningún otro cambio de comportamiento. La cabecera `User-Agent` (T-020) y el registro del cuerpo de error (T-021) siguen siendo tareas de implementación.
