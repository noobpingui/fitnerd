import type { ReactElement } from "react"
import type { LibraryFood } from "@/features/food-library/types"

export function LibraryFoodList(_props: {
  label: string
  foods: LibraryFood[]
  onSelect: (food: LibraryFood) => void
  onToggleFavorite: (food: LibraryFood) => void
  onDelete: (food: LibraryFood) => void
  disabled?: boolean
}): ReactElement {
  throw new Error("not implemented")
}
