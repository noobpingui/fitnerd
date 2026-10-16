# Backlog

## 014-auth-hardening · Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados (2026-10-16)

Feature: [specs/014-auth-hardening/](../specs/014-auth-hardening/)

- [ ] Traducir al español los mensajes "Wrong Credentials" y "Email already registered".
- [ ] Validar en el servidor el nombre, el apellido y la fecha de nacimiento del registro, y responder bien a un cuerpo que no sea JSON.
- [ ] En la tabla de solicitudes de restablecimiento puede haber filas antiguas con correos en mayúsculas; no se tocan porque solo cuentan para el límite de 2 minutos.
- [ ] Recortar los espacios de los correos ya guardados (la migración solo los pasa a minúsculas).
- [ ] Índice único funcional o CHECK `email = lower(email)` como garantía en la base una vez migrados los datos.
- [ ] Un cuerpo que no sea JSON en `/register` y `/login` (`request.get_json()` devuelve None) y un `date_of_birth` ausente siguen dando 500 (fuera de alcance según la spec).
- [ ] Las contraseñas antiguas de más de 72 bytes, truncadas por el bcrypt antiguo, ya no pueden entrar con login (401) y tendrán que restablecerse.
- [ ] Opcional: unitarios directos de `escape_log_text` más allá del que ya hay.
- [ ] `lower()` de Postgres y `str.lower()` de Python difieren en letras no ASCII (anotado en ADR-0025).
- [ ] Tildes en textos de tests anteriores a la spec 014 (p. ej. test_password_reset_service.py, docstring de FakePasswordResetRepository).
- [ ] Textos sin tilde anteriores a la 014 en los tests de autenticación y reset, y en los tests de `LoginForm` y `ForgotPasswordForm` ("exito", "peticion", "contrasena"...).
- [ ] Si el implementer cambia `type="email"` o añade `noValidate`, revisar `fireEvent.submit` en `RegisterForm.test.tsx`.
- [ ] Prueba manual en navegador real de AC-011.3 y AC-011.4 (aviso de /login y botón atrás).
- [ ] NIT (implementer): `_ensure_link_is_usable` lee `self.clock()` en cada llamada en lugar de usar un solo `now`, como pide el plan §3.3 (password_reset_service.py:125,154).
- [ ] NIT (implementer): la comprobación de `user is None` llega después de tomar el FOR UPDATE; es inofensivo (password_reset_service.py:150-152).
- [ ] ADR-0025 sigue por pasar a "Aceptada" (el usuario la aprobó en la review; las ADRs no son del doc-keeper).
- [ ] La fila "pendiente" del historial del runbook hay que completarla (PR, fecha y volcado) tras el despliegue.
