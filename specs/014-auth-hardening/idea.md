# Idea original · 014-auth-hardening

2026-10-16T01:36:04.972Z

Endurecer la autenticación: token de reset de un solo uso atómico (002 F3), limpiar el aviso de /login tras mostrarlo (002 F7), normalizar el email a minúsculas en registro/login/reset, reglas de contraseña del registro iguales a las del reset (8 caracteres mínimo, 72 bytes UTF-8 máximo, validadas también en el backend) y escapar los caracteres de control en el log de errores de Resend (003 F1).
