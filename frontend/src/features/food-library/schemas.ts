import { z } from "zod"

const per100g = z.object({
  calories_kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
})

export const customLibraryFoodSchema = z.object({
  kind: z.literal("custom"),
  id: z.number(),
  name: z.string(),
  per_100g: per100g,
  favorite: z.boolean(),
})

export const libraryFoodSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("catalog"),
    id: z.string(),
    name: z.string(),
    per_100g: per100g,
    favorite: z.boolean(),
  }),
  customLibraryFoodSchema,
])

export const libraryResultsSchema = z.object({ results: z.array(libraryFoodSchema) })

export const recentResultsSchema = z.object({
  results: z.array(z.intersection(libraryFoodSchema, z.object({ last_grams: z.number() }))),
})
