# Informe de documentación — 008-metrics-from-profile

## Archivos actualizados

| Archivo | Motivo |
|---|---|
| `README.md` | En "What it offers", la línea de Body metrics tracking menciona una medición por día, historial editable/borrable y peso del perfil sincronizado. Sigue ASCII con CRLF. |
| `CLAUDE.md` (solo `## Proyecto`) | Fila de Métricas corporales: una medición por día, `PUT`/`DELETE /api/body-metrics/{id}`, historial y sincronización del peso del perfil (spec 008, ADR-0020), y aviso de que la migración consolida duplicados. Codificación sin cambios. |

## No se tocó

- `.env.example`: el diff no añade variables de entorno.
- `frontend/README.md`: no cambia cómo correr, testear ni desplegar.
- `docs/sdd/00-discovery.md`: foto de septiembre de 2026, no se reescribe.
- `docs/sdd/decisions/`: fuera de mi alcance (ADR-0020 ya lo escribió el planner).
- Pasos de despliegue en `CLAUDE.md`: ya dicen que las migraciones no se aplican solas, y esta feature añade una migración que hay que aplicar con `flask db upgrade`.
