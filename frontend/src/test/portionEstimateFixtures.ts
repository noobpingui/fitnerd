// Respuestas de POST /api/meals/portion-estimate (spec 030) para los tests de la 031.
// Las tres constantes son respuestas crudas del contrato, con todas las claves;
// `makePortionEstimate` devuelve ya el tipo parseado que da `estimatePortion`.
import type { PortionEstimate } from "@/features/diary/types"

export const EGGS_ESTIMATE = {
  status: "estimated",
  grams: 250,
  unit: "5 huevos grandes",
  note: "Unos 50 g por huevo sin cáscara.",
  message: null,
} as const

// Respuesta cruda completa de la spec 032 (AC-001.1): con nombre y valores por 100 g.
export const EGGS_ESTIMATE_WITH_PER_100G = {
  status: "estimated",
  grams: 250,
  unit: "5 huevos grandes",
  note: "Unos 50 g por huevo sin cáscara.",
  message: null,
  name: "Huevo",
  per_100g: { calories_kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 },
} as const

// Estimación ya parseada con nombre y valores por 100 g (los de AC-001.1).
export function makeEggsWithPer100g(overrides: Partial<PortionEstimate> = {}): PortionEstimate {
  return makePortionEstimate({
    name: "Huevo",
    per_100g: { calories_kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 },
    ...overrides,
  } as Partial<PortionEstimate>)
}

export const NOT_FOOD_RESPONSE = {
  status: "not_food",
  grams: null,
  unit: null,
  note: null,
  message: "Solo puedo ayudarte a estimar cuántos gramos pesa un alimento.",
} as const

export const UNKNOWN_RESPONSE = {
  status: "unknown",
  grams: null,
  unit: null,
  note: null,
  message: "No he podido estimar el peso. Prueba a describir el alimento de otra forma.",
} as const

export function makePortionEstimate(overrides: Partial<PortionEstimate> = {}): PortionEstimate {
  return {
    status: "estimated",
    grams: 250,
    unit: "5 huevos grandes",
    note: "Unos 50 g por huevo sin cáscara.",
    ...overrides,
  } as PortionEstimate
}
