# Plan 025 — Registro de una comida con foto desde el diario

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-22)
- **Ámbitos:** `frontend` (solo; Q8: el backend no cambia. `state.json` aún lista `backend` y lo corrige el orquestador
  con la CLI `sdd-state`).

## 1. Resumen de la solución

Todo vive en la feature `src/features/diary/`, que ya se carga bajo demanda con la pantalla «Diario» (ADR-0026). Cada
`MealSection` gana el botón «Cargar imagen» y abre `MealPhotoDialog`, que encadena tres fases: **foto** (elegir,
validar y vista previa), **análisis** (preparar el JPEG en el navegador y llamar a `POST /api/meals/analyze`) y
**revisión** (`PhotoReview`, un formulario react-hook-form con `useFieldArray` sobre la propuesta). Guardar reutiliza
`useAddMealItems` con **una** petición a `POST /api/meals`. El código del navegador (decodificar, `canvas`, URLs
`blob:`) queda detrás del puerto `PhotoProcessor` (ADR-0033) para que la regla sea pura y testeable en jsdom, y
`apiFetch` aprende a enviar `FormData`. La Política de privacidad añade el punto de Amazon Bedrock. Sin migraciones,
sin dependencias nuevas y sin cambios en el backend.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| frontend | lib (HTTP) | — | `frontend/src/lib/apiClient.ts` | `apiFetch` acepta `FormData`: lo envía tal cual y sin `Content-Type` JSON (REQ-004) |
| frontend | diary · tipos | — | `frontend/src/features/diary/types.ts` | Tipos de la respuesta del análisis y de la propuesta |
| frontend | diary · api | — | `frontend/src/features/diary/api.ts` | `analyzeMealPhoto(image)` (REQ-004, REQ-005) |
| frontend | diary · hooks | — | `frontend/src/features/diary/hooks.ts` | `useAnalyzeMealPhoto()`; `useAddMealItems` se reutiliza sin cambios (REQ-011) |
| frontend | diary · esquemas | — | `frontend/src/features/diary/schemas.ts` | `mealPhotoAnalysisSchema` (respuesta), `proposalFormSchema` (gramos) y `gramsError` pasa a exportarse (REQ-007) |
| frontend | diary · errores | — | `frontend/src/features/diary/errors.ts` | `analysisErrorView` y mensajes del análisis (REQ-012) |
| frontend | diary · foto | `frontend/src/features/diary/photo.ts` | — | Puerto `PhotoProcessor`, adaptador del navegador y reglas de tipo, tamaño, reducción y 3 MB (REQ-002 a REQ-004, NFR-001) |
| frontend | diary · propuesta | `frontend/src/features/diary/proposal.ts` | — | Funciones puras: propuesta desde el análisis, macros, total, etiquetas y carga útil de guardado (REQ-006 a REQ-011) |
| frontend | diary · componentes | `frontend/src/features/diary/components/MealPhotoDialog.tsx`, `frontend/src/features/diary/components/PhotoPicker.tsx`, `frontend/src/features/diary/components/PhotoReview.tsx`, `frontend/src/features/diary/components/ProposalEntryRow.tsx`, `frontend/src/features/diary/components/ProposalSearchStep.tsx` | `frontend/src/features/diary/components/MealSection.tsx`, `frontend/src/features/diary/components/CustomFoodForm.tsx` | Botón «Cargar imagen», diálogo con todo el flujo y paso a «Añadir a {sección}»; `CustomFoodForm` admite gramos iniciales y texto del botón (REQ-001 a REQ-013) |
| frontend | legal | — | `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx` | Punto «Amazon Web Services (Amazon Bedrock):», frase en Langfuse y fecha (REQ-014) |
| frontend | tests (dobles) | `frontend/src/test/photoFixtures.ts`, `frontend/src/test/analysisFixtures.ts` | — | `FakePhotoProcessor`, `makePhotoFile` y fábricas de respuestas del análisis |
| docs | ADR | `docs/sdd/decisions/ADR-0033-preparacion-de-la-foto-en-el-navegador.md` | `docs/sdd/decisions/README.md` | Decisión nueva (sección 8) |

`AddFoodDialog.tsx` y `EditGramsDialog.tsx` **no** cambian (fuera de alcance); el paso de búsqueda de la propuesta
reutiliza sus mismas piezas (`FoodSearchForm`, `CatalogResultList`, `useCatalogSearch`, `searchErrorView`).

## 3. Diseño

### 3.1 Datos y migraciones

No aplica: sin cambios en la base ni en el backend. Nada se persiste en el navegador (NFR-001): la foto, el JPEG
generado y la propuesta viven solo en el estado de React del diálogo y se descartan al cerrarlo.

### 3.2 Contratos e interfaces

