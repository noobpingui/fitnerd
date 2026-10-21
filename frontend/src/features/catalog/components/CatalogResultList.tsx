import type { ReactElement } from "react"
import type { CatalogFood } from "../types"

export function CatalogResultList(_props: {
  foods: CatalogFood[]
  onSelect: (food: CatalogFood) => void
}): ReactElement {
  throw new Error("not implemented")
}
