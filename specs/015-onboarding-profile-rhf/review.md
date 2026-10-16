# Review 015 — Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod

- **Iteración:** 2 de 3
- **Diff revisado:** `git diff main...fix/015-onboarding-profile-rhf` @ `4db5316` (foco en `cf1da40` y `4db5316`, correcciones de F2 y F1; cambios sin commitear solo en `specs/015-onboarding-profile-rhf/`: `backlog.md`, `state.json`, `verify-report.md`, más `.claudecodeignore` sin trackear, ajeno a la feature)
- **Veredicto:** APPROVED

## 1. Resumen
Los dos hallazgos MAYORES de la iteración 1 están resueltos. F1: `addPhysicalDataIssues` añade ahora un issue "Elige una opción" cuando `gender`, `activityLevel` o `goal` son `null` (`frontend/src/features/onboarding/schemas.ts:126-130`). Así, `validFor([...])` vuelve a exigir la elección en esos pasos y `handleSubmit` no deja pasar enums vacíos. F2: hay tres tests unitarios del esquema y dos de página que cubren la regresión. Se añadieron con `rework tests`, un red check y un snapshot posterior, y `snapshot --check` da `identical: true`. Los hallazgos MENORES y NIT de la iteración 1 (F3 a F7) siguen abiertos y están en el backlog de la feature.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 … AC-001.4 | Sí (sin cambios desde la iteración 1) | `onboarding/schemas.ts` (`dateOfBirthMessage`), `OnboardingPage.tsx:95-98,118`, `PhysicalDataForm.tsx:159` |
| AC-002.1, AC-002.2 | Sí | `PhysicalDataForm.tsx:159,167`; `profile/schemas.ts` hereda `addPhysicalDataIssues` |
| AC-003.1 … AC-003.5 | Sí | `onboarding/schemas.ts:59-84,137-150`; `units.ts:6` |
| AC-004.1 … AC-004.3 | Sí | `onboarding/schemas.ts:144-150`; `PhysicalDataForm.tsx:224-231` |
| AC-005.1 … AC-005.3 | Sí | `profile/schemas.ts` (issues `fat`/`muscle`); `PhysicalDataForm.tsx:237,251` |
| AC-006.1 … AC-006.4 | Sí | `OnboardingPage.tsx:151,200`; `PhysicalDataForm.tsx:180,221` |
| AC-007.1 … AC-007.3, AC-007.5 | Sí | `OnboardingPage.tsx:83-92,246-273` |
| AC-007.4 / REQ-007 (flujo actual) | **Sí (corregido)** | `onboarding/schemas.ts:126-130` hace que `validFor(["gender"])`, `validFor(["activityLevel"])` y `validFor(["goal"])` (`OnboardingPage.tsx:105,216,229`) sean falsos hasta elegir; por eso `OnboardingPage.tsx:356` no muestra "Siguiente" en el género y "Comenzar" queda `disabled`. Tests: `OnboardingPage.test.tsx:758-796`, `onboarding/schemas.test.ts:245-263` |
| AC-008.1 … AC-008.3 | Sí | `OnboardingPage.tsx:246-264`; `handleSubmit` ya no acepta enums `null`, así que `payloadFromAnswers` no recibe `null` |
| AC-009.1 … AC-009.6 | Sí | `PhysicalDataForm.tsx:55,96-143` |
| AC-010.1, AC-010.2 | Sí | `PhysicalDataForm.tsx:64-66` |
| Sección 6 ("Género", "Nivel de actividad", "Meta" obligatorios) | **Sí (corregido)** | `onboarding/schemas.ts:126-130` |

