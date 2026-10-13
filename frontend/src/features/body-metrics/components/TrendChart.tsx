import { useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { UnitToggle } from "@/features/onboarding/components/UnitToggle"
import {
  formatDate,
  formatShortDate,
  periodStart,
  todayIsoDate,
} from "@/features/body-metrics/dateUtils"
import {
  trendChartData,
  type NumericField,
} from "@/features/body-metrics/insights"
import type { BodyMetric } from "@/features/body-metrics/types"

type Range = "1" | "3" | "12"

const FIELDS: { value: NumericField; label: string }[] = [
  { value: "weight", label: "Peso" },
  { value: "body_fat_percentage", label: "% Grasa" },
  { value: "muscle_mass_percentage", label: "% Músculo" },
]

const RANGES: { value: Range; label: string }[] = [
  { value: "1", label: "1M" },
  { value: "3", label: "3M" },
  { value: "12", label: "1A" },
]

// Un solo gráfico con selector de métrica y de rango, en lugar de tres
// gráficos pequeños: se lee mejor y deja sitio a la línea de tendencia.
export function TrendChart({
  metrics,
  weightUnit,
  toDisplayWeight,
}: {
  metrics: BodyMetric[]
  weightUnit: string
  toDisplayWeight: (kg: number) => number
}) {
  const [field, setField] = useState<NumericField>("weight")
  const [range, setRange] = useState<Range>("3")

  const isWeight = field === "weight"
  const unit = isWeight ? ` ${weightUnit}` : "%"
  const label = FIELDS.find((f) => f.value === field)!.label

  // La tendencia solo tiene sentido en el peso, que fluctúa a diario; la
  // grasa y el músculo se miden con menos frecuencia.
  const from = periodStart(todayIsoDate(), Number(range))
  const data = trendChartData(metrics, field, from, toDisplayWeight)

  const config = {
    value: { label, color: "var(--muted-foreground)" },
    trend: { label: "Tendencia (7 días)", color: "var(--primary)" },
  } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UnitToggle units={FIELDS} value={field} onChange={setField} />
        <UnitToggle units={RANGES} value={range} onChange={setRange} />
      </div>

      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          Sin registros de {label.toLowerCase()} en este periodo.
        </div>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-56 w-full">
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
              width={48}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `${v}${unit}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    formatDate(payload[0]?.payload.date)
                  }
                />
              }
            />
            {/* Los registros van como puntos con una línea tenue; la
                tendencia, como línea sólida encima. Así el ojo sigue la
                tendencia y los puntos quedan como contexto. */}
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeOpacity={isWeight ? 0.35 : 1}
              strokeWidth={isWeight ? 1 : 2}
              dot={{ r: 3, fill: "var(--color-value)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            {isWeight && (
              <Line
                dataKey="trend"
                type="monotone"
                stroke="var(--color-trend)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            )}
          </LineChart>
        </ChartContainer>
      )}

      {isWeight && data.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
            Registro
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-primary" />
            Tendencia (7 días)
          </span>
        </div>
      )}
    </div>
  )
}
