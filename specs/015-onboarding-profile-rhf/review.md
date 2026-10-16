# Review 015 — Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod

- **Iteración:** 3 de 3
- **Diff revisado:** `git diff main...fix/015-onboarding-profile-rhf` @ `81f118b`, con foco en `81f118b` (corrección de F3 a F8). Hay cambios sin commitear solo en `specs/015-onboarding-profile-rhf/` (`backlog.md`, `state.json` y `verify-report.md`) y un `.claudecodeignore` sin trackear que no pertenece a la feature.
- **Veredicto:** APPROVED

## 1. Resumen
El usuario pidió corregir los hallazgos F3 a F8 de la iteración 2, y el commit `81f118b` los corrige todos sin cambiar el comportamiento. Para comprobarlo he revisado cada cambio por equivalencia semántica (detalle en la sección 3) y he ejecutado los tests de onboarding, perfil y métricas corporales: 421 de 421 en verde. Además, `npm run lint` ya solo da los 2 warnings previos de `components/ui/`, `npx tsc -b` pasa y `snapshot --check` da `identical: true`. No hay hallazgos nuevos.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 … AC-001.4 | Sí, sin cambios funcionales desde la iteración 2 | `onboarding/schemas.ts` (`dateOfBirthMessage`), `OnboardingPage.tsx`, `PhysicalDataForm.tsx` |
| AC-002.1, AC-002.2 | Sí | `PhysicalDataForm.tsx`; `profile/schemas.ts` reutiliza `addPhysicalDataIssues` |
| AC-003.1 … AC-003.5 | Sí | `onboarding/schemas.ts:57-66` (`inRange`, ahora exportada, mismo cuerpo) |
| AC-004.1 … AC-004.3 | Sí | `onboarding/schemas.ts` |
| AC-005.1 … AC-005.3 | Sí | `profile/schemas.ts:20-22,31,38`: `optionalInRange` delega en `inRange` y la semántica es la misma (vacío = válido) |
| AC-006.1 … AC-006.4 | Sí | sin cambios |
| AC-007.1 … AC-007.5 | Sí | `onboarding/schemas.ts:127-135` (issue `CHOOSE_OPTION_MESSAGE` por cada enum en `null`); `OnboardingPage.tsx:62` |
| AC-008.1 … AC-008.3 | Sí | sin cambios |
| AC-009.1 … AC-009.6 | Sí | `PhysicalDataForm.tsx:64,92-100,239,253` |
| AC-010.1, AC-010.2 | Sí | `PhysicalDataForm.tsx:64-71` |

## 3. Cumplimiento del plan
La corrección de F3 a F8 no se aparta del plan. He comprobado la equivalencia de cada cambio:

- **F3** (`OnboardingPage.tsx:62`, `PhysicalDataForm.tsx:64`): `form.watch()` pasa a ser `useWatch({ control: form.control })`.
  - En el primer render, `useWatch` devuelve los `defaultValues`. Se actualiza con `setValue` y con `form.reset(...)`, que se usan en `onSave` y `discard`.
  - Los warnings `incompatible-library` han desaparecido del lint.
  - El cast `as OnboardingAnswers` / `as PhysicalDataFormValues` es seguro porque los `defaultValues` son completos.
- **F4** (`onboarding/schemas.ts:57`, `body-metrics/schemas.ts:3`, `profile/schemas.ts:20-22`): queda una sola `inRange`.
  - En `body-metrics`, la copia antigua no rechazaba el texto vacío y la compartida sí. No cambia nada, porque las tres llamadas (`weight`, `fat` y `muscle`) reciben el texto ya recortado y solo cuando no está vacío.
  - `integer` vale `false` por defecto.
  - `optionalInRange` sigue aceptando el vacío.
  - La dependencia `body-metrics → onboarding/schemas` no crea ciclos: `onboarding/schemas.ts` solo importa de `onboarding/constants`, `onboarding/types` y `lib/`. Esa dirección ya existía con `LIMITS`, `KG_PER_LB` y `WeightUnit`.
