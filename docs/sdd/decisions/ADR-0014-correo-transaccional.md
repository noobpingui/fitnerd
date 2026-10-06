# ADR-0014: correo transaccional con Resend detrás de un `EmailSender` con transportes configurables

- **Estado:** Aceptada · 2026-10-05
- **Decidido por:** planner de la feature `002-forgot-password`; el usuario confirmó Resend en el gate de plan (iteración 1, 2026-10-05)

## Contexto
Hasta la feature 002 la app no enviaba ningún correo. La recuperación de contraseña necesita enviar un correo en el momento, desde `no-reply@fitnerd.betofallas.dev` con el nombre "fitnerd" (spec 002, Q1), y la spec dejó la elección del proveedor al plan.

Restricciones:
- La constitución (Art. 5.4) prohíbe que los tests llamen a servicios externos reales y desaconseja `unittest.mock` y `monkeypatch`.
- Las rutas construyen los servicios en `_build_*_service()` a partir de singletons de `extensions.py`, así que los tests de integración de rutas no pueden inyectar un doble por constructor.
- `requirements.txt` ya mezcla muchas dependencias. Mejor no añadir más si no hace falta.

Alternativas evaluadas:
- **AWS SES** (vía `boto3`, que ya está instalado): obliga a pedir la salida del *sandbox* (revisión manual de AWS) y a gestionar credenciales IAM en la instancia EC2.
- **SMTP genérico** (`smtplib`): depende de un servidor SMTP de terceros y de los puertos de salida de EC2, que AWS restringe por defecto en el 25.
- **Resend** (API HTTP con un único `POST`): alta inmediata, plan gratuito suficiente para el volumen de un portfolio, y verificación del dominio con registros DNS (SPF y DKIM).

## Decisión
- El proveedor es **Resend**. Se usa su API HTTP (`POST https://api.resend.com/emails`) con `urllib.request` de la librería estándar, **sin SDK nuevo** ni dependencias nuevas.
- Se añade `backend/utils/email_sender.py` con:
  - un singleton `EmailSender` en `extensions.py` (`email_sender`), con `init_app(app)` y `send(to, subject, text, html)`. Mismo patrón que `RateLimiter` y `EmbeddingClient`;
  - tres transportes, que se eligen con la variable `MAIL_BACKEND`:
    - `resend`: envío real;
    - `console`: escribe el correo en el log (desarrollo local, sin cuenta en Resend);
    - `memory`: guarda los correos en una lista `outbox` y puede simular un fallo con `fail_with`.
- Los servicios reciben el `EmailSender` **por constructor** (Art. 6.2), y los tests unitarios usan un `FakeEmailSender` de `tests/fakes.py`.
- `TestingConfig` fija `MAIL_BACKEND = "memory"` en el código, sin leer la variable de entorno, para que ningún test pueda enviar un correo real aunque el `.env` local tenga una API key.
- `ProductionConfig` usa `resend` por defecto. Desarrollo usa `console` por defecto.
- Variables nuevas: `MAIL_BACKEND`, `RESEND_API_KEY`, `MAIL_FROM` (por defecto `fitnerd <no-reply@fitnerd.betofallas.dev>`) y `FRONTEND_BASE_URL` (para construir enlaces hacia la app pública).

## Consecuencias
- (+) Cambiar de proveedor solo exige escribir otro transporte con el mismo método `send`, sin tocar los servicios.
- (+) Los tests de integración comprueban los correos enviados (destinatario, contenido y token) sin red y sin `monkeypatch`.
- (−) El transporte `memory` es un doble de pruebas que vive en código de producción. Se acepta, igual que el *backend* `locmem` de Django, porque solo se activa por configuración y no tiene efectos fuera del proceso.
- (−) Requiere trabajo operativo fuera del repositorio: crear la cuenta de Resend, verificar el dominio `fitnerd.betofallas.dev` en el DNS y poner `RESEND_API_KEY`, `MAIL_BACKEND=resend` y `FRONTEND_BASE_URL` en `backend/.env` de la instancia EC2.
- (−) El envío es síncrono dentro de la petición HTTP (la spec exige enviar antes de responder). Un proveedor lento alarga la respuesta hasta el *timeout* del transporte (10 s).
