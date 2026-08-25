import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { BodyMetric } from "@/features/body-metrics/types"

// new Date("YYYY-MM-DD") lo interpreta como medianoche UTC - en un huso
// horario negativo (como Costa Rica, UTC-6) eso puede mostrar el dia
// ANTERIOR al formatear. Partimos el string a mano y construimos la fecha
// en hora LOCAL para evitar ese corrimiento.
function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function BodyMetricRow({
  metric,
  onDelete,
  isDeleting,
}: {
  metric: BodyMetric
  onDelete: () => void
  isDeleting: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">
            {formatDate(metric.recorded_at)}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {metric.weight !== null && (
              <span>
                <span className="font-semibold">{metric.weight}</span> kg
              </span>
            )}
            {metric.body_fat_percentage !== null && (
              <span>
                <span className="font-semibold">
                  {metric.body_fat_percentage}
                </span>
                % grasa
              </span>
            )}
            {metric.muscle_mass_percentage !== null && (
              <span>
                <span className="font-semibold">
                  {metric.muscle_mass_percentage}
                </span>
                % masa muscular
              </span>
            )}
          </div>

          {metric.notes && (
            <p className="text-sm text-muted-foreground">{metric.notes}</p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          disabled={isDeleting}
          onClick={onDelete}
          aria-label="Eliminar registro"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardContent>
    </Card>
  )
}
