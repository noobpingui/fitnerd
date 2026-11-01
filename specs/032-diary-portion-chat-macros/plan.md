# Plan 032 — Valores por 100 g en el chat de porciones y «Añadir alimento» precargado

- **Spec:** [spec.md](spec.md) (aprobada el 2026-11-01)
- **Ámbitos:** `backend`, `frontend`

## 1. Resumen de la solución

- **Backend:** se amplía la herramienta forzada `report_portion` de la 030 (ADR-0037) con `name` y `per_100g`. Las
  reglas puras de `services/portion_estimate_rules.py` limpian el nombre y validan los valores por 100 g con los
  mismos rangos que un alimento personalizado (`services/meal_rules.py`). `PortionEstimate` gana dos campos con valor
  por defecto `None`, la ruta los serializa y el máximo de tokens de salida sube de 150 a 250. Sin migración, sin
  variables y sin dependencias nuevas. Las trazas no cambian.
- **Frontend:** el esquema zod de la respuesta acepta las claves nuevas (si faltan, `null`). `PortionChat` muestra la
  línea «Por 100 g: …» y el botón «Añadir alimento» cuando la última respuesta es una estimación. Un diálogo nuevo,
  `PortionAddFoodDialog`, reutiliza `CustomFoodForm` precargado, un grupo de radios «Comida» y `useAddMealItems(date)`,
  el mismo guardado que «Crear alimento personalizado». `DiaryPage` pausa «hoy» mientras el diálogo está abierto.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | services (reglas) | — | `backend/services/portion_estimate_rules.py` | `PortionPer100g`, `parse_per_100g`, `round_to_tenth`, `PortionEstimate.name`/`per_100g`, esquema de la herramienta, instrucciones y `MAX_OUTPUT_TOKENS = 250` (REQ-001 a REQ-004, NFR-001, NFR-002) |
| backend | services | — | `backend/services/portion_estimate_service.py` | Ninguno de lógica: ya pasa `MAX_OUTPUT_TOKENS` y `PORTION_TOOL`. La traza **no** cambia (fuera de alcance). Solo se toca si el linter lo pide |
| backend | routes | — | `backend/routes/meal_routes.py` | `_serialize_portion_estimate` añade `name` y `per_100g` (REQ-001, REQ-004) |
| backend | tests | — | `backend/tests/test_services/test_portion_estimate_rules.py`, `backend/tests/test_services/test_portion_estimate_service.py`, `backend/tests/test_routes/test_portion_estimate_routes.py` | Casos nuevos y ajuste de los tests de la 030 cuyo contrato cambia (ver §5) |
| frontend | types | — | `frontend/src/features/diary/types.ts` | `PortionPer100g`, claves opcionales en `PortionEstimate` y en la respuesta `estimate`, `PortionEstimateAnswer` |
| frontend | schemas | — | `frontend/src/features/diary/schemas.ts` | `portionEstimateResponseSchema` con `name` y `per_100g` (REQ-011) |
| frontend | lógica pura | — | `frontend/src/features/diary/portionChat.ts` | `portionAnswerFromEstimate` lleva las claves nuevas; `formatPer100gLine`, `latestEstimateAnswer`, `portionFoodFormDefaults` |
| frontend | constantes | — | `frontend/src/features/diary/constants.ts` | Textos del diálogo y de la comida sin elegir |
| frontend | components | `frontend/src/features/diary/components/PortionAddFoodDialog.tsx` | `frontend/src/features/diary/components/PortionChat.tsx`, `frontend/src/features/diary/components/CustomFoodForm.tsx` | Diálogo precargado; línea «Por 100 g», botón y foco en el chat; precarga de nutrientes y bloqueo previo al envío en el formulario |
| frontend | pages | — | `frontend/src/features/diary/pages/DiaryPage.tsx` | Pasa `date` y `onDialogOpenChange` al chat; pausa `useToday` con el diálogo abierto (AC-007.7) |
| frontend | tests | `frontend/src/features/diary/components/PortionAddFoodDialog.test.tsx` | `frontend/src/test/portionEstimateFixtures.ts`, `frontend/src/features/diary/portionChat.test.ts`, `frontend/src/features/diary/schemas.test.ts`, `frontend/src/features/diary/components/PortionChat.test.tsx`, `frontend/src/features/diary/pages/DiaryPage.test.tsx` | Ver §5 |

