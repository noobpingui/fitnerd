# Idea original · 018-auth-robustness

Fecha: 2026-10-18T19:37:18.600Z

Endurecer /register y /login: responder 400 ante cuerpo no JSON o date_of_birth ausente, validar en servidor nombre, apellido y fecha de nacimiento del registro, traducir al español "Wrong Credentials" y "Email already registered"; opcional: NITs de password_reset_service (un solo now, user is None antes del FOR UPDATE)
