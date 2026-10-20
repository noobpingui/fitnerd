import type { ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { DATA_TYPE_LABELS, formatCalories, formatGrams } from "../format"
import type { Food } from "../types"

export function FoodResultList({
  foods,
  onSelect,
}: {
  foods: Food[]
  onSelect?: (food: Food) => void
}): ReactElement {
  return (
    <ul aria-label="Resultados" className="space-y-3">
      {foods.map((food) => (
        <li key={food.fdc_id} className="rounded-lg border p-3">
          <p className="font-medium">{food.description}</p>
          <p className="text-xs text-muted-foreground">{DATA_TYPE_LABELS[food.data_type]}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{formatCalories(food.per_100g.calories_kcal)}</span>
            <span>{formatGrams(food.per_100g.protein_g, "proteína")}</span>
            <span>{formatGrams(food.per_100g.carbs_g, "carbohidratos")}</span>
            <span>{formatGrams(food.per_100g.fat_g, "grasa")}</span>
          </div>
          {onSelect && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              aria-label={`Elegir ${food.description}`}
              onClick={() => onSelect(food)}
            >
              Elegir
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
