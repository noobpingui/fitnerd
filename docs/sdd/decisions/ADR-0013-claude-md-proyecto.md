# ADR-0013: sección "Proyecto" en `CLAUDE.md`, mantenida por el `doc-keeper`

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario, a propuesta de Claude, tras hacer el merge del harness en `main` (PR #1)

## Contexto
`CLAUDE.md` es lo único que Claude Code carga automáticamente en cada sesión, en la sesión principal y en los subagentes. Hasta ahora describía casi solo el harness SDD. Una sesión nueva no sabía qué es fitnerd, cuáles son sus áreas, cómo se despliega ni cuáles son sus puntos delicados, así que tenía que deducirlo leyendo el código, con coste y riesgo de error.

Además, la información de proyecto se queda desactualizada con cada feature, y la ADR-0011 impedía al `doc-keeper` tocar `CLAUDE.md`.

## Decisión
- `CLAUDE.md` tiene un solo archivo, con cuatro secciones:
  1. **Proyecto:** qué es la app, áreas funcionales (backend y frontend), arquitectura, despliegue, entorno local, comandos y puntos delicados.
  2. **SDD.**
  3. **Aprobación humana.**
  4. **Convenciones.**
- No se usan varios `CLAUDE.md` ni imports con `@` por ahora. Se podrán añadir `backend/CLAUDE.md` y `frontend/CLAUDE.md` si las convenciones de cada capa crecen.
- El `doc-keeper` puede editar `CLAUDE.md`, pero **solo la sección `## Proyecto`**, en la etapa `docs` y cuando la feature lo haga necesario.
  - El hook permite el archivo completo, porque no puede validar secciones.
  - La restricción por sección está en su prompt, y la revisa el usuario en la pausa de aprobación de `docs`.
- Las secciones SDD, Aprobación y Convenciones solo cambian mediante un ADR.

## Consecuencias
- (+) Cada sesión nueva arranca con el contexto del proyecto, y ese contexto se mantiene al día con cada feature.
- (−) Que el `doc-keeper` respete la sección depende de su prompt y de tu revisión en la pausa de `docs`. Una mejora posible es un hook que compare las secciones protegidas antes y después de la edición.
