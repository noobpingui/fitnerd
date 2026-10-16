# Plan 015 — Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-16)
- **Ámbitos:** frontend

## 1. Resumen de la solución

Se crea un único esquema zod de los datos físicos en `frontend/src/features/onboarding/schemas.ts` (fecha de nacimiento, altura, peso y las tres opciones obligatorias), con los mensajes visibles de la spec, y el perfil lo extiende en `frontend/src/features/profile/schemas.ts` con la grasa y el músculo opcionales. Los dos formularios pasan a `useForm` con `zodResolver` (Art. P2.3): react-hook-form guarda los valores, aplica los cambios (`setValue`), restaura (`reset`) y controla el envío (`handleSubmit`), y los mensajes que se pintan se derivan **de forma síncrona** del mismo esquema en cada render (`fieldMessages`), porque el resolver de RHF es asíncrono y la spec (REQ-010, AC-007.5) y los tests existentes exigen ver los errores en el mismo render del cambio. `validation.ts` desaparece y sus predicados pasan a `schemas.ts` (los usa también `units.ts` para decidir si convierte). No hay backend, migración ni dependencias nuevas.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| frontend | `features/onboarding` (reglas) | `frontend/src/features/onboarding/schemas.ts` | — | Conjunto único de reglas zod de fecha, altura y peso, predicados y `fieldMessages` |
| frontend | `features/onboarding` (reglas) | — | `frontend/src/features/onboarding/validation.ts` (**se elimina**) | Sustituido por `schemas.ts`; queda sin uso |
| frontend | `features/onboarding` (unidades) | — | `frontend/src/features/onboarding/units.ts` | Importa `isHeightValid`/`isWeightValid` de `schemas.ts` (ft/in enteros, Q2) |
| frontend | `features/onboarding` (página) | — | `frontend/src/features/onboarding/pages/OnboardingPage.tsx` | `useState` de respuestas → `useForm` + `zodResolver`; validez de cada paso desde el esquema |
| frontend | `features/profile` (esquemas) | — | `frontend/src/features/profile/schemas.ts` | `makeProfileFormSchema` (datos físicos + grasa y músculo); reutiliza los enums del esquema compartido |
| frontend | `features/profile` (tipos) | — | `frontend/src/features/profile/types.ts` | `BodyComposition` (movido desde `PhysicalDataForm.tsx`) y `PhysicalDataFormValues` |
| frontend | `features/profile` (componente) | — | `frontend/src/features/profile/components/PhysicalDataForm.tsx` | `useState` de borrador → `useForm` + `zodResolver`; mensajes desde el esquema; `optionalInRange` desaparece |
| frontend | tests | `frontend/src/features/onboarding/schemas.test.ts`, `frontend/src/features/profile/schemas.test.ts` | `frontend/src/features/onboarding/validation.test.ts` (**traslado** a `schemas.test.ts`, Q1), `frontend/src/features/onboarding/units.test.ts`, `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`, `frontend/src/features/profile/pages/ProfilePage.test.tsx`; opcional `frontend/src/test/profileFixtures.ts` | Cobertura de los AC de la 015 y traslado de los casos de la 006 |

Sin cambios: `frontend/src/features/profile/mappers.ts` (`payloadFromAnswers` y `answersFromProfile` siguen igual), `frontend/src/features/profile/api.ts`, `saveProfilePayloadSchema`, `frontend/src/features/onboarding/types.ts`, `constants.ts` (`LIMITS`, `EMPTY_ANSWERS`), `NumberField`, `UnitToggle`, `ChoiceList`, `ProfilePage.tsx` y `OnboardingRoute.tsx`.

## 3. Diseño

### 3.1 Datos y migraciones

No aplica. Ni backend, ni modelos, ni migraciones, ni cambios en el contrato de `PUT /api/profile` o `POST /api/body-metrics`.

### 3.2 Contratos e interfaces

No cambia ninguna API HTTP. Símbolos nuevos o modificados del frontend (los que importan los tests van marcados con **[T]**; el `implementer` crea sus esqueletos según el Art. P1 frontend 5: cuerpo `throw new Error("not implemented");` y parámetros con prefijo `_`).

