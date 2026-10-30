# Plan 031 — Chat de porciones en el diario (frontend)

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-30)
- **Ámbitos:** `frontend`

## 1. Resumen de la solución

Se añade a la feature `diary` un componente `PortionChat` que se pinta en `/diary` justo después de `DailyTotals`.
La consulta a `POST /api/meals/portion-estimate` (spec 030, sin cambios) va en `api.ts` (`estimatePortion`, que pasa
por `apiFetch` y valida la respuesta con zod) y se envuelve en una mutación de TanStack Query sin reintentos
(`useEstimatePortion`). Como `DiaryDayView` se monta con `key={date}` y además desaparece mientras carga el día
nuevo, **todo el estado del chat** (turnos, pregunta en curso y formulario de react-hook-form) vive en un hook
`usePortionChat()` que se llama en `DiaryPage`, que no se desmonta al cambiar de día; `PortionChat` es
presentacional y lo recibe por props. Al salir de `/diary`, `DiaryPage` se desmonta y la conversación se pierde, como
pide la spec. Sin backend, sin migraciones, sin dependencias nuevas.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| frontend | `diary` · api | — | `frontend/src/features/diary/api.ts` | `estimatePortion(question)` sobre `apiFetch` con validación zod de la respuesta (REQ-003, AC-007.5). |
| frontend | `diary` · esquemas | — | `frontend/src/features/diary/schemas.ts` | `portionQuestionFormSchema` (pregunta) y `portionEstimateResponseSchema` (respuesta 200). |
| frontend | `diary` · tipos | — | `frontend/src/features/diary/types.ts` | `PortionEstimate`, `PortionChatAnswer`, `PortionChatTurn`, `PortionQuestionFormValues`. |
| frontend | `diary` · constantes | — | `frontend/src/features/diary/constants.ts` | `PORTION_QUESTION_MAX_LENGTH = 200`. |
| frontend | `diary` · errores | — | `frontend/src/features/diary/errors.ts` | `PORTION_ESTIMATE_FAILED_MESSAGE` y `portionEstimateErrorAnswer(error)` (REQ-007). |
| frontend | `diary` · lógica pura | `frontend/src/features/diary/portionChat.ts` | — | `portionAnswerFromEstimate` y `formatEstimatedGrams` (REQ-005, REQ-006). |
| frontend | `diary` · hooks | — | `frontend/src/features/diary/hooks.ts` | `useEstimatePortion()` y `usePortionChat()` con el estado elevado (REQ-003, REQ-004, REQ-008). |
| frontend | `diary` · componentes | `frontend/src/features/diary/components/PortionChat.tsx` | `frontend/src/features/diary/components/DiaryDayView.tsx` | Bloque del chat; `DiaryDayView` recibe un hueco `afterTotals` que pinta entre `DailyTotals` y el aviso de día vacío (REQ-001). |
| frontend | `diary` · página | — | `frontend/src/features/diary/pages/DiaryPage.tsx` | Llama a `usePortionChat()` y pasa `<PortionChat chat={…} />` en `afterTotals` (REQ-001, REQ-008). |
| frontend | utilidades de test | `frontend/src/test/portionEstimateFixtures.ts` | — | `makePortionEstimate(…)` y respuestas tipo de la spec. |
| frontend | tests | `frontend/src/features/diary/portionChat.test.ts`, `frontend/src/features/diary/components/PortionChat.test.tsx` | `frontend/src/features/diary/api.test.ts`, `frontend/src/features/diary/schemas.test.ts`, `frontend/src/features/diary/errors.test.ts`, `frontend/src/features/diary/pages/DiaryPage.test.tsx` | Ver sección 5. |

## 3. Diseño

### 3.1 Datos y migraciones

No aplica. No hay cambios de modelo ni de backend. La conversación vive solo en memoria (estado de React de
`DiaryPage`); no se usa `localStorage`, `sessionStorage` ni la caché de TanStack Query para guardarla.

### 3.2 Contratos e interfaces

