import type { ReactElement } from "react"
import type { CustomFoodUpdatePayload, CustomLibraryFood } from "@/features/food-library/types"

export function CustomFoodEditForm(_props: {
  food: CustomLibraryFood
  isSaving: boolean
  serverError: string | null
  nameTakenKey: string | null
  onSubmit: (payload: CustomFoodUpdatePayload) => void
  onCancel: () => void
}): ReactElement {
  throw new Error("not implemented")
}
