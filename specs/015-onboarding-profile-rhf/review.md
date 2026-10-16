# Review 015 — Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod

- **Iteración:** 1 de 3
- **Diff revisado:** `git diff main...fix/015-onboarding-profile-rhf` @ `84e7e3d` (+ cambios sin commitear solo en `specs/015-onboarding-profile-rhf/`: `backlog.md`, `state.json`, `verify-report.md`)
- **Veredicto:** CHANGES_REQUESTED

## 1. Resumen
El cambio mueve el onboarding y el formulario Datos físicos a `useForm` con `zodResolver`, con un esquema compartido en `onboarding/schemas.ts` y los mensajes calculados de forma síncrona con `fieldMessages`. Los tests no se tocaron después de la etapa `tests` y el traslado de `validation.test.ts` está completo. Pero hay una regresión funcional en el onboarding que ningún test detecta: el esquema acepta `null` en género, nivel de actividad y meta, y como la validez de esos pasos sale ahora del esquema, el usuario puede saltarse esas preguntas.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 … AC-001.3 | Sí | `onboarding/schemas.ts:87-106` (`dateOfBirthMessage`), pintado en `OnboardingPage.tsx:95-98,128-134` y `PhysicalDataForm.tsx:156-169`; tests en `onboarding/schemas.test.ts:71-92`, `OnboardingPage.test.tsx`, `ProfilePage.test.tsx` |
| AC-001.4 | Sí | `OnboardingPage.tsx:95-98` oculta `DOB_REQUIRED_MESSAGE`; `validFor(["dateOfBirth"])` en `:118` |
| AC-002.1, AC-002.2 | Sí | `PhysicalDataForm.tsx:159,167` (`errors.dateOfBirth` + `aria-invalid`), `profile/schemas.ts` hereda `addPhysicalDataIssues` |
| AC-003.1 … AC-003.4 | Sí | `onboarding/schemas.ts:67-78`, `:130-136`; `PhysicalDataForm.tsx:183-207` |
| AC-003.5 | Sí | `onboarding/schemas.ts:59-65,75-76` (`Number.isInteger`); `units.ts:6` reutiliza el predicado, así que `5.5` ft no se convierte |
| AC-004.1 … AC-004.3 | Sí | `onboarding/schemas.ts:80-84,137-143`; `PhysicalDataForm.tsx:224-231` |
| AC-005.1 … AC-005.3 | Sí | `profile/schemas.ts` (`makeProfileFormSchema`, issues `fat`/`muscle` con `FAT_LIMITS`/`MUSCLE_LIMITS`); `PhysicalDataForm.tsx:237,251` |
| AC-006.1 … AC-006.4 | Sí | `OnboardingPage.tsx:151,200` y `PhysicalDataForm.tsx:180,221` siguen usando `convertHeight`/`convertWeight` vía `update` |
| AC-007.1 … AC-007.3, AC-007.5 | Sí | `OnboardingPage.tsx:83-92`, `:246-273`, valores conservados por RHF |
| AC-007.4 / REQ-007 (flujo actual) | **Parcial** | Elegir la meta habilita "Comenzar", pero "Comenzar" ya está habilitado **antes** de elegir, y el paso de género muestra "Siguiente" habilitado desde el inicio: `OnboardingPage.tsx:105,216,229` + `onboarding/schemas.ts:109,117-118` (ver F1). |
| AC-008.1 … AC-008.3 | Sí | `OnboardingPage.tsx:246-264` (`handleSubmit` + guardia `submitting`); `payloadFromAnswers` sin cambios |
| AC-009.1 … AC-009.6 | Sí | `PhysicalDataForm.tsx:55,96-103,105-143` (`saved` + `form.reset`, `dirty`, `measurementChanged`) |
| AC-010.1, AC-010.2 | Sí | `PhysicalDataForm.tsx:64-66`: `fieldMessages` en cada render, sin esperar a enviar |
| Tabla de la sección 6 ("Género", "Nivel de actividad", "Meta": obligatorios) | **No** en el onboarding | Ver F1 |

