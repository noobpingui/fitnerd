# Docs report 004 — Observabilidad del coach con Langfuse

## Archivos actualizados

| Archivo | Motivo |
|---|---|
| `README.md` | Nuevo paso 6 "Observability" en la sección "The AI Coach": trazas a Langfuse Cloud, activación solo con las dos claves, envío en segundo plano, sin efecto sobre la respuesta, usuario solo por ID interno. Codificación verificada (ASCII, CRLF, sin cambios). |
| `CLAUDE.md` (solo `## Proyecto`) | Fila del coach con las trazas en Langfuse (ADR-0017) y nota de despliegue con las variables opcionales `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` y el paso manual de precios del modelo. Otras secciones intactas. |

## No tocado

- `backend/.env.example`: la feature ya añadió las tres variables (UTF-8 verificado).
- `frontend/README.md`, `frontend/.env.example`, `.env.example` raíz: sin cambios de frontend ni de variables.
- `docs/`: no hay documentación técnica del coach fuera de `docs/sdd/00-discovery.md` (foto histórica) y `docs/sdd/decisions/` (ADR-0017 ya existe, fuera de mi alcance).
- Sección "Running it locally" del README: no cambia cómo correr o testear.

## Backlog (review.md, pendiente de decisión del usuario)

- F3: test de ruta para AC-N001.1 (privacidad), a cargo del test-author.
- F4: import perezoso de `langfuse` en la primera pregunta y aviso repetido si falla la fábrica, a cargo del planner.
