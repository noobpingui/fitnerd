import type { ReactElement } from "react"
import type { PhotoProcessor } from "../photo"
import type { MealType } from "../types"

export function MealPhotoDialog(_props: {
  mealType: MealType
  label: string
  date: string
  onClose: () => void
  onRegisterManually: () => void // cierra este diálogo y abre «Añadir a {sección}»
  photoProcessor?: PhotoProcessor // por defecto browserPhotoProcessor
}): ReactElement {
  throw new Error("not implemented")
}
