// Fábricas compartidas por los tests de la feature 028 (biblioteca de alimentos
// del diario): resultados de /api/food-library con la forma de la sección 6 de
// la spec.
import type {
  CatalogLibraryFood,
  CustomLibraryFood,
  RecentFood,
} from "@/features/food-library/types"

// Pechuga de pollo a la plancha del catálogo: 165 kcal, 31,0 g, 0,0 g y 3,57 g por 100 g.
export function makeLibraryFood(overrides: Partial<CatalogLibraryFood> = {}): CatalogLibraryFood {
  return {
    kind: "catalog",
    id: "pechuga-de-pollo-a-la-plancha",
    name: "Pechuga de pollo a la plancha",
    per_100g: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 },
    favorite: false,
    ...overrides,
  }
}

// Banano del catálogo: 89 kcal, 1,09 g, 22,84 g y 0,33 g por 100 g.
export function makeBananaFood(overrides: Partial<CatalogLibraryFood> = {}): CatalogLibraryFood {
  return makeLibraryFood({
    id: "banano",
    name: "Banano",
    per_100g: { calories_kcal: 89, protein_g: 1.09, carbs_g: 22.84, fat_g: 0.33 },
    ...overrides,
  })
}

// Gallo pinto propio (id 12): 180 kcal, 6,0 g, 30,0 g y 4,0 g por 100 g.
export function makeCustomLibraryFood(
  overrides: Partial<CustomLibraryFood> = {}
): CustomLibraryFood {
  return {
    kind: "custom",
    id: 12,
    name: "Gallo pinto",
    per_100g: { calories_kcal: 180, protein_g: 6, carbs_g: 30, fat_g: 4 },
    favorite: false,
    ...overrides,
  }
}

// Un reciente: el alimento con los gramos de su último registro.
export function makeRecentFood<T extends CatalogLibraryFood | CustomLibraryFood>(
  food: T,
  lastGrams: number
): RecentFood {
  return { ...food, last_grams: lastGrams }
}
