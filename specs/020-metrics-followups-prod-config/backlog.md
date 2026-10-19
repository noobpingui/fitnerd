# Backlog · 020-metrics-followups-prod-config

## spec · spec-writer
- [ ] Aviso de relectura al corregir o borrar (si se confirma Q1).
- [ ] Desplazar la pantalla o resaltar la fila nueva del Historial.
- [ ] Pruebas en navegador real (Playwright o similar).
- [ ] No arrancar la producción sin `RESEND_API_KEY` cuando `MAIL_BACKEND=resend`.
- [ ] Unificar `utc_now`, duplicado en varios servicios (NIT de la 018), si el plan no lo resuelve con REQ-005.
- [ ] Paso manual antes de desplegar: comprobar `FRONTEND_BASE_URL` en el `backend/.env` de EC2 (para el doc-keeper y el runbook).

## spec (iteración 2) · spec-writer
- [ ] Aviso de relectura fallida con «Reintentar» al corregir o borrar una medición (Q1).
- [ ] Desplazar la pantalla hasta la fila nueva del Historial o resaltarla (Q3).
- [ ] Pruebas en navegador real con el backend levantado, por ejemplo con Playwright (Q4).
- [ ] Que producción no arranque si `MAIL_BACKEND=resend` y falta `RESEND_API_KEY` (Q7).

## plan · planner
- [ ] Al registrar en lb, el peso del perfil puede variar en 0,1 lb respecto a lo escrito (160 lb pasa a 160,1) por el redondeo a 0,1 kg del envío.
- [ ] Avisos de relectura fallida al corregir o borrar una medición (Q1 de la spec).
- [ ] Desplazar la pantalla hasta la fila nueva del Historial o resaltarla (Q3).
- [ ] Pruebas en navegador real (Q4).
- [ ] Exigir `RESEND_API_KEY` al arrancar en producción con `MAIL_BACKEND=resend` (Q7).
- [ ] Validar `FRONTEND_BASE_URL` como URL completa (hoy basta con el prefijo `https://`).
- [ ] Con `isLoadingError`, un fallo de relectura en segundo plano que no viene de un registro ya no muestra ningún aviso en Métricas ni en el perfil; valorar un aviso general.

## tests (scaffold) · implementer
- Ninguno.

## tests · test-author
- [ ] Aviso para el implementer: los helpers de los tests de límites de fecha (`day()`, `today()` y `years_ago()`) siguen en uso por otros tests. No hay que borrarlos.
- [ ] `test_fixed_clock_routes.py` usa `X-Forwarded-For` fijo (203.0.113.50) en `forgot`. Si se añaden más tests de restablecimiento ahí, conviene una IP por test para evitar el límite de 3 por IP.
- [ ] Si el implementer añade el hook de relectura con reintentos reales en producción (3 reintentos), el aviso tarda unos segundos. Los tests usan `retry: false`, como dice el plan.
- [ ] El plan no pide stubs adicionales al implementer. La única dependencia de comportamiento es que `get_app_clock` devuelva `app.extensions[CLOCK_EXTENSION_KEY]` y que `install_clock` se llame en `create_app` antes de las extensiones.
- [ ] (decisión del test-author) El bloque de fixtures de `backend/tests/conftest.py` (`app_clock`, `make_app`) se escribió con un heredoc de shell, no con Write/Edit; el verifier debe revisar ese archivo. El plan pedía un fixture autouse `_reset_app_clock`; se sustituyó por `app_clock`, que hace `reset()` antes y después.

## tests (red check) · verifier
- [ ] `app_clock` no es autouse: un test que fije el reloj sin pedir el fixture lo dejaría fijado. Hoy todos los que lo fijan lo piden.

## implement · implementer
- [ ] E501 (102 > 100) en la línea 73 de `backend/tests/test_routes/test_fixed_clock_routes.py`, escrito por el test-author. Corregirlo en una iteración de tests o aceptarlo en la review para que el ratchet quede en 0.
- [ ] `conftest.py` se escribió con heredoc (anotado en el state). Revisarlo en la review.
- [ ] Paso manual antes del merge: comprobar que el `.env` de EC2 tiene `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev` (tarea del doc-keeper).