**Consumo (sin cambios, spec 030):** `POST /api/meals/portion-estimate`, con sesión (el `Authorization` lo pone
`apiFetch`). Cuerpo `{"question": string}`. 200 con `{status, grams, unit, note, message}`. Errores `{"error": …}`
con 400, 429 y 503 (mensaje del servidor), 401 (lo gestiona `apiFetch`: cierra sesión y va a `/login`) y cualquier
otro.

**Firmas exactas de los símbolos nuevos** (los tests los importan; el `implementer` crea primero sus esqueletos con
`throw new Error("not implemented")` y parámetros con `_`, Art. P1 frontend 5):

`frontend/src/features/diary/constants.ts`
```ts
export const PORTION_QUESTION_MAX_LENGTH = 200
```
(Constante: no es esqueleto, se escribe con su valor.)

`frontend/src/features/diary/types.ts`
```ts
export type PortionEstimate =
  | { status: "estimated"; grams: number; unit: string | null; note: string | null }
  | { status: "not_food" | "unknown"; message: string }
// Respuesta mostrada debajo de una pregunta.
export type PortionChatAnswer =
  | { kind: "estimate"; grams: number; unit: string | null; note: string | null }
  | { kind: "message"; text: string } // not_food / unknown
  | { kind: "notice"; text: string } // 429, estilo neutro
  | { kind: "error"; text: string } // 400, 503 y cualquier otro fallo
export type PortionChatTurn = { id: number; question: string; answer: PortionChatAnswer | null } // null = en curso
export type PortionQuestionFormValues = { question: string }
```

`frontend/src/features/diary/schemas.ts`
```ts
// Pregunta sin los espacios de los extremos, obligatoria y de hasta 200 caracteres. La salida ya va recortada.
export const portionQuestionFormSchema: z.ZodType<PortionQuestionFormValues, PortionQuestionFormValues>
// = z.object({ question: z.string().trim().min(1).max(PORTION_QUESTION_MAX_LENGTH) })

// Respuesta 200 del contrato de la 030. Cualquier otra forma lanza (AC-007.5).
export const portionEstimateResponseSchema: z.ZodType<PortionEstimate, unknown>
// = z.union([
//     z.object({ status: z.literal("estimated"), grams: z.number().int().min(1).max(5000),
//                unit: z.string().nullable(), note: z.string().nullable() }),
//     z.object({ status: z.enum(["not_food", "unknown"]), message: z.string().min(1) }),
//   ])
```
Los esquemas son valores, no funciones: no llevan esqueleto `not implemented`; el `implementer` los escribe en la
etapa de scaffold con un esquema provisional que no valide nada (`z.never()` con el tipo forzado por `as`), de modo
que los tests de esquema fallen por comportamiento ausente, y los completa al implementar.

`frontend/src/features/diary/api.ts`
```ts
export async function estimatePortion(question: string): Promise<PortionEstimate>
// apiFetch<unknown>("/api/meals/portion-estimate", { method: "POST", body: { question } })
// y portionEstimateResponseSchema.parse(...)
```

`frontend/src/features/diary/errors.ts`
```ts
export const PORTION_ESTIMATE_FAILED_MESSAGE = "No se pudo estimar el peso. Vuelve a intentarlo."
export function portionEstimateErrorAnswer(error: unknown): Extract<PortionChatAnswer, { kind: "notice" | "error" }>
```

`frontend/src/features/diary/portionChat.ts`
```ts
export function formatEstimatedGrams(grams: number): string // «Unos 250 g»
export function portionAnswerFromEstimate(estimate: PortionEstimate): PortionChatAnswer
```

`frontend/src/features/diary/hooks.ts`
```ts
export function useEstimatePortion(): UseMutationResult<PortionEstimate, Error, string>
export type PortionChatState = {
  form: UseFormReturn<PortionQuestionFormValues>
  turns: PortionChatTurn[]
  isPending: boolean
  submit: (values: PortionQuestionFormValues) => void
}
export function usePortionChat(): PortionChatState
```

`frontend/src/features/diary/components/PortionChat.tsx`
```ts
export function PortionChat({ chat }: { chat: PortionChatState }): ReactElement
```

`frontend/src/features/diary/components/DiaryDayView.tsx` (prop nueva, opcional para no romper usos existentes)
```ts
afterTotals?: ReactNode
```

