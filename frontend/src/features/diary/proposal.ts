import type { CatalogFood } from "@/features/catalog/types"
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

export function catalogEntry(food: CatalogFood, grams: string): ProposalEntry {
  return {
    kind: "catalog",
    catalogId: food.id,
    name: food.name,
    per100g: food.per_100g,
    grams,
    tag: "user",
  }
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
