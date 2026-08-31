import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BodyMetric } from "@/features/body-metrics/types"
import { formatDate } from "@/features/body-metrics/dateUtils"

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
    // Mismo lenguaje visual que los items de Rutina Semanal (ver
    // DayColumn.tsx): rounded-md border bg-card + px-2 py-1.5 text-xs, en
    // vez del Card completo (con su padding grande de CardContent) que
    // tenia antes. Sigue siendo una fila por registro, apilados hacia
    // abajo - solo cambia el tamano/densidad de cada fila.
    <div className="flex items-start justify-between gap-2 rounded-md border bg-card px-2 py-1.5 text-xs">
      <div className="space-y-1">
        <p className="font-medium text-muted-foreground">
          {formatDate(metric.recorded_at)}
        </p>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
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
          <p className="text-muted-foreground">{metric.notes}</p>
        )}
      </div>

      {/* icon-xs (size-6, svg size-3): el "icon" default (size-9) se veia
          desproporcionado contra una fila este tan compacta. */}
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={isDeleting}
        onClick={onDelete}
        aria-label="Eliminar registro"
        className="shrink-0"
      >
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  )
}
