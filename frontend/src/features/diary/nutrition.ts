import type { Nutrients } from "./types"

export type NutrientProgressView = {
  consumed: number
  remaining: number
  over: boolean
  percent: number
}

export function portionNutrients(_per100g: Nutrients, _grams: number): Nutrients {
  throw new Error("not implemented")
}

export function nutrientProgress(
  _consumed: number,
  _target: number,
  _decimals: 0 | 1
): NutrientProgressView {
  throw new Error("not implemented")
}
