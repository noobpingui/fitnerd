import { useMemo, type ReactNode } from "react"
import { Link } from "react-router"
import { motion } from "motion/react"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CircleCheck,
  CircleAlert,
  Flame,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError } from "@/lib/apiClient"
import { cn } from "@/lib/utils"
import { MetricsHistory } from "@/features/body-metrics/components/MetricsHistory"
import { ProgressAnalysis } from "@/features/body-metrics/components/ProgressAnalysis"
import { TrendChart } from "@/features/body-metrics/components/TrendChart"
import { formatDate } from "@/features/body-metrics/dateUtils"
import { todayIsoDate } from "@/lib/dates"
import { useBodyMetrics } from "@/features/body-metrics/hooks"
import { buildAnalysisRequest } from "@/features/body-metrics/analysisRequest"
import {
  buildInsights,
  formatInsights,
} from "@/features/body-metrics/insightsView"
import { useProfile } from "@/features/profile/hooks"
import { answersFromProfile } from "@/features/profile/mappers"
import { KG_PER_LB } from "@/features/onboarding/units"

function fadeIn(index: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, delay: index * 0.06 },
  }
}

export function BodyMetricsPage() {
  const { data: metrics, isLoading, isError, error } = useBodyMetrics()
  const { data: profileResponse } = useProfile()
  const profile = useMemo(
    () => (profileResponse ? answersFromProfile(profileResponse) : null),
    [profileResponse]
  )

  // El backend guarda el peso en kg; se muestra en la unidad del perfil.
  const weightUnit = profile?.weightUnit ?? "kg"
  const toDisplayWeight = (kg: number) =>
    weightUnit === "lb" ? Math.round((kg / KG_PER_LB) * 10) / 10 : kg
  const today = todayIsoDate()

  const insights = useMemo(
    () =>
      metrics && metrics.length > 0 ? buildInsights(metrics, profile, today) : null,
    [metrics, profile, today]
  )
  const view = insights ? formatInsights(insights, weightUnit) : null

  // Contexto del análisis del coach: null sin perfil (el servidor responde 409).
  const analysisRequest = useMemo(
    () =>
      metrics && metrics.length > 0 && profile && profileResponse?.profile
        ? buildAnalysisRequest(metrics, profile, today)
        : null,
    [metrics, profile, profileResponse, today]
  )

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-bold">Métricas</h1>
      <p className="mb-6 text-muted-foreground">
        Tu progreso a partir de las mediciones que registras en tu perfil.
      </p>

      {isLoading && <p className="text-muted-foreground">Cargando...</p>}

      {isError && (
        <p className="text-destructive">
          Error ({error instanceof ApiError ? error.status : "?"}):{" "}
          {error.message}
        </p>
      )}

      {!isLoading && !isError && !insights && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="font-medium">Aún no tienes mediciones</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Registra tu peso y, si lo conoces, tu composición corporal desde
              tu perfil. Aquí verás cómo evolucionan.
            </p>
            <Button asChild variant="outline">
              <Link to="/profile">Ir a mi perfil</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {insights && view && metrics && (
        <div className="flex flex-col gap-4">
          {/* Indicadores principales */}
          <motion.div {...fadeIn(0)} className="grid gap-4 sm:grid-cols-3">
            <KpiTile
              label="Peso"
              value={view.weight ?? "—"}
              delta={
                view.weightChange30d !== null
                  ? `${view.weightChange30d} en 30 días`
                  : undefined
              }
              direction={insights.weight?.delta}
            />
            <KpiTile
              label="Ritmo"
              value={view.rate ?? "—"}
              status={
                view.statusLabel !== null && view.tone !== null
                  ? { label: view.statusLabel, tone: view.tone }
                  : undefined
              }
            />
            <KpiTile
              label="% Grasa"
              value={view.bodyFat ?? "—"}
              delta={
                view.bodyFatChange30d !== null
                  ? `${view.bodyFatChange30d} en 30 días`
                  : undefined
              }
              direction={insights.fat?.delta}
            />
          </motion.div>

          <motion.div {...fadeIn(1)}>
            <Section title="Evolución">
              <TrendChart
                metrics={metrics}
                weightUnit={weightUnit}
                toDisplayWeight={toDisplayWeight}
              />
            </Section>
          </motion.div>

          <motion.div {...fadeIn(2)}>
            <Section
              title="Composición corporal"
              description={
                insights.composition.date
                  ? `Según tu medición del ${formatDate(insights.composition.date)}.`
                  : "Registra tu % de grasa en el perfil para ver tu masa grasa y magra."
              }
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat
                  label="Masa grasa"
                  value={view.fatMass ?? "—"}
                />
                <Stat
                  label="Masa magra"
                  value={view.leanMass ?? "—"}
                />
                <Stat
                  label="IMC"
                  value={view.bmi ?? "—"}
                />
                <Stat
                  label="FFMI"
                  hint="Índice de masa libre de grasa"
                  value={view.ffmi ?? "—"}
                />
              </div>
            </Section>
          </motion.div>

          <motion.div {...fadeIn(3)}>
            <Section
              title="Análisis del coach"
              description="Una lectura de tu progreso hecha por el IA Coach a partir de tus mediciones."
            >
              <ProgressAnalysis request={analysisRequest} warning={view.paceWarning} />
            </Section>
          </motion.div>

          <motion.div {...fadeIn(4)}>
            <Section title="Historial">
              <MetricsHistory
                metrics={metrics}
                weightUnit={weightUnit}
                toDisplayWeight={toDisplayWeight}
                suspiciousDate={insights.suspiciousDate}
              />
            </Section>
          </motion.div>

          <motion.div {...fadeIn(5)}>
            <Section title="Constancia">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat
                  icon={Flame}
                  label="Racha"
                  value={
                    insights.streak.weeks === 1
                      ? "1 semana"
                      : `${insights.streak.weeks} semanas`
                  }
                  hint="Semanas seguidas con al menos un registro"
                />
                <Stat
                  icon={CalendarCheck}
                  label="Últimos 30 días"
                  value={
                    insights.streak.last30 === 1
                      ? "1 registro"
                      : `${insights.streak.last30} registros`
                  }
                  hint={`${insights.streak.total} en total`}
                />
                <Stat
                  label="Último registro"
                  value={
                    insights.streak.lastDate
                      ? formatDate(insights.streak.lastDate)
                      : "—"
                  }
                />
              </div>
            </Section>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function KpiTile({
  label,
  value,
  delta,
  direction,
  status,
}: {
  label: string
  value: string
  delta?: string
  direction?: number | null
  status?: { label: string; tone: "good" | "warn" | "muted" }
}) {
  // La flecha solo indica sentido (sube/baja), sin color de "bueno/malo":
  // que bajar de peso sea bueno depende de la meta de cada usuario.
  const Arrow = direction != null && direction < 0 ? ArrowDownRight : ArrowUpRight
  const StatusIcon = status?.tone === "good" ? CircleCheck : CircleAlert

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {delta && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Arrow aria-hidden className="h-4 w-4" />
            {delta}
          </span>
        )}
        {status && (
          <span
            data-tone={status.tone}
            className={cn(
              "flex items-center gap-1 text-sm",
              status.tone === "good" && "text-emerald-500",
              status.tone === "warn" && "text-amber-500",
              status.tone === "muted" && "text-muted-foreground"
            )}
          >
            {status.tone !== "muted" && (
              <StatusIcon aria-hidden className="h-4 w-4" />
            )}
            {status.label}
          </span>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {Icon && <Icon aria-hidden className="h-4 w-4" />}
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