## 3. Diseño

### 3.1 Datos y migraciones

No aplica. No hay cambios de modelo, tablas ni migraciones. El guardado usa `POST /api/meals` (spec 022/028) tal
como está, así que el alimento también entra en la biblioteca `custom_foods`.

### 3.2 Contratos e interfaces

**HTTP:** `POST /api/meals/portion-estimate` (sigue con `@require_auth`, el mismo límite de uso y el mismo tope de
cuerpo). La respuesta 200 lleva **siempre** las siete claves:

```json
{"status": "estimated", "grams": 250, "unit": "5 huevos grandes", "note": "…", "message": null,
 "name": "Huevo", "per_100g": {"calories_kcal": 143.0, "protein_g": 12.6, "carbs_g": 0.7, "fat_g": 9.5}}
```

En `not_food` y `unknown`, `name` y `per_100g` son `null`. Los errores 400, 401, 429 y 503 no cambian. Los valores de
`per_100g` salen como `float` de JSON (`143.0` equivale a `143` al compararlos).

**Herramienta `report_portion`** (`PORTION_TOOL`): se añaden dos propiedades y se mantiene `required: ["is_food"]`.

```python
"name": {"type": ["string", "null"], "maxLength": 100},
"per_100g": {
    "type": ["object", "null"],
    "properties": {
        "calories_kcal": {"type": "number"},
        "protein_g": {"type": "number"},
        "carbs_g": {"type": "number"},
        "fat_g": {"type": "number"},
    },
    "required": ["calories_kcal", "protein_g", "carbs_g", "fat_g"],
},
```

La `description` de la herramienta pasa a ser «Informa del peso estimado en gramos de un alimento o una porción de
comida, su nombre corto y sus calorías y macros por 100 g.».

**Backend — `backend/services/portion_estimate_rules.py`** (firmas exactas):

```python
from services.meal_rules import (
    CALORIES_PER_100G_RANGE,
    MACRO_PER_100G_RANGE,
    MAX_NAME_CHARS,  # 100
    NUTRIENT_KEYS,
)

MAX_OUTPUT_TOKENS = 250  # antes 150 (NFR-001)

@dataclass(frozen=True)
class PortionPer100g:
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float

@dataclass(frozen=True)
class PortionEstimate:
    status: str
    grams: int | None
    unit: str | None
    note: str | None
    message: str | None
    name: str | None = None
    per_100g: PortionPer100g | None = None

def round_to_tenth(value: int | float) -> Decimal: ...
def parse_per_100g(value: object) -> PortionPer100g | None: ...
# Sin cambios de firma: parse_question, parse_grams, clean_text, build_estimate,
# not_food_estimate, unknown_estimate.
```

Los dos campos nuevos van al final y con valor por defecto, así que las construcciones posicionales de cinco
argumentos que ya hacen los tests de la 030 siguen siendo válidas e iguales a las de ahora.

**Backend — `backend/routes/meal_routes.py`:** `_serialize_portion_estimate(estimate: PortionEstimate) -> dict` añade
`"name": estimate.name` y `"per_100g": None if estimate.per_100g is None else {key: getattr(estimate.per_100g, key)
for key in NUTRIENT_KEYS}` (`NUTRIENT_KEYS` ya se importa en la ruta).

**Frontend — `frontend/src/features/diary/types.ts`:**

```ts
export type PortionPer100g = Record<NutrientKey, number>
export type PortionEstimate =
  | {
      status: "estimated"
      grams: number
      unit: string | null
      note: string | null
      name?: string | null      // ausente o null en un backend anterior (REQ-011)
      per_100g?: PortionPer100g | null
    }
  | { status: "not_food" | "unknown"; message: string }
export type PortionChatAnswer =
  | {
      kind: "estimate"
      grams: number
      unit: string | null
      note: string | null
      name?: string           // solo si viene
      per100g?: PortionPer100g // solo si viene
    }
  | { kind: "message"; text: string }
  | { kind: "notice"; text: string }
  | { kind: "error"; text: string }
export type PortionEstimateAnswer = Extract<PortionChatAnswer, { kind: "estimate" }>
```

Las claves nuevas son opcionales para que los literales y los `toEqual` de la 031 sigan siendo válidos:
`portionAnswerFromEstimate` las pone a `undefined` cuando son `null`, y `toEqual` ignora las propiedades `undefined`.

