import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiError } from "@/lib/apiClient"
import { BodyMetricForm } from "@/features/body-metrics/components/BodyMetricForm"
import { BodyMetricRow } from "@/features/body-metrics/components/BodyMetricRow"
import { useBodyMetrics, useDeleteBodyMetric } from "@/features/body-metrics/hooks"

export function BodyMetricsPage() {
  const { data: metrics, isLoading, isError, error } = useBodyMetrics()
  const deleteMetric = useDeleteBodyMetric()

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Metricas corporales</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Nuevo registro</CardTitle>
        </CardHeader>
        <CardContent>
          <BodyMetricForm />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Historial</h2>

      {isLoading && <p className="text-muted-foreground">Cargando...</p>}

      {isError && (
        <p className="text-destructive">
          Error ({error instanceof ApiError ? error.status : "?"}):{" "}
          {error.message}
        </p>
      )}

      {!isLoading && metrics?.length === 0 && (
        <p className="text-muted-foreground">
          Todavia no hay registros - cargá el primero arriba.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {metrics?.map((metric, index) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            <BodyMetricRow
              metric={metric}
              // Igual que con favoritos: solo el registro que realmente
              // se esta borrando queda deshabilitado, no toda la lista.
              isDeleting={
                deleteMetric.isPending && deleteMetric.variables === metric.id
              }
              onDelete={() => deleteMetric.mutate(metric.id)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