**Endpoints (sin cambios, specs 022–024):** `POST /api/meals/analyze` (`multipart/form-data`, un archivo en `image`),
`POST /api/meals` (`{"date","meal_type","items"}`) y `GET /api/catalog/search?q=`. El análisis responde
`{"items":[{"catalog_id","name","grams","confidence","per_100g","nutrients"}],"unmatched":[{"name","grams","confidence"}],"totals"}`
con `confidence ∈ {"high","medium","low"}` y `grams` entero de 1 a 2000.

**`frontend/src/lib/apiClient.ts`** (firma igual; cambia el comportamiento con `FormData`):

```ts
export async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T>
// Si options.body es FormData: body se envía tal cual y NO se añade "Content-Type"
// (el navegador fija multipart con su boundary). En otro caso, igual que hoy.
```

**`frontend/src/features/diary/types.ts`** (añadidos):

```ts
export type AnalysisConfidence = "high" | "medium" | "low"
export type ProposedFood = {
  catalog_id: string
  name: string
  grams: number
  confidence: AnalysisConfidence
  per_100g: Record<NutrientKey, number>
  nutrients: Nutrients
}
export type UnmatchedFood = { name: string; grams: number; confidence: AnalysisConfidence }
export type MealPhotoAnalysis = {
  items: ProposedFood[]
  unmatched: UnmatchedFood[]
  totals: NutrientTotals
}
// Un alimento de la propuesta. `grams` es el texto del campo (coma o punto) en los que se guardan.
export type ProposalEntry =
  | {
      kind: "catalog"
      catalogId: string
      name: string
      per100g: Record<NutrientKey, number>
      grams: string
      tag: AnalysisConfidence | "user" // "user" = «Añadido por ti»
    }
  | { kind: "custom"; name: string; per100g: Record<NutrientKey, number>; grams: string }
  | { kind: "unmatched"; name: string; grams: number; confidence: AnalysisConfidence }
export type ProposalFormValues = { entries: ProposalEntry[] }
export type SavableItemPayload = CatalogItemPayload | CustomItemPayload
```

**`frontend/src/features/diary/api.ts`** (añadido):

```ts
// Envía un único archivo en `image` (nombre "comida.jpg") y valida la respuesta con mealPhotoAnalysisSchema.
export async function analyzeMealPhoto(image: Blob): Promise<MealPhotoAnalysis>
```

**`frontend/src/features/diary/hooks.ts`** (añadido):

```ts
// Sin reintentos: cada análisis cuenta para el límite de 10 por hora.
export function useAnalyzeMealPhoto(): UseMutationResult<MealPhotoAnalysis, Error, Blob>
```

**`frontend/src/features/diary/schemas.ts`** (añadidos y cambio):

```ts
export function gramsError(text: string): string | null // antes privada; misma lógica
export const mealPhotoAnalysisSchema: z.ZodType<MealPhotoAnalysis>
// Valida los gramos de las entradas que se guardan (catalog y custom) con gramsError;
// el error va en el path ["entries", i, "grams"]. Las "unmatched" no se validan.
export const proposalFormSchema: z.ZodType<ProposalFormValues>
```

**`frontend/src/features/diary/errors.ts`** (añadidos):

```ts
export const ANALYSIS_FAILED_MESSAGE = "No se pudo analizar la foto. Vuelve a intentarlo."
export const NO_FOODS_MESSAGE = "No reconocimos alimentos en la foto."
export type AnalysisErrorView = {
  message: string
  canRetry: boolean      // «Reintentar»
  canChangePhoto: boolean // «Cambiar foto»
  canRegisterManually: boolean // «Registrar a mano»
}
// 400 y 413: mensaje del servidor + cambiar foto. 429: mensaje del servidor + a mano.
// 503: mensaje del servidor + reintentar + a mano. Cualquier otro error (red, ZodError, 5xx…):
// ANALYSIS_FAILED_MESSAGE + reintentar + a mano.
export function analysisErrorView(error: unknown): AnalysisErrorView
```

**`frontend/src/features/diary/photo.ts`** (nuevo):

