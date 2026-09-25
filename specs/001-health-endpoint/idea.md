# Idea original · 001-health-endpoint

- **Fecha:** 2026-09-25
- **Autor:** usuario (vía `/sdd-new`)

Endpoint GET /api/health en el backend que responda 200 {"status":"ok","database":"ok"} cuando Postgres responde, y 503 cuando la base de datos no responde. Es la prueba en seco de backend del harness: usar NNN=001 y crear la rama desde chore/sdd-harness.
