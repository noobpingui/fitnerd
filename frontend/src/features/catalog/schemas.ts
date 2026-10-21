import { z } from "zod"

export const catalogSearchResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      per_100g: z.object({
        calories_kcal: z.number(),
        protein_g: z.number(),
        carbs_g: z.number(),
        fat_g: z.number(),
      }),
    })
  ),
})