```ts
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024
export const MAX_UPLOAD_SIDE = 1600
export const JPEG_QUALITY = 0.85
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
export const PHOTO_TYPE_MESSAGE = "Elige una foto JPEG, PNG, WebP o HEIC."
export const PHOTO_SIZE_MESSAGE = "La foto no puede superar los 20 MB."
export const PHOTO_UNREADABLE_MESSAGE =
  "No se pudo leer la foto. Prueba con otra foto en JPEG, PNG o WebP."
export const UPLOAD_TOO_LARGE_MESSAGE = "La imagen no puede superar los 3 MB."

export type PhotoSize = { width: number; height: number }
export interface PhotoProcessor {
  // Decodifica la foto con la orientación aplicada; lanza PhotoReadError si no se puede leer.
  readSize(file: Blob): Promise<PhotoSize>
  // Dibuja la foto orientada al tamaño dado y la codifica en JPEG; lanza PhotoReadError si falla.
  toJpeg(file: Blob, size: PhotoSize): Promise<Blob>
  createPreviewUrl(file: Blob): string
  revokePreviewUrl(url: string): void
}
export class PhotoReadError extends Error {}
export class UploadTooLargeError extends Error {}

// Tipo (MIME; si viene vacío, por la extensión .jpg/.jpeg/.png/.webp/.heic/.heif) y después tamaño
// (> MAX_PHOTO_BYTES). Devuelve el mensaje o null si es válida. Sin leer el contenido.
export function photoFileError(file: File): string | null
// Lado mayor ≤ maxSide conservando la proporción (Math.round, mínimo 1); nunca agranda.
export function scaledSize(size: PhotoSize, maxSide?: number): PhotoSize
// Comprueba que el navegador puede leerla (processor.readSize); propaga PhotoReadError.
export async function checkPhotoReadable(file: File, processor: PhotoProcessor): Promise<void>
// readSize → scaledSize → toJpeg; lanza UploadTooLargeError si el JPEG supera MAX_UPLOAD_BYTES.
export async function preparePhotoUpload(file: File, processor: PhotoProcessor): Promise<Blob>
// Adaptador real: HTMLImageElement + img.decode() desde URL blob: (revocada tras usarla),
// canvas con imageSmoothingQuality "high" y toBlob("image/jpeg", JPEG_QUALITY).
export const browserPhotoProcessor: PhotoProcessor
```

**`frontend/src/features/diary/proposal.ts`** (nuevo):

```ts
// items en su orden (tag = confianza, grams = String(grams)) y después unmatched.
export function proposalFromAnalysis(analysis: MealPhotoAnalysis): ProposalEntry[]
export function catalogEntry(food: CatalogFood, grams: string): ProposalEntry // tag "user"
export function customEntry(payload: CustomItemPayload): ProposalEntry // grams con coma decimal
export function isSavable(entry: ProposalEntry): boolean // catalog o custom
// portionNutrients(per100g, parseDecimalText(grams) ?? 0); null para unmatched.
export function entryNutrients(entry: ProposalEntry): Nutrients | null
// Suma de entryNutrients de las entradas que se guardan (las unmatched no cuentan).
export function proposalTotals(entries: ProposalEntry[]): NutrientTotals
// En el orden de la propuesta, sin unmatched: {catalog_id, grams} y {name, grams, per_100g}.
export function proposalItems(entries: ProposalEntry[]): SavableItemPayload[]
export function confidenceLabel(confidence: AnalysisConfidence): string // «Confianza alta|media|baja»
export function entryTag(entry: ProposalEntry): string // confianza, «Añadido por ti» o «Personalizado»
export function formatProposalTotal(totals: NutrientTotals): string // "Total: " + formatPortionPreview
```

**Componentes** (`frontend/src/features/diary/components/`):

```ts
export function MealPhotoDialog(props: {
  mealType: MealType
  label: string
  date: string
  onClose: () => void
  onRegisterManually: () => void // cierra este diálogo y abre «Añadir a {sección}»
  photoProcessor?: PhotoProcessor // por defecto browserPhotoProcessor
}): ReactElement

export function PhotoPicker(props: {
  onPick: (file: File) => void
  disabled?: boolean
}): ReactElement // botones «Hacer una foto» y «Elegir una foto» con sus <input type="file"> ocultos

export function PhotoReview(props: {
  initialEntries: ProposalEntry[]
  label: string
  isSaving: boolean
  saveError: string | null
  onSave: (items: SavableItemPayload[]) => void
  onCancel: () => void
}): ReactElement

export function ProposalEntryRow(props: {
  index: number
  entry: ProposalEntry
  onRemove: () => void
  onSearch: () => void   // solo unmatched
  onCreate: () => void   // solo unmatched
}): ReactElement // dentro del <Form> de PhotoReview (usa useFormContext para el campo de gramos)

export function ProposalSearchStep(props: {
  initialQuery: string
  onSelect: (food: CatalogFood) => void
  onBack: () => void
}): ReactElement

// CustomFoodForm: props nuevas opcionales, sin cambiar el comportamiento actual
//   defaultGrams?: string   (por defecto "")
//   submitLabel?: string    (por defecto "Añadir")
```

Identificadores fijos para los tests: los dos `<input type="file">` llevan `data-testid="meal-photo-camera-input"` y
`data-testid="meal-photo-file-input"`.

### 3.3 Lógica

