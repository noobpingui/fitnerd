import { z } from "zod"
import { PORTION_QUESTION_MAX_LENGTH } from "./constants"
import type {
  CustomItemPayload,
  PortionEstimate,
  PortionQuestionFormValues,
  ProposalFormValues,
} from "./types"

export const GRAMS_RANGE_MESSAGE = "Los gramos deben estar entre 1 y 2000."
export const GRAMS_DECIMALS_MESSAGE = "Los gramos admiten como mucho un decimal."
export const NAME_REQUIRED_MESSAGE = "Escribe el nombre del alimento."
export const NAME_TOO_LONG_MESSAGE = "El nombre no puede superar los 100 caracteres."
export const PER_100G_REQUIRED_MESSAGE =
  "Indica las calorías, proteína, carbohidratos y grasa por 100 g."
export const CALORIES_RANGE_MESSAGE = "Las calorías por 100 g deben estar entre 0 y 900."
export const MACROS_RANGE_MESSAGE = "Los macros por 100 g deben estar entre 0 y 100 g."
export const MACROS_SUM_MESSAGE =
  "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g."
export const CUSTOM_NAME_MAX_LENGTH = 100

export type GramsFormValues = { grams: string }
export type CustomFoodFormValues = {
  name: string
  grams: string
  calories: string
  protein: string
  carbs: string
  fat: string
}

// Admite coma o punto como separador decimal; null si no es un número sin signo.
export function parseDecimalText(text: string): number | null {
  const normalized = text.trim().replace(",", ".")
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

// Como parseDecimalText pero admite signo, para dar el mensaje de rango en negativos.
export function parseSignedDecimalText(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed.startsWith("-")) {
    const value = parseDecimalText(trimmed.slice(1))
    return value === null ? null : value === 0 ? 0 : -value
  }
  return parseDecimalText(trimmed)
}

// Más de un decimal significativo (150,50 cuenta como uno).
function hasTooManyDecimals(text: string): boolean {
  const fraction = text.trim().replace(",", ".").split(".")[1] ?? ""
  return fraction.replace(/0+$/, "").length > 1
}

// Devuelve el mensaje de error de unos gramos o null si son válidos.
export function gramsError(text: string): string | null {
  const value = parseDecimalText(text)
  if (value === null || value < 1 || value > 2000) return GRAMS_RANGE_MESSAGE
  if (hasTooManyDecimals(text)) return GRAMS_DECIMALS_MESSAGE
  return null
}

export const gramsFormSchema = z
  .object({ grams: z.string() })
  .superRefine((values, ctx) => {
    const message = gramsError(values.grams)
    if (message) ctx.addIssue({ code: "custom", path: ["grams"], message })
  })

export type CustomFoodEditValues = {
  name: string
  calories: string
  protein: string
  carbs: string
  fat: string
}

type CustomFoodIssueValues = {
  name: string
  grams?: string
  calories: string
  protein: string
  carbs: string
  fat: string
}

// Reglas compartidas por el formulario de la 022 (con gramos) y el de edición de la 029 (sin gramos).
function addCustomFoodIssues(values: CustomFoodIssueValues, ctx: z.RefinementCtx) {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message })

  const name = values.name.trim()
  if (name === "") issue("name", NAME_REQUIRED_MESSAGE)
  else if (name.length > CUSTOM_NAME_MAX_LENGTH) issue("name", NAME_TOO_LONG_MESSAGE)

  if (values.grams !== undefined) {
    const gramsMessage = gramsError(values.grams)
    if (gramsMessage) issue("grams", gramsMessage)
  }

  const calories = parseSignedDecimalText(values.calories)
  if (calories === null) issue("calories", PER_100G_REQUIRED_MESSAGE)
  else if (calories < 0 || calories > 900) issue("calories", CALORIES_RANGE_MESSAGE)

  const macros: number[] = []
  let macrosValid = true
  for (const field of ["protein", "carbs", "fat"] as const) {
    const value = parseSignedDecimalText(values[field])
    if (value === null) {
      issue(field, PER_100G_REQUIRED_MESSAGE)
      macrosValid = false
    } else if (value < 0 || value > 100) {
      issue(field, MACROS_RANGE_MESSAGE)
      macrosValid = false
    } else {
      macros.push(value)
    }
  }
  if (macrosValid) {
    const sum = Math.round(macros.reduce((a, b) => a + b, 0) * 1e6) / 1e6
    if (sum > 100) issue("macroSum", MACROS_SUM_MESSAGE)
  }
}

export const customFoodEditSchema = z
  .object({
    name: z.string(),
    calories: z.string(),
    protein: z.string(),
    carbs: z.string(),
    fat: z.string(),
  })
  .superRefine(addCustomFoodIssues)

