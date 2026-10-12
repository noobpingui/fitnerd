# Review 006 — Perfil de usuario persistido en el backend

- **Iteración:** 2 de 3
- **Commit / diff revisado:** `git diff chore/frontend-redesign...feat/006-user-profile` @ `ab5f8a3`, más los cambios sin commit del árbol de trabajo (correcciones F1-F6 de la iteración 1): `frontend/src/lib/dates.ts` (nuevo), `body-metrics/dateUtils.ts`, `onboarding/pages/OnboardingPage.tsx`, `onboarding/validation.ts`, `profile/components/PhysicalDataForm.tsx`, `profile/components/ProfileLoadState.tsx`, `profile/hooks.ts`, `profile/pages/ProfilePage.tsx`, `lib/age.ts`, `docs/sdd/decisions/ADR-0019-perfil-de-usuario.md` y `docs/sdd/decisions/README.md`.
- **Veredicto:** APPROVED

## 1. Resumen
Esta iteración solo revisa las correcciones de F1-F6 sobre la base aprobada en la iteración 1 (la tabla de cumplimiento de la spec de esa iteración sigue vigente: el backend no cambia y los cambios del frontend son refactors y ajustes de UX). Los seis hallazgos están resueltos. Las utilidades de fecha se centralizan en `src/lib/dates.ts`; el campo de fecha del perfil tiene `max` y un mensaje cuando está vacío; los estados de carga del perfil admiten una altura propia; el comentario de `staleTime` se corrigió; y ADR-0019 pasa a "Aceptada". Los tests no se tocaron y verify full volvió a dar PASS.

## 2. Cumplimiento de la spec
Sin cambios respecto a la iteración 1 (ver el historial de git de este archivo). Comprobaciones específicas sobre los cambios nuevos:

| REQ / AC | ¿Sigue implementado como se especificó? | Evidencia |
|---|---|---|
| AC-009.1–AC-009.6 (onboarding, fecha) | Sí | `OnboardingPage.tsx:111` usa `todayIsoDate()` de `src/lib/dates.ts`; `validation.ts:32-34` sigue rechazando fechas imposibles (compara mes y día tras `parseLocalDate`) y devuelve `""` sin mensaje si la fecha está vacía |
| AC-011.4 (perfil, fecha inválida) | Sí | `PhysicalDataForm.tsx:171-174`: `dobError` tiene prioridad; el texto "Indica tu fecha de nacimiento" solo aparece con la fecha vacía, caso que la spec no regula |
| AC-012.1–AC-012.4 (edad) | Sí | `lib/age.ts:6-15` obtiene año, mes y día de `parseLocalDate`; con fechas válidas el resultado es idéntico al anterior (`age.test.ts` y `calculations.test.ts` pasan) |
| AC-006.x / AC-010.x (estados de carga) | Sí | `ProfileLoadState.tsx` conserva `min-h-dvh` por defecto (guard); `ProfilePage.tsx:63-66` pasa `min-h-40` |

## 3. Cumplimiento del plan
- La desviación de `staleTime` (iteración 1, F4) queda explicada correctamente en el comentario de `features/profile/hooks.ts:12-14`, con referencia a AC-011.7. No se anotó en `plan.md`; es aceptable porque el propio plan §5.3 lo exige implícitamente.
- `src/lib/dates.ts` es una utilidad compartida nueva, no prevista en el plan, pero es exactamente el remedio propuesto en F1/F2 y respeta la organización por feature (lo común va en `src/lib/`).

## 4. Checklist de la constitución
- [x] **Art. 2:** cada agente se mantuvo en su rol (el implementer corrigió F1-F5 y el planner, F6).
- [x] **Art. 4/5:** los 15 archivos de `tests_snapshot` tienen el mismo SHA-256 en el árbol de trabajo actual (comprobado con `node` y `crypto`), y `git diff bbf1387 -- backend/tests frontend/src/test 'frontend/src/**/*.test.*'` está vacío. No hay tests nuevos, borrados ni saltados.
- [x] **Art. 6:** capas y `apiFetch` sin cambios; `src/lib/dates.ts` no introduce dependencias entre features (`body-metrics/dateUtils.ts` reexporta desde `lib`, no al revés).
- [x] **Art. 6.4:** no cambian los modelos; la migración `c6a1f0d2e9b4` sigue siendo la única.
- [x] **Art. 7:** sin secretos ni cambios en autenticación o validación del backend.
- [x] **Art. 6.11:** los comentarios nuevos (`dates.ts`, `hooks.ts`, `dateUtils.ts`) y el texto "Indica tu fecha de nacimiento" están en español correcto, sin voseo.

## 5. Hallazgos
Estado de los hallazgos de la iteración 1:

| # | Estado | Evidencia |
|---|---|---|
| F1 | Resuelto | `todayIso()` eliminado de `OnboardingPage.tsx`; `todayIsoDate()` vive en `frontend/src/lib/dates.ts:12-18` |
| F2 | Resuelto | `parseLocalDate` en `frontend/src/lib/dates.ts:5-8`, usado por `validation.ts:33`, `lib/age.ts:7` y `body-metrics/dateUtils.ts` |
| F3 | Resuelto | `PhysicalDataForm.tsx:179` (`max={todayIsoDate()}`) y `:171-174` (mensaje con la fecha vacía) |
| F4 | Resuelto | `features/profile/hooks.ts:12-14` |
| F5 | Resuelto | `ProfileLoadState.tsx` acepta `className`; `ProfilePage.tsx:63-66` usa `min-h-40` |
| F6 | Resuelto | `ADR-0019-perfil-de-usuario.md:3` y `decisions/README.md:25` en "Aceptada" |

Hallazgos nuevos:

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F7 | NIT | `frontend/src/features/body-metrics/dateUtils.ts:1-4` | La reexportación de `parseLocalDate` y `todayIsoDate` se mantiene solo por compatibilidad con `insights.ts:2`, `TrendChart.tsx` y `BodyMetricsPage.tsx:19`. Podría eliminarse importando directamente desde `@/lib/dates`, pero es inocua; puede quedar así. | implementer |
| F8 | NIT | `frontend/src/features/profile/components/PhysicalDataForm.tsx:173` | El texto "Indica tu fecha de nacimiento" no figura en §6 de la spec y no lo cubre ningún test (la spec solo regula que el onboarding no muestre mensaje con la fecha vacía). Es coherente y correcto; si se quiere dejar constancia, el doc-keeper o el spec-writer pueden mencionarlo en la etapa `docs`. | spec-writer |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES; F1-F6 están resueltos y los dos NIT nuevos son opcionales. Recordatorio operativo para el cierre (plan §6): la migración `c6a1f0d2e9b4` debe aplicarse en producción (`flask db upgrade` en EC2) antes de que el frontend que consume `/api/profile` llegue a Vercel; si no, toda la app mostrará "No se pudo cargar tu perfil.". Las correcciones siguen sin commit: deben incluirse en el commit de esta etapa.
