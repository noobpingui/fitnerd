import type { ReactElement } from "react"
import type { MealType } from "../types"

export function AddFoodDialog(_props: {
  mealType: MealType
  label: string
  date: string
  onClose: () => void
}): ReactElement {
  throw new Error("not implemented")
}
