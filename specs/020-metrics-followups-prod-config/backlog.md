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
