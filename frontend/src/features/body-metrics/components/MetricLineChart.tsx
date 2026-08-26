import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { MetricChartPoint } from "@/features/body-metrics/chartData"
import { formatDate, formatShortDate } from "@/features/body-metrics/dateUtils"

export function MetricLineChart({
  title,
  unit,
  data,
}: {
  title: string
  unit: string
  data: MetricChartPoint[]
}) {
  // ChartConfig es lo que le dice al ChartContainer que color usar para
  // la serie "value" (queda disponible como la variable CSS
  // --color-value, referenciada abajo en el stroke de <Line>). Usamos
  // --primary (el mismo tono que ya usamos en los hover de las Cards) en
  // vez de --chart-1..5 porque esos vienen en escala de grises en este
  // tema - no aportan mas contraste y cada chart aca solo tiene una linea.
  const config = {
    value: { label: title, color: "var(--primary)" },
  } satisfies ChartConfig

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Sin datos de {title.toLowerCase()} en los ultimos 12 meses.
      </div>
    )
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-48 w-full">
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={formatShortDate}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          domain={["auto", "auto"]}
          tickFormatter={(value: number) => `${value}${unit}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => formatDate(payload[0]?.payload.date)}
            />
          }
        />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-value)" }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  )
}
