import type { AddMealItemsPayload, Diary, Meal } from "./types"

export async function getDiary(_date: string): Promise<Diary> {
  throw new Error("not implemented")
}

export async function addMealItems(_payload: AddMealItemsPayload): Promise<Meal> {
  throw new Error("not implemented")
}

export async function updateMealItemGrams(
  _mealId: number,
  _itemId: number,
  _grams: number
): Promise<Meal> {
  throw new Error("not implemented")
}

export async function removeMealItem(_mealId: number, _itemId: number): Promise<void> {
  throw new Error("not implemented")
}
