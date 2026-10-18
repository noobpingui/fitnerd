# Backlog · 018-auth-robustness

## spec · spec-writer
- [ ] Validación en el cliente de la edad (14-100) y de los nombres en blanco en RegisterForm.
- [ ] /api/auth/google: cuerpo no JSON y mensajes «Invalid Google token» y «Google email not verified» en inglés (si se confirma Q5).
- [ ] Otros mensajes de autenticación en inglés (/me, token ausente o caducado).
- [ ] NIT: comprobar `user is None` antes de tomar el FOR UPDATE en password_reset_service (si se confirma Q6).

## spec (cierre tras respuestas) · spec-writer
- [ ] /api/auth/google: responder a cuerpos no JSON y traducir al español «Invalid Google token» y «Google email not verified» (Q5).
- [ ] Restablecimiento de contraseña: comprobar que el usuario del enlace existe antes de bloquearlo; es un NIT de la review de la spec 014, sin efecto observable (Q6).
- [ ] Otros mensajes de autenticación que siguen en inglés (/me, token ausente o caducado).
