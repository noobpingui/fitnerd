import { useId, useState, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  MEAL_SECTIONS,
  PORTION_ADD_FOOD_DESCRIPTION,
  PORTION_ADD_FOOD_TITLE,
  PORTION_MEAL_REQUIRED_MESSAGE,
} from "../constants"
import { saveErrorMessage } from "../errors"
import { useAddMealItems } from "../hooks"
import { portionFoodFormDefaults } from "../portionChat"
import type { CustomItemPayload, MealType, PortionEstimateAnswer } from "../types"
import { CustomFoodForm } from "./CustomFoodForm"

export function PortionAddFoodDialog({
  answer,
  date,
  onClose,
}: {
  answer: PortionEstimateAnswer
  date: string
  onClose: () => void
}): ReactElement {
  const legendId = useId()
  const [mealType, setMealType] = useState<MealType | null>(null)
  const [mealError, setMealError] = useState(false)
  const add = useAddMealItems(date)
  const defaults = portionFoodFormDefaults(answer)

  function checkMeal(): boolean {
    if (mealType === null) {
      setMealError(true)
      return false
    }
    return true
  }

  async function save(item: CustomItemPayload) {
    if (add.isPending || mealType === null) return
    try {
      await add.mutateAsync({ date, meal_type: mealType, items: [item] })
    } catch {
      return
    }
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !add.isPending) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{PORTION_ADD_FOOD_TITLE}</DialogTitle>
          <DialogDescription>{PORTION_ADD_FOOD_DESCRIPTION}</DialogDescription>
        </DialogHeader>

        {add.isError && (
          <p role="alert" className="text-sm text-destructive">
            {saveErrorMessage(add.error)}
          </p>
        )}

        <fieldset
          role="radiogroup"
          aria-labelledby={legendId}
          aria-invalid={mealError || undefined}
          className="space-y-1"
        >
          <legend id={legendId} className="text-sm font-medium">
            Comida
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {MEAL_SECTIONS.map((section) => (
              <label key={section.type} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="portion-meal"
                  value={section.type}
                  checked={mealType === section.type}
                  onChange={() => {
                    setMealType(section.type)
                    setMealError(false)
                  }}
                />
                {section.label}
              </label>
            ))}
          </div>
          {mealError && (
            <p role="alert" className="text-sm text-destructive">
              {PORTION_MEAL_REQUIRED_MESSAGE}
            </p>
          )}
        </fieldset>

        <CustomFoodForm
          defaultName={defaults.name}
          defaultGrams={defaults.grams}
          defaultNutrients={{
            calories: defaults.calories,
            protein: defaults.protein,
            carbs: defaults.carbs,
            fat: defaults.fat,
          }}
          submitLabel="Añadir"
          isSaving={add.isPending}
          onSubmitAttempt={checkMeal}
          onSubmit={save}
        >
          <Button type="button" variant="ghost" disabled={add.isPending} onClick={onClose}>
            Cancelar
          </Button>
        </CustomFoodForm>
      </DialogContent>
    </Dialog>
  )
}
