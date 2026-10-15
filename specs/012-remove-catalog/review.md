# Review 012 — Eliminar el catálogo de ejercicios, los favoritos y el plan semanal

- **Iteración:** 2 de 3
- **Commit / diff revisado:** `git diff main...feat/012-remove-catalog` @ `6cfdf2c` más los cambios sin commitear del árbol de trabajo (`frontend/nginx.conf`, `frontend/src/app/AppLayout.tsx`, `PrivacyPolicyPage.tsx`, `PrivacyPolicyPage.test.tsx` y `StorePage.tsx`)
- **Veredicto:** APPROVED

## 1. Resumen

Esta iteración revisa solo las correcciones de los hallazgos de la iteración 1. La revisión completa del cambio (spec, plan y constitución) está en la iteración 1 y sigue vigente, porque desde `6cfdf2c` solo han cambiado comentarios, el formato del JSX y un aserto de test. Se corrigieron F1, F2, F4 y F5. Por decisión del usuario, F3 pasa al backlog y deja de ser un hallazgo pendiente de esta feature.

## 2. Cumplimiento de la spec

Sin cambios respecto a la iteración 1: todos los AC están implementados como se especificó (ver la tabla de la iteración 1). Las correcciones no tocan ninguna lógica:

- `PrivacyPolicyPage.tsx:36-40` solo cambia los saltos de línea del `<li>` "Actividad en la app". El texto renderizado no cambia, así que AC-007.1, AC-007.2 y AC-007.6 se mantienen.
- `StorePage.tsx:11-12` solo cambia un comentario JSX.

## 3. Cumplimiento del plan

Sin desviaciones nuevas.

## 4. Checklist de la constitución

- [x] **Art. 2, integridad de los tests:**
  - Los SHA-256 de los 11 archivos de `tests_snapshot` (actualizado el 2026-10-15T01:41:00Z) coinciden con los archivos actuales, y los 2 archivos borrados siguen borrados.
  - El único cambio de test posterior a `b83d52c` es `PrivacyPolicyPage.test.tsx:124`. Es el cambio autorizado por F4 y está registrado en el `history` de `state.json`.
- [x] **Art. 5:** el aserto nuevo, `not.toMatch(/(^|\D)8 de octubre de 2026/)`, sigue probando AC-007.3 (que la fecha antigua desaparece). Ya no rechaza "18" ni "28 de octubre de 2026".
- [x] **Art. 6.11:** los comentarios están en español y sin voseo. Mantienen el estilo previo del archivo, sin tildes en los comentarios.
- [x] El resto del checklist sigue como en la iteración 1.

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable | Estado |
|---|---|---|---|---|---|
| F1 | MENOR | `frontend/nginx.conf:9` | El ejemplo `/categories/x` pasa a ser `/body-metrics`. | implementer | Resuelto |
| F2 | NIT | `frontend/src/app/AppLayout.tsx:11-13` | Se quita la lista incompleta: ahora dice "TODAS las pantallas protegidas". | implementer | Resuelto |
| F3 | NIT | `PrivacyPolicyPage.tsx:5`, `TermsOfServicePage.tsx:5` | La fecha legal debe ajustarse al día de cierre. | implementer | Movido al backlog por el usuario; no está pendiente en esta feature |
| F4 | NIT | `PrivacyPolicyPage.test.tsx:124` | El aserto queda anclado con `(^|\D)`. | test-author | Resuelto |
| F5 | NIT | `PrivacyPolicyPage.tsx:37-39`, `StorePage.tsx:11-12` | El reflujo de las líneas queda homogéneo con el resto del archivo. | implementer | Resuelto |

No hay hallazgos nuevos. Conteo de hallazgos abiertos: 0 BLOQUEANTES, 0 MAYORES, 0 MENORES y 0 NIT.

Quedan pendientes, igual que en la iteración 1, dos tareas de la etapa `docs`: actualizar `README.md` y la sección Proyecto de `CLAUDE.md`, y añadir a los pasos de despliegue la copia de seguridad previa a `flask db upgrade`.

## 6. Decisión

**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES.
