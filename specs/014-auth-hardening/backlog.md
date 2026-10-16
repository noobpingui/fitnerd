# Backlog · 014-auth-hardening

## spec · spec-writer
- [ ] Traducir al español los mensajes "Wrong Credentials" y "Email already registered".
- [ ] Validar en el servidor el nombre, el apellido y la fecha de nacimiento del registro, y responder bien a un cuerpo que no sea JSON.
- [ ] En la tabla de solicitudes de restablecimiento puede haber filas antiguas con correos en mayúsculas; no se tocan porque solo cuentan para el límite de 2 minutos.

## plan · planner
- [ ] Recortar los espacios de los correos ya guardados (la migración solo los pasa a minúsculas).
- [ ] Índice único funcional o CHECK `email = lower(email)` como garantía en la base una vez migrados los datos.
- [ ] Un cuerpo que no sea JSON en `/register` y `/login` (`request.get_json()` devuelve None) y un `date_of_birth` ausente siguen dando 500 (fuera de alcance según la spec).
- [ ] Las contraseñas antiguas de más de 72 bytes, truncadas por el bcrypt antiguo, ya no pueden entrar con login (401) y tendrán que restablecerse.
- [ ] Documentar en `docs/deploy-runbook.md` el volcado previo y el `flask db upgrade` de esta migración (tarea del doc-keeper, Art. P4).

## tasks · task-breaker
- [ ] Los correos guardados con espacios no se recortan en la migración, porque la spec solo pide minúsculas.
- [ ] Las contraseñas antiguas de más de 72 bytes dejan de entrar en el login (REQ-009) y se recuperan con el restablecimiento.
- [ ] Los mensajes del registro y el login siguen en inglés (`Wrong Credentials`, `Email already registered`), fuera del alcance de la spec.

## tests · test-author
- [ ] Opcional: unitarios directos de `escape_log_text` más allá del que ya hay.
- [ ] Pendiente de la implementación (hoy sin esqueleto): el test de migración depende de que T-036 cree `a7d3f9c1e5b2_lowercase_user_emails.py` con `down_revision = 'f2c4e6a8b0d1'`.
- [ ] El test de concurrencia necesita Postgres y un pool con al menos 4 conexiones (el valor por defecto de SQLAlchemy basta).

## implement · implementer
- [ ] Los correos guardados con espacios no se recortan en la migración (la spec solo pide minúsculas).
- [ ] Las contraseñas antiguas de más de 72 bytes dejan de poder entrar. Se recuperan con el restablecimiento.
- [ ] `lower()` de Postgres y `str.lower()` de Python difieren en letras no ASCII (anotado en ADR-0025).
- [ ] 6 líneas largas (E501) en los tests de la feature hacen fallar el ratchet de backend.
