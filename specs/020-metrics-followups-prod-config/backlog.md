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

## review · reviewer
- [ ] F1 (MENOR, implementer): en `PhysicalDataForm.tsx:176`, guardar un cambio sin medición quita el aviso de relectura sin releer, en contra de lo que dice el plan en §3.4.
- [ ] F2 (MENOR, implementer): en `PhysicalDataForm.tsx:218-224`, «Reintentar» hace `form.reset` con los valores guardados antes y descarta lo que el usuario editó después sin guardar.
- [ ] F3 (MENOR, test-author): en `backend/tests/conftest.py:195-236`, el bloque se escribió con un heredoc de shell (Art. B2.4). La copia de trabajo queda con finales de línea mixtos (CRLF y LF); el índice guarda LF. Para no repetirlo, el test-author debe usar Write o Edit.
- [ ] F4 (NIT, test-author): el marcador de `BodyMetricsPage.sync.test.tsx:209` dice `NFR-002 AC-004.1` y debería decir `REQ-004 AC-004.1`.
- [ ] F5 (NIT, test-author): `round1` de `fakeMetricsServer.ts` redondea en binario, mientras el servidor usa `Decimal` half-up; pueden divergir en valores frontera.
- [ ] F6 (NIT, test-author): `app_clock` no es autouse, y `make_app` solo repone `email_sender`, no los demás singletons.
- [ ] F7 (NIT, planner): si el usuario la acepta en el gate, pasar la ADR-0028 a «Aceptada» en la ADR y en el índice de `docs/sdd/decisions/README.md`.
- [ ] F8 (NIT, implementer): `auth_service`, `body_metric_service` y `progress_analysis_service` deberían importar `utc_now` de `utils.clock`, no del reexporte de `profile_service`.
- [ ] Etapa docs (Art. P4): documentar en `docs/deploy-runbook.md` y `CLAUDE.md` el paso manual: antes del merge, comprobar que el `backend/.env` de EC2 tiene `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev`; si falta, la app no arranca.

## tests (correcciones de review) · test-author
- [ ] Los tests nuevos de F1 y F2 (`PhysicalDataForm.refresh-edge.test.tsx`) llevan los marcadores `AC-002.5` y `AC-002.6` por afinidad temática, porque F1 y F2 no tienen AC propio en la spec; la trazabilidad es aproximada.
- [ ] F1 y F2 aplican el plan §3.4, la spec no fija el comportamiento exacto: F1 exige que sigan el aviso y «Reintentar» tras guardar solo la meta; F2 exige que se conserve el borrador del usuario tras «Reintentar».

## tests (red check de correcciones) · verifier
- [ ] Alinear los marcadores SDD de los tests F1 y F2 con un AC propio o dejarlos como casos fuera de spec.
- [ ] Normalizar a LF tres archivos de test que están en CRLF en la copia de trabajo (`test_auth_routes.py`, `test_body_metric_routes.py`, `MetricsHistory.test.tsx`), para evitar falsos diffs en otras herramientas.

## implement (correcciones de review) · implementer
- [ ] Con el aviso de relectura visible y una medición posterior a hoy, el aviso de fecha futura (spec 016) solo se calcula al reintentar correctamente.
- [ ] F2: tras «Reintentar» con ediciones sin guardar se conserva el borrador y `saved` pasa a los valores del guardado anterior, así que el formulario queda con cambios pendientes.
