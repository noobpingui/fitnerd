import type { NutrientKey, Nutrients } from "./types"

export type NutrientProgressView = {
  consumed: number
  remaining: number
  over: boolean
  percent: number
}

const KEYS: NutrientKey[] = ["calories_kcal", "protein_g", "carbs_g", "fat_g"]

// Redondea con las mitades hacia arriba (como ROUND_HALF_UP del servidor) usando
// notación exponencial para evitar el error binario de multiplicar por 10^n.
function roundHalfUp(value: number, decimals: number): number {
  const shifted = Math.round(Number(`${value.toFixed(12)}e${decimals}`))
  return Number(`${shifted}e-${decimals}`)
}

export function portionNutrients(per100g: Nutrients, grams: number): Nutrients {
  const result = {} as Nutrients
  for (const key of KEYS) {
    const value = per100g[key]
    if (value === null) {
      result[key] = null
      continue
    }
    // toPrecision(12) limpia el ruido binario (3,57 × 150 / 100 = 5,355000000000001).
    const exact = Number(((value * grams) / 100).toPrecision(12))
    result[key] = roundHalfUp(exact, 2)
  }
  return result
}

export function nutrientProgress(
  consumed: number,
  target: number,
  decimals: 0 | 1
): NutrientProgressView {
  const shown = roundHalfUp(consumed, decimals)
  const remaining = roundHalfUp(target - shown, decimals)
  const percent = target <= 0 ? 0 : Math.min(100, (shown * 100) / target)
  return { consumed: shown, remaining, over: remaining < 0, percent }
}
