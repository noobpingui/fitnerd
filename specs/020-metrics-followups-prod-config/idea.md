# Idea original · 020-metrics-followups-prod-config

Fecha: 2026-10-18T22:13:38.226Z

Seguimiento de métricas corporales y configuración de producción. (A) Métricas: mostrar un error o reintento si falla la relectura de mediciones o del perfil tras registrar una medición (hoy no se vería el aviso de REQ-009 de la 016); desplegar el Historial ("Mostrar más") hasta la medición recién registrada; test de extremo a extremo de la sincronización del peso del perfil; reloj configurable inyectable en los tests de rutas. (B) Producción: ProductionConfig no debe heredar FRONTEND_BASE_URL=http://localhost:5173; debe fallar al arrancar si falta (backend/config.py:61); y un test que ejecute ResendTransport y EmailSender.init_app.
