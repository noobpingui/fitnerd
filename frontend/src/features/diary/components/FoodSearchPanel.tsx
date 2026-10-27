import type { ReactElement, ReactNode } from "react"
import type { LibraryFood } from "@/features/food-library/types"

export function FoodSearchPanel(_props: {
  initialQuery?: string
  onQueryChange?: (query: string) => void
  onSelect: (food: LibraryFood, defaultGrams: string) => void
  onCreateCustom: (name: string) => void
  actions?: ReactNode
  confirmContainer?: HTMLElement | null
}): ReactElement {
  throw new Error("not implemented")
}