`frontend/src/test/portionEstimateFixtures.ts`
```ts
export const EGGS_ESTIMATE: { status: "estimated"; grams: 250; unit: "5 huevos grandes"; note: "Unos 50 g por huevo sin cáscara."; message: null }
export const NOT_FOOD_RESPONSE: { status: "not_food"; grams: null; unit: null; note: null; message: "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento." }
export const UNKNOWN_RESPONSE: { status: "unknown"; grams: null; unit: null; note: null; message: "No he podido estimar el peso. Prueba a describir el alimento de otra forma." }
export function makePortionEstimate(overrides?: Partial<PortionEstimate>): PortionEstimate // estimated por defecto
```
Las tres constantes son respuestas **crudas** del contrato (con todas las claves), para alimentar a `apiFetch`
simulado o al esquema; `makePortionEstimate` devuelve ya el tipo parseado, para simular `estimatePortion`. Este
archivo es utilitario de test y lo escribe el `test-author` (Art. P1 frontend 1).

### 3.3 Lógica

- **`estimatePortion`** (api.ts): una sola llamada a `apiFetch` con el cuerpo `{ question }` tal cual lo recibe (ya
  recortado por el esquema del formulario); nunca envía turnos anteriores (AC-003.3). La respuesta pasa por
  `portionEstimateResponseSchema.parse`: si no encaja (p. ej. `estimated` con `grams` nulo o un `status`
  desconocido), lanza un `ZodError`. Un cuerpo que no es JSON (p. ej. un 502 en HTML) hace fallar `JSON.parse` en
  `apiFetch`, que también lanza: ambos casos acaban en el mensaje genérico.
- **`portionEstimateErrorAnswer`** (errors.ts), con el patrón de `analysisErrorView`:
  - `ApiError` 429 → `{ kind: "notice", text: error.message }`;
  - `ApiError` 400 o 503 → `{ kind: "error", text: error.message }`;
  - cualquier otro (otro `ApiError`, `TypeError` de red, `ZodError`, `SyntaxError`…) →
    `{ kind: "error", text: PORTION_ESTIMATE_FAILED_MESSAGE }`; nunca se muestra el texto original (AC-007.4).
- **`portionAnswerFromEstimate`** (portionChat.ts): `estimated` → `{ kind: "estimate", grams, unit, note }`;
  `not_food`/`unknown` → `{ kind: "message", text: message }`. **`formatEstimatedGrams`** devuelve
  `` `Unos ${grams} g` `` con `String(grams)` (entero garantizado por el esquema; sin `Intl`, para no meter separador
  de miles: AC-005.3 «Unos 5000 g»).
- **`useEstimatePortion`** (hooks.ts): `useMutation({ mutationFn: estimatePortion, retry: false })`; sin
  `onSuccess` que invalide nada (NFR-002: ni el diario ni la biblioteca se vuelven a leer). `retry: false` porque cada
  pregunta cuenta para el límite de 10 cada 6 h (como `useAnalyzeMealPhoto`).
- **`usePortionChat`** (hooks.ts), llamado en `DiaryPage`:
  - `form = useForm<PortionQuestionFormValues>({ resolver: zodResolver(portionQuestionFormSchema), mode: "onSubmit",
    reValidateMode: "onSubmit", defaultValues: { question: "" } })`. Al vivir en `DiaryPage`, el valor del campo y
    el control sobreviven al desmontaje de `PortionChat` (RHF con `shouldUnregister: false` por defecto).
  - `turns` en `useState<PortionChatTurn[]>([])`; ids con un `useRef` contador.
  - `inFlightRef` (`useRef(false)`) evita una segunda petición antes de que React vuelva a pintar (doble Enter).
  - `isPending = turns.some((turn) => turn.answer === null)`.
  - `submit(values)`: si `inFlightRef.current`, sale sin hacer nada (el campo conserva lo escrito, AC-004.1). Si no,
    marca `inFlightRef`, añade `{ id, question: values.question, answer: null }`, vacía el campo con
    `form.setValue("question", "")` (no mueve el foco, AC-N001.2) y llama a `estimate.mutateAsync(values.question)`;
    al resolverse escribe en el turno `id` el resultado de `portionAnswerFromEstimate` o de
    `portionEstimateErrorAnswer`, y en `finally` libera `inFlightRef`. Se actualiza por `id`, así que la respuesta
    cae debajo de su pregunta aunque el día haya cambiado mientras tanto (AC-008.3).
  - El formulario se envía con `form.handleSubmit(chat.submit)`: si la pregunta está vacía o solo tiene espacios, el
    resolver la rechaza y `submit` no se llama (AC-002.2), además de estar el botón desactivado.
