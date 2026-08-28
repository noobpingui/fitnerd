import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiError } from "@/lib/apiClient"
import { BodyMetricForm } from "@/features/body-metrics/components/BodyMetricForm"
import { BodyMetricRow } from "@/features/body-metrics/components/BodyMetricRow"
import { MetricLineChart } from "@/features/body-metrics/components/MetricLineChart"
import { ProgressAnalysis } from "@/features/body-metrics/components/ProgressAnalysis"
import { buildMetricSeries } from "@/features/body-metrics/chartData"
import { useBodyMetrics, useDeleteBodyMetric } from "@/features/body-metrics/hooks"

export function BodyMetricsPage() {
  const { data: metrics, isLoading, isError, error } = useBodyMetrics()
  const deleteMetric = useDeleteBodyMetric()

  return (
    // max-w-4xl (en vez del max-w-2xl que usan Categorias/Favoritos): esta
    // pagina ahora tiene una grilla de 3 charts lado a lado, que quedaria
    // apretada en un contenedor mas angosto.
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-bold">Métricas corporales</h1>
      <p className="mb-6 text-muted-foreground">
        Registra tu peso y composición corporal para seguir tu progreso en el
        tiempo.
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Nuevo registro</CardTitle>
        </CardHeader>
        <CardContent>
          <BodyMetricForm />
        </CardContent>
      </Card>

      {!isLoading && !isError && metrics && metrics.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">
            Progreso (últimos 12 meses)
          </h2>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Peso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricLineChart
                  title="Peso"
                  unit="kg"
                  data={buildMetricSeries(metrics, "weight")}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  % Grasa corporal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricLineChart
                  title="% Grasa corporal"
                  unit="%"
                  data={buildMetricSeries(metrics, "body_fat_percentage")}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  % Masa muscular
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricLineChart
                  title="% Masa muscular"
                  unit="%"
                  data={buildMetricSeries(metrics, "muscle_mass_percentage")}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Fuera del if de arriba a proposito: el boton tiene que estar
          visible siempre, incluso sin ningun registro - ahi el backend
          responde con un mensaje aclarando que no hay datos, en vez de
          esconder la funcionalidad. */}
      <ProgressAnalysis />

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
          Todavía no hay registros - carga el primero arriba.
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
