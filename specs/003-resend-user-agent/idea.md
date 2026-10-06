# Idea original · 003-resend-user-agent

Fecha: 2026-10-06

El envío de correos con Resend falla en producción con HTTP 403 (Cloudflare error 1010) porque urllib usa su User-Agent por defecto. ResendTransport debe enviar un User-Agent propio para que Resend acepte la petición.
