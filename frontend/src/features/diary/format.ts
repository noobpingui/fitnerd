import type { MealItem, Nutrients } from "./types"

export function formatDiaryDate(_isoDate: string): string {
  throw new Error("not implemented")
}

export function formatKcal(_value: number | null): string {
  throw new Error("not implemented")
}

export function formatNutrientGrams(_value: number): string {
  throw new Error("not implemented")
}

export function formatLoggedGrams(_grams: number): string {
  throw new Error("not implemented")
}

export function formatPortionPreview(_nutrients: Nutrients): string {
  throw new Error("not implemented")
}

export function sourceLabel(_item: MealItem): string {
  throw new Error("not implemented")
}
