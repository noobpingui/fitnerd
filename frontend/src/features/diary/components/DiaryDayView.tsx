import type { ReactElement } from "react"
import { MEAL_SECTIONS } from "../constants"
import { useRemovalUndo } from "../hooks"
import type { Diary, MealType, NutrientTotals } from "../types"
import { DailyTotals } from "./DailyTotals"
import { MealSection } from "./MealSection"

// Se monta con `key={date}`: al cambiar de día se reinician el aviso de «Deshacer»,
// los diálogos y los errores.
export function DiaryDayView({
  date,
  isToday,
  diary,
  targets,
  onDialogOpenChange,
}: {
  date: string
  isToday: boolean
  diary: Diary
  targets: NutrientTotals
  onDialogOpenChange: (type: MealType, open: boolean) => void
}): ReactElement {
  const undo = useRemovalUndo(date)

  return (
    <>
      <DailyTotals totals={diary.totals} incomplete={diary.incomplete} targets={targets} />

      {diary.meals.length === 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {isToday ? "Todavía no has registrado nada hoy." : "No hay nada registrado este día."}
        </p>
      )}

      {MEAL_SECTIONS.map((section) => (
        <MealSection
          key={section.type}
          type={section.type}
          label={section.label}
          meal={diary.meals.find((meal) => meal.meal_type === section.type) ?? null}
          date={date}
          undo={undo}
          onDialogOpenChange={(open) => onDialogOpenChange(section.type, open)}
        />
      ))}
    </>
  )
}
