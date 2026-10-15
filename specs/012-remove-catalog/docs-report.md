# Docs report 012-remove-catalog

## Archivos actualizados

| Archivo | Cambio | Motivo |
|---|---|---|
| `README.md` | Quita el catálogo, los favoritos y el plan semanal de "What problem does it solve" y "What it offers"; quita `exercises` del ejemplo de carpetas por feature; añade un párrafo en "Running it locally" con la retirada, la migración `f2c4e6a8b0d1`, la copia de seguridad completa previa (fuera del repo, `C:/Users/alber/fitnerd-backups`) y el `flask db upgrade` manual en EC2 | Alcance de la spec: documentar la retirada y los pasos de despliegue. Codificación comprobada: ASCII con CRLF, sin cambios |
| `CLAUDE.md` (solo `## Proyecto`) | Quita las filas "Catálogo de ejercicios" y "Favoritos y plan semanal" de las áreas funcionales; añade el paso previo al despliegue (copia completa, migración, rol admin conservado) | ADR-0013. Codificación comprobada: UTF-8 con CRLF, sin cambios |

## No se tocó

- `frontend/README.md`: no menciona las funciones retiradas.
- `.env.example` (los tres): la feature no añade ni cambia variables de entorno.
- `docs/sdd/00-discovery.md`: es una foto de septiembre de 2026; no se reescribe el historial.
- `docs/sdd/decisions/**`: fuera de mi alcance; la spec no genera ADR.
- Otras secciones de `CLAUDE.md`: solo cambian mediante ADR.