**`frontend/src/features/onboarding/schemas.ts` (nuevo)**

```ts
import { z } from "zod"
import type { HeightUnit, OnboardingAnswers, WeightUnit } from "@/features/onboarding/types"

// Enums compartidos (los reutiliza profile/schemas.ts en lugar de redefinirlos).
export const genderSchema = z.enum(["male", "female"])
export const heightUnitSchema = z.enum(["cm", "ft"])
export const weightUnitSchema = z.enum(["kg", "lb"])
export const activityLevelSchema = z.enum(["low", "moderate", "high", "very_high", "athlete"])
export const goalSchema = z.enum(["lose", "lose_slow", "maintain", "gain_slow", "gain"])

// Mensajes visibles (textos exactos de la spec, sección 6).
export const DOB_REQUIRED_MESSAGE = "Indica tu fecha de nacimiento"
export const DOB_FUTURE_MESSAGE = "La fecha de nacimiento no puede ser futura"
export const DOB_AGE_RANGE_MESSAGE = "Debes tener entre 14 y 100 años"

// Claves de los mensajes que produce el esquema. "height" es una clave virtual
// que agrupa cm, ft e in (un solo mensaje para la altura).
export type PhysicalDataErrorKey =
  | "gender" | "dateOfBirth" | "height" | "weight" | "activityLevel" | "goal"

// "Entre 100 y 250 cm" | "Entre 3 y 8 ft"
export function heightRangeMessage(unit: HeightUnit): string
// "Entre 30 y 300 kg" | "Entre 66 y 660 lb"
export function weightRangeMessage(unit: WeightUnit): string

// Predicados de las reglas (los usa el esquema y units.ts).
export function isHeightValid(
  a: Pick<OnboardingAnswers, "heightUnit" | "heightCm" | "heightFt" | "heightIn">
): boolean
export function isWeightValid(a: Pick<OnboardingAnswers, "weightUnit" | "weight">): boolean
// null = válida; si no, el mensaje (DOB_REQUIRED_MESSAGE si está vacía o incompleta).
export function dateOfBirthMessage(value: string, today?: Date): string | null

// Forma del objeto y refinamiento compartidos (los compone profile/schemas.ts).
export const physicalDataShape: {
  gender, dateOfBirth, heightUnit, heightCm, heightFt, heightIn, weightUnit, weight, activityLevel, goal
} // z.string() para los textos, enums .nullable() para gender, activityLevel y goal
export function addPhysicalDataIssues(
  values: OnboardingAnswers,
  ctx: z.RefinementCtx,
  today: Date
): void

// [T] Esquema único de los datos físicos. Sin `today`, usa new Date() en cada validación.
export function makePhysicalDataSchema(
  today?: Date
): z.ZodType<OnboardingAnswers, OnboardingAnswers>

// [T] Primer mensaje de cada clave (issue.path[0]) de un safeParse síncrono; {} si es válido.
export function fieldMessages<K extends string>(
  schema: z.ZodType,
  values: unknown
): Partial<Record<K, string>>
```

Convención de rutas de los issues (la usan los tests y los formularios):

| Clave | Cuándo | Mensaje |
|---|---|---|
| `dateOfBirth` | vacía o incompleta / futura / edad fuera de 14–100 | `DOB_REQUIRED_MESSAGE` / `DOB_FUTURE_MESSAGE` / `DOB_AGE_RANGE_MESSAGE` |
| `height` | altura no válida (incluye pulgadas fuera de 0–11 y decimales en ft o in) | `heightRangeMessage(heightUnit)` |
| `weight` | peso no válido | `weightRangeMessage(weightUnit)` |
| `gender`, `activityLevel`, `goal` | `null` | "Elige una opción" (no se pinta en ningún formulario) |

**`frontend/src/features/profile/schemas.ts` (modificado)**

```ts
export type ProfileFormErrorKey = PhysicalDataErrorKey | "fat" | "muscle"

// [T] Datos físicos (mismo refinamiento compartido) + grasa ("" o 3–60, "Entre 3 y 60 %")
// y músculo ("" o 10–70, "Entre 10 y 70 %"), con FAT_LIMITS y MUSCLE_LIMITS de body-metrics/schemas.ts.
export function makeProfileFormSchema(
  today?: Date
): z.ZodType<PhysicalDataFormValues, PhysicalDataFormValues>
```

