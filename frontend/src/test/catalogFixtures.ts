// Fábrica compartida por los tests de la feature 023 (catálogo genérico de
// alimentos). El alimento del catálogo registrado en el diario (`makeCatalogItem`)
// vive en `diaryFixtures.ts`, junto a las demás fábricas del diario.
import type { CatalogFood } from "@/features/catalog/types"

// Pechuga de pollo a la plancha del catálogo: 165 kcal, 31,0 g, 0,0 g y 3,57 g por 100 g.
export function makeCatalogFood(overrides: Partial<CatalogFood> = {}): CatalogFood {
  return {
    id: "pechuga-de-pollo-a-la-plancha",
    name: "Pechuga de pollo a la plancha",
    per_100g: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 },
    ...overrides,
  }
}