**Frontend — `frontend/src/features/diary/schemas.ts`:** la rama `estimated` de `portionEstimateResponseSchema` añade
`name: z.string().nullable().default(null)` y `per_100g: z.object({calories_kcal: z.number(), protein_g: z.number(),
carbs_g: z.number(), fat_g: z.number()}).nullable().default(null)` (el mismo patrón `.nullable().default(null)` de
`mealResponseSchema`). Si falta la clave, sale `null`. Si tiene otra forma (`"143"`, un objeto sin `fat_g`, `name: 5`),
`parse` lanza y `portionEstimateErrorAnswer` muestra el mensaje genérico de la 031. Se reutiliza el `per100g` ya
definido en el archivo.

**Frontend — `frontend/src/features/diary/portionChat.ts`** (firmas exactas):

```ts
export function formatEstimatedGrams(grams: number): string            // sin cambios
export function portionAnswerFromEstimate(estimate: PortionEstimate): PortionChatAnswer // añade name/per100g
export function formatPer100gLine(per100g: PortionPer100g): string
export function latestEstimateAnswer(turns: PortionChatTurn[]): PortionEstimateAnswer | null
export function portionFoodFormDefaults(answer: PortionEstimateAnswer): CustomFoodFormValues
```

**Frontend — `frontend/src/features/diary/constants.ts`:**

```ts
export const PORTION_ADD_FOOD_TITLE = "Añadir alimento"
export const PORTION_ADD_FOOD_DESCRIPTION = "Revisa los datos de la IA y elige en qué comida añadirlo."
export const PORTION_MEAL_REQUIRED_MESSAGE = "Elige en qué comida añadirlo."
```

**Frontend — componentes** (firmas exactas):

```ts
// components/PortionChat.tsx
export function PortionChat(props: {
  chat: PortionChatState
  date: string
  onDialogOpenChange?: (open: boolean) => void
}): ReactElement

// components/PortionAddFoodDialog.tsx
export function PortionAddFoodDialog(props: {
  answer: PortionEstimateAnswer
  date: string
  onClose: () => void
}): ReactElement

// components/CustomFoodForm.tsx (props nuevas, opcionales; las existentes no cambian)
defaultNutrients?: Pick<CustomFoodFormValues, "calories" | "protein" | "carbs" | "fat">
onSubmitAttempt?: () => boolean
```

### 3.3 Lógica

**Backend (reglas puras, sin dependencias externas; el servicio ya recibe `llm_client`, `rate_limiter`, `tracer` y
`logger` por constructor, Art. P2.2):**

- `round_to_tenth(value)`: usa `Decimal(repr(value))` si es `float` y `Decimal(value)` si es `int` (el mismo patrón
  que `parse_grams`), y luego `quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)`. Suma `Decimal(0)` para que un `-0.0`
  salga como `0.0`. Así, 12,65 da 12,7 y 9,549 da 9,5 (AC-002.1).
- `parse_per_100g(value)` devuelve `None` en estos casos:
  - `value` no es un `dict` (AC-002.4);
  - a alguna de las cuatro claves de `NUTRIENT_KEYS` le falta el valor o no es un número según `is_number`, que ya
    rechaza booleanos, `None`, textos e infinitos (AC-002.3);
  - el redondeo lanza `decimal.InvalidOperation` (un entero gigantesco);
  - con los valores **ya redondeados**, las kcal están fuera de `CALORIES_PER_100G_RANGE`, algún macro fuera de
    `MACRO_PER_100G_RANGE`, o la suma de los tres macros, calculada con `Decimal`, supera `MACRO_PER_100G_RANGE[1]`.

  Los extremos (0 y 900; 0 y 100) son válidos (AC-002.2). Si todo cumple, devuelve `PortionPer100g` con los valores
  convertidos a `float`. Se valida después de redondear para que lo devuelto pase siempre `_parse_per_100g` de
  `meal_rules` al guardarlo desde el formulario.
- Nombre: `clean_text(tool_input.get("name"), MAX_NAME_CHARS)`, la utilidad que ya existe. Quita los espacios de los
  extremos, recorta a 100 caracteres y vuelve a quitar los espacios del final; si no es texto o queda vacío, devuelve
  `None` (REQ-003).
