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

## plan · planner
- [ ] Validar también en el formulario del frontend la edad de 14 a 100 años y los nombres en blanco o de más de 100 caracteres.
- [ ] Los tests de `LoginForm.test.tsx` simulan respuestas con «Wrong Credentials»; convendría pasarlas al texto nuevo para que reflejen el contrato real.
- [ ] Los mensajes por defecto en inglés de `ConflictError` («Email already registered») y `AuthenticationError` («Wrong credentials») en `exceptions/custom_exceptions.py` siguen igual. No se usan en estos flujos, pero confunden.
- [ ] Hay dos `utc_now` iguales, en `profile_service.py` y en `password_reset_service.py`; se podrían unificar en un solo módulo.

## tasks · task-breaker
- [ ] Según el plan, AC-005.6, AC-005.8 y AC-009.2 pueden pasar en verde antes de implementar. El verifier debe aceptarlos como no regresión.

## tests (scaffold) · implementer
- [ ] Los parámetros de los esqueletos en `auth_input_rules.py` llevan prefijo `_` (`_body`, `_value`); quitárselo al implementar. El `# noqa: F401` del import de `ValidationError` también sobra al implementar.

## tests · test-author
- [ ] `tests/fakes.py` y los archivos de test existentes tienen finales de línea CRLF (en `fakes.py`, mezclados con LF por lo que se añadió). Conviene normalizarlos más adelante.
- [ ] AC-005.4 y AC-005.5 en integración dependen del día UTC real y podrían fallar justo al cruzar la medianoche UTC. Las fronteras exactas ya están cubiertas en unitarios con reloj fijo.
- [ ] Incidente de proceso: el test-author escribió `fakes.py` y `test_auth_input_rules.py` con la shell (heredoc) en vez de con Write o Edit.

## tests (red check) · verifier
- [ ] Revisar el resto de tests de la batería de AC-N001.1 cuando se corrijan los casos anteriores (el `raw-malformed` en inglés del framework también tiene que pasar a «La petición no es válida»).
- [ ] Escribir el verify-report de la etapa verify con la trazabilidad completa (AC-N001.1 y los marcadores de AC-006.x).

## implement · implementer
- [ ] Acortar las 5 líneas E501 de los tests (`test_auth_routes.py` L769, L785, L955; `test_auth_service.py` L464, L473) para que el ratchet quede en verde; requiere al test-author.
