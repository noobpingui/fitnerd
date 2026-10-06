# Plan 003 — User-Agent propio en el envío de correos con Resend

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-06)

## 1. Resumen de la solución
El cambio se limita a `ResendTransport` en `backend/utils/email_sender.py`, que añade la cabecera fija `User-Agent: fitnerd/1.0 (+https://fitnerd.betofallas.dev)` a la petición, sin tocar nada más de ella. Ante un `HTTPError` de Resend, lee el cuerpo de la respuesta, quita la API key, lo recorta a 200 caracteres y lo escribe en el log con `logger.warning`. El mensaje de `EmailSendError` sigue siendo el mismo que antes, sin el cuerpo.

Para probarlo sin red y sin `monkeypatch` (Art. 5.4), `ResendTransport` recibe **por constructor** dos dependencias nuevas, ambas opcionales y con valor por defecto:
- `opener`: la función que abre la petición; por defecto, `urllib.request.urlopen`;
- `logger`: el logger donde se escribe; por defecto, `logging.getLogger(__name__)`.

`EmailSender.init_app` le pasa `app.logger`. El servicio `PasswordResetService`, la ruta y el handler de errores no cambian.

## 2. Impacto en la arquitectura
| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | Sin cambios de modelo. |
| backend · repositories | — | — | Sin cambios. |
| backend · services | — | — | `PasswordResetService` ya traduce cualquier fallo de `email_sender.send` a 503 (spec 002, REQ-006). No cambia. |
| backend · routes | — | — | `auth_routes` no cambia. |
| backend · utils | — | `backend/utils/email_sender.py` | Constante `USER_AGENT`, cabecera nueva, `opener` y `logger` inyectables, registro del cuerpo de error recortado y sin la API key. `init_app` pasa `app.logger` al construir `ResendTransport`. |
| backend · tests | `backend/tests/test_services/test_email_sender.py` | `backend/tests/test_routes/test_password_reset_routes.py` | Tests unitarios del transporte con un `FakeOpener` y un `FakeLogger`, más un test de integración para AC-004.6. |
| frontend | — | — | Fuera de alcance. |

## 3. Diseño
### 3.1 Modelo de datos y migraciones
No aplica: no hay tablas ni columnas nuevas, y no hace falta migración.

### 3.2 Contratos de API
Los endpoints propios no cambian. `POST /api/auth/forgot-password` mantiene `200`, `400`, `429` y `503` con los mensajes de la spec 002.

El único contrato que cambia es la petición saliente a Resend:

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| POST | `https://api.resend.com/emails` (externo) | `Authorization: Bearer <RESEND_API_KEY>` | Cabeceras `Content-Type: application/json` y `User-Agent: fitnerd/1.0 (+https://fitnerd.betofallas.dev)` (**nueva**). Cuerpo JSON `{"from", "to": [destinatario], "subject", "text", "html"}`, sin cambios. | 2xx: se ignora el cuerpo, como ahora. | `HTTPError` → `EmailSendError("Resend respondió con HTTP <code>")` y una entrada `warning` en el log. Fallo de red → `EmailSendError("No se pudo contactar a Resend: <Tipo>")`, sin cambios. Sin API key → `EmailSendError("Falta RESEND_API_KEY")` sin llamar a `opener`, sin cambios. |

### 3.3 Lógica de negocio
Cambios en `backend/utils/email_sender.py`. No hay variables de entorno nuevas (Q2).

```python
class ResendTransport:
    URL = "https://api.resend.com/emails"
    USER_AGENT = "fitnerd/1.0 (+https://fitnerd.betofallas.dev)"
    ERROR_BODY_MAX_CHARS = 200

    def __init__(self, api_key, timeout=10, opener=None, logger=None):
        # opener: callable(request, timeout=...) -> context manager; por defecto urllib.request.urlopen
        # logger: objeto con .warning(msg, *args); por defecto logging.getLogger(__name__)
```

**Reglas de `send(message)`:**
1. **Sin API key:** si `api_key` está vacía, lanza `EmailSendError("Falta RESEND_API_KEY")` antes de construir la petición, y `opener` no se llama (AC-003.3).
2. **Petición:** se construye el `urllib.request.Request` con el mismo `URL`, `method="POST"`, el mismo cuerpo JSON y las cabeceras `Authorization`, `Content-Type` y `User-Agent: USER_AGENT`.
   - `Request` normaliza la clave a `User-agent`, y el `OpenerDirector` real solo añade su `Python-urllib/3.x` por defecto cuando la petición no trae esa cabecera (`has_header`). Por eso queda una única cabecera.
   - El valor es una constante de clase, idéntico en cada envío (AC-001.3).