- `build_estimate`: solo la rama `estimated` rellena `name` y `per_100g`. `not_food_estimate()` y
  `unknown_estimate()` no cambian y los dejan en `None`, aunque el modelo los traiga (REQ-004, AC-004.1 y AC-004.2).
- `SYSTEM_PROMPT` (sigue siendo una constante fija, NFR-002) añade, después de la frase de `note`: «name es el nombre
  corto del alimento estimado, sin la cantidad (por ejemplo, «Huevo»), de 100 caracteres como máximo. per_100g son las
  calorías (calories_kcal) y los gramos de proteína (protein_g), carbohidratos (carbs_g) y grasa (fat_g) de 100 g de
  la parte comestible, en el mismo estado (crudo, cocinado…) que la porción supuesta; si no los conoces, déjalo
  vacío.»
- Servicio: no cambia. La traza (`trace.finish`) sigue con sus cinco claves, porque la spec deja las trazas fuera de
  alcance; la salida cruda del modelo ya queda en `step.end` (`result.data`).
- Se reutilizan `is_number` (`services/number_validation.py`), `clean_text`, las constantes de `meal_rules` y
  `LazyLLMClient.generate_structured` (Art. P2.5). `temperature` se sigue pasando (`TEMPERATURE = 0`) y el cliente lo
  ignora, como desde el fix posterior a la 031.

**Frontend (lógica pura en `portionChat.ts`):**

- `formatPer100gLine(p)` devuelve `` `Por 100 g: ${formatPortionPreview(p)}` ``. Reutiliza `formatPortionPreview` de
  `format.ts`, que ya da «143 kcal · 12,6 g proteína · 0,7 g carbohidratos · 9,5 g grasa»: las kcal sin decimales y
  los gramos con un decimal y coma (AC-005.1 y AC-005.3).
- `latestEstimateAnswer(turns)` devuelve la `answer` del **último** turno si es de tipo `estimate`. Devuelve `null` si
  no hay turnos, si la respuesta sigue en curso (`answer === null`) o si es `message`, `notice` o `error` (REQ-006).
- `portionFoodFormDefaults(a)` devuelve `{ name: a.name ?? "", grams: String(a.grams), calories, protein, carbs,
  fat }`. Los cuatro valores se calculan con `gramsText(valor)` de `format.ts` (143 da «143» y 12.6 da «12,6») y
  quedan en `""` si falta `per100g` (REQ-007).

**Frontend (componentes):**

- `CustomFoodForm`:
  - `defaultNutrients` rellena `calories`, `protein`, `carbs` y `fat` en `defaultValues`; si no se pasa, quedan en
    `""`, como hasta ahora.
  - `onSubmitAttempt` se llama al enviar, **antes** de la validación de react-hook-form. Si devuelve `false`, el
    formulario sigue mostrando sus propios errores, pero no llama a `onSubmit`:
    ```ts
    onSubmit={(e) => { const ok = onSubmitAttempt?.() ?? true
      return form.handleSubmit((v) => { if (ok) handleSubmit(v) })(e) }}
    ```
    Así «Elige en qué comida añadirlo.» y los errores de los campos salen a la vez.
  - El resto (vista previa, aviso de la biblioteca, «Guardando…», guarda de `isSaving`) no cambia, y
    `AddFoodDialog` no se toca.
- `PortionAddFoodDialog`:
  - Estructura: `Dialog` con `open` controlado, como `AddFoodDialog`, con el título «Añadir alimento» y la
    descripción fija.
  - Estado: `mealType: MealType | null` (null al abrir) y `mealError: boolean`; usa `useAddMealItems(date)`.
  - Campo «Comida», antes del formulario: un `<fieldset role="radiogroup" aria-labelledby=…>` con `<legend>Comida`
    y cuatro `<input type="radio" name="portion-meal">` etiquetados, en el orden de `MEAL_SECTIONS` (los textos ya
    son «Desayuno», «Almuerzo», «Cena», «Meriendas»). Ninguno está marcado al abrir.
  - Error de la comida: `onSubmitAttempt` devuelve `mealType !== null` y, si es `null`, activa `mealError`, que se
    muestra bajo el grupo como `<p role="alert">` con `PORTION_MEAL_REQUIRED_MESSAGE` (y `aria-invalid` en el grupo).
    Elegir una comida lo quita.
  - Formulario: `<CustomFoodForm>`, con los datos de `portionFoodFormDefaults(answer)` como `defaultName`,
    `defaultGrams` y `defaultNutrients`, `submitLabel="Añadir"` e `isSaving={add.isPending}`. Su `onSubmit`, `save`,
    hace lo mismo que `AddFoodDialog.save`: si `add.isPending`, no hace nada; si no, llama a
    `add.mutateAsync({ date, meal_type: mealType, items: [payload] })`. Si falla, el diálogo sigue abierto; si va
    bien, `onClose()` (REQ-009, AC-009.4).
  - Error al guardar: `<p role="alert">{saveErrorMessage(add.error)}</p>`, igual que `AddFoodDialog` (REQ-010).
  - Cerrar: «Cancelar» (deshabilitado mientras guarda) y Escape (`onOpenChange(false)` sin `isPending`) llaman a
    `onClose()` sin enviar nada.