`profileResponseSchema` y `saveProfilePayloadSchema` no cambian de comportamiento; solo pasan a usar los enums exportados por `onboarding/schemas.ts`.

**`frontend/src/features/profile/types.ts` (modificado)**

```ts
// Composición corporal opcional (texto mientras se edita, "" = sin dato).
export type BodyComposition = { fat: string; muscle: string }
// Valores del formulario Datos físicos.
export type PhysicalDataFormValues = OnboardingAnswers & BodyComposition
```

`PhysicalDataForm` mantiene sus props (`initial: OnboardingAnswers`, `initialBody: BodyComposition`), así que `ProfilePage.tsx` no cambia.

**Sin cambios de firma:** `convertHeight`, `convertWeight`, `heightCmFromAnswers` y `KG_PER_LB` (`units.ts`); `payloadFromAnswers` y `answersFromProfile` (`mappers.ts`).

### 3.3 Lógica

- **Reglas (una sola vez, en `onboarding/schemas.ts`):**
  - Fecha: se porta tal cual `dateOfBirthError` de `validation.ts` (formato `YYYY-MM-DD`, fecha real con la comprobación de mes y día, no futura respecto al inicio del día local, edad con `ageFromIsoDate` de `@/lib/age` entre `LIMITS.age.min` y `LIMITS.age.max`, `parseLocalDate` de `@/lib/dates`). Diferencia: la fecha vacía o incompleta devuelve `DOB_REQUIRED_MESSAGE` en lugar de `""`; el onboarding decide no pintarlo (ver 3.4).
  - Altura: cm en `LIMITS.heightCm` con decimales permitidos (como hoy); ft/in con `Number.isInteger` en pies y pulgadas (Q2, AC-003.5), pies en `LIMITS.heightFt` y pulgadas en `LIMITS.heightIn`, pulgadas vacías = 0.
  - Peso: `LIMITS.kg` o `LIMITS.lb` con decimales; vacío no válido.
  - `addPhysicalDataIssues` llama a los predicados y añade un issue por clave; `makePhysicalDataSchema` es `z.object(physicalDataShape).superRefine((v, ctx) => addPhysicalDataIssues(v, ctx, today ?? new Date()))`, igual que el patrón de `makeMetricCorrectionSchema` en `body-metrics/schemas.ts`.
- **Perfil (`profile/schemas.ts`):** `z.object({ ...physicalDataShape, fat: z.string(), muscle: z.string() }).superRefine(...)` que llama a `addPhysicalDataIssues` y añade los issues `fat` y `muscle` con `FAT_LIMITS` y `MUSCLE_LIMITS` reutilizados de `body-metrics/schemas.ts`.
- **`units.ts`:** solo cambia el import de `isHeightValid`/`isWeightValid`. Como ft/in exige ahora enteros, `convertHeight` no convierte un `5.5` ft (cambia solo la unidad, coherente con REQ-006).
- **Contrato saliente:** `saveProfilePayloadSchema` se mantiene como guarda del cuerpo enviado (`.strict()`, sin `age`) y usa los mismos `LIMITS`. Con ft/in enteros en el formulario, todo valor que el esquema del formulario acepta produce un cuerpo que la guarda acepta; un test lo fija (AC-003.5).
- **Dependencias:** ninguna nueva. Se reutilizan `react-hook-form`, `@hookform/resolvers/zod` y `zod` ya instalados, `LIMITS`/`EMPTY_ANSWERS` de `onboarding/constants.ts`, `FAT_LIMITS`/`MUSCLE_LIMITS` de `body-metrics/schemas.ts`, `ageFromIsoDate`, `parseLocalDate`, `todayIsoDate`, `payloadFromAnswers`, `useSaveProfile` y `useCreateBodyMetric`.

### 3.4 Interfaz de usuario

Patrón común a los dos formularios (como `MetricEditForm.tsx`, que ya usa `watch` + `setValue` con componentes controlados):

