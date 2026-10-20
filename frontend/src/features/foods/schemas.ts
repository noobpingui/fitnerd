import { z } from "zod"

export const FOOD_QUERY_MAX_LENGTH = 100
export const EMPTY_QUERY_MESSAGE = "Escribe qué alimento quieres buscar."
export const SHORT_QUERY_MESSAGE = "La búsqueda debe tener al menos 2 caracteres."
export const LONG_QUERY_MESSAGE = "La búsqueda no puede superar los 100 caracteres."

// Esquema provisional sin reglas (esqueleto)
export const foodSearchFormSchema = z.object({ query: z.string() })

export type FoodSearchFormValues = { query: string }

// Esquema provisional (esqueleto)
export const foodSearchResponseSchema = z.object({ results: z.array(z.unknown()) })