- `PortionChat`:
  - Respuesta: en `AnswerView` (rama `estimate`), después de la nota, va `{answer.per100g &&
    <p>{formatPer100gLine(answer.per100g)}</p>}` (REQ-005).
  - Botón: `const latest = latestEstimateAnswer(chat.turns)`. La fila inferior pasa a ser `[contador] [div: botón
    «Añadir alimento» (type="button", variant="outline", ref) + «Preguntar»]`; el botón solo se pinta si `latest`
    existe y queda justo antes de «Preguntar» en el DOM (REQ-006).
  - Diálogo: el estado local `adding: PortionEstimateAnswer | null` guarda una copia de `latest` al pulsar el botón,
    para que la precarga no cambie con el diálogo abierto, y abre `<PortionAddFoodDialog answer={adding}
    date={date} onClose={close}>`.
  - Foco: `close` pone `adding` a `null` y devuelve el foco al botón con `requestAnimationFrame(() =>
    addButtonRef.current?.focus())`. No se depende de que Radix restaure el foco al desmontar (NFR-003); tras un
    guardado el botón sigue visible y también recibe el foco (decisión).
  - Aviso a la página: `onDialogOpenChange(adding !== null)` con el mismo patrón `notifyRef` de `MealSection`,
    incluida la limpieza al desmontar.
- `DiaryPage`: `const [portionDialogOpen, setPortionDialogOpen] = useState(false)`,
  `useToday(openDialogs.size > 0 || portionDialogOpen)` y `afterTotals={<PortionChat chat={portionChat} date={date}
  onDialogOpenChange={setPortionDialogOpen} />}`. La conversación sigue viviendo en `usePortionChat()`, así que
  guardar o cambiar de día no la borra (AC-009.3). `useAddMealItems(date)` invalida `["diary", date]` y la
  biblioteca, de modo que la sección elegida muestra el alimento nuevo.

### 3.4 Interfaz de usuario

- **Chat:** debajo de cada estimación, en este orden: «Unos N g», «Porción: …», la nota y, si viene, «Por 100 g: …».
  Fila inferior: contador `n/200` a la izquierda; a la derecha, «Añadir alimento» (solo con una estimación como última
  respuesta) y «Preguntar».
- **Diálogo «Añadir alimento»:** título, la descripción «Revisa los datos de la IA y elige en qué comida añadirlo.», el
  error de guardado si lo hay, el grupo «Comida» con cuatro radios en una fila que se ajusta, y el formulario de
  «Crear alimento personalizado» (Nombre, Gramos, cuatro campos por 100 g, vista previa, aviso de la biblioteca) con
  «Añadir»/«Guardando…» y «Cancelar».
- Validación: zod (`customFoodFormSchema`, sin cambios) en los campos y la comprobación de la comida en el estado del
  diálogo (Art. P2.3).
- Accesibilidad: `role="dialog"` con nombre «Añadir alimento» (Radix, por `DialogTitle`), radios nativos etiquetados,
  errores con `role="alert"` y el foco de vuelta al botón del chat.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `PORTION_TOOL` (`name`, `per_100g`), `build_estimate` y `PortionEstimate.name`/`per_100g` en `portion_estimate_rules.py`; `_serialize_portion_estimate` en `meal_routes.py` |
