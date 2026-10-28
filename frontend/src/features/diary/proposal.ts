import type { CustomLibraryFood, LibraryFood } from "@/features/food-library/types"
import { formatPortionPreview } from "./format"
import { portionNutrients } from "./nutrition"
import { parseDecimalText } from "./schemas"
import type {
  AnalysisConfidence,
  CustomItemPayload,
  MealPhotoAnalysis,
  NutrientKey,
  NutrientTotals,
  Nutrients,
  ProposalEntry,
  ProposalFormEntry,
  SavableItemPayload,
} from "./types"

const NUTRIENT_KEYS: NutrientKey[] = ["calories_kcal", "protein_g", "carbs_g", "fat_g"]

const CONFIDENCE_LABELS: Record<AnalysisConfidence, string> = {
  high: "Confianza alta",
  medium: "Confianza media",
  low: "Confianza baja",
}

// Los alimentos del catálogo en su orden y después los sin coincidencia.
export function proposalFromAnalysis(analysis: MealPhotoAnalysis): ProposalEntry[] {
  return [
    ...analysis.items.map(
      (item): ProposalEntry => ({
        kind: "catalog",
        catalogId: item.catalog_id,
        name: item.name,
        per100g: item.per_100g,
        grams: String(item.grams),
        tag: item.confidence,
      })
    ),
    ...analysis.unmatched.map(
      (item): ProposalEntry => ({
        kind: "unmatched",
        name: item.name,
        grams: item.grams,
        confidence: item.confidence,
      })
    ),
  ]
}

export function libraryEntry(food: LibraryFood, grams: string): ProposalEntry {
  if (food.kind === "custom") {
    return {
      kind: "custom",
      customFoodId: food.id,
      name: food.name,
      per100g: food.per_100g,
      grams,
    }
  }
  return {
    kind: "catalog",
    catalogId: food.id,
    name: food.name,
    per100g: food.per_100g,
    grams,
    tag: "user",
  }
}

let entryKeyCounter = 0

// Cada entrada del formulario lleva una clave propia: los gramos observados se
// emparejan por clave y nunca por posición.
export function withEntryKey(entry: ProposalEntry): ProposalFormEntry {
  entryKeyCounter += 1
  return { ...entry, key: `entry-${entryKeyCounter}` }
}

// Los gramos observados de la entrada con la misma clave pisan los del campo.
export function mergeProposalEntries(
  fields: ProposalFormEntry[],
  watched: readonly (Partial<ProposalFormEntry> | undefined)[] | undefined
): ProposalFormEntry[] {
  if (!watched) return fields
  return fields.map((field) => {
    if (field.kind === "unmatched") return field
    const seen = watched.find((value) => value?.key === field.key)
    const grams = seen?.grams
    return typeof grams === "string" ? { ...field, grams } : field
  })
}

// Si la entrada es el alimento propio borrado, la misma entrada sin `customFoodId` (y sin `key`); si no, null.
export function unlinkCustomFood(entry: ProposalEntry, customFoodId: number): ProposalEntry | null {
  if (entry.kind !== "custom" || entry.customFoodId !== customFoodId) return null
  return { kind: "custom", name: entry.name, per100g: entry.per100g, grams: entry.grams }
}

// Si la entrada es ese alimento propio (custom con el mismo customFoodId), la misma entrada (misma key y gramos)
// con el nombre y los valores por 100 g editados; si no, null.
export function applyCustomFoodEdit(
  entry: ProposalFormEntry,
  food: CustomLibraryFood
): ProposalFormEntry | null {
  if (entry.kind !== "custom" || entry.customFoodId !== food.id) return null
  return { ...entry, name: food.name, per100g: food.per_100g }
}

export function customEntry(payload: CustomItemPayload): ProposalEntry {
  return {
    kind: "custom",
    name: payload.name,
    per100g: payload.per_100g,
    grams: String(payload.grams).replace(".", ","),
  }
}

export function isSavable(entry: ProposalEntry): boolean {
  return entry.kind !== "unmatched"
}

export function entryNutrients(entry: ProposalEntry): Nutrients | null {
  if (entry.kind === "unmatched") return null
  return portionNutrients(entry.per100g, parseDecimalText(entry.grams) ?? 0)
}

// Las entradas sin coincidencia no cuentan.
export function proposalTotals(entries: ProposalEntry[]): NutrientTotals {
  const totals: NutrientTotals = { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  for (const entry of entries) {
    const nutrients = entryNutrients(entry)
    if (!nutrients) continue
    for (const key of NUTRIENT_KEYS) totals[key] += nutrients[key] ?? 0
  }
  return totals
}

export function proposalItems(entries: ProposalEntry[]): SavableItemPayload[] {
  const items: SavableItemPayload[] = []
  for (const entry of entries) {
    if (entry.kind === "catalog") {
      items.push({ catalog_id: entry.catalogId, grams: parseDecimalText(entry.grams) as number })
    } else if (entry.kind === "custom" && entry.customFoodId !== undefined) {
      items.push({
        custom_food_id: entry.customFoodId,
        grams: parseDecimalText(entry.grams) as number,
      })
    } else if (entry.kind === "custom") {
      items.push({
        name: entry.name,
        grams: parseDecimalText(entry.grams) as number,
        per_100g: entry.per100g,
      })
    }
  }
  return items
}

export function confidenceLabel(confidence: AnalysisConfidence): string {
  return CONFIDENCE_LABELS[confidence]
}

export function entryTag(entry: ProposalEntry): string {
  if (entry.kind === "custom") return "Personalizado"
  if (entry.kind === "unmatched") return confidenceLabel(entry.confidence)
  return entry.tag === "user" ? "Añadido por ti" : confidenceLabel(entry.tag)
}

export function formatProposalTotal(totals: NutrientTotals): string {
  return `Total: ${formatPortionPreview(totals)}`
}
