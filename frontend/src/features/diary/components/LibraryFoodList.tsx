import type { ReactElement, ReactNode } from "react"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCalories, formatGrams } from "@/features/foods/format"
import type { LibraryFood } from "@/features/food-library/types"

// Lista de alimentos de la biblioteca (resultados, favoritos o recientes).
export function LibraryFoodList({
  label,
  foods,
  onSelect,
  onToggleFavorite,
  onDelete,
  disabled = false,
}: {
  label: string
  foods: LibraryFood[]
  onSelect: (food: LibraryFood) => void
  onToggleFavorite: (food: LibraryFood) => void
  onDelete: (food: LibraryFood) => void
  renderInline?: (food: LibraryFood) => ReactNode
  disabled?: boolean
}): ReactElement {
  return (
    <ul aria-label={label} className="space-y-3">
      {foods.map((food) => (
        <li key={`${food.kind}:${food.id}`} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{food.name}</p>
            {food.kind === "custom" && (
              <span className="text-sm text-muted-foreground">Personalizado</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{formatCalories(food.per_100g.calories_kcal)}</span>
            <span>{formatGrams(food.per_100g.protein_g, "proteína")}</span>
            <span>{formatGrams(food.per_100g.carbs_g, "carbohidratos")}</span>
            <span>{formatGrams(food.per_100g.fat_g, "grasa")}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Elegir ${food.name}`}
              onClick={() => onSelect(food)}
            >
              Elegir
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={food.favorite}
              aria-label={
                food.favorite
                  ? `Quitar ${food.name} de favoritos`
                  : `Añadir ${food.name} a favoritos`
              }
              disabled={disabled}
              onClick={() => onToggleFavorite(food)}
            >
              <Star aria-hidden="true" className={food.favorite ? "fill-current" : undefined} />
            </Button>
            {food.kind === "custom" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Borrar ${food.name} de tus alimentos`}
                disabled={disabled}
                onClick={() => onDelete(food)}
              >
                Borrar
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