- **Validación al elegir (REQ-003):** `photoFileError` (tipo antes que tamaño) → si hay mensaje, se muestra y no hay
  vista previa. Si pasa, `checkPhotoReadable` (decodifica una vez); si lanza `PhotoReadError`, se muestra
  `PHOTO_UNREADABLE_MESSAGE`. Solo entonces se crea la URL de vista previa (`createPreviewUrl`). Una foto nueva no
  válida descarta también la anterior (revocando su URL) y vuelve al inicio con el mensaje: REQ-003 prohíbe mostrar
  vista previa con un error. Elegir una válida borra el mensaje (AC-003.4).
- **Preparación y análisis (REQ-004, REQ-005):** «Analizar foto» → `preparePhotoUpload(file, processor)` y, con el
  `Blob` resultante guardado en el estado del diálogo, `analyze.mutate(blob)`. Mientras prepara o analiza se muestra
  «Analizando la foto…» y se desactivan «Analizar foto» y «Cambiar foto». `UploadTooLargeError` →
  `UPLOAD_TOO_LARGE_MESSAGE` con «Cambiar foto»; `PhotoReadError` aquí → `PHOTO_UNREADABLE_MESSAGE` con «Cambiar foto».
  «Reintentar» vuelve a llamar `analyze.mutate` con **el mismo** `Blob` (AC-012.2).
- **Resultado:** éxito con `items` y `unmatched` vacíos → `NO_FOODS_MESSAGE` con «Cambiar foto» y «Registrar a mano»;
  con algún alimento → fase revisión con `proposalFromAnalysis(data)`. Error → `analysisErrorView(error)`.
- **Cierre durante el análisis (AC-005.2):** «Cancelar» sigue activo; `MealSection` desmonta el diálogo y la respuesta
  de la mutación se ignora (no hay callbacks por llamada ni guardado automático). No se aborta la petición: el análisis
  ya contó para el límite (backlog).
- **Revisión (REQ-006 a REQ-010):** `PhotoReview` monta `useForm<ProposalFormValues>({ resolver:
  zodResolver(proposalFormSchema), defaultValues: { entries: initialEntries } })` y `useFieldArray({ name: "entries" })`.
  Vistas internas: `"list" | {search: "add"} | {search: "resolve", index} | {custom: index}`; el formulario no se
  desmonta al cambiar de vista, así que «Volver a la propuesta» la deja igual (AC-009.3, AC-010.5). Elegir en la
  búsqueda: `append(catalogEntry(food, "100"))` o `update(index, catalogEntry(food, String(entry.grams)))`. Crear
  personalizado: `CustomFoodForm` con `defaultName = entry.name`, `defaultGrams = String(entry.grams)`, `submitLabel =
  "Añadir a la propuesta"` y, al enviar, `update(index, customEntry(payload))`. Quitar: `remove(index)` sin confirmar.
  El total y las vistas previas se recalculan con `useWatch` (`proposalTotals`, `entryNutrients`) sin peticiones.
- **Búsqueda desde la propuesta:** `ProposalSearchStep` usa su propio `useCatalogSearch()`; si `initialQuery` pasa
  `foodSearchFormSchema` lo busca al montarse (AC-010.1), si no solo lo deja escrito. Textos, estados («Buscando…»,
  sin resultados, errores con `searchErrorView` y «Reintentar») y ayuda iguales a `AddFoodDialog`; el botón de salida es
  «Volver a la propuesta». No ofrece «Crear alimento personalizado» (no lo pide REQ-009; ver DECISIONS).
- **Guardar (REQ-011):** submit del formulario → `proposalItems(entries)` → `PhotoReview.onSave(items)` →
  `add.mutateAsync({ date, meal_type: mealType, items })` (`useAddMealItems(date)`, que espera a releer el diario) →
  `onClose()`. Errores con `saveErrorMessage` (400 → servidor; otro → «No se pudo guardar…»). «Guardar en {sección}»
  desactivado y aviso «Añade al menos un alimento para guardar.» si `!entries.some(isSavable)`. Durante el guardado:
  «Guardando…», botones desactivados y `onOpenChange` ignora el cierre (patrón de `AddFoodDialog`).
- **Paso a manual (REQ-012):** `MealSection` guarda `photoOpen` y `adding`; `onRegisterManually` hace
  `setPhotoOpen(false); setAdding(true)`.
- **Vista previa (NFR-001):** la URL se revoca al cambiar de foto y en la limpieza de un `useEffect` al desmontar. La
  foto no se escribe en `localStorage`/`sessionStorage` ni se envía en otra petición que el análisis.
- **Reutilizado:** `apiFetch`, `useAddMealItems`, `saveErrorMessage`, `portionNutrients`, `formatPortionPreview`,
  `formatLoggedGrams`, `parseDecimalText`, `gramsError` (ahora exportada), `CustomFoodForm`, `FoodSearchForm`,
  `CatalogResultList`, `useCatalogSearch`, `searchErrorView`, `foodSearchFormSchema`, componentes shadcn `Dialog`,
  `Button`, `Input` y `Form`.

