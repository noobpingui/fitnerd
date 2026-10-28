import { useState, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { LibraryFood } from "@/features/food-library/types"
import { saveErrorMessage } from "../errors"
import { useAddMealItems } from "../hooks"
import type { CatalogItemPayload, CustomItemPayload, LibraryItemPayload, MealType } from "../types"
import { CustomFoodForm } from "./CustomFoodForm"
import { FoodSearchPanel } from "./FoodSearchPanel"
import { PortionForm } from "./PortionForm"

type Step = "search" | "portion" | "custom"
type Chosen = { food: LibraryFood; grams: string }

export function AddFoodDialog({
  mealType,
  label,
  date,
  onClose,
}: {
  mealType: MealType
  label: string
  date: string
  onClose: () => void
}): ReactElement {
  const [step, setStep] = useState<Step>("search")
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [customName, setCustomName] = useState("")
  // La última consulta se guarda aquí para que «Volver a la búsqueda» la recupere.
  const [lastQuery, setLastQuery] = useState("")
  const add = useAddMealItems(date)

  function goTo(next: Step) {
    add.reset()
    setStep(next)
  }

  function choose(food: LibraryFood, grams: string) {
    setChosen({ food, grams })
    goTo("portion")
  }

  function createCustom(name: string) {
    setCustomName(name)
    goTo("custom")
  }

  async function save(item: CatalogItemPayload | CustomItemPayload | LibraryItemPayload) {
    if (add.isPending) return
    try {
      await add.mutateAsync({ date, meal_type: mealType, items: [item] })
    } catch {
      return
    }
    onClose()
  }

  const cancelButton = (
    <Button type="button" variant="ghost" disabled={add.isPending} onClick={onClose}>
      Cancelar
    </Button>
  )
  const backButton = (
    <Button
      type="button"
      variant="outline"
      disabled={add.isPending}
      onClick={() => goTo("search")}
    >
      Volver a la búsqueda
    </Button>
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !add.isPending) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`Añadir a ${label}`}</DialogTitle>
          <DialogDescription>Busca un alimento o crea uno propio.</DialogDescription>
        </DialogHeader>

        {add.isError && (
          <p role="alert" className="text-sm text-destructive">
            {saveErrorMessage(add.error)}
          </p>
        )}

        {step === "search" && (
          <FoodSearchPanel
            initialQuery={lastQuery}
            onQueryChange={setLastQuery}
            onSelect={choose}
            onCreateCustom={createCustom}
            actions={cancelButton}
          />
        )}

        {step === "portion" && chosen && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{chosen.food.name}</p>
              {chosen.food.kind === "custom" && (
                <span className="text-sm text-muted-foreground">Personalizado</span>
              )}
            </div>
            <PortionForm
              key={`${chosen.food.kind}:${chosen.food.id}`}
              per100g={chosen.food.per_100g}
              defaultGrams={chosen.grams}
              submitLabel="Añadir"
              isSaving={add.isPending}
              onSubmit={(grams) =>
                save(
                  chosen.food.kind === "custom"
                    ? { custom_food_id: chosen.food.id, grams }
                    : { catalog_id: chosen.food.id, grams }
                )
              }
            >
              {backButton}
              {cancelButton}
            </PortionForm>
          </div>
        )}

        {step === "custom" && (
          <CustomFoodForm defaultName={customName} isSaving={add.isPending} onSubmit={save}>
            {backButton}
            {cancelButton}
          </CustomFoodForm>
        )}
      </DialogContent>
    </Dialog>
  )
}
