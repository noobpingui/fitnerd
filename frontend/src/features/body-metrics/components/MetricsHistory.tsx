import { useMemo, useState } from "react"
import { CircleAlert, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeleteMetricDialog } from "@/features/body-metrics/components/DeleteMetricDialog"
import { MetricEditForm } from "@/features/body-metrics/components/MetricEditForm"
import { formatDate } from "@/features/body-metrics/dateUtils"
import type { BodyMetric } from "@/features/body-metrics/types"
import type { WeightUnit } from "@/features/onboarding/types"

const PAGE_SIZE = 10
const one = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 })

type MetricsHistoryProps = {
  metrics: BodyMetric[]
  weightUnit: WeightUnit
  toDisplayWeight: (kg: number) => number
  suspiciousDate?: string | null
}

export function MetricsHistory({
  metrics,
  weightUnit,
  toDisplayWeight,
  suspiciousDate = null,
}: MetricsHistoryProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<BodyMetric | null>(null)
  // Lista con la que falló el último borrado: si la lista cambia, el aviso deja de verse.
  const [failedFor, setFailedFor] = useState<BodyMetric[] | null>(null)

  const sorted = useMemo(
    () =>
      [...metrics].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)),
    [metrics]
  )
  const visible = sorted.slice(0, visibleCount)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Peso</th>
              <th className="py-2 pr-3 font-medium">% Grasa</th>
              <th className="py-2 pr-3 font-medium">% Músculo</th>
              <th className="py-2">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((metric) => {
              const date = formatDate(metric.recorded_at)
              if (metric.id === editingId) {
                return (
                  <tr key={metric.id} className="border-b">
                    <td colSpan={5}>
                      <MetricEditForm
                        metric={metric}
                        weightUnit={weightUnit}
                        onDone={() => setEditingId(null)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={metric.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">{date}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {metric.weight === null
                      ? "—"
                      : `${one.format(toDisplayWeight(metric.weight))} ${weightUnit}`}
                    {metric.weight !== null &&
                      metric.recorded_at === suspiciousDate && (
                        <span
                          data-tone="warn"
                          className="ml-2 inline-flex items-center gap-1 text-xs text-amber-500"
                        >
                          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                          Revisa este peso
                        </span>
                      )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {metric.body_fat_percentage === null
                      ? "—"
                      : `${one.format(metric.body_fat_percentage)} %`}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {metric.muscle_mass_percentage === null
                      ? "—"
                      : `${one.format(metric.muscle_mass_percentage)} %`}
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Corregir medición del ${date}`}
                        onClick={() => {
                          setFailedFor(null)
                          setEditingId(metric.id)
                        }}
                      >
                        <Pencil aria-hidden className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Borrar medición del ${date}`}
                        onClick={() => {
                          setFailedFor(null)
                          setDeleting(metric)
                        }}
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {visibleCount < sorted.length && (
        <Button
          type="button"
          variant="outline"
          className="self-center"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          Mostrar más
        </Button>
      )}

      {failedFor !== null && failedFor === metrics && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo borrar la medición. Inténtalo de nuevo.
        </p>
      )}

      {deleting && (
        <DeleteMetricDialog
          metric={deleting}
          onClose={() => setDeleting(null)}
          onFailed={() => {
            setDeleting(null)
            setFailedFor(metrics)
          }}
        />
      )}
    </div>
  )
}