- **Dependencias:** `apiFetch` (Art. P2 frontend 2), `ApiError`, TanStack Query, react-hook-form, `zodResolver` y
  zod, ya presentes. Se reutilizan los componentes `Card`, `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`,
  `Input` y `Button` de `src/components/ui/`.

### 3.4 Interfaz de usuario

- **Colocación:** `DiaryDayView` pinta `{afterTotals}` justo después de `<DailyTotals …/>` y antes del aviso de día
  vacío y de las `MealSection`. `DiaryPage` pasa `afterTotals={<PortionChat chat={portionChat} />}` solo dentro del
  bloque `diary.data && targets`, así que el chat no aparece mientras carga ni si falla la carga (AC-001.5), y sí en
  días pasados (AC-001.4). Al cambiar de día, `PortionChat` se desmonta y se vuelve a montar con el mismo estado,
  que está en `DiaryPage`.
- **Estructura de `PortionChat`** (dentro de un `Card` con `mb-4`, como `DailyTotals`):
  - `<section aria-labelledby={titleId}>` con `<h2 id={titleId}>Calcular gramos con IA</h2>` (mismo nivel que los
    encabezados de las secciones, que son `h2`) y un `<p>` con el texto explicativo exacto de la sección 6 de la spec.
  - Área de conversación: `<div role="log" aria-label="Conversación sobre gramos">` (`role="log"` lleva
    `aria-live="polite"` implícito; se añade también `aria-live="polite"` explícito para lectores que no lo infieran,
    AC-N001.1), con altura máxima y desplazamiento (`max-h-64 overflow-y-auto`) para que la ventana sea «pequeña».
    - Sin turnos: `<p>Todavía no has preguntado nada.</p>`.
    - Cada turno: la pregunta (burbuja del usuario, alineada a la derecha) y debajo su respuesta:
      - `answer === null` → `<p>Calculando…</p>`;
      - `estimate` → `<p>{formatEstimatedGrams(grams)}</p>`, `{unit && <p>Porción: {unit}</p>}`,
        `{note && <p>{note}</p>}`;
      - `message` → `<p>{text}</p>`;
      - `notice` → `<p className="text-muted-foreground">{text}</p>` (aviso neutro, AC-007.1);
      - `error` → `<p className="text-destructive">{text}</p>` (AC-007.2–007.5).
    - Se pinta cada turno con `key={turn.id}`; el orden es el de `turns` (AC-008.1). Tras añadir un turno o una
      respuesta, un efecto desplaza el área al final (`scrollTop = scrollHeight`), sin mover el foco.
  - Formulario: `<Form {...chat.form}><form onSubmit={chat.form.handleSubmit(chat.submit)}>` con un `FormField`
    `question`:
    - `FormLabel` «Alimento o porción» (visible en `sr-only` para no recargar la ventana; el nombre accesible es el
      mismo);
    - `Input` de una línea, `placeholder="Por ejemplo: 5 huevos"`, `maxLength={PORTION_QUESTION_MAX_LENGTH}`,
      `autoComplete="off"`, y `onChange` que recorta a 200 caracteres
      (`field.onChange(event.target.value.slice(0, PORTION_QUESTION_MAX_LENGTH))`) por si el navegador no aplica
      `maxLength` a lo pegado (AC-002.3). El campo **no** se desactiva con una pregunta en curso (AC-004.1);
    - contador `{n}/200` con `n = value.length` (leído con `useWatch({ control: chat.form.control, name:
      "question" })` dentro de `PortionChat`, para que solo este componente se vuelva a pintar al escribir);
    - `Button type="submit"` «Preguntar», `disabled={value.trim() === "" || chat.isPending}` (AC-002.1, AC-002.4,
      AC-004.1, AC-004.2, AC-007.6). Con el botón de envío desactivado, el Enter del campo no envía el formulario
      (envío implícito del HTML), y `submit` y el resolver lo impiden de todos modos.
  - No se renderiza `FormMessage`: la validación solo bloquea el envío, sin texto de error.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `PortionChat.tsx` (título, texto, campo, botón, conversación vacía); `DiaryDayView.tsx` (`afterTotals` entre `DailyTotals` y el aviso de día vacío); `DiaryPage.tsx` (solo con `diary.data && targets`). |