export const customFoodFormSchema = z
  .object({
    name: z.string(),
    grams: z.string(),
    calories: z.string(),
    protein: z.string(),
    carbs: z.string(),
    fat: z.string(),
  })
  .superRefine(addCustomFoodIssues)

export function customItemPayload(values: CustomFoodFormValues): CustomItemPayload {
  return {
    name: values.name.trim(),
    grams: parseDecimalText(values.grams) as number,
    per_100g: {
      calories_kcal: parseSignedDecimalText(values.calories) as number,
      protein_g: parseSignedDecimalText(values.protein) as number,
      carbs_g: parseSignedDecimalText(values.carbs) as number,
      fat_g: parseSignedDecimalText(values.fat) as number,
    },
  }
}

const nutrientKey = z.enum(["calories_kcal", "protein_g", "carbs_g", "fat_g"])
const nullableNutrients = z.object({
  calories_kcal: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fat_g: z.number().nullable(),
})
const totals = z.object({
  calories_kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
})

export const mealResponseSchema = z.object({
  id: z.number(),
  date: z.string(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  items: z.array(
    z.object({
      id: z.number(),
      source: z.enum(["catalog", "usda", "custom"]),
      catalog_id: z.string().nullable().default(null),
      custom_food_id: z.number().nullable().default(null),
      fdc_id: z.number().nullable(),
      name: z.string(),
      data_type: z.enum(["foundation", "sr_legacy"]).nullable(),
      grams: z.number(),
      per_100g: nullableNutrients,
      nutrients: nullableNutrients,
    })
  ),
  totals,
  incomplete: z.array(nutrientKey),
})

export const diaryResponseSchema = z.object({
  date: z.string(),
  meals: z.array(mealResponseSchema),
  totals,
  incomplete: z.array(nutrientKey),
})

const confidence = z.enum(["high", "medium", "low"])
const per100g = z.object({
  calories_kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
})

export const mealPhotoAnalysisSchema = z.object({
  items: z.array(
    z.object({
      catalog_id: z.string(),
      name: z.string(),
      grams: z.number(),
      confidence,
      per_100g: per100g,
      nutrients: nullableNutrients,
    })
  ),
  unmatched: z.array(z.object({ name: z.string(), grams: z.number(), confidence })),
  totals,
})

function proposalEntryUnion() {
  const key = z.string()
  return z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("catalog"),
      catalogId: z.string(),
      name: z.string(),
      per100g,
      grams: z.string(),
      tag: z.enum(["high", "medium", "low", "user"]),
      key,
    }),
    z.object({
      kind: z.literal("custom"),
      name: z.string(),
      per100g,
      grams: z.string(),
      customFoodId: z.number().optional(),
      key,
    }),
    z.object({
      kind: z.literal("unmatched"),
      name: z.string(),
      grams: z.number(),
      confidence,
      key,
    }),
  ])
}

// Valida los gramos de las entradas que se guardan; las «unmatched» no se validan.
function validateProposalGrams(
  values: { entries: { kind: string; grams: string | number }[] },
  ctx: z.RefinementCtx
) {
  values.entries.forEach((entry, index) => {
    if (entry.kind === "unmatched") return
    const message = gramsError(String(entry.grams))
    if (message) ctx.addIssue({ code: "custom", path: ["entries", index, "grams"], message })
  })
}

// Esquema del formulario de la propuesta (PhotoReview): `key` obligatoria y gramos
// validados salvo en las entradas sin coincidencia.
export const proposalReviewSchema: z.ZodType<ProposalFormValues, ProposalFormValues> = z
  .object({ entries: z.array(proposalEntryUnion()) })
  .superRefine(validateProposalGrams)

export const removalResponseSchema = z.object({ restore_token: z.string().min(1) })

// Pregunta sin los espacios de los extremos, obligatoria y de hasta 200 caracteres.
export const portionQuestionFormSchema: z.ZodType<
  PortionQuestionFormValues,
  PortionQuestionFormValues
> = z.object({ question: z.string().trim().min(1).max(PORTION_QUESTION_MAX_LENGTH) })

// Respuesta 200 del contrato de la 030; cualquier otra forma lanza.
export const portionEstimateResponseSchema: z.ZodType<PortionEstimate, unknown> = z.union([
  z.object({
    status: z.literal("estimated"),
    grams: z.number().int().min(1).max(5000),
    unit: z.string().nullable(),
    note: z.string().nullable(),
  }),
  z.object({ status: z.enum(["not_food", "unknown"]), message: z.string().min(1) }),
])