### 3.4 Interfaz de usuario

- **Tarjeta (`MealSection`):** fila con «Añadir alimento» y «Cargar imagen» (`aria-label="Cargar imagen en {label}"`,
  `variant="outline"`, `size="sm"`).
- **Diálogo:** `DialogTitle` «Añadir a {label} con una foto»; `DialogDescription` «Puedes analizar hasta 10 fotos por
  hora.»; `showCloseButton={false}` como `AddFoodDialog`. `DialogContent` con
  `className="max-h-[90vh] overflow-y-auto max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full
  max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"`: a pantalla
  completa por debajo de 640 px y centrado (con el `sm:max-w-lg` del componente) desde 640 px.
- **Inicio:** `PhotoPicker` («Hacer una foto»: `<input type="file" accept={PHOTO_ACCEPT} capture="environment">`;
  «Elegir una foto»: mismo `accept`, sin `capture`; ninguno con `multiple`; inputs ocultos con `className="sr-only"`,
  `tabIndex={-1}` y `aria-hidden`; los botones hacen `input.click()` y el `value` se vacía tras cada elección para
  poder elegir la misma foto otra vez) y «Cancelar».
- **Vista previa:** `<img alt="Vista previa de la foto">` (con `object-contain` y alto máximo), «Analizar foto»,
  «Cambiar foto» (abre el selector de archivos) y «Cancelar».
- **Regiones vivas (NFR-002):** un `role="status" aria-live="polite"` para «Analizando la foto…»; `role="alert"` para
  los errores de validación, de análisis y de guardado.
- **Revisión:** `<ul aria-label="Alimentos de la propuesta">`; cada fila con el nombre, la etiqueta (`entryTag`), y:
  - catalog/custom: `FormField` `entries.${index}.grams` con `FormLabel` «Gramos de {nombre}» (visualmente oculta,
    `sr-only`), `Input type="text" inputMode="decimal"`, `FormMessage`, la vista previa `formatPortionPreview` y
    «Quitar» con `aria-label="Quitar {nombre}"`;
  - unmatched: «Sin coincidencia en el catálogo», `formatLoggedGrams(grams)`, la confianza y los botones con
    `aria-label` «Buscar {nombre} en el catálogo», «Crear {nombre} como personalizado» y «Quitar {nombre}».
- Debajo: aviso de sin coincidencia (si queda alguna), «Total: …», aviso «Añade al menos un alimento para guardar.» (si
  no hay ninguna que se guarde) y botones «Añadir otro alimento», «Guardar en {label}» (submit) y «Cancelar».
- Formato: el del diario (`formatPortionPreview`: kcal sin decimales, gramos con un decimal y coma).
- **Política de privacidad:** `updatedAt="22 de octubre de 2026"`; nuevo `<li>` tras el de Anthropic con
  `<strong>Amazon Web Services (Amazon Bedrock):</strong>` y el texto de AC-014.1; al final del `<li>` de Langfuse, la
  frase de AC-014.2. El resto, igual.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `MealSection.tsx` (botón, estado `photoOpen`); `MealPhotoDialog.tsx` (título, descripción, clases de pantalla completa, «Cancelar») |
