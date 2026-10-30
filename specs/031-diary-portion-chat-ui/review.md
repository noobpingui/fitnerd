# Review 031 — Chat de porciones en el diario (frontend)

- **Iteración:** 2 de 5
- **Diff revisado:** `git diff main...feat/031-diary-portion-chat-ui` @ `5a9ca99`, con foco en `git diff 8126ff4 5a9ca99` (corrección de F2 y F3). Los cambios sin commitear (`state.json`, `verify-report.md`, `backlog.md` y este `review.md`) son solo artefactos del flujo.
- **Veredicto:** APPROVED

## 1. Resumen
La segunda iteración solo cambia dos archivos de producción: `hooks.ts`, donde `usePortionChat` desestructura `mutateAsync` y lo usa como dependencia del `useCallback` (F2), y el orden de imports en `hooks.ts` y `DiaryPage.tsx` (F3). No cambia el comportamiento, los tests no se han tocado (el snapshot es idéntico) y la suite de `features/diary` pasa (906 tests). Lo que se valoró en la iteración 1 sigue igual: todos los AC están implementados y los tests prueban el comportamiento.

## 2. Cumplimiento de la spec
Sin cambios respecto a la iteración 1: la tabla AC → evidencia de la review anterior sigue vigente. Las líneas de `hooks.ts` se desplazan como mucho una posición (`submit` está ahora en `hooks.ts:221-240`, con la llamada en `:230` y las dependencias en `:239`). La corrección de F2 no altera AC-003.1, AC-004.1, AC-007.6 ni AC-008.3: el flujo de `inFlightRef`, `setValue`, `then` y `finally` es idéntico. Lo confirman `PortionChat.test.tsx` y `DiaryPage.test.tsx` en verde.

## 3. Cumplimiento del plan
Sin desviaciones nuevas. Las de la iteración 1 (`noValidate` y el encadenado de `.then` y `.finally`) siguen justificadas.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` idéntico (`identical: true`, sin archivos cambiados, borrados ni añadidos). `git diff 796c9fb HEAD --stat` no incluye ningún archivo de test. La incidencia de proceso B2.4 sigue anotada (F1).
- [x] B4: trazabilidad sin cambios; las 26 tareas están `[x]`.
- [x] B5: no hay tests modificados; la suite de `src/features/diary` pasa (21 archivos, 906 tests, ejecución propia). Lint, `tsc -b` y build están limpios según `verify-report.md` (iteración 2).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P2 frontend: el hook sigue en `features/diary/hooks.ts`, con TanStack Query y react-hook-form; imports de terceros antes que los de alias y los relativos.
- [x] P2 General 1: textos en español, sin cambios.
- [x] P3, P4 y P5.1: sin cambios respecto a la iteración 1.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable | Estado |
|---|---|---|---|---|---|
| F1 | MENOR | `specs/031-diary-portion-chat-ui/backlog.md:10-14` | Proceso (Art. B2.4): el `test-author` añadió bloques a `schemas.test.ts`, `api.test.ts` y `errors.test.ts` con heredocs y `sed`, y el `implementer` marcó casillas de `tasks.md` con `sed -i`, en lugar de usar Edit. Los agentes lo declararon ellos mismos y no afecta al producto: el snapshot se tomó después y el diff de los tests solo tiene adiciones. Se presenta en el gate. | test-author | Abierto (fallo de proceso ya anotado) |
| F2 | NIT | `frontend/src/features/diary/hooks.ts:210,239` | `submit` dependía de `estimate`, un objeto que se crea de nuevo en cada render. | implementer | **Corregido**: `const { mutateAsync } = useEstimatePortion()` y dependencias `[mutateAsync, form]`, las dos estables. |
| F3 | NIT | `frontend/src/features/diary/hooks.ts:8-9`, `frontend/src/features/diary/pages/DiaryPage.tsx:9` | Orden de imports. | implementer | **Corregido**: `react-hook-form` y `@hookform/resolvers/zod` van con los de terceros, y `PortionChat` está en orden alfabético entre los componentes. |
| F4 | NIT | `specs/031-diary-portion-chat-ui/backlog.md:5`, `specs/031-diary-portion-chat-ui/spec.md:235-236` | El backlog de la spec sigue teniendo como pendiente «Desplazamiento automático al último turno», que el plan incluyó y está implementado (`PortionChat.tsx:37-40`). Además, la fila Q8 de la tabla de preguntas abiertas está después de la línea «Estado: …» y rompe la tabla en Markdown. Queda pendiente de que lo decida el usuario. | spec-writer | Abierto (pendiente de decisión del usuario) |

## 6. Decisión
APPROVED. F2 y F3 están corregidos, sin cambios de comportamiento y con los tests intactos y en verde. No hay hallazgos BLOQUEANTES ni MAYORES. F1 se presenta en el gate como incidencia de proceso, y F4 queda como NIT abierto, a decisión del usuario.

## Comentarios del usuario
