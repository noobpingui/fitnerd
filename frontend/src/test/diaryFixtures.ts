// Fábricas compartidas por los tests de la feature 022 (diario de comidas):
// alimentos, comidas y diarios con la forma de las respuestas de /api/meals.
import type {
  Diary,
  Meal,
  MealItem,
  NutrientKey,
  NutrientTotals,
} from "@/features/diary/types"

const KEYS: NutrientKey[] = ["calories_kcal", "protein_g", "carbs_g", "fat_g"]

export const ZERO_TOTALS: NutrientTotals = {
  calories_kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
}

// Pollo de USDA (SR Legacy) con 150 g: 247,5 kcal, 46,5 g, 0 g y 5,36 g.
export function makeMealItem(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 31,
    source: "usda",
    catalog_id: null,
    fdc_id: 171477,
    name: "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
    data_type: "sr_legacy",
    grams: 150,
    per_100g: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 },
    nutrients: { calories_kcal: 247.5, protein_g: 46.5, carbs_g: 0, fat_g: 5.36 },
    ...overrides,
  }
}

// Gallo pinto personalizado de 250 g: 400 kcal, 13,75 g, 67,5 g y 8 g.
export function makeCustomItem(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 32,
    source: "custom",
    catalog_id: null,
    fdc_id: null,
    name: "Gallo pinto",
    data_type: null,
    grams: 250,
    per_100g: { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
    nutrients: { calories_kcal: 400, protein_g: 13.75, carbs_g: 67.5, fat_g: 8 },
    ...overrides,
  }
}

// Arroz blanco cocido del catálogo registrado con 150 g: 195 kcal.
export function makeCatalogItem(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 33,
    source: "catalog",
    catalog_id: "arroz-blanco-cocido",
    fdc_id: null,
    name: "Arroz blanco cocido",
    data_type: null,
    grams: 150,
    per_100g: { calories_kcal: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3 },
    nutrients: { calories_kcal: 195, protein_g: 4.05, carbs_g: 42.3, fat_g: 0.45 },
    ...overrides,
  }
}

// Suma los nutrientes conocidos de los alimentos (como hace el servidor).
export function sumItems(items: MealItem[]): NutrientTotals {
  const totals = { ...ZERO_TOTALS }
  for (const item of items) {
    for (const key of KEYS) totals[key] += item.nutrients[key] ?? 0
  }
  return totals
}

export function incompleteOf(items: MealItem[]): NutrientKey[] {
  return KEYS.filter((key) => items.some((item) => item.nutrients[key] === null))
}

export function makeMeal(overrides: Partial<Meal> = {}): Meal {
  const items = overrides.items ?? [makeMealItem()]
  return {
    id: 12,
    date: "2026-10-20",
    meal_type: "lunch",
    items,
    totals: sumItems(items),
    incomplete: incompleteOf(items),
    ...overrides,
  }
}

export function makeDiary(meals: Meal[] = [], overrides: Partial<Diary> = {}): Diary {
  const items = meals.flatMap((meal) => meal.items)
  return {
    date: "2026-10-20",
    meals,
    totals: sumItems(items),
    incomplete: incompleteOf(items),
    ...overrides,
  }
}