| REQ-002 | `round_to_tenth` y `parse_per_100g` en `portion_estimate_rules.py`, con los rangos de `meal_rules.py` |
| REQ-003 | `clean_text(…, MAX_NAME_CHARS)` dentro de `build_estimate` |
| REQ-004 | `not_food_estimate`/`unknown_estimate` (por defecto `None`) y serialización siempre con las siete claves |
| REQ-005 | `formatPer100gLine` (`portionChat.ts`) y `AnswerView` de `PortionChat.tsx`; `portionAnswerFromEstimate` lleva `per100g` |
| REQ-006 | `latestEstimateAnswer` y el botón con `ref` en `PortionChat.tsx` |
| REQ-007 | `portionFoodFormDefaults`, `CustomFoodForm.defaultNutrients` y `PortionAddFoodDialog`; copia en `adding` (AC-007.5); pausa de `useToday` en `DiaryPage` (AC-007.7) |
| REQ-008 | Grupo de radios «Comida», `mealError` y `CustomFoodForm.onSubmitAttempt` en `PortionAddFoodDialog` |
| REQ-009 | `save` con `useAddMealItems(date)` en `PortionAddFoodDialog`; `date` desde `DiaryPage`; la conversación en `usePortionChat` |
| REQ-010 | `saveErrorMessage`, «Cancelar», `onOpenChange` y guarda de `isPending` en `PortionAddFoodDialog` |
| REQ-011 | `portionEstimateResponseSchema` (`.nullable().default(null)` y error de forma) y `portionEstimateErrorAnswer` existente |
| NFR-001 | `MAX_OUTPUT_TOKENS = 250` en `portion_estimate_rules.py` (el servicio ya lo pasa, una sola llamada) |
| NFR-002 | `SYSTEM_PROMPT` constante ampliado y `PORTION_TOOL` con `name` y los cuatro valores |
| NFR-003 | `DialogTitle` «Añadir alimento» y `addButtonRef` con foco en `close` de `PortionChat` |

## 5. Estrategia de pruebas

### backend

Entorno: Postgres de prueba (`TEST_DATABASE_URL`), solo para los tests de rutas. No se llama a Anthropic ni a Redis
reales (Art. P1.4). Dobles: se reutilizan `FakeStructuredLLMClient`, `FakeRateLimiter`, `FakeRedisClient`,
`FakeLogger` (`tests/fakes.py`) y `FakeTraceBackend`; no hacen falta dobles nuevos ni `monkeypatch`.

- **Unitarios de reglas** (`tests/test_services/test_portion_estimate_rules.py`, sobre `build_estimate` y
  `parse_per_100g`):
  - AC-001.1 a AC-001.3: estimación completa; sin `name` ni `per_100g`; solo uno de los dos.
  - AC-002.1: redondeo de 143,26 / 12,65 / 0,74 / 9,549 a 143,3 / 12,7 / 0,7 / 9,5.
  - AC-002.2: extremos 0/0/0/0 y 900/0/0/100.
  - AC-002.3: parametrizado con 900,1; -1; proteína 100,1; -0,5; `"143"`; `True`; `None`; sin `carbs_g`; 50+40+10,1.
    Los gramos, `unit` y `note` siguen como en una estimación válida y `per_100g` es `None`.
  - AC-002.4: `per_100g` como texto y como lista.
  - AC-003.1 a AC-003.3: espacios en los extremos, 140 caracteres (≤ 100, prefijo del original, sin espacio final;
    conviene un nombre con un espacio en la posición 100), y `""`, `"   "`, `5` o `None`.
  - AC-004.1 y AC-004.2: `not_food` y 0 gramos con nombre y valores, que dan `name`/`per_100g` `None`.
  - Recomendado: un caso con un entero gigantesco que dé `None`, sin excepción.
- **Unitarios del servicio** (`tests/test_services/test_portion_estimate_service.py`):
  - AC-N001.1: una sola llamada con `max_tokens == 250`.
  - AC-N002.1: dos preguntas distintas reciben el mismo `system_prompt`, y `call["tool"]["input_schema"]
    ["properties"]` incluye `name` y `per_100g` con sus cuatro claves.
- **Integración** (`tests/test_routes/test_portion_estimate_routes.py`, fixture `client` y los singletons
  `portion_llm`/`rate_limiter` sustituidos como ya hace el archivo):
  - AC-001.1: JSON exacto de siete claves.
  - AC-004.1: JSON exacto de `not_food`.
  - AC-002.3: un caso con `per_100g` no válido para ver el `null` serializado.
