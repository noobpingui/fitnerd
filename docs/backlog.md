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
- [x] Prueba manual en navegador real de AC-011.3 y AC-011.4 (aviso de /login y botón atrás).
- [ ] NIT (implementer): `_ensure_link_is_usable` lee `self.clock()` en cada llamada en lugar de usar un solo `now`, como pide el plan §3.3 (password_reset_service.py:125,154).
- [ ] NIT (implementer): la comprobación de `user is None` llega después de tomar el FOR UPDATE; es inofensivo (password_reset_service.py:150-152).
- [x] ADR-0025 sigue por pasar a "Aceptada" (el usuario la aprobó en la review; las ADRs no son del doc-keeper).
- [x] La fila "pendiente" del historial del runbook hay que completarla (PR, fecha y volcado) tras el despliegue.

## 015-onboarding-profile-rhf · Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod (2026-10-16)

Feature: [specs/015-onboarding-profile-rhf/](../specs/015-onboarding-profile-rhf/)

- [ ] Mensaje específico para las pulgadas fuera de rango en el perfil (p. ej. "Entre 0 y 11 in").
- [ ] Valorar un test de escaneo del código (como `sourceCleanup013`) que impida reintroducir `validation.ts` o `useState` en estos formularios.
- [ ] Si más formularios necesitan errores visibles desde la carga, documentar el patrón de `fieldMessages` síncrono en un ADR.
- [ ] Mediciones con fecha pasada desde el perfil (fuera de alcance de la spec).
- [ ] Los tests nuevos de `OnboardingPage.test.tsx` repiten algunas pruebas de fecha que ya existen con el marcador 006 (por ejemplo, la fecha prerrellenada de 1900). Se pueden simplificar cuando se cierre la feature.
- [ ] Los tests de fecha de `ProfilePage.test.tsx` (reglas de validación de la 015) comprueban 14 y 100 años con `fireEvent.change` sobre el `input type=date`. Un test de integración con un navegador real sería más fiel, pero queda fuera de Vitest.
- [ ] Warnings previos `only-export-components` en components/ui/form.tsx:159 y components/ui/button.tsx:64 (no tocados por la feature).
- [x] Hay un archivo sin trackear `.claudecodeignore` en la raíz del repo que no creó esta feature; decidir si se versiona, se añade a .gitignore o se borra.
- [ ] Valorar mover inRange a una utilidad compartida en src/lib (hoy body-metrics la importa de onboarding/schemas, que la documenta como regla del onboarding).
