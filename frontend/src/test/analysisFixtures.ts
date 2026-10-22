// Fábricas de la spec 025: respuestas de POST /api/meals/analyze (spec 024).
import type {
  MealPhotoAnalysis,
  NutrientTotals,
  ProposedFood,
  UnmatchedFood,
} from "@/features/diary/types"

// Arroz blanco cocido, 150 g: 195 kcal, 4,0 g, 42,3 g y 0,4 g.
export const RICE: ProposedFood = {
  catalog_id: "arroz-blanco-cocido",
  name: "Arroz blanco cocido",
  grams: 150,
  confidence: "high",
  per_100g: { calories_kcal: 130, protein_g: 2.69, carbs_g: 28.17, fat_g: 0.28 },
  nutrients: { calories_kcal: 195, protein_g: 4.04, carbs_g: 42.26, fat_g: 0.42 },
}

// Pechuga de pollo a la plancha, 100 g: 165 kcal, 31 g, 0 g y 3,57 g.
export const CHICKEN: ProposedFood = {
  catalog_id: "pechuga-de-pollo-a-la-plancha",
  name: "Pechuga de pollo a la plancha",
  grams: 100,
  confidence: "medium",
  per_100g: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 },
  nutrients: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 },
}

// Alimento que el modelo ve y no está en el catálogo.
export const TOMATO_SAUCE: UnmatchedFood = {
  name: "Salsa de tomate",
  grams: 30,
  confidence: "low",
}

function sumTotals(items: ProposedFood[]): NutrientTotals {
  const totals: NutrientTotals = { calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  for (const item of items) {
    totals.calories_kcal += item.nutrients.calories_kcal ?? 0
    totals.protein_g += item.nutrients.protein_g ?? 0
    totals.carbs_g += item.nutrients.carbs_g ?? 0
    totals.fat_g += item.nutrients.fat_g ?? 0
  }
  return totals
}

export function makeAnalysis(overrides: Partial<MealPhotoAnalysis> = {}): MealPhotoAnalysis {
  const items = overrides.items ?? [RICE]
  return {
    items,
    unmatched: [],
    totals: sumTotals(items),
    ...overrides,
  }
}