3. **Envío:** `with self.opener(request, timeout=self.timeout): pass`, igual que ahora.
4. **`urllib.error.HTTPError` como `exc`:**
   1. `snippet = self._error_snippet(exc)`.
   2. `self.logger.warning("Resend respondió con HTTP %s: %s", exc.code, snippet)`.
   3. `raise EmailSendError(f"Resend respondió con HTTP {exc.code}") from None`. El mensaje es el de siempre y no incluye el cuerpo (AC-003.1, AC-004.4).
5. **`URLError`, `TimeoutError` u `OSError`:** igual que ahora, sin entrada de log nueva (spec, sección 6).

**Helper privado `_error_snippet(exc) -> str`:**
1. Lee como máximo 4096 bytes: `exc.read(4096)`, dentro de un `try` que captura `Exception`. Si `fp` es `None`, o la lectura falla, el snippet es `""`. Así, un cuerpo ilegible nunca convierte el fallo en otro error (AC-004.5).
2. Decodifica con `decode("utf-8", errors="replace")`.
3. **Quita la API key primero:** `text.replace(self.api_key, "[REDACTED]")`.
4. **Recorta después:** `text[:200]`.

El orden de los pasos 3 y 4 importa: si se recortara antes, una key que cruzara el límite de 200 caracteres dejaría un prefijo suyo en el log (AC-004.3). AC-004.2 se cumple igual: 200 `a` y ninguna `b`.

**`EmailSender.init_app`:** construye `ResendTransport(app.config.get("RESEND_API_KEY"), logger=app.logger)`. En producción, el `opener` es el `urlopen` real.

**Dependencias inyectadas por constructor (Art. 6.2):** `opener` y `logger` en `ResendTransport`. `PasswordResetService` sigue recibiendo `email_sender` por constructor, sin cambios.

**Seguridad:**
- La API key no aparece en el mensaje de la excepción, porque nunca se interpola.
- Tampoco aparece en el log: se redacta antes de escribir y el formato del mensaje no la incluye.
- El 503 al usuario sigue siendo genérico (`ServiceUnavailableError` del servicio, sin cambios).

### 3.4 Frontend
No aplica: el ámbito es solo backend.

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `ResendTransport.USER_AGENT` y la cabecera `User-Agent` en el `Request` que construye `ResendTransport.send` (`backend/utils/email_sender.py`). |
| REQ-002 | `ResendTransport.send`: URL, método, `Authorization`, `Content-Type` y cuerpo JSON sin cambios. Lo protegen los tests de AC-002.x. |
| REQ-003 | `ResendTransport.send`: la rama `HTTPError` mantiene el mensaje `"Resend respondió con HTTP <code>"`, y no cambian ni la rama de red ni la comprobación de la API key. `PasswordResetService` sigue traduciendo el fallo a 503. |
| REQ-004 | `ResendTransport._error_snippet` (leer, redactar la key y recortar a 200) y `self.logger.warning(...)` en la rama `HTTPError`. `init_app` inyecta `app.logger`. |
| NFR | La spec no define NFR. La restricción de no usar red real se cumple con el `opener` inyectado (tests unitarios) y con la sustitución del transporte en el singleton (test de integración). |

## 5. Estrategia de pruebas

### Tests unitarios
Van en `backend/tests/test_services/test_email_sender.py`. No hay carpeta `test_utils/`, y el Art. 5.4 reserva `test_services/` para los unitarios. No necesitan Postgres.

**Fakes nuevos, locales al archivo** (no se reutilizan en otros archivos, así que no van a `fakes.py`):
- **`FakeOpener`:** invocable `(request, timeout)`.
  - Guarda cada `urllib.request.Request` en `requests`.
  - Según cómo se configure:
    - devuelve un context manager vacío (éxito);
    - lanza `urllib.error.HTTPError(url, code, "msg", hdrs={}, fp=io.BytesIO(body_bytes))`;
    - lanza `urllib.error.URLError("sin conexión")`.
  - Helper: `make_transport(api_key="re_test_123", **opener_kwargs)`, que devuelve `(transport, opener, logger)`.
- **`FakeLogger`:**
  - Implementa `warning`, `info` y `error`.
  - Guarda cada entrada **ya formateada** (`msg % args`) en `records`, para poder buscar subcadenas en ella.

