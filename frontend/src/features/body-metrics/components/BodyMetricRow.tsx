import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
