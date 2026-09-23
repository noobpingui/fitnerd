# ADR-0011 — Agente `doc-keeper` y etapa `docs`

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario. Claude recomendaba no añadirlo; el usuario lo pidió.

## Contexto
Al terminar una feature suele quedar documentación desactualizada: el README (cómo correr el proyecto o qué ofrece la app), los `.env.example` cuando hay variables nuevas, o `docs/`. Ninguno de los 7 roles originales se encarga de esto.

## Decisión
- Se añade el agente `doc-keeper` (modelo `sonnet`) y la etapa `docs`, que va **después de `review` y antes de `close`**, con su propio gate humano.
- **Entradas:** `spec.md`, `plan.md`, `review.md` y el diff de la rama respecto a `main`.
- **Rutas en las que puede escribir:**
  - `README.md` y `frontend/README.md`;
  - los `.env.example` (raíz, `backend/` y `frontend/`);
  - `docs/**`, **excepto** `docs/sdd/decisions/`;
  - `specs/NNN-slug/docs-report.md`.
- **Qué NO puede tocar:** código de producción, tests, spec, plan, tasks ni la constitución.
- Si no hay nada que actualizar, escribe `docs-report.md` indicando "sin cambios necesarios" y el motivo.
- Conserva la codificación original de cada archivo. El README tuvo un problema histórico de UTF-16, así que la verifica antes y después de editar.

## Consecuencias
- (+) La documentación queda sincronizada con cada feature, y la definición de "hecho" (constitución, Art. 9) lo exige.
- (−) Añade una etapa y una pausa más por feature (9 en total).