- **Tests de la 030 que el cambio de contrato obliga a actualizar** (sustituidos por la spec 032, no se debilitan):
  - `test_valid_question_returns_the_exact_estimation`, `test_not_food_question_returns_the_fixed_message`,
    `test_invalid_grams_return_unknown` y los demás de rutas que comparan el JSON exacto: añadir `"name": None,
    "per_100g": None`.
  - `test_the_model_is_called_once_with_150_tokens_and_temperature_0`: pasa a 250, con el marcador `032 NFR-001
    AC-N001.1` añadido. Se puede renombrar, porque el nombre describe el comportamiento (Art. B5.5).
  - El test de la traza de cinco claves **no** cambia: se mantiene como comprobación de que la traza sigue igual.

### frontend

La red se simula con `vi.mock("@/features/diary/api", …)` (`estimatePortion`, `addMealItems`), Art. P1.4. Los tests
van junto a su archivo e importan desde `vitest` (P1.2). Fixtures: `src/test/portionEstimateFixtures.ts` gana
`EGGS_ESTIMATE_WITH_PER_100G` (la respuesta cruda de AC-001.1) y `makePortionEstimate` acepta `name`/`per_100g`. No
hacen falta servicios del entorno.

- **`schemas.test.ts`:**
  - REQ-011 / AC-011.1: sin las claves nuevas da `name`/`per_100g` `null`.
  - AC-011.2: `per_100g: "143"`, sin `fat_g` o `name: 5` lanzan.
  - Una respuesta completa de AC-001.1 se acepta.
- **`portionChat.test.ts`** (lógica pura):
  - `formatPer100gLine`: AC-005.1 y AC-005.3 (52,4 da «52»; 0 da «0,0»).
  - `latestEstimateAnswer`: AC-006.1, AC-006.3, AC-006.4, AC-006.5 y AC-007.5 (devuelve la última).
  - `portionFoodFormDefaults`: AC-007.1 y AC-007.3.
  - `portionAnswerFromEstimate` con `name`/`per_100g`. Los tests de la 031 siguen válidos sin cambios.
- **`components/PortionChat.test.tsx`** (con `usePortionChat` real y `estimatePortion` simulado):
  - AC-005.1 y AC-005.2: orden de los textos.
  - AC-006.1 a AC-006.5: «Añadir alimento» dentro del bloque y justo antes de «Preguntar» (`compareDocumentPosition`
    o el orden de `getAllByRole("button")` dentro del bloque).
  - AC-011.1 y AC-011.2: la respuesta de un backend anterior o con otra forma.
  - AC-007.1 y AC-007.5: pulsar el botón abre el diálogo con los valores de la última estimación.
  - AC-010.3: «Cancelar» y Escape no envían nada y la conversación sigue igual.
  - AC-N003.2: el foco vuelve al botón (`waitFor(() => expect(button).toHaveFocus())`).
  - Hay que **actualizar** el arnés existente a `<PortionChat chat={chat} date="2026-10-31" />`, porque la prop `date`
    es obligatoria; es un cambio mecánico que no debilita nada.
- **`components/PortionAddFoodDialog.test.tsx`** (nuevo; `QueryClientProvider` y `addMealItems` simulado):
  - AC-007.1 a AC-007.4 y AC-007.6.
  - AC-008.1 y AC-008.2.
  - AC-009.1: payload exacto con `meal_type: "dinner"` y la fecha que se pasa.
  - AC-009.2: otra fecha y `breakfast`.
  - AC-009.4: promesa pendiente; un segundo clic no envía y se ve «Guardando…».
  - AC-010.1 (`ApiError` 400), AC-010.2 (red o 500, con `SAVE_FAILED_MESSAGE`) y AC-010.3.
  - AC-N003.1: `getByRole("dialog", { name: "Añadir alimento" })`.
- **`pages/DiaryPage.test.tsx`** (integración de página, con los mocks de API que ya usa el archivo):
  - AC-009.3: guardar cierra el diálogo, el diario se vuelve a leer con el alimento en la sección y la conversación y
    el botón siguen.
  - AC-009.2 con `?date=`.
  - AC-007.7: con el diálogo abierto, avanzar el reloj más allá de medianoche no cambia el día, con el mismo patrón de
    temporizadores que los tests de la 026.
  - Cuidado: las secciones ya tienen botones «Añadir alimento». Los tests nuevos acotan con `within(bloque del chat)`
    y los existentes que usen `getAllByRole("button", {name: "Añadir alimento"})` siguen valiendo, porque sin una
    estimación el botón del chat no existe.

