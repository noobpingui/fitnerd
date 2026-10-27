import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/features/profile/hooks"
import { answersFromProfile } from "@/features/profile/mappers"
import { calculateMacros } from "@/features/macros/calculations"
import { DiaryDateNav } from "../components/DiaryDateNav"
import { DiaryDayView } from "../components/DiaryDayView"
import { resolveDiaryDate } from "../days"
import { formatDiaryDate } from "../format"
import { useDiary, useToday } from "../hooks"
import type { MealType, NutrientTotals } from "../types"

export function DiaryPage(): ReactElement {
  // Con un diálogo abierto, «hoy» no avanza: el día y el diálogo no cambian (AC-005.4).
  const [openDialogs, setOpenDialogs] = useState<ReadonlySet<MealType>>(new Set())
  const today = useToday(openDialogs.size > 0)
  const [searchParams, setSearchParams] = useSearchParams()
  const { date, normalize } = resolveDiaryDate(searchParams.get("date"), today)
  const diary = useDiary(date)
  const profile = useProfile()

  // Un parámetro inválido, fuera del intervalo o igual a hoy deja la dirección en /diary.
  useEffect(() => {
    if (normalize) setSearchParams({}, { replace: true })
  }, [normalize, setSearchParams])

  function goTo(next: string) {
    setSearchParams(next === today ? {} : { date: next }, { replace: true })
  }

  const handleDialogOpenChange = useCallback((type: MealType, open: boolean) => {
    setOpenDialogs((current) => {
      if (current.has(type) === open) return current
      const next = new Set(current)
      if (open) next.add(type)
      else next.delete(type)
      return next
    })
  }, [])

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
      <h1 className="mb-1 text-2xl font-semibold">Diario</h1>
      <p className="mb-2 text-muted-foreground">{formatDiaryDate(date, today)}</p>
      <DiaryDateNav date={date} today={today} onChange={goTo} />

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
        <DiaryDayView
          key={date}
          date={date}
          isToday={date === today}
          diary={diary.data}
          targets={targets}
          onDialogOpenChange={handleDialogOpenChange}
        />
      )}
    </div>
  )
}