Los tests leen las cabeceras con `request.get_header("User-agent")`, `request.header_items()`, `request.get_method()`, `request.full_url` y `json.loads(request.data)`.

| AC | Test (nombre orientativo) | Comprobación |
|---|---|---|
| AC-001.1 | `test_resend_request_has_fitnerd_user_agent` | `get_header("User-agent") == "fitnerd/1.0 (+https://fitnerd.betofallas.dev)"` |
| AC-001.2 | `test_resend_request_has_single_user_agent_without_python_urllib` | Cuenta las claves de `header_items()` cuyo `lower()` es `user-agent` (debe haber una) y comprueba que su valor no contiene `Python-urllib`. |
| AC-001.3 | `test_consecutive_sends_keep_user_agent` | Dos `send` a destinatarios distintos: `len(opener.requests) == 2` y ambas peticiones llevan el UA exacto. |
| AC-002.1 | `test_resend_request_method_url_and_auth_unchanged` | `POST`, `https://api.resend.com/emails`, `Authorization: Bearer re_test_123` y `Content-type: application/json`. |
| AC-002.2 | `test_resend_request_body_unchanged` | `json.loads(request.data)` es igual al dict exacto de la spec. |
| AC-003.1 | `test_http_error_raises_email_send_error_with_code_without_key` | 403: `pytest.raises(EmailSendError)`, `"403" in str(e)` y `"re_test_123" not in str(e)`. |
| AC-003.2 | `test_connection_error_raises_email_send_error_without_key` | `URLError`: `EmailSendError` sin la key. |
| AC-003.3 | `test_missing_api_key_raises_without_network` | `api_key=None`: `EmailSendError` y `opener.requests == []`. |
| AC-004.1 | `test_http_error_body_is_logged_with_code` | 403 con `b"error code: 1010"`: alguna entrada de `logger.records` contiene `403` y `error code: 1010`. |
| AC-004.2 | `test_logged_error_body_is_truncated_to_200_chars` | Cuerpo `"a"*200 + "b"*300`: la entrada contiene `"a"*200` y ningún `b`. Ojo: el texto fijo del mensaje no debe tener `b` minúscula. Ver riesgos. |
| AC-004.3 | `test_logged_error_body_never_contains_api_key` | 401 con un cuerpo que contiene `re_test_123`: ninguna entrada de `records` lo contiene. |
| AC-004.4 | `test_error_message_does_not_include_response_body` | 403 con `error code: 1010`: `"error code: 1010" not in str(e)`. |
| AC-004.5 | `test_empty_error_body_still_raises_email_send_error_and_logs_code` | 500 con `b""`: lanza exactamente `EmailSendError` y alguna entrada contiene `500`. |

### Test de integración
Va en `backend/tests/test_routes/test_password_reset_routes.py` y necesita Postgres.

| AC | Test | Montaje |
|---|---|---|
| AC-004.6 | `test_resend_403_body_never_reaches_forgot_password_response` | Registra la cuenta y sustituye el transporte del singleton: `email_sender.transport = ResendTransport("re_test_123", opener=FakeOpener(403, b"error code: 1010"), logger=FakeLogger())`. Comprueba que `forgot()` responde 503 con `SEND_FAILED` y que `"1010" not in response.get_data(as_text=True)`. |

Sobre ese montaje:
- La sustitución sigue el mismo patrón que el `fail_with` de los tests actuales: asignar un atributo del singleton, no `monkeypatch`.
- La fixture autouse `_clear_email_outbox` de `conftest.py` vuelve a instalar un `InMemoryTransport` después del test.
- `FakeOpener` y `FakeLogger` se definen en este archivo, o el test-author puede moverlos a `tests/fakes.py` para compartirlos con los tests unitarios. Lo decide él; ambas opciones cumplen la constitución.

### RTL
No aplica: no hay cambios en el frontend.