Cobertura de AC: todos los AC de REQ-001 a REQ-011 y de NFR-001 a NFR-003 aparecen arriba al menos una vez.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Con 250 tokens, una respuesta con nombre y valores se corta (`max_tokens`) y da `unknown`, peor que hoy | Baja | Media | El esquema pide `name` ≤ 100 caracteres y cuatro números; las instrucciones piden textos cortos. Se revisa en Langfuse tras desplegar (los `stop_reason` están en `step.end`) |
| El modelo inventa valores por 100 g poco realistas pero dentro de rango | Media | Media | Fuera del alcance comprobarlo (NFR-002). El usuario los revisa en un formulario editable con la vista previa antes de «Añadir» |
| Romper tests de la 030 y la 031 por el cambio de contrato o de firma | Alta | Baja | Campos nuevos con valor por defecto o claves opcionales; la lista exacta de tests que se actualizan está en §5 |
| Confusión entre el «Añadir alimento» del chat y los de las secciones (tests y lectores de pantalla) | Media | Baja | Tests acotados con `within` y el diálogo con nombre propio. El nombre accesible del botón es «Añadir alimento», como pide la spec |
| Foco perdido al desmontar el diálogo (Radix no restaura con montaje condicional) | Media | Baja | Foco explícito con `ref` y `requestAnimationFrame`, cubierto por AC-N003.2 |
| Un frontend nuevo contra un backend antiguo | Baja | Baja | REQ-011: las claves que faltan se tratan como `null` y el botón sigue disponible |

## 7. Cumplimiento de la constitución

- **B1, B4 y B5:** cambio con spec aprobada. Cada AC tiene su test en §5 con marcador `SDD: 032 …` (P1.1). Los
  esqueletos siguen P1.5 en backend y frontend: `round_to_tenth`/`parse_per_100g` lanzan `NotImplementedError("not
  implemented")`, y `formatPer100gLine`, `latestEstimateAnswer`, `portionFoodFormDefaults` y `PortionAddFoodDialog`
  lanzan `Error("not implemented")` con parámetros prefijados con `_`. Los tests existentes que se tocan cambian por el
  contrato nuevo de la spec, no se debilitan (B5.3).
- **P1:** fakes escritos a mano e inyectados por constructor o en los singletons, sin `unittest.mock` ni `monkeypatch`.
  En el frontend, la red se simula en `api.ts`.
- **P2 backend:** las reglas viven en `services/`, la ruta solo serializa y no hay commits. Se reutilizan
  `meal_rules`, `number_validation`, `clean_text` y `LazyLLMClient` (P2.5). Sin cambios de modelo, así que no hay
  migración (P2.4).
- **P2 frontend:** organización por feature; HTTP solo por `apiFetch`, a través de `api.ts`; formularios con
  react-hook-form y zod (el formulario reutiliza `customFoodFormSchema`); estado de servidor con
  `useAddMealItems`/TanStack Query. El campo «Comida» es estado local del diálogo y no un campo de RHF: es una
  comprobación de presencia sobre un valor cerrado, que no admite texto libre, así que no hace falta zod (P3.2 se
  cumple, porque los datos que se envían siguen validados por zod y por el servidor).
- **P3:** el endpoint sigue con `@require_auth` y el límite de uso en Redis. Todo lo nuevo que llega del modelo se
  valida en el servicio (reglas puras) y en el frontend con zod. No hay SQL ni secretos nuevos.
- **P2.General.1:** los textos nuevos están en español con tildes.
- **P4:** sin migraciones ni pasos manuales en producción. Basta con el CD normal del backend y Vercel.
- No se incumple ningún «DEBERÍA».

## 8. ADRs

Ninguna. El cambio amplía, dentro del mismo diseño, la herramienta forzada y las reglas puras decididas en
[ADR-0037](../../docs/sdd/decisions/ADR-0037-estimacion-de-porciones-con-salida-estructurada.md). El nuevo máximo
de 250 tokens viene de la spec (NFR-001). El contexto de ADR-0037 sigue mencionando los 150 tokens de la 030; si se
quiere anotar el cambio allí, lo hará la sesión principal (Art. P5.2).
