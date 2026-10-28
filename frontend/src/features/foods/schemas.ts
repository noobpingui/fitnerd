import { z } from "zod"

export const FOOD_QUERY_MAX_LENGTH = 100
export const EMPTY_QUERY_MESSAGE = "Escribe qué alimento quieres buscar."
export const SHORT_QUERY_MESSAGE = "La búsqueda debe tener al menos 2 caracteres."
export const LONG_QUERY_MESSAGE = "La búsqueda no puede superar los 100 caracteres."

export const foodSearchFormSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, EMPTY_QUERY_MESSAGE)
    .min(2, SHORT_QUERY_MESSAGE)
    .max(FOOD_QUERY_MAX_LENGTH, LONG_QUERY_MESSAGE),
})

export type FoodSearchFormValues = { query: string }