| REQ-002 | `PortionChat.tsx` (`maxLength`, recorte en `onChange`, contador, botón desactivado); `schemas.ts` (`portionQuestionFormSchema`); `constants.ts` (`PORTION_QUESTION_MAX_LENGTH`). |
| REQ-003 | `hooks.ts` (`usePortionChat.submit`: añade turno, vacía campo, «Calculando…»); `api.ts` (`estimatePortion` con `{ question }` recortada, sin historial); `schemas.ts` (recorte con `trim`). |
| REQ-004 | `hooks.ts` (`isPending`, `inFlightRef`); `PortionChat.tsx` (botón desactivado con `isPending`, campo activo). |
| REQ-005 | `portionChat.ts` (`portionAnswerFromEstimate`, `formatEstimatedGrams`); `PortionChat.tsx` (líneas «Porción:» y nota opcionales). |
| REQ-006 | `portionChat.ts` (`kind: "message"`); `PortionChat.tsx`. |
| REQ-007 | `errors.ts` (`portionEstimateErrorAnswer`, `PORTION_ESTIMATE_FAILED_MESSAGE`); `schemas.ts` (`portionEstimateResponseSchema` rechaza formas inesperadas); `PortionChat.tsx` (estilos `notice` y `error`); `hooks.ts` (libera el envío tras el fallo). |
| REQ-008 | `hooks.ts` (`usePortionChat` llamado en `DiaryPage`, que no se desmonta al cambiar de día; actualización por `id`); `PortionChat.tsx` (orden de `turns`). |
| NFR-001 | `PortionChat.tsx` (`role="log"`, `aria-live="polite"`, `aria-label="Conversación sobre gramos"`; `setValue` sin mover el foco). |
| NFR-002 | `hooks.ts` (`useEstimatePortion` sin invalidaciones); `api.ts` (solo `POST /api/meals/portion-estimate`). |

## 5. Estrategia de pruebas

**Ámbito `frontend`** (Vitest + Testing Library + user-event; `globals: false`, nombres de `it` en español,
marcadores `// SDD: 031 REQ-… AC-…`). Sin servicios externos: no hace falta Postgres ni Redis. La red se simula
según Art. P1 frontend 4: en `apiClient` para los tests de `api.ts` y en `@/features/diary/api` para los de
componente y página. No hacen falta dobles nuevos aparte de las respuestas de `portionEstimateFixtures.ts`; la
respuesta en curso se simula con una promesa diferida creada en el propio test (`let resolve; new Promise(r =>
resolve = r)`).

