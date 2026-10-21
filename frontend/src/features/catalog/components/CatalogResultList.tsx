import type { ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { formatCalories, formatGrams } from "@/features/foods/format"
import type { CatalogFood } from "../types"

export function CatalogResultList({
  foods,
  onSelect,
}: {
  foods: CatalogFood[]
  onSelect: (food: CatalogFood) => void
}): ReactElement {
  return (
    <ul aria-label="Resultados" className="space-y-3">
      {foods.map((food) => (
        <li key={food.id} className="rounded-lg border p-3">
          <p className="font-medium">{food.name}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{formatCalories(food.per_100g.calories_kcal)}</span>
            <span>{formatGrams(food.per_100g.protein_g, "proteína")}</span>
            <span>{formatGrams(food.per_100g.carbs_g, "carbohidratos")}</span>
            <span>{formatGrams(food.per_100g.fat_g, "grasa")}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            aria-label={`Elegir ${food.name}`}
            onClick={() => onSelect(food)}
          >
            Elegir
          </Button>
        </li>
      ))}
    </ul>
  )
}
