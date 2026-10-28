import type { CustomFoodUpdatePayload, CustomLibraryFood } from "@/features/food-library/types"
import type { CustomFoodEditValues } from "./schemas"

// Valores del formulario a partir del alimento (números con coma decimal, como gramsText).
export function customFoodEditDefaults(_food: CustomLibraryFood): CustomFoodEditValues {
  throw new Error("not implemented")
}

// Cuerpo del PATCH: nombre sin los espacios de los extremos y los cuatro números (solo con valores válidos).
export function customFoodEditPayload(_values: CustomFoodEditValues): CustomFoodUpdatePayload {
  throw new Error("not implemented")
}

// REQ-008: true si el nombre recortado es idéntico y los cuatro campos son el mismo número; un campo no válido es un cambio.
export function isCustomFoodEditUnchanged(
  _values: CustomFoodEditValues,
  _food: CustomLibraryFood
): boolean {
  throw new Error("not implemented")
}
