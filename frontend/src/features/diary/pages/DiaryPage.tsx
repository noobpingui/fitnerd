import { useMemo, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/features/profile/hooks"
import { answersFromProfile } from "@/features/profile/mappers"
import { calculateMacros } from "@/features/macros/calculations"
import { todayIsoDate } from "@/lib/dates"
import { DailyTotals } from "../components/DailyTotals"
import { MealSection } from "../components/MealSection"
import { MEAL_SECTIONS } from "../constants"
import { formatDiaryDate } from "../format"
import { useDiary } from "../hooks"
import type { NutrientTotals } from "../types"

export function DiaryPage(): ReactElement {
  const date = useMemo(() => todayIsoDate(), [])
  const diary = useDiary(date)
  const profile = useProfile()

  // Los objetivos son los mismos que muestra Macros para el mismo perfil.
  const targets = useMemo<NutrientTotals | null>(() => {
    if (!profile.data) return null
    const summary = calculateMacros(answersFromProfile(profile.data))
    const grams = (key: "protein" | "carbs" | "fat") =>
      summary.macros.find((macro) => macro.key === key)?.grams ?? 0
    return {
      calories_kcal: summary.targetKcal,
      protein_g: grams("protein"),
      carbs_g: grams("carbs"),
      fat_g: grams("fat"),
    }
  }, [profile.data])

  const isError = diary.isError || profile.isError
  const isLoading = !isError && (diary.isPending || profile.isPending)

  function retry() {
    if (diary.isError) void diary.refetch()
    if (profile.isError) void profile.refetch()
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      {(isLoading || isError) && (
        <div role="status" aria-live="polite" className="my-4 text-sm text-muted-foreground">
          {isLoading && "Cargando el diario…"}
          {isError && (
            <>
              <p className="text-destructive">No se pudo cargar el diario.</p>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={retry}>
                Reintentar
              </Button>
            </>
          )}
        </div>
      )}

      {diary.data && targets && (
        <>
          <h1 className="mb-1 text-2xl font-semibold">Diario</h1>
          <p className="mb-4 text-muted-foreground">{formatDiaryDate(date)}</p>

          <DailyTotals
            totals={diary.data.totals}
            incomplete={diary.data.incomplete}
            targets={targets}
          />

          {diary.data.meals.length === 0 && (
            <p className="mb-4 text-sm text-muted-foreground">
              Todavía no has registrado nada hoy.
            </p>
          )}

          {MEAL_SECTIONS.map((section) => (
            <MealSection
              key={section.type}
              type={section.type}
              label={section.label}
              meal={diary.data.meals.find((meal) => meal.meal_type === section.type) ?? null}
              date={date}
            />
          ))}
        </>
      )}
    </div>
  )
}
