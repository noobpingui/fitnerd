import { z } from "zod"

// Los 3 campos numericos vienen de <input type="number">, que SIEMPRE
// entrega un string (aunque "parezca" un numero) - por eso el schema los
// valida como string. "" (campo vacio) es un valor valido: significa que
// el usuario no cargo ese dato. La conversion a numero real pasa recien
// al armar el payload para el backend (ver BodyMetricForm.tsx), para no
// mezclar "que es un input valido" con "que forma tiene que tener el
// request" en el mismo lugar.
const optionalPositiveNumber = z
  .string()
  .refine(
    (v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) > 0),
    "Debe ser un numero mayor a 0"
  )

const optionalPercentage = z
  .string()
  .refine(
    (v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100),
    "Debe estar entre 0 y 100"
  )

export const bodyMetricSchema = z.object({
  weight: optionalPositiveNumber,
  body_fat_percentage: optionalPercentage,
  muscle_mass_percentage: optionalPercentage,
  notes: z.string().optional(),
  recorded_at: z.iso.date("Fecha invalida"),
})
export type BodyMetricFormValues = z.infer<typeof bodyMetricSchema>

// Fecha de hoy en formato "YYYY-MM-DD", en hora LOCAL - no usar
// new Date().toISOString() aca, porque esa siempre convierte a UTC
// primero, y cerca de medianoche eso puede mostrar el dia equivocado
// segun el huso horario del usuario.
export function todayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