| REQ-002 | `PhotoPicker.tsx` (`PHOTO_ACCEPT`, `capture`, sin `multiple`); `MealPhotoDialog.tsx` (vista previa, «Analizar foto», «Cambiar foto»); `photo.ts` (`createPreviewUrl`) |
| REQ-003 | `photo.ts` (`photoFileError`, `checkPhotoReadable`, mensajes); `MealPhotoDialog.tsx` (mensaje y vuelta al inicio) |
| REQ-004 | `photo.ts` (`scaledSize`, `preparePhotoUpload`, `UploadTooLargeError`, `browserPhotoProcessor`); `api.ts` (`analyzeMealPhoto` con `FormData`); `apiClient.ts` (`FormData`) |
| REQ-005 | `hooks.ts` (`useAnalyzeMealPhoto`); `MealPhotoDialog.tsx` (estado «Analizando la foto…», botones desactivados, cierre); `MealSection.tsx` (desmontaje) |
| REQ-006 | `schemas.ts` (`mealPhotoAnalysisSchema`); `proposal.ts` (`proposalFromAnalysis`, `entryNutrients`, `proposalTotals`, `confidenceLabel`, `entryTag`, `formatProposalTotal`); `PhotoReview.tsx`, `ProposalEntryRow.tsx` |
| REQ-007 | `schemas.ts` (`proposalFormSchema`, `gramsError`); `PhotoReview.tsx` (`useWatch`, submit) |
| REQ-008 | `PhotoReview.tsx` (`remove`) |
| REQ-009 | `ProposalSearchStep.tsx`; `PhotoReview.tsx` (`append(catalogEntry(food, "100"))`, «Volver a la propuesta») |
| REQ-010 | `ProposalSearchStep.tsx` (`initialQuery`); `CustomFoodForm.tsx` (`defaultGrams`, `submitLabel`); `PhotoReview.tsx` (`update`); `proposal.ts` (`catalogEntry`, `customEntry`) |
| REQ-011 | `proposal.ts` (`proposalItems`, `isSavable`); `PhotoReview.tsx` (aviso y botón); `MealPhotoDialog.tsx` (`useAddMealItems`, `saveErrorMessage`, bloqueo del cierre) |
| REQ-012 | `errors.ts` (`analysisErrorView`, `ANALYSIS_FAILED_MESSAGE`, `NO_FOODS_MESSAGE`); `MealPhotoDialog.tsx` (acciones); `MealSection.tsx` (`onRegisterManually`) |
| REQ-013 | `MealPhotoDialog.tsx` (cierre sin confirmar); `MealSection.tsx` (desmontaje = empieza de cero) |
| REQ-014 | `PrivacyPolicyPage.tsx` |
| NFR-001 | `photo.ts` (`revokePreviewUrl`); `MealPhotoDialog.tsx` (revocar al cambiar y al desmontar; nada en almacenamiento); `proposal.ts` (`proposalItems` sin datos de imagen) |
| NFR-002 | `MealPhotoDialog.tsx` y `PhotoReview.tsx` (`role="status"`/`role="alert"`, nombre del diálogo); `ProposalEntryRow.tsx` (etiquetas y `aria-label`) |
| NFR-003 | El diálogo solo se importa desde `MealSection.tsx`, que solo usa `DiaryPage` (cargada con `lazyNamed`, ADR-0026); ningún módulo de carga inicial (`router.tsx`, `AppLayout`, `main.tsx`) lo importa |

## 5. Estrategia de pruebas

**Ámbito:** solo `frontend` (Vitest + Testing Library + jsdom). Sin servicios externos. Marcadores
`// SDD: 025 REQ-… AC-…` (Art. P1.1); `it("…")` en español; `describe/it/expect/vi` importados de `vitest`.

**Aislamiento (Art. P1 frontend):**
- Red: `vi.mock("@/features/diary/api", …)` (añadiendo `analyzeMealPhoto: vi.fn()` a la fábrica) y
  `vi.mock("@/features/catalog/api", …)`, como los tests actuales del diario.
- Navegador (decodificar, `canvas`, URLs `blob:`): doble escrito a mano **`FakePhotoProcessor`** inyectado por la prop
  `photoProcessor` de `MealPhotoDialog` o pasado a `preparePhotoUpload`/`checkPhotoReadable`. En los tests que montan
  `DiaryPage` (donde no hay prop), se sustituye `browserPhotoProcessor` con
  `vi.mock("@/features/diary/photo", async (orig) => ({ ...(await orig()), browserPhotoProcessor: fake }))` y
  `vi.hoisted` para el doble: es la forma de inyectar en un módulo que jsdom no puede ejecutar de verdad.
- `apiClient.test.ts` sustituye `fetch` con `vi.stubGlobal("fetch", …)`: es la única forma de probar la capa más baja,
  que es justo donde P1 permite simular la red.

**Dobles y fábricas nuevos:**
- `frontend/src/test/photoFixtures.ts`:
  - `class FakePhotoProcessor implements PhotoProcessor` con constructor `({ size?: PhotoSize; unreadable?: boolean;
    jpegBytes?: number })`; registra `readCalls: Blob[]`, `jpegCalls: PhotoSize[]`, `created: string[]` y
    `revoked: string[]`; `toJpeg` devuelve un `Blob` `image/jpeg` del tamaño `jpegBytes` (por defecto pequeño);
    `createPreviewUrl` devuelve `blob:preview-1`, `blob:preview-2`…; con `unreadable` lanza `PhotoReadError`.
  - `makePhotoFile({ name?, type?, bytes? })`: `File` con `Object.defineProperty(file, "size", { value: bytes })` para
    simular 20 MB sin reservarlos.
- `frontend/src/test/analysisFixtures.ts`: `makeAnalysis(overrides)`, `RICE` (Arroz blanco cocido 150 g, `high`, 130 /
  2,69 / 28,17 / 0,28), `CHICKEN` (pechuga 100 g, 165 / 31 / 0 / 3,57) y `TOMATO_SAUCE` (`unmatched`, 30 g, `low`).

