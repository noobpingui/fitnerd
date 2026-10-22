import type { CatalogFood } from "@/features/catalog/types"
import type {
  AnalysisConfidence,
  CustomItemPayload,
  MealPhotoAnalysis,
  NutrientTotals,
  Nutrients,
  ProposalEntry,
  SavableItemPayload,
} from "./types"

export function proposalFromAnalysis(_analysis: MealPhotoAnalysis): ProposalEntry[] {
  throw new Error("not implemented")
}

export function catalogEntry(_food: CatalogFood, _grams: string): ProposalEntry {
  throw new Error("not implemented")
}

export function customEntry(_payload: CustomItemPayload): ProposalEntry {
  throw new Error("not implemented")
}

export function isSavable(_entry: ProposalEntry): boolean {
  throw new Error("not implemented")
}

export function entryNutrients(_entry: ProposalEntry): Nutrients | null {
  throw new Error("not implemented")
}

export function proposalTotals(_entries: ProposalEntry[]): NutrientTotals {
  throw new Error("not implemented")
}

export function proposalItems(_entries: ProposalEntry[]): SavableItemPayload[] {
  throw new Error("not implemented")
}

export function confidenceLabel(_confidence: AnalysisConfidence): string {
  throw new Error("not implemented")
}

export function entryTag(_entry: ProposalEntry): string {
  throw new Error("not implemented")
}

export function formatProposalTotal(_totals: NutrientTotals): string {
  throw new Error("not implemented")
}