## 3. Cumplimiento del plan
- La desviación de la iteración 1 (plan 3.2: issue "Elige una opción" para los enums en `null`) está corregida tal como fija el plan. El mensaje no se pinta en la UI: ni `OnboardingPage.tsx` ni `PhysicalDataForm.tsx` leen `errors.gender`, `errors.activityLevel` ni `errors.goal`. Esto coincide con el plan.
- En Datos físicos el issue nuevo no tiene efecto: `answersFromProfile` parte de un perfil del servidor validado por `serverProfileSchema`, con los enums obligatorios, así que nunca llegan en `null`.
- Sigue vigente la observación menor de la iteración 1 sobre `optionalInRange` (F4).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: los roles se respetaron. El commit `4db5316` (implementer) solo toca `onboarding/schemas.ts` y `state.json`, y el commit `cf1da40` (test-author) solo toca tests y artefactos de la feature.
- [x] B4: los marcadores de los tests nuevos son coherentes (`SDD: 015 REQ-007 AC-007.4`).
- [x] B5: los tests cambiados después de la etapa `tests` están autorizados: `history` registra `rework tests` (08:39:19), red check PASS (08:43:33) y `snapshot` (08:43:51), y `snapshot --check` da `identical: true`. No se borró ni se debilitó ningún test, y los tests nuevos prueban de verdad el AC: la ausencia del botón, el botón deshabilitado y que no se llama a `saveMock`.
- [x] B5.7: según verify, lint da 0 errores (4 warnings, 2 de ellos nuevos de la feature, F3), y `tsc` y build pasan. He ejecutado `npx vitest run src/features/onboarding src/features/profile`: 152/152 en verde.
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1.1 / P1 frontend 1–4: tests junto al archivo, marcadores con número de spec y nombres en español.
- [x] P2 frontend 1 y 3: el esquema zod recoge ahora todas las reglas de los datos del formulario, incluida la obligatoriedad de los enums.
- [x] P2 frontend 5: sin errores de oxlint.
- [x] P2 General 1: el texto nuevo "Elige una opción" está en español, aunque no se pinta.
- [x] P3.2: la entrada del onboarding se valida por completo con zod antes del envío.
- [x] P4: sin migraciones ni pasos manuales.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | ~~MAYOR~~ RESUELTO | `frontend/src/features/onboarding/schemas.ts:126-130` | Corregido en `4db5316`: issue por cada enum en `null`. | implementer |
| F2 | ~~MAYOR~~ RESUELTO | `frontend/src/features/onboarding/schemas.test.ts:245-263`; `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx:758-796` | Corregido en `cf1da40`, con `rework tests` y un snapshot nuevo. Los 5 tests fallaron antes de la corrección (red check) y ahora pasan. | test-author |
| F3 | MENOR | `frontend/src/features/onboarding/pages/OnboardingPage.tsx:62`; `frontend/src/features/profile/components/PhysicalDataForm.tsx:64` | Sigue abierto: dos warnings nuevos de oxlint `react(incompatible-library)` por `form.watch()`; `useWatch` los evitaría. Está en el backlog. | implementer |
| F4 | MENOR | `frontend/src/features/profile/schemas.ts` (`optionalInRange`); `frontend/src/features/body-metrics/schemas.ts:22`; `frontend/src/features/onboarding/schemas.ts:56` | Sigue abierto: hay tres copias de la lógica de rango. Está en el backlog. | implementer |
| F5 | NIT | `frontend/src/features/profile/components/PhysicalDataForm.tsx:88-90` | Sigue abierto: `updateBody` es redundante. Está en el backlog. | implementer |
| F6 | NIT | `frontend/src/features/profile/schemas.ts` (alias `const gender = genderSchema`…) | Sigue abierto: alias locales redundantes. Está en el backlog. | implementer |
| F7 | NIT | `frontend/src/features/profile/components/PhysicalDataForm.tsx:100-103` | Sigue abierto: `dirty` depende del orden de las claves al comparar con `JSON.stringify`. Está en el backlog. | implementer |
| F8 | NIT | `frontend/src/features/onboarding/schemas.ts:128` | El literal "Elige una opción" está escrito en la llamada, mientras que los demás mensajes del esquema son constantes exportadas (`DOB_REQUIRED_MESSAGE`…). Si algún día se pinta o se testea por texto, conviene extraerlo a una constante. | implementer |

## 6. Decisión
**APPROVED.** No quedan hallazgos BLOQUEANTES ni MAYORES. F1 y F2 están resueltos y verificados: el diff es correcto, el snapshot es idéntico y los tests de onboarding y perfil pasan (152/152). F3 a F8 son MENORES o NIT y pueden ir al backlog.

## Comentarios del usuario

Vamos a corregirlos todos. Desde f3 hasta f8
