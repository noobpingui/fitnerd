import type { ReactElement } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { saveErrorMessage } from "../errors"
import { useUpdateMealItemGrams } from "../hooks"
import type { MealItem } from "../types"
import { PortionForm } from "./PortionForm"

export function EditGramsDialog({
  mealId,
  item,
  date,
  onClose,
}: {
  mealId: number
  item: MealItem
  date: string
  onClose: () => void
}): ReactElement {
  const update = useUpdateMealItemGrams(date)

  async function save(grams: number) {
    if (update.isPending) return
    try {
      await update.mutateAsync({ mealId, itemId: item.id, grams })
    } catch {
      return
    }
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !update.isPending) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Editar gramos</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>

        {update.isError && (
          <p role="alert" className="text-sm text-destructive">
            {saveErrorMessage(update.error)}
          </p>
        )}

        <PortionForm
          per100g={item.per_100g}
          defaultGrams={String(item.grams).replace(".", ",")}
          submitLabel="Guardar"
          isSaving={update.isPending}
          onSubmit={save}
        >
          <Button type="button" variant="ghost" disabled={update.isPending} onClick={onClose}>
            Cancelar
          </Button>
        </PortionForm>
      </DialogContent>
    </Dialog>
  )
}