**Unitarios (funciones puras):**
- `frontend/src/features/diary/photo.test.ts`: `photoFileError` (PDF y GIF → tipo; 20 MB exactos válidos y +1 byte no;
  HEIC con `type` vacío y extensión `.heic` aceptado) — AC-003.1, AC-003.2; `checkPhotoReadable` con `unreadable` —
  AC-003.3; `scaledSize` y `preparePhotoUpload` con el doble: 4000×3000 → `jpegCalls` = 1600×1200 y `Blob` JPEG
  (AC-004.1); 800×600 PNG → 800×600 (AC-004.2); tamaño ya orientado 3000×4000 → 1200×1600 (AC-004.3, ver riesgos);
  `image/heic` → JPEG (AC-004.4); `jpegBytes` > 3 MB → `UploadTooLargeError` (AC-004.5).
- `frontend/src/features/diary/proposal.test.ts`: vistas previas y totales de AC-006.1, AC-006.4, AC-007.1, AC-008.1,
  AC-010.3; `confidenceLabel` (AC-006.2); `proposalItems` con orden, sin `unmatched`, 150.5 desde «150,5» y
  personalizado (AC-007.2, AC-011.1, AC-011.2); duplicados (AC-009.4).
- `frontend/src/features/diary/schemas.test.ts` (ampliar): `proposalFormSchema` con vacío, 0, 2001 y «150,25»
  (AC-007.3); `mealPhotoAnalysisSchema` acepta la respuesta de la 024 y rechaza una `confidence` desconocida.
- `frontend/src/features/diary/errors.test.ts` (ampliar): `analysisErrorView` para 503, 429, 400, 413, red y otros
  (AC-012.1, AC-012.3, AC-012.4, AC-012.6).
- `frontend/src/features/diary/api.test.ts` (nuevo, `vi.mock("@/lib/apiClient")` parcial): `analyzeMealPhoto` llama a
  `/api/meals/analyze` con `method: "POST"` y un `FormData` con **un** valor en `image` que es el `Blob` JPEG
  (AC-004.1, AC-004.4).
- `frontend/src/lib/apiClient.test.ts` (nuevo): con `FormData` no envía `Content-Type: application/json`, conserva
  `Authorization` y pasa el `FormData` como `body`; con objeto sigue serializando JSON (regresión) — REQ-004.

**Componentes (integración en jsdom):**
- `frontend/src/features/diary/components/MealPhotoDialog.test.tsx` (con `QueryClientProvider` sin reintentos y la
  sonda de diario de `AddFoodDialog.test.tsx`): AC-001.2, AC-001.3 (comprueba las clases `max-sm:` de pantalla completa
  y `sm:max-w-lg`), AC-001.4, AC-002.1 (atributos `accept`, `capture`, sin `multiple`), AC-002.2, AC-002.3 (y
  `revoked` contiene la URL anterior), AC-003.1–AC-003.4 por la interfaz (para PDF/GIF usa
  `userEvent.setup({ applyAccept: false })`), AC-004.5, AC-005.1, AC-006.1–AC-006.5, AC-007.1–AC-007.3,
  AC-008.1–AC-008.2, AC-009.1–AC-009.4, AC-010.1–AC-010.5, AC-011.1, AC-011.2, AC-011.4–AC-011.6,
  AC-012.1–AC-012.6, AC-012.8, AC-013.1, AC-N001.1 (claves de `localStorage`/`sessionStorage` iguales antes y después;
  la carga de `addMealItems` es exactamente la esperada), AC-N001.2 (`revoked` al cambiar y al desmontar con
  `unmount()`), AC-N002.1 y AC-N002.2. Las respuestas pendientes se simulan con promesas diferidas.
- `frontend/src/features/diary/pages/DiaryPage.test.tsx` (ampliar; añade `analyzeMealPhoto` a la fábrica del mock y
  el `vi.mock` de `photo`): AC-001.1 (cuatro botones con su nombre accesible), AC-005.2 (cerrar con el análisis
  pendiente, resolverlo después: diálogo cerrado, sin `addMealItems`), AC-011.3 (tras guardar, `getDiary` devuelve
  Almuerzo con tres alimentos), AC-012.7 (503, 429 y vacío → «Registrar a mano» cierra el de la foto y abre «Añadir a
  Cena»), AC-013.2 (reabrir empieza sin foto).
- `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx` (ampliar): AC-014.1, AC-014.2 y AC-014.3. El test
  existente `// SDD: 023 REQ-012 AC-012.3` («la última actualización es la del 21 de octubre de 2026») contradice
  AC-014.3, que lo sustituye: el `test-author` lo actualiza a la fecha nueva con el marcador `025 REQ-014 AC-014.3`
  (cambio exigido por la spec, no un debilitamiento).
- `frontend/src/app/mealPhotoRoute.test.tsx` (nuevo, mismo patrón que `diaryRoute.test.tsx`): `vi.mock` de
  `@/features/diary/components/MealPhotoDialog` con bandera `evaluated`; visitar `/home` no lo evalúa (AC-N003.1).

