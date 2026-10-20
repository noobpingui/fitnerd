import { z } from "zod"
import type { CustomItemPayload, Diary, Meal } from "./types"

export const GRAMS_RANGE_MESSAGE = "Los gramos deben estar entre 1 y 2000."
export const GRAMS_DECIMALS_MESSAGE = "Los gramos admiten como mucho un decimal."
export const NAME_REQUIRED_MESSAGE = "Escribe el nombre del alimento."
export const PER_100G_REQUIRED_MESSAGE =
  "Indica las calorías, proteína, carbohidratos y grasa por 100 g."
export const CALORIES_RANGE_MESSAGE = "Las calorías por 100 g deben estar entre 0 y 900."
export const MACROS_RANGE_MESSAGE = "Los macros por 100 g deben estar entre 0 y 100 g."
export const MACROS_SUM_MESSAGE =
  "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g."
export const CUSTOM_NAME_MAX_LENGTH = 100

export type GramsFormValues = { grams: string }
export type CustomFoodFormValues = {
  name: string
  grams: string
  calories: string
  protein: string
  carbs: string
  fat: string
}

export function parseDecimalText(_text: string): number | null {
  throw new Error("not implemented")
}

export const gramsFormSchema = z.custom<GramsFormValues>(() => {
  throw new Error("not implemented")
})

export const customFoodFormSchema = z.custom<CustomFoodFormValues>(() => {
  throw new Error("not implemented")
})

export function customItemPayload(_values: CustomFoodFormValues): CustomItemPayload {
  throw new Error("not implemented")
}

export const diaryResponseSchema = z.custom<Diary>(() => {
  throw new Error("not implemented")
})

export const mealResponseSchema = z.custom<Meal>(() => {
  throw new Error("not implemented")
})
