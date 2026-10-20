# Reporte de documentación 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `CLAUDE.md` (sección Proyecto) | Fila nueva «Alimentos de USDA» en la tabla de áreas (`food_routes` / `foods`, endpoint, límites, búsqueda híbrida, pantalla `/foods`) y un «Paso previo al despliegue» para la 021 con el mismo estilo que los existentes | REQ-006, REQ-010, REQ-012 y diff (`routes/food_routes.py`, `scripts/import_usda_foods.py`, migración `c8e2a4f6b9d3`); ADR-0029 |
| `docs/deploy-runbook.md` | Sección nueva en el paso 5, «Caso B con importación de datos: 021», con volcado, migración, CD, descarga de CSV (carpeta anidada), copia a EC2, importación interactiva con confirmación [s/N], `--yes` solo no interactivo, aviso del túnel SSH (F8), `PYTHONIOENCODING=utf-8`, medición de `public.foods` (referencia 48 MB con 8.262 alimentos) y marcha atrás; la 021 añadida como ejemplo del caso B en la tabla del paso 1 | Backlog de la feature (plan, tasks y verify piden este runbook); REQ-001 y AC-001.8 a AC-001.12 |
| `README.md` | Viñeta «Food database» en «What it offers» (en inglés, como el resto) | Funcionalidad visible nueva (REQ-006, REQ-012) |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `backend/.env.example`, `frontend/.env.example` | La feature no añade variables de entorno (usa `VOYAGE_*`, Redis y la base ya existentes) |
| `frontend/README.md` | No describe pantallas ni rutas de la feature |
| `docs/sdd/decisions/ADR-0029-*.md` | Las ADR no son del doc-keeper (fuera de `paths.docs`): sigue «Propuesta» y su aceptación queda en el backlog |
| Tabla «Historial de despliegues» del runbook | La 021 aún no se ha desplegado; la fila se añade cuando se haga, con el tamaño real medido |
| `docs/backlog.md` y otros `docs/sdd/**` | Son artefactos SDD o del proyecto, no documentación de uso afectada |

## 3. Conclusión
Se actualizaron `CLAUDE.md` (sección Proyecto), `docs/deploy-runbook.md` y `README.md`. Los tres conservan su codificación y sus finales de línea CRLF (README.md es ASCII, compatible con UTF-8). La cifra de AC de la feature es 67.

## Comentarios del usuario
