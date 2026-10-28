import type { ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { formatKcal, formatLoggedGrams, sourceLabel } from "../format"
import type { MealItem } from "../types"

export function MealItemRow({
  item,
  onEdit,
  onRemove,
  isRemoving,
}: {
  item: MealItem
  onEdit: () => void
  onRemove: () => void
  isRemoving: boolean
}): ReactElement {
  const origin = sourceLabel(item)
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.name}</p>
        <p className="flex gap-2 text-xs text-muted-foreground">
          {origin !== null && <span>{origin}</span>}
          <span>{formatLoggedGrams(item.grams)}</span>
          <span>{formatKcal(item.nutrients.calories_kcal)}</span>
        </p>
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Editar gramos de ${item.name}`}
          onClick={onEdit}
        >
          Editar gramos
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Quitar ${item.name}`}
          disabled={isRemoving}
          onClick={onRemove}
        >
          Quitar
        </Button>
      </div>
    </li>
  )
}