- `const schema = useMemo(() => makePhysicalDataSchema(), [])` (o `makeProfileFormSchema()` en el perfil).
- `const form = useForm<T>({ resolver: zodResolver(schema), defaultValues })`; `const values = form.watch()`.
- `const errors = fieldMessages<K>(schema, values)` en cada render: es síncrono, así que un `fireEvent.change` ya pinta el mensaje en el mismo render (lo exigen los tests existentes de la 006, por ejemplo la fecha futura del perfil, y REQ-010). No se usa `formState.errors` para pintar porque `trigger`/resolver es asíncrono.
- `update(patch)` aplica cada clave con `form.setValue(key, value, { shouldDirty: true })`. Los campos no se desregistran al cambiar de paso (`shouldUnregister` por defecto `false`), así que "Atrás" conserva lo respondido.
- Los selectores de unidad siguen llamando a `update(convertHeight(values, unit))` y `update(convertWeight(values, unit))`.

**Onboarding (`OnboardingPage.tsx`):**

- `defaultValues = { ...EMPTY_ANSWERS, dateOfBirth: initialDateOfBirth ?? "" }`.
- Cada paso declara sus claves de error: género `["gender"]`, fecha `["dateOfBirth"]`, altura `["height"]`, peso `["weight"]`, actividad `["activityLevel"]`, meta `["goal"]`; `isValid = claves.every((k) => !errors[k])`.
- Fecha: se pinta el mensaje (y `aria-invalid`) solo si `errors.dateOfBirth` existe y no es `DOB_REQUIRED_MESSAGE` (AC-001.4: vacía sin mensaje). Con la fecha prerrellenada `1900-01-01`, el mensaje se ve sin tocar nada (AC-007.5) porque se deriva en el primer render.
- Altura y peso: nunca se pinta mensaje; solo cuenta para `isValid`.
- Se conservan `choose` (avance a los 250 ms con el guardia `advancing`), `goBack`, el indicador "N de 6", la animación y el botón "Siguiente"/"Comenzar"/"Guardando…".
- Envío: el `<form>` sigue llamando a `goNext()` (Enter o botón). En el último paso, `goNext` activa el guardia `submitting` y llama a `form.handleSubmit(onValid, onInvalid)()`; `onValid(v)` hace `saveProfile.mutate(payloadFromAnswers(v), { onSuccess: navigate("/home", { replace: true }), onError: soltar el guardia })`; `onInvalid` suelta el guardia. Así se mantiene un único envío aunque se pulse dos veces antes de que `isPending` se refleje (AC-008.3).

**Datos físicos (`PhysicalDataForm.tsx`):**

- `defaultValues = { ...initial, ...initialBody }` (tipo `PhysicalDataFormValues`).
- Valores guardados de referencia: `const [saved, setSaved] = useState(defaultValues)`, sin casts. "Descartar" = `form.reset(saved)`; tras un guardado correcto, `setSaved(v)` y `form.reset(v)` (AC-009.6).
- `dirty` y `measurementChanged` se calculan como hoy, comparando `values` con `saved` (texto de los datos físicos, peso en kg con umbral de 0,05 y grasa o músculo cambiados).
- `allValid = Object.keys(errors).length === 0`; "Guardar cambios" deshabilitado si `!dirty || !allValid || isPending`.
- Mensajes: fecha `errors.dateOfBirth` (incluye "Indica tu fecha de nacimiento", REQ-002) con `aria-invalid` en el input; altura `errors.height` con `invalid` en todos los campos de altura; peso `errors.weight`; grasa `errors.fat`; músculo `errors.muscle`. Se ven desde la carga sin pulsar "Guardar cambios" (REQ-010).
- `<form onSubmit={form.handleSubmit(onSave)}>`: `onSave(v)` conserva la secuencia actual (reset de mutaciones, `PUT` del perfil con `payloadFromAnswers(v)`, después la medición de hoy solo si cambió el peso o la composición, con grasa o músculo solo si cambiaron, y finalmente `commit`). `justSaved` sigue siendo estado local: se activa en `commit`, se apaga a los 3 s o en cualquier `update`.
- `Field` y `OptionSelect` se conservan; `optionalInRange` desaparece.

