# Review 003 — User-Agent propio en el envío de correos con Resend

- **Iteración:** 1 de 3
- **Commit / diff revisado:** `git diff main...fix/003-resend-user-agent` @ `41fdbc0` (los cambios sin commitear son solo `state.json` y `verify-report.md`)
- **Veredicto:** APPROVED

## 1. Resumen
El fix añade a `ResendTransport` la cabecera fija `User-Agent: fitnerd/1.0 (+https://fitnerd.betofallas.dev)` y, ante un `HTTPError`, registra con `logger.warning` el código y el cuerpo de la respuesta, con la API key redactada y recortado a 200 caracteres. El mensaje de `EmailSendError` y el 503 al usuario no cambian. `opener` y `logger` se inyectan por constructor, con los valores de producción por defecto. El cambio es pequeño, está bien acotado y sigue el plan al pie de la letra. No hay hallazgos bloqueantes ni mayores.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `backend/utils/email_sender.py:43` (constante) y `:83` (cabecera); `test_email_sender.py:37` |
| AC-001.2 | Sí | `email_sender.py:83`; `test_email_sender.py:47`. Lo comprobé además con un `OpenerDirector` real y un handler falso sin red: urllib conserva una única cabecera `User-agent` con el valor de fitnerd y no añade `Python-urllib` |
| AC-001.3 | Sí | La constante de clase es la misma en cada envío (`email_sender.py:43`, `:83`); `test_email_sender.py:59` |
| AC-002.1 | Sí | `email_sender.py:76-85` (URL, `POST`, `Authorization` y `Content-Type` sin cambios); `test_email_sender.py:72` |
| AC-002.2 | Sí | `email_sender.py:69-75` (cuerpo sin cambios); `test_email_sender.py:86` |
| AC-003.1 | Sí | `email_sender.py:92`; `test_email_sender.py:102` |
| AC-003.2 | Sí | `email_sender.py:93-94`; `test_email_sender.py:114` |
| AC-003.3 | Sí | `email_sender.py:66-67` (sale antes de construir la petición); `test_email_sender.py:125` |
| AC-004.1 | Sí | `email_sender.py:90-91`; `test_email_sender.py:136` |
| AC-004.2 | Sí | `email_sender.py:63` (`ERROR_BODY_MAX_CHARS = 200`, `:44`); `test_email_sender.py:147` |
| AC-004.3 | Sí | `email_sender.py:61-63`: redacta antes de recortar, así que tampoco queda un prefijo de la key; `test_email_sender.py:163` |
| AC-004.4 | Sí | `email_sender.py:92`: el mensaje no interpola el snippet; `test_email_sender.py:175` |
| AC-004.5 | Sí | `email_sender.py:55-59` (la lectura va en un `try`, así que el cuerpo vacío o ilegible no cambia la excepción); `test_email_sender.py:186` |
| AC-004.6 | Sí | `PasswordResetService` no cambia y sigue traduciendo el fallo a un 503 genérico; `test_password_reset_routes.py:521` |

## 3. Cumplimiento del plan
- La implementación coincide con la sección 3.3 del plan: la constante, la cabecera, `opener` y `logger` inyectables, `_error_snippet` con un límite de 4096 bytes, `errors="replace"`, redactar antes de recortar, el formato del log sin la letra `b` e `init_app` con `logger=app.logger`.
- **Desviación 1 (justificada):** `FakeOpener` y `FakeLogger` están en `tests/fakes.py` y no locales al archivo. El plan, en la sección 5, deja esa decisión al test-author, y los dos fakes se usan en dos archivos.
- **Desviación 2 (justificada):** el scaffold T-000 ya hacía que `send()` usara `self.opener`, cosa que va más allá de un esqueleto puro (Art. 5.7). El usuario lo aprobó (opción A, en "Comentarios del usuario" de `tasks.md`) para que el red check no hiciera peticiones reales a Resend (Art. 5.4).

