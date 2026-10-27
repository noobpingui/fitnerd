import type { ReactElement } from "react"
import { DELETE_MEAL_FAILED_MESSAGE } from "../errors"
import { useDeleteMeal } from "../hooks"
import { ConfirmDialog } from "./ConfirmDialog"

export function DeleteMealDialog({
  mealId,
  label,
  itemCount,
  date,
  onClose,
}: {
  mealId: number
  label: string
  itemCount: number
  date: string
  onClose: () => void
}): ReactElement {
  const remove = useDeleteMeal(date)

  function handleConfirm() {
    remove.mutate(mealId, { onSuccess: onClose })
  }

  return (
    <ConfirmDialog
      title={`¿Borrar ${label}?`}
      description={
        itemCount === 1
          ? `Se quitará el alimento de ${label}. No se puede deshacer.`
          : `Se quitarán los ${itemCount} alimentos de ${label}. No se puede deshacer.`
      }
      confirmLabel="Borrar"
      cancelLabel="Cancelar"
      destructive
      isPending={remove.isPending}
      error={remove.isError ? DELETE_MEAL_FAILED_MESSAGE : null}
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  )
}