**Comprobación manual (no automatizable en jsdom, para `verify`/`review`):** en un navegador real, una foto vertical
de móvil con EXIF 6 se envía derecha (AC-004.3), una HEIC en Safari se envía como JPEG y en Chrome de Windows da «No se
pudo leer la foto…» (AC-003.3, AC-004.4), y el diálogo ocupa la pantalla a 375 px y se centra a 1024 px (AC-001.3).
`npm run build` confirma el chunk de entrada ≤ 500 kB (NFR-003).

**Entorno:** `npm ci` en `frontend/`; no hace falta Postgres ni Redis.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Un navegador no aplica la orientación EXIF al dibujar en el `canvas` y la foto llega girada | Baja | Medio | Navegadores soportados (Chrome 81+, Firefox 77+, Safari 13.1+) la aplican; el modelo reconoce alimentos girados igualmente; comprobación manual; si fallara, el cambio queda acotado al adaptador (ADR-0033) |
| La orientación y HEIC no se pueden probar en jsdom: los tests de AC-004.3/AC-004.4 prueban la regla con el doble, no el navegador | Alta | Bajo | Se declara en el plan y en el ADR; comprobación manual en la verificación |
| Memoria al decodificar fotos grandes en móviles modestos | Media | Bajo | Tope de 20 MB en el archivo original; el `canvas` de destino es como mucho 1600 px; si falla la decodificación se muestra «No se pudo leer la foto…» |
| `FormData` en `apiFetch` rompe otras llamadas | Baja | Alto | La rama nueva solo se activa con `body instanceof FormData`; test de regresión con JSON en `apiClient.test.ts` y toda la suite existente |
| Tests existentes que mockean `@/features/diary/api` sin `analyzeMealPhoto` | Media | Bajo | Solo fallan si llaman a la función; el `test-author` añade `analyzeMealPhoto: vi.fn()` donde se monte el diálogo |
| `useFieldArray` con entradas heterogéneas pierde campos al `update` | Baja | Medio | `update(index, entrada completa)`; tests de sustitución en posición (AC-010.1, AC-010.3) |

## 7. Cumplimiento de la constitución

- **B1 / B4 / B5:** cambio funcional con spec aprobada; cada REQ/NFR tiene diseño (sección 4) y cada AC un test
  previsto (sección 5); los símbolos de la sección 3.2 se crean como esqueletos `throw new Error("not implemented")` con
  parámetros prefijados con `_` (P1.5). Sin dependencias nuevas.
- **B5.3:** el único test existente que cambia es el de la fecha de la política (023 AC-012.3), sustituido por AC-014.3
  de esta spec aprobada; no se borra, salta ni debilita ningún otro.
- **B5.4 / P1 frontend 4:** sin llamadas reales; red simulada en `api.ts` y en `apiClient` (`fetch` sustituido solo en
  el test de `apiClient`). El `vi.mock` parcial de `photo.ts` en los tests de página sustituye un adaptador del
  navegador que jsdom no puede ejecutar; los demás tests inyectan el doble por prop.
- **P2.1:** todo en `src/features/diary/` (`api.ts`, `hooks.ts`, `types.ts`, `schemas.ts`, `components/`), más
  `photo.ts` y `proposal.ts` como los ya existentes `nutrition.ts`, `format.ts` y `errors.ts`.
- **P2.2:** la subida pasa por `apiFetch` (ampliado), nunca por `fetch` directo.
- **P2.3:** mutaciones con TanStack Query (`useAnalyzeMealPhoto`, `useAddMealItems`, `useCatalogSearch`); la propuesta
  y el alimento personalizado son formularios react-hook-form con zod (`proposalFormSchema`, `customFoodFormSchema`).
- **P2.4 / P2.5:** componentes shadcn existentes, alias `@/`; sin errores nuevos de oxlint ni de `tsc -b`.
- **P2 General / P3.2:** textos en español sin voseo; la respuesta del análisis se valida con zod y la foto se valida en
  el dispositivo antes de enviarla.
- **P3 (resto) y P4:** sin endpoints nuevos, sin migraciones, sin variables nuevas ni pasos manuales en producción.
- **NFR-003 / ADR-0026:** sin cambios en `router.tsx`; el diálogo viaja en el chunk de `DiaryPage`.
- No hay ningún «DEBERÍA» incumplido.

## 8. ADRs

- [ADR-0033](../../docs/sdd/decisions/ADR-0033-preparacion-de-la-foto-en-el-navegador.md) — Preparación de la foto en
  el navegador (`HTMLImageElement` + `canvas`, sin dependencias), puerto `PhotoProcessor` con doble escrito a mano y
  `apiFetch` con `FormData` (Propuesta).