Textos, estilos, orden de campos y `aria-*` no cambian salvo el comportamiento de ft/in con decimales (Q2).

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `dateOfBirthMessage` y `addPhysicalDataIssues` en `onboarding/schemas.ts`; pintado en `OnboardingPage.tsx` (oculta el mensaje de vacía) y `PhysicalDataForm.tsx` |
| REQ-002 | `DOB_REQUIRED_MESSAGE` en el esquema; `PhysicalDataForm.tsx` pinta `errors.dateOfBirth` con `aria-invalid` y deshabilita "Guardar cambios" |
| REQ-003 | `isHeightValid` (ft/in enteros) y `heightRangeMessage` en `onboarding/schemas.ts`; clave `height` en los dos formularios; guarda `saveProfilePayloadSchema` coherente |
| REQ-004 | `isWeightValid` y `weightRangeMessage` en `onboarding/schemas.ts`; clave `weight` en los dos formularios |
| REQ-005 | `makeProfileFormSchema` en `profile/schemas.ts` con `FAT_LIMITS`/`MUSCLE_LIMITS`; claves `fat` y `muscle` en `PhysicalDataForm.tsx` |
| REQ-006 | `convertHeight`/`convertWeight` de `units.ts` (sin cambios de lógica, validez desde `schemas.ts`) llamados vía `update` en los dos formularios |
| REQ-007 | `OnboardingPage.tsx`: pasos, `choose`, `goNext`/`goBack`, validez por paso desde `fieldMessages`, valores conservados en RHF |
| REQ-008 | `OnboardingPage.tsx`: `handleSubmit` + guardia `submitting` + `payloadFromAnswers` (sin cambios) |
| REQ-009 | `PhysicalDataForm.tsx`: `saved` + `form.reset`, `dirty`, `measurementChanged`, `onSave` y `justSaved` |
| REQ-010 | `fieldMessages` síncrono en cada render de `PhysicalDataForm.tsx` |

La spec no define NFR (sección 5); la ausencia de regresiones la cubren los tests existentes de las specs 006, 008 y 009, que no se tocan salvo el traslado de `validation.test.ts` (Q1).

## 5. Estrategia de pruebas

**Ámbito frontend** (Vitest + Testing Library, `globals: false`, nombres de los `it` en español, marcador `// SDD: 015 REQ-… AC-…` en la línea anterior; Art. P1 frontend). Sin servicios externos: solo `npm ci`. La red se simula con `vi.mock("@/features/profile/api", …)` y `vi.mock("@/features/body-metrics/api", …)`, como ya hacen `OnboardingPage.test.tsx` y `ProfilePage.test.tsx`. No hacen falta dobles nuevos; se reutilizan `makeAnswers`, `makeProfileResponse` y `makePendingResponse` de `frontend/src/test/profileFixtures.ts` (se puede añadir ahí una fábrica `makeProfileFormValues` si ayuda).

**Unitarios (puros, "hoy" fijo `new Date(2026, 9, 11)`):**

- `frontend/src/features/onboarding/schemas.test.ts` (nuevo):
  - **Traslado de `validation.test.ts` (Q1, Art. B5.3):** los seis casos con los mismos valores (`""`, `2026-10-12`, `2020-01-01`, `2012-10-12`, `1900-01-01`, `1925-10-11`, `2012-10-11`, `1925-10-12`, `1998-04-03`), el mismo hoy fijo y las mismas aserciones, reescritas sobre `fieldMessages(makePhysicalDataSchema(TODAY), makeAnswers({ dateOfBirth }))` y `safeParse(...).success`. El caso vacío sigue afirmando "no válida" y "ni mensaje de futura ni de rango". Marcadores: los de la 006 con su número delante (`// SDD: 006 REQ-009 AC-009.2`, `006 REQ-009 AC-009.3`, `006 REQ-009 AC-009.4` ×2, `006 REQ-009 AC-009.1`, `006 REQ-011 AC-011.4`), para que no se confundan con los REQ homónimos de la 015. `validation.test.ts` se elimina en la misma tarea que `validation.ts`; es un traslado, no un borrado.
  - 015: AC-001.1, AC-001.2, AC-001.3 (fecha en el esquema), AC-002.1 (vacía → "Indica tu fecha de nacimiento"), AC-003.1 a AC-003.5 (clave `height` y sus mensajes, incluidos `5.5` ft y pulgadas con decimales), AC-004.1 a AC-004.3 (clave `weight`).
  - AC-003.5, invariante: para valores válidos en ft/in (y en cm), `saveProfilePayloadSchema.safeParse(payloadFromAnswers(v)).success` es `true`; con `5.5` ft el esquema del formulario ya los rechaza.
