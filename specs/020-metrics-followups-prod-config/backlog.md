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
