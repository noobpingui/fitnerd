import type { ReactElement } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { NUTRIENT_LABELS } from "../constants"
import { formatNutrientGrams } from "../format"
import { nutrientProgress } from "../nutrition"
import type { NutrientKey, NutrientTotals } from "../types"
import { NutrientProgress } from "./NutrientProgress"

const ROWS: { key: NutrientKey; unit: "kcal" | "g" }[] = [
  { key: "calories_kcal", unit: "kcal" },
  { key: "protein_g", unit: "g" },
  { key: "carbs_g", unit: "g" },
  { key: "fat_g", unit: "g" },
]

const intFormat = new Intl.NumberFormat("es-ES")
const INCOMPLETE_NOTICE = "Algún alimento no tiene este dato: el total puede ser mayor."

export function DailyTotals({
  totals,
  incomplete,
  targets,
}: {
  totals: NutrientTotals
  incomplete: NutrientKey[]
  targets: NutrientTotals
}): ReactElement {
  return (
    <Card className="mb-4">
      <CardContent className="space-y-4">
        {ROWS.map(({ key, unit }) => {
          const isKcal = unit === "kcal"
          const view = nutrientProgress(totals[key], targets[key], isKcal ? 0 : 1)
          const amount = (value: number) =>
            isKcal ? intFormat.format(value) : formatNutrientGrams(value)
          const gap = `${amount(Math.abs(view.remaining))} ${unit}`
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{NUTRIENT_LABELS[key]}</span>
                <span className="tabular-nums">
                  {`${amount(view.consumed)} / ${intFormat.format(targets[key])} ${unit}`}
                </span>
              </div>
              <NutrientProgress label={NUTRIENT_LABELS[key]} percent={view.percent} />
              <p className="text-sm text-muted-foreground">
                {view.over ? `${gap} por encima del objetivo` : `Quedan ${gap}`}
              </p>
              {incomplete.includes(key) && (
                <p className="text-xs text-muted-foreground">{INCOMPLETE_NOTICE}</p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