| Archivo | Tipo | Qué prueba | AC |
|---|---|---|---|
| `src/features/diary/api.test.ts` (añadir `describe("estimatePortion")`) | unitario, `vi.mock("@/lib/apiClient")` como ya hace el archivo | Llama una vez a `apiFetch` con `"/api/meals/portion-estimate"`, `method: "POST"` y `body` exactamente `{ question }`; devuelve la respuesta parseada; lanza con `estimated` + `grams: null` y con un `status` desconocido. | AC-003.1, AC-003.3, AC-007.5 |
| `src/features/diary/schemas.test.ts` (añadir) | unitario | `portionQuestionFormSchema`: rechaza `""` y `"   "`; acepta `"  5 huevos  "` con salida `"5 huevos"`; acepta 200 y rechaza 201 caracteres. `portionEstimateResponseSchema`: acepta las tres respuestas de la spec (AC-005.1, AC-005.2, AC-006.1, AC-006.2), acepta `grams` 5000 y rechaza `grams` nulo, decimal y `status` desconocido. | AC-002.2, AC-003.1, AC-005.1–005.3, AC-006.1, AC-006.2, AC-007.5 |
| `src/features/diary/errors.test.ts` (añadir) | unitario | `portionEstimateErrorAnswer`: 429 → `notice` con el mensaje; 400 y 503 → `error` con el mensaje; 500, `TypeError("Failed to fetch")` y un `ZodError` → `error` con `PORTION_ESTIMATE_FAILED_MESSAGE` y sin el texto original. | AC-007.1–007.5 |
| `src/features/diary/portionChat.test.ts` (nuevo) | unitario | `formatEstimatedGrams(250)` = «Unos 250 g», `(5000)` = «Unos 5000 g»; `portionAnswerFromEstimate` con `estimated` (con y sin `unit`/`note`) y con `not_food`/`unknown`. | AC-005.1–005.3, AC-006.1, AC-006.2 |
| `src/features/diary/components/PortionChat.test.tsx` (nuevo) | componente, `vi.mock("@/features/diary/api", () => ({ estimatePortion: vi.fn() }))` | Se renderiza con un arnés del propio test que llama a `usePortionChat()` y pinta `<PortionChat chat={…} />` dentro de `QueryClientProvider`. Prueba: textos, etiqueta, botón y conversación vacía; contador «0/200» y botón desactivado; Enter con espacios no llama a `estimatePortion`; pegar/escribir 250 caracteres deja 200 y «200/200»; «5 huevos» → «8/200» y botón activo; «  5 huevos  » + clic → una llamada con `"5 huevos"`, pregunta visible, campo vacío y «Calculando…»; Enter envía; segunda pregunta envía solo la suya; con una en curso, escribir y pulsar botón o Enter no llama de nuevo y el campo conserva el texto; al resolver desaparece «Calculando…» y el botón se reactiva; estimación completa, sin `unit`/`note` y 5000; `not_food` y `unknown` sin «Unos» ni «Porción:»; 429 con clase neutra (sin `text-destructive`), 400 y 503 con `text-destructive`; red y 500 con el mensaje genérico; forma inesperada (`estimatePortion` rechaza con un `ZodError`) con el mensaje genérico; tras un fallo se puede enviar otra; dos preguntas en orden; `role="log"` con nombre «Conversación sobre gramos»; foco en el campo tras Enter (`toHaveFocus`). | AC-001.1, AC-001.6, AC-002.1–002.4, AC-003.1–003.3, AC-004.1, AC-004.2, AC-005.1–005.3, AC-006.1, AC-006.2, AC-007.1–007.6, AC-008.1, AC-N001.1, AC-N001.2 |
| `src/features/diary/pages/DiaryPage.test.tsx` (añadir; se añade `estimatePortion: vi.fn()` a la factoría existente de `vi.mock("@/features/diary/api")`, sin quitar nada) | integración de página | Bloque presente con el diario cargado; orden en el documento (`compareDocumentPosition`) tras la tarjeta de totales y antes del `h2` «Desayuno»; antes del aviso de día vacío (hoy y día pasado); presente con `?date=` pasado; ausente mientras `getDiary` no resuelve y cuando rechaza; conversación conservada al cambiar de día con «Día anterior», «Día siguiente», «Hoy» y el selector; con una pregunta en curso, cambiar de día y resolver → respuesta bajo la pregunta en el día nuevo y una sola llamada a `estimatePortion`; salir a otra ruta y volver (`createMemoryRouter` con dos rutas, como ya usa el archivo) → «Todavía no has preguntado nada.»; tras una estimación, ni `addMealItems` ni los mocks de la biblioteca se han llamado y `getDiary` no se ha vuelto a llamar para ese día; totales sin cambios. | AC-001.1–001.5, AC-008.2–008.4, AC-N002.1 |

Notas para el `test-author`:
- AC-002.3: `user.paste` respeta `maxLength` en user-event v14; el recorte en `onChange` lo garantiza también si se
  usa `fireEvent.change` con 250 caracteres. Basta con comprobar el valor final y el contador.
- AC-004.1 «Enter» con una en curso: tras el Enter, `estimatePortion` sigue con una sola llamada y el campo conserva
  «un plátano».
