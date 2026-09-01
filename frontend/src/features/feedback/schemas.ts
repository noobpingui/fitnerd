import { z } from "zod"

// Mismas 3 categorias que valida FeedbackService en el backend - si se
// agrega o renombra una categoria, hay que actualizar los dos lugares
// (no hay una fuente unica compartida entre frontend y backend en este
// proyecto).
export const feedbackCategories = ["general", "suggestion", "bug"] as const

export const feedbackSchema = z.object({
  category: z.enum(feedbackCategories, "Elige una categoría"),
  message: z
    .string()
    .trim()
    .min(1, "El mensaje no puede estar vacío")
    .max(2000, "El mensaje no puede superar los 2000 caracteres"),
})
export type FeedbackFormValues = z.infer<typeof feedbackSchema>