### Rojo esperado
- **Con el scaffold:** si `opener` y `logger` todavía no existen en el constructor, el `TypeError` al construir el transporte es un error de fixture, no un rojo legítimo. Por eso el scaffold (ADR-0012) debe añadir ya la firma `__init__(api_key, timeout=10, opener=None, logger=None)`, guardando las dependencias, y la constante `USER_AGENT`.
- **Tests que se pondrán en rojo:** AC-001.x (falta la cabecera) y AC-004.1, 004.2 y 004.5 (no hay log).
- **Tests que pasarán ya en verde:** AC-002.x, AC-003.x, AC-004.3, AC-004.4 y AC-004.6. Son tests de regresión que protegen un comportamiento actual (REQ-002 y REQ-003 piden explícitamente "sin cambios"), y el verifier debe tratarlos así.

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Cloudflare o Resend también rechazan el UA nuevo, o el 403 tiene otra causa (dominio sin verificar, key inválida). | Baja | Alto: la recuperación de contraseña sigue caída en producción. | Comprobación manual tras el desplegar (Q4, la recuerda el orquestador en el cierre). Si vuelve a fallar, el log nuevo (REQ-004) muestra el motivo real sin tener que reproducirlo. |
| El `FakeOpener` evita el `OpenerDirector` real, así que los tests no prueban que urllib no añada un segundo `User-Agent`. | Baja | Medio | El comportamiento de urllib está documentado: `do_request_` solo añade `addheaders` si `not request.has_header(name)`. Lo cubre la verificación manual en producción. Si se quiere, el reviewer puede pedir una prueba adicional con un `OpenerDirector` y un handler falso, sin red. |
| AC-004.2 da un falso negativo porque el texto fijo del log contiene la letra `b`. | Media | Bajo | El formato propuesto, `"Resend respondió con HTTP %s: %s"`, no contiene `b`. El test-author puede afinar la aserción para comprobar que no aparece `"b"` dentro del fragmento del cuerpo, separándolo por `": "`. El implementer no debe añadir al mensaje palabras con `b` (como `body`). |
| Leer el cuerpo de un `HTTPError` lanza una excepción, o el cuerpo es enorme o binario. | Baja | Medio | Lectura limitada a 4096 bytes dentro de un `try`, y `errors="replace"`. Siempre se lanza `EmailSendError` (AC-004.5). |
| La API key llega al log en un cuerpo de error (por ejemplo, un 401 que repite la key). | Baja | Alto | Se redacta la key sobre el texto completo **antes** de recortar (AC-004.3). |

## 7. Cumplimiento de la constitución
- **Art. 4 (trazabilidad):** los 14 AC tienen un test asignado en la sección 5, y cada test lleva su marcador `# SDD:`.
- **Art. 5.4:**
  - los tests unitarios aíslan la red con un `FakeOpener` escrito a mano e inyectado por constructor, sin `unittest.mock` ni `monkeypatch`;
  - el test de integración sustituye el transporte del singleton, igual que el patrón `fail_with` actual;
  - ningún test llama a Resend.
  - los tests unitarios de `utils/` van en `test_services/`, que es la carpeta de unitarios que fija el artículo.
- **Art. 6.1 y 6.2:** no se tocan capas, y las dependencias nuevas (`opener` y `logger`) se inyectan por constructor con valores por defecto de producción.
- **Art. 6.3:** sin cambios. `EmailSendError` sigue siendo una excepción interna del transporte, que `PasswordResetService` traduce a `ServiceUnavailableError`.
- **Art. 6.4:** no hay cambios de modelo, así que no hace falta migración.
- **Art. 6.5:** el código nuevo debe pasar `ruff-new.mjs` sin violaciones nuevas.
- **Art. 7.1:** no hay variables nuevas ni secretos, y no cambia ningún `.env.example`.
- **Art. 7.4:** el fallo del proveedor sigue saliendo como 503 genérico, y el cuerpo de error solo va al log del servidor.
- **Art. 6.11:** los comentarios y mensajes nuevos van en español; el log no lo ve el usuario.
- **"DEBERÍA" incumplidos:** ninguno.

## 8. ADRs
Ninguna. El cambio aplica la ADR-0014 (Resend por HTTP con `urllib`, sin SDK) sin contradecirla. Inyectar `opener` y `logger` en el transporte es un detalle de testabilidad local que no merece ADR propia.

## Comentarios del usuario
Gate de plan, iteración 1 (2026-10-06). Copiado literalmente por el orquestador, respondiendo a "1. ¿Aceptas por adelantado que el red check marque en verde los tests de regresión? 2. ¿Apruebas cerrar la etapa plan? 3. ¿Apruebas el commit?":

> 1,2,3: Si

Por tanto, en el red check, los tests de regresión de la sección 5 ("Tests que pasarán ya en verde": AC-002.x, AC-003.x, AC-004.3, AC-004.4 y AC-004.6) pueden pasar en verde sin implementación: el usuario lo acepta. Los demás tests nuevos (AC-001.x, AC-004.1, AC-004.2 y AC-004.5) sí deben fallar por comportamiento ausente.