- **F5** (`PhysicalDataForm.tsx:239,253`): ya no existe `updateBody` y las dos llamadas usan `update` directamente. `BodyComposition` sigue usándose en las props.
- **F6** (`profile/schemas.ts:49-57,71-93`): sin alias locales. Los esquemas `serverProfileSchema` y `saveProfilePayloadSchema` usan los mismos objetos zod que antes.
- **F7** (`PhysicalDataForm.tsx:96-100`): `dirty` compara campo a campo las claves de `saved`.
  - Equivale a la comparación anterior porque `draft` y `saved` tienen el mismo conjunto de claves: los dos salen de `defaultValues` o de los valores que devuelve `handleSubmit`, que pasan después a `form.reset(values)`.
  - Ya no depende del orden de las claves.
- **F8** (`onboarding/schemas.ts:34,132`): el mensaje es la constante exportada `CHOOSE_OPTION_MESSAGE`, con el mismo texto "Elige una opción".

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: se respetaron los roles. El commit `81f118b` (implementer) solo toca código de producción del frontend y artefactos de estado. No modifica ningún test.
- [x] B4: no hay marcadores nuevos. Según verify, los 37 AC siguen cubiertos.
- [x] B5.3 y B5.5: `snapshot --check` da `identical: true` (snapshot de 08:43:51, posterior al `rework tests` autorizado de F2). Además, `git diff cf1da40 HEAD` sobre los archivos de test está vacío. No se ha borrado, saltado ni debilitado ningún test.
- [x] B5.7: lint sin errores ni warnings nuevos (quedan los 2 previos de `components/ui/`), `tsc -b` en verde y build en verde según verify.
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1 frontend: no hay tests nuevos ni modificados en esta iteración.
- [x] P2 frontend 1 y 3: la organización por feature se mantiene, y los formularios usan react-hook-form con zod. `useWatch` es la API recomendada de RHF.
- [x] P2 frontend 5: oxlint sin errores, y la feature ya no aporta warnings.
- [x] P2 General 1: comentarios y textos en español correcto (`PhysicalDataForm.tsx:95`, `onboarding/schemas.ts:34`).
- [x] P3.2: la validación con zod no cambia.
- [x] P4: sin migraciones ni pasos manuales.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | ~~MAYOR~~ RESUELTO | `frontend/src/features/onboarding/schemas.ts:127-135` | Resuelto en `4db5316`. | implementer |
| F2 | ~~MAYOR~~ RESUELTO | `frontend/src/features/onboarding/schemas.test.ts`; `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx` | Resuelto en `cf1da40`. | test-author |
| F3 | ~~MENOR~~ RESUELTO | `frontend/src/features/onboarding/pages/OnboardingPage.tsx:62`; `frontend/src/features/profile/components/PhysicalDataForm.tsx:64` | Resuelto en `81f118b` con `useWatch`; el lint ya no da los warnings. | implementer |
| F4 | ~~MENOR~~ RESUELTO | `frontend/src/features/onboarding/schemas.ts:57`; `frontend/src/features/body-metrics/schemas.ts:3`; `frontend/src/features/profile/schemas.ts:20-22` | Resuelto en `81f118b` con una sola `inRange` compartida, sin cambio de comportamiento. | implementer |
| F5 | ~~NIT~~ RESUELTO | `frontend/src/features/profile/components/PhysicalDataForm.tsx:239,253` | Resuelto en `81f118b`: se eliminó `updateBody`. | implementer |
| F6 | ~~NIT~~ RESUELTO | `frontend/src/features/profile/schemas.ts:49-57,71-93` | Resuelto en `81f118b`: se quitaron los alias. | implementer |
| F7 | ~~NIT~~ RESUELTO | `frontend/src/features/profile/components/PhysicalDataForm.tsx:96-100` | Resuelto en `81f118b`: la comparación es campo a campo. | implementer |
| F8 | ~~NIT~~ RESUELTO | `frontend/src/features/onboarding/schemas.ts:34,132` | Resuelto en `81f118b` con `CHOOSE_OPTION_MESSAGE`. | implementer |

No hay hallazgos nuevos en esta iteración.

## 6. Decisión
**APPROVED.** No queda abierto ningún hallazgo, ni BLOQUEANTE ni MAYOR ni de otra severidad. F3 a F8 están corregidos sin cambio de comportamiento, y lo comprueban la revisión de equivalencia de la sección 3, los 421 tests en verde de las tres features afectadas, el lint sin warnings nuevos y el snapshot de tests idéntico.

## Comentarios del usuario

Vamos a corregirlos todos. Desde f3 hasta f8