## 3. Cumplimiento del plan
- **Desviación no justificada (F1):** el plan (3.2, tabla de rutas de issues) fija que `gender`, `activityLevel` y `goal` en `null` producen un issue ("Elige una opción", no se pinta) y que cada paso del onboarding calcula `isValid` con `validFor([clave])`. La implementación hace lo segundo pero no lo primero: `addPhysicalDataIssues` (`onboarding/schemas.ts:121-144`) no añade ningún issue para esas claves, y `physicalDataShape` las declara `.nullable()` (`:109,117,118`). El resultado es que `validFor(["gender"])`, `validFor(["activityLevel"])` y `validFor(["goal"])` son siempre `true`.
- `optionalInRange` no "desaparece" como dice el plan (3.4): se trasladó a `profile/schemas.ts`. Es inocuo, pero duplica el `inRange` de `body-metrics/schemas.ts:22` (F4).
- El resto del plan se sigue: `fieldMessages` síncrono, `saved` + `form.reset`, `handleSubmit` con guardia y `validation.ts` eliminado. No hay dependencias nuevas.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` da `identical: true`, y `git diff 6bb94e7 HEAD` no muestra cambios en los archivos de test.
- [x] B4: los marcadores `SDD:` son coherentes. Los 006 trasladados llevan el prefijo `006` y los nuevos, `015`.
- [x] B5: no hay tests borrados (`validation.test.ts` se trasladó íntegro a `onboarding/schemas.test.ts:28-68`, con los mismos valores y el mismo hoy fijo), ni saltados ni debilitados; tampoco hay llamadas externas ni queda ningún `not implemented`.
- [x] B5.7: sin errores de lint ni de tipos. Hay 2 warnings nuevos `incompatible-library` por `form.watch()` (F3).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1.1 / P1 frontend 1–4: marcadores con número de spec, tests junto al archivo, imports de `vitest`, nombres en español y red simulada en `api.ts`.
- [x] P2 frontend 1: reglas en `schemas.ts` y tipos en `types.ts` de cada feature.
- [ ] P2 frontend 3: los formularios usan RHF con zod, pero el esquema no recoge todas las reglas de los datos (F1): la obligatoriedad de género, actividad y meta se perdió al pasar la validez al esquema.
- [x] P2 frontend 5: sin errores de oxlint.
- [x] P2 General 1: textos en español sin cambios.
- [ ] P3.2: la entrada del onboarding no se valida por completo con zod antes del envío: `handleSubmit` deja pasar `null` en los enums y solo lo para `saveProfilePayloadSchema.parse` dentro de `api.ts:13`, con el mensaje genérico de error (F1).
- [x] P4: sin migraciones ni pasos manuales.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MAYOR | `frontend/src/features/onboarding/schemas.ts:109,117-118,121-144`; `frontend/src/features/onboarding/pages/OnboardingPage.tsx:105,216,229,356-367` | **Regresión: género, nivel de actividad y meta dejan de ser obligatorios en el onboarding.** `physicalDataShape` declara esos enums `.nullable()` y `addPhysicalDataIssues` no añade issue cuando son `null` (comprobado: `z.enum([...]).nullable().safeParse(null).success === true`). Como el paso calcula `isValid` con `validFor(["gender"])` (antes, `answers.gender !== null`), pasan tres cosas. (1) En la primera pantalla aparece desde el inicio un botón "Siguiente" habilitado (`!step.autoAdvance \|\| step.isValid` es verdadero), que antes no existía hasta elegir. (2) El usuario puede avanzar sin género ni nivel de actividad. (3) En la meta, "Comenzar" está habilitado sin elegir nada, `handleSubmit` acepta los valores y `payloadFromAnswers` envía `null` con `!`, así que `saveProfilePayloadSchema.parse` falla en `profile/api.ts:13` y se muestra "No se pudo guardar tu perfil. Inténtalo de nuevo.". Esto incumple REQ-007 ("conservar el flujo actual"), la sección 6 (los tres campos son obligatorios) y el plan 3.2 (issue "Elige una opción" para `null`). **Corrección esperada:** añadir en `addPhysicalDataIssues` un issue por cada enum `null` (`gender`, `activityLevel` y `goal`), como fija el plan. | implementer |
| F2 | MAYOR | `frontend/src/features/onboarding/schemas.test.ts` (bloque sin cubrir); `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx:608-655` | **Falta un test para la regresión de F1.** Ningún test comprueba que el esquema rechace `gender`, `activityLevel` o `goal` en `null`, ni que en el onboarding el paso de género no muestre "Siguiente" o que "Comenzar" esté deshabilitado antes de elegir la meta. AC-007.4 solo comprueba el estado después de elegir. Hay que añadir casos unitarios del esquema compartido (clave `gender`/`activityLevel`/`goal` presente con `null`) y un caso de página (por ejemplo, "Comenzar" deshabilitado al llegar a la meta sin elegir). Como corrige tests después de la etapa `tests`, debe hacerse con `rework tests` y un snapshot nuevo. | test-author |
| F3 | MENOR | `frontend/src/features/onboarding/pages/OnboardingPage.tsx:62`; `frontend/src/features/profile/components/PhysicalDataForm.tsx:64` | Dos warnings nuevos de oxlint `react(incompatible-library)` por `form.watch()`. No son errores (P2 frontend 5), pero `useWatch({ control: form.control })` los evitaría. Ya está en el backlog. | implementer |
| F4 | MENOR | `frontend/src/features/profile/schemas.ts` (`optionalInRange`); `frontend/src/features/body-metrics/schemas.ts:22` | `optionalInRange` (que el plan decía eliminar) duplica la lógica de rango de `body-metrics/schemas.ts` y de `inRange` de `onboarding/schemas.ts:56`. Una utilidad de rango compartida evitaría que tres copias diverjan. | implementer |
| F5 | NIT | `frontend/src/features/profile/components/PhysicalDataForm.tsx:88-90` | `updateBody` ya solo delega en `update`: se puede eliminar y llamar a `update` directamente. Ya está en el backlog. | implementer |
| F6 | NIT | `frontend/src/features/profile/schemas.ts` (`const gender = genderSchema` … `const goal = goalSchema`) | Alias locales redundantes de los enums compartidos. Se pueden usar los nombres importados directamente en `serverProfileSchema` y `saveProfilePayloadSchema`. | implementer |
| F7 | NIT | `frontend/src/features/profile/components/PhysicalDataForm.tsx:100-103` | `dirty` compara `JSON.stringify(draft)` con `saved`. Ahora `saved` sale de la salida del resolver (el orden de las claves es el de `physicalDataShape`) y `draft` de `watch()` (el orden de `defaultValues`). Hoy coinciden, pero es frágil: si cambia el orden de `answersFromProfile` o del shape, "Descartar" quedaría visible sin cambios. Conviene comparar campo a campo. | implementer |

## 6. Decisión
**CHANGES_REQUESTED.** Quedan dos hallazgos MAYORES abiertos. F1 es una regresión funcional del flujo del onboarding: permite saltarse preguntas obligatorias y el envío termina en un error genérico. F2 es la falta de cobertura que la dejó pasar. Los MENORES y los NIT pueden ir al backlog si el usuario lo aprueba.

## Comentarios del usuario