- `frontend/src/features/profile/schemas.test.ts` (nuevo): AC-005.1 a AC-005.3 sobre `makeProfileFormSchema(TODAY)` (claves `fat` y `muscle`), y que hereda las reglas compartidas (AC-002.1: fecha vacía da el mismo mensaje).
- `frontend/src/features/onboarding/units.test.ts` (añadir): AC-006.1 (`175` cm ↔ `5` ft `9` in), AC-006.2 (`182` cm → `6` ft `0` in), AC-006.3 (`72` kg → `158.7` lb; `160` lb → `72.6` kg), AC-006.4 (`1750` cm y `20` kg solo cambian la unidad) y AC-003.5 (`5.5` ft no se convierte).

**De página (integración de componente con la red simulada):**

- `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx` (añadir; los tests existentes no se tocan):
  - AC-001.1 a AC-001.4 en la pregunta de la fecha (con `vi.useFakeTimers({ toFake: ["Date"] })` y `vi.setSystemTime(new Date(2026, 9, 11, 12, 0))`, como el perfil).
  - AC-003.2 a AC-003.5 y AC-004.2/AC-004.3: "Siguiente" deshabilitado y ningún texto "Entre …" visible.
  - AC-006.1/AC-006.4 por la UI (un caso basta; la conversión ya está cubierta en unitarios).
  - AC-007.1 a AC-007.5: avance solo en género, Enter en la altura (`user.type(input, "175{Enter}")`), "Atrás" con `175` conservado y "Siguiente" habilitado, meta sin avance automático, fecha prerrellenada y `1900-01-01` con el aviso visible sin tocar el campo.
  - AC-008.1 (`5` ft con pulgadas vacías y `160` lb → `height_in: 0`, sin `age`), AC-008.2 (cm y kg), AC-008.3 (dos clics, un solo `saveProfile`, "Guardando…" deshabilitado).
- `frontend/src/features/profile/pages/ProfilePage.test.tsx` (añadir; los existentes no se tocan):
  - AC-001.1 a AC-001.3 en el perfil; AC-002.1 y AC-002.2 (`aria-invalid="true"`, mensaje que aparece y desaparece); AC-003.1 a AC-003.5 (mensajes "Entre 100 y 250 cm" y "Entre 3 y 8 ft", incluido `5.5` ft); AC-004.1 a AC-004.3; AC-005.1 a AC-005.3.
  - AC-006.x por la UI del perfil (al menos `72` kg → `158.7` lb).
  - AC-009.1 a AC-009.6: sin cambios no hay "Descartar"; descartar restaura los valores cargados; cambiar solo la unidad de peso envía `weight_unit: "lb"` sin medición; músculo `40` con grasa `20` sin tocar → medición sin `body_fat_percentage`; "Cambios guardados" desaparece a los 3 s (`vi.useFakeTimers({ shouldAdvanceTime: true })`, `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` y `act(() => vi.advanceTimersByTime(3000))`) o al editar; segunda medición con `79.5` tras guardar `80`.
  - AC-010.1 (perfil sin fecha → el aviso ya está visible al cargar) y AC-010.2 (`500` kg → "Entre 30 y 300 kg" sin pulsar guardar).
  - El Select de Radix necesita los mismos stubs de `Element.prototype` que ya ponen los `beforeEach` del archivo.

**Rojo esperado (Art. B5.2):** es un refactor, así que muchos tests de página **caracterizan** comportamiento que ya existe y pasarán antes de implementar. El rojo legítimo lo dan:
- los tests unitarios que importan `makePhysicalDataSchema`, `fieldMessages` y `makeProfileFormSchema` (fallan con `not implemented` del esqueleto);
- los tests de AC-003.5 (decimales en ft/in) en las dos páginas y en `units.test.ts`, que hoy fallan por comportamiento ausente.

