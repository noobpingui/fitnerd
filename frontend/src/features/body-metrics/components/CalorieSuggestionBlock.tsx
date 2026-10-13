import { Card, CardContent } from "@/components/ui/card"
import type { CalorieSuggestion } from "@/features/body-metrics/types"

const kcal = new Intl.NumberFormat("es-ES")

// El signo se pone a mano (ASCII) para que "+450" y "-450" sean iguales en
// todos los navegadores.
function signedKcal(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${kcal.format(Math.abs(value))}`
}

export function CalorieSuggestionBlock({
  suggestion,
}: {
  suggestion: CalorieSuggestion
}) {
  const { kind, target_kcal, suggested_kcal, adjustment_kcal, floor_kcal } =
    suggestion

  return (
    <Card className="mt-3">
      <CardContent className="flex flex-col gap-1 text-sm">
        <h3 className="font-semibold">Ajuste de calorías sugerido</h3>

        {(kind === "adjust" || kind === "floor_limited") && (
          <>
            <p className="text-lg font-semibold tabular-nums">
              {`${kcal.format(target_kcal)} kcal → ${kcal.format(suggested_kcal)} kcal al día`}
            </p>
            <p className="text-muted-foreground">
              {`(${signedKcal(adjustment_kcal)} kcal)`}
            </p>
          </>
        )}
        {kind === "floor_limited" && (
          <p>{`No se sugiere bajar de ${kcal.format(floor_kcal)} kcal.`}</p>
        )}
        {kind === "at_floor" && (
          <p>
            {`Tu objetivo ya está en el mínimo recomendado de ${kcal.format(floor_kcal)} kcal, así que no se sugiere bajarlo.`}
          </p>
        )}
        {kind === "on_track" && (
          <p>{`Tu ritmo encaja con tu meta: mantén ${kcal.format(target_kcal)} kcal al día.`}</p>
        )}

        <p className="text-xs text-muted-foreground">
          Es una estimación basada en tu ritmo de las últimas 4 semanas y supone
          que sigues tu objetivo diario actual.
        </p>
      </CardContent>
    </Card>
  )
}
