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

## verify · verifier
- [ ] Antes de desplegar, la migración a7d3f9c1e5b2 (correos a minúsculas, falla con RuntimeError ante conflictos) necesita `flask db upgrade` en la instancia y su paso documentado en docs/deploy-runbook.md (Art. P4).

## review · reviewer
- [ ] F1 (MENOR, implementer): en AC-010.3, el mensaje que recibe la petición "corta" simultánea depende del orden de la cola del `FOR UPDATE`. Si la válida llega antes, recibe "enlace no válido" en vez del mensaje de mínimo de 8 caracteres. El test pasó 20 de 20 veces, pero solo porque el primer hilo suele llegar antes a Postgres. Arreglo posible: validar enlace y contraseña con una lectura sin bloqueo y después releer con `FOR UPDATE` y revalidar el enlace.
- [ ] F2 (MENOR, test-author): hay docstrings, comentarios y nombres de tests nuevos sin tildes (contrasena, peticion, linea, envia…), lo que incumple Art. P1.2 y P2 general.
- [ ] F3 (NIT, implementer): en `_NAMED_ESCAPES` de `email_sender.py`, las claves de U+2028 y U+2029 son caracteres literales invisibles; mejor escribirlas como `"\u2028"` y `"\u2029"`.
- [ ] F4 (NIT, test-author): `concurrent_resets` ignora el resultado de `wait_until`; conviene añadir un `assert` sobre él.
- [ ] F5 (NIT, spec-writer): `registerSchema.email` no recorta los espacios, así que el formulario rechaza un correo con espacios que el servidor ya acepta.
- [ ] Etapa docs: documentar en `docs/deploy-runbook.md` el volcado previo y el `flask db upgrade` de la migración `a7d3f9c1e5b2` (Art. P4).
- [ ] Etapa docs: pasar ADR-0025 a "Aceptada" si el usuario la aprueba en el gate.

## plan (iteración 2) · planner
- [ ] Tildes en textos de tests anteriores a la spec 014 (p. ej. test_password_reset_service.py, docstring de FakePasswordResetRepository).
- [ ] Recortar los espacios de los correos ya guardados (la migración solo pasa a minúsculas).
- [ ] Contraseñas antiguas de más de 72 bytes dejan de entrar en el login (REQ-009); se recuperan con el restablecimiento.
- [ ] Documentar en docs/deploy-runbook.md el paso manual de la migración a7d3f9c1e5b2 (etapa docs, Art. P4).

## tasks (iteración 2) · task-breaker
- [ ] Las tildes pendientes en textos anteriores a la 014, por ejemplo el docstring de `FakePasswordResetRepository`, no se tocan. El plan ya los manda al backlog.