- El rojo legítimo: todos los símbolos de la sección 3.2 existen como esqueletos; `PortionChat` lanza
  `not implemented`, así que los tests de página que buscan el bloque fallan por comportamiento ausente.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El estado del chat se pierde al cambiar de día (por `key={date}` en `DiaryDayView` y porque el bloque se oculta mientras carga el día nuevo). | Alta si se pone el estado en el componente | Alto (incumple REQ-008) | Estado y formulario elevados a `usePortionChat()` en `DiaryPage`; tests de página para los cuatro modos de cambiar de día y para la respuesta que llega tras el cambio. |
| Doble envío por Enter rápido antes de que se pinte el botón desactivado (gasta el límite de 10 cada 6 h). | Media | Medio | `inFlightRef` en `submit`, además de `disabled` y `retry: false`; test de «una sola llamada». |
| Recuento de caracteres distinto entre navegador (unidades UTF-16) y servidor (puntos de código) con emojis. | Baja | Bajo | El frontend nunca deja enviar más de 200 unidades UTF-16, que siempre son ≤ 200 puntos de código para el servidor; si el servidor respondiera 400, se muestra su mensaje (AC-007.3). |
| `DiaryPage.test.tsx` y otros tests con la factoría de `@/features/diary/api` sin `estimatePortion`. | Media | Bajo | Solo `DiaryPage` renderiza el chat; se añade `estimatePortion: vi.fn()` a esa factoría. Los demás tests (`AddFoodDialog`, `MealPhotoDialog`, `hooks`) no montan `DiaryPage`. |
| Volver a pintar todo el diario en cada tecla. | Baja | Bajo | `useWatch` dentro de `PortionChat`, no en `DiaryPage`; `DiaryPage` solo se vuelve a pintar al cambiar `turns`. |

## 7. Cumplimiento de la constitución

- **Art. B1:** cambio funcional con spec aprobada (2026-10-30); este plan no cambia el alcance.
- **Art. B4 / P1.1:** cada AC tiene test en la sección 5 con marcador `// SDD: 031 …`.
- **Art. B5 / P1 frontend:** tests escritos antes de implementar; esqueletos con `throw new Error("not implemented")`
  y parámetros con `_` (los esquemas zod, que son valores, con un esquema provisional que no valida, ver 3.2); la red
  se simula en `api.ts` o `apiClient`; ningún test llama al backend ni a Anthropic. Tests junto a su archivo y
  utilitario en `src/test/`.
- **Art. B5.4:** sin servicios externos reales.
- **Art. P2 frontend 1–4:** todo dentro de `src/features/diary/` (`api.ts`, `hooks.ts`, `types.ts`, `schemas.ts`,
  `components/`, `pages/`); HTTP solo por `apiFetch`; estado de servidor con TanStack Query (`useEstimatePortion`)
  y formulario con react-hook-form y zod (`portionQuestionFormSchema`); UI con los componentes de `src/components/ui/`.
  `portionChat.ts` es un módulo de lógica pura de la feature, como `nutrition.ts`, `proposal.ts` o `days.ts`.
- **Art. P2 frontend 5:** sin errores nuevos de oxlint; typecheck y build deben pasar.
- **Art. P2 General 1:** textos en español, con tildes y sin voseo (los de la spec, literales).
- **Art. P3.2:** la pregunta se valida con zod en el frontend (`portionQuestionFormSchema`) y la respuesta también
  (`portionEstimateResponseSchema`); el servidor sigue validando (030). P3.1 y P3.3 no aplican (no hay endpoint
  nuevo; el rate limiting ya está en la 030).
- **Art. P4:** sin migraciones ni pasos manuales en producción; el frontend se despliega con Vercel al hacer merge.
  Requiere que la 030 esté desplegada en el backend (lo está: PR #52 en `main`).
- **Art. P5.1:** archivos nuevos en LF.
- No hay ningún «DEBERÍA» incumplido.

## 8. ADRs

Ninguna. Elevar el estado al componente que no se desmonta es un patrón de React, no una decisión de arquitectura
nueva; el consumo del endpoint sigue la ADR-0037 sin cambios.