Los tests de caracterización que ya pasan se declaran así en `tasks.md` para que el `verifier` no los cuente como rojo ilegítimo. Al terminar deben pasar `npm test`, `npm run lint` (sin errores nuevos), `npx tsc -b` y `npm run build`.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| La validación de RHF (resolver) es asíncrona y rompería tests existentes que comprueban el mensaje justo después de `fireEvent.change` (p. ej. fecha futura en el perfil) | Alta si se pintara `formState.errors` | Alto (Art. B5.3) | Los mensajes se derivan con `fieldMessages` (safeParse síncrono del mismo esquema) en cada render; RHF solo gestiona valores, `reset` y `handleSubmit` |
| El rojo de los tests de caracterización no se ve porque el comportamiento ya existe | Alta | Medio (bloqueo en la verificación del rojo) | Rojo legítimo concentrado en los símbolos nuevos y en AC-003.5; los de caracterización se marcan como tales en `tasks.md` (sección 5) |
| Los marcadores trasladados de la 006 sin número chocan con los REQ/AC homónimos de la 015 en el mismo archivo | Media | Medio (trazabilidad confusa) | Se trasladan con el prefijo `006` (Art. P1.1, ADR-0022); los nuevos llevan `015` |
| `handleSubmit` con campos no registrados (componentes controlados con `setValue`) no enviaría algún valor | Baja | Alto (cuerpo distinto al actual) | `defaultValues` completos y `shouldUnregister: false`; AC-008.1, AC-008.2 y los tests existentes comparan el cuerpo exacto |
| Exigir `gender`, `activityLevel` y `goal` en el esquema del perfil deshabilita "Guardar cambios" si alguna vez faltan | Baja (el guard de onboarding lo impide) | Bajo | Hoy ese caso ya fallaba al validar el cuerpo; ningún mensaje visible nuevo |

## 7. Cumplimiento de la constitución

- **Art. B1 / B1.3:** el plan no cambia el alcance; el único cambio visible es el de Q2 aceptado en la spec.
- **Art. B2:** el plan solo escribe `plan.md`.
- **Art. B4.3:** cada AC tiene asignado al menos un test en la sección 5; los nuevos llevan `// SDD: 015 …`.
- **Art. B5.3:** ningún test existente se borra ni se debilita; `validation.test.ts` se **traslada** íntegro a `schemas.test.ts` (Q1) con sus valores, hoy fijo, aserciones y marcadores de la 006 (con su número delante).
- **Art. B5.6 / P1 frontend 5:** esqueletos de `makePhysicalDataSchema`, `fieldMessages` y `makeProfileFormSchema` con `throw new Error("not implemented");` y parámetros con `_`.
- **Art. B5.7 / P2 frontend 5:** sin errores nuevos de oxlint ni de tipos (`zodResolver` tipado con `z.ZodType<T, T>` para que entrada y salida coincidan con los valores de `useForm<T>`).
- **Art. P1 frontend 1–4:** tests junto a su archivo, imports explícitos de `vitest`, nombres en español y red simulada en `api.ts`.
- **Art. P2 frontend 1:** las reglas viven en `schemas.ts` de cada feature y los tipos en `types.ts`.
- **Art. P2 frontend 3:** los dos formularios pasan a react-hook-form con zod; se salda la desviación aceptada en el plan de la 006. Matiz justificado: los mensajes se pintan desde el esquema zod evaluado de forma síncrona en lugar de `formState.errors`, por la asincronía del resolver (sección 6); la fuente de las reglas sigue siendo una sola y `handleSubmit` con `zodResolver` controla el envío.
- **Art. P2 General 1:** textos sin cambios, en español con tildes.
- **Art. P3.2:** la entrada del usuario se valida con zod en el frontend; `saveProfilePayloadSchema` sigue protegiendo el cuerpo saliente.
- **Art. P4:** sin migraciones ni pasos manuales en producción (despliegue normal de Vercel).

No queda ningún "DEBERÍA" sin cumplir.

## 8. ADRs

Ninguna. Es la aplicación del Art. P2.3 a dos formularios más; la forma de pintar los errores se justifica en este plan y no establece una decisión general para el resto de formularios.