## 4. Checklist de la constitución
- [x] **Art. 2:** cada agente se mantuvo en su rol. Los SHA-256 de `tests_snapshot` coinciden con los tres archivos actuales (`fakes.py`, `test_email_sender.py` y `test_password_reset_routes.py`). Además, `git diff 4f7dd5c HEAD` solo toca `backend/utils/email_sender.py`, `state.json` y `tasks.md`, ningún test.
- [x] **Art. 4:** los 14 marcadores `# SDD:` corresponden al AC que prueba cada test.
- [x] **Art. 5:** no se borró, saltó ni debilitó ningún test. Se usan fakes escritos a mano e inyectados por constructor, sin `mock` ni `monkeypatch`, y nada llama a la red. Los 42 tests de los dos archivos tocados pasan, y el verifier reporta la suite completa en verde (129).
- [x] **Art. 6:** las capas se respetan, porque el cambio queda dentro de `utils/` y las dependencias se inyectan por constructor. `EmailSendError` se sigue traduciendo a `ServiceUnavailableError` en el servicio. No toca el frontend. Ruff no encuentra violaciones nuevas (`ruff-new.mjs` OK).
- [x] **Art. 6.4:** no hay cambios de modelo, así que no hace falta migración.
- [x] **Art. 7:** no hay secretos ni variables nuevas. La API key no aparece en la excepción ni en el log, y el cuerpo de error no llega al usuario. No hay endpoints nuevos.
- [x] **Art. 6.11:** no hay textos nuevos visibles para el usuario. El mensaje de log está en español y con tildes.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | NIT | `backend/utils/email_sender.py:63,91` | El snippet se registra tal cual, así que si el cuerpo de error trae saltos de línea o caracteres de control, la entrada de log se parte en varias líneas, lo que permite falsificar entradas (log injection). Por ejemplo, un cuerpo `"x\nFAKE LOG LINE"` produce dos líneas. Sugerencia opcional: registrar con `%r` o sustituir `\r`/`\n` antes de recortar. La spec no lo exige y el riesgo es bajo, porque el cuerpo viene de Resend o Cloudflare. | implementer |
| F2 | NIT | `backend/tests/fakes.py:86,97,122`; `backend/tests/test_services/test_email_sender.py:1,38,103,126,137,158,187`; `backend/tests/test_routes/test_password_reset_routes.py:522` | Los docstrings y comentarios nuevos no llevan tildes: "exito", "vacio", "segun", "configuracion", "aisla", "peticion", "codigo", "generico", "envios", "conexion". Es coherente con el estilo ASCII que ya tenía `fakes.py`, y no es texto visible para el usuario, pero CLAUDE.md pide español correcto en comentarios y docstrings. | test-author |
| F3 | NIT | `backend/tests/test_services/test_email_sender.py:47` | AC-001.2 se prueba con `FakeOpener`, que no pasa por el `OpenerDirector` real, así que el test no demostraría que urllib no añade un segundo `User-Agent`. Era un riesgo ya identificado en el plan (sección 6). Lo comprobé a mano con `build_opener` y un handler falso sin red: queda una única cabecera con el valor de fitnerd. Sugerencia opcional para el futuro: un test con `urllib.request.build_opener(FakeHandler())` como `opener`. | test-author |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES, y los tres NIT son opcionales. Sigue pendiente la comprobación manual en producción tras el despliegue (Q4), que el orquestador debe recordar en el cierre.

## Comentarios del usuario
Gate de review, iteración 1 (2026-10-06). Copiado literalmente por el orquestador:

> 1. Seguimos tus recomendaciones. 2. Si. 3. Si

Recomendaciones del orquestador que el usuario acepta:
- **F1** (log injection por saltos de línea en el snippet): se acepta; tarea futura (sustituir `\n`/`\r` y escapar caracteres de control antes de registrar).
- **F2** (tildes en docstrings y comentarios de tests): se acepta sin cambios.
- **F3** (AC-001.2 no pasa por el `OpenerDirector` real): se acepta; el reviewer lo comprobó a mano y la prueba en producción lo confirmará.
