# Informe de documentación: 010-progress-analysis-context

## Archivos actualizados

| Archivo | Motivo |
|---|---|
| `README.md` | Nueva viñeta "AI progress analysis" en "What it offers": el análisis usa perfil, indicadores y calorías, y muestra un ajuste de calorías calculado por el servidor. Sigue en ASCII/CRLF. |
| `CLAUDE.md` (solo `## Proyecto`) | Fila de métricas corporales: el análisis recibe el contexto, devuelve la sugerencia (spec 010, ADR-0021), responde 409 sin perfil y exige cuerpo. Sigue en UTF-8/CRLF. |

## No se tocó

- `.env.example`: la feature no añade variables de entorno.
- `docs/sdd/decisions/` (ADR-0021 y su índice): ya existen y están fuera del alcance del doc-keeper.
- `docs/sdd/00-discovery.md`: es una foto de septiembre de 2026.
- `frontend/README.md`: no cambia cómo correr, testear o desplegar.
- Despliegue en `CLAUDE.md`: sin migración ni pasos nuevos. La nota del runbook (F7 de la review) no está en el diff.
