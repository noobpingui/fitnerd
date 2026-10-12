import { useMemo } from "react"
import { Link } from "react-router"
import { motion } from "motion/react"
import { Activity, ArrowRight, Quote, Scale } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { AddToHomeScreen } from "@/features/home/components/AddToHomeScreen"
import { useRandomQuote } from "@/features/home/useRandomQuote"
import { getOnboardingAnswers } from "@/features/onboarding/storage"
import {
  ACTIVITY_OPTIONS,
  GOAL_OPTIONS,
} from "@/features/onboarding/constants"
import { calculateMacros } from "@/features/macros/calculations"
import { MACRO_META } from "@/features/macros/constants"

const numberFormat = new Intl.NumberFormat("es-ES")

// Aparición escalonada de los bloques del home, de arriba abajo.
function fadeIn(index: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, delay: index * 0.06 },
  }
}

// El home es un resumen personal: muestra de un vistazo los datos del
// onboarding y el objetivo de hoy, en lugar de accesos directos (para
// navegar ya están la barra superior y la inferior).
export function HomePage() {
  const quote = useRandomQuote()
  const answers = useMemo(() => getOnboardingAnswers(), [])
  const summary = useMemo(
    () => (answers ? calculateMacros(answers) : null),
    [answers]
  )

  if (!answers || !summary) return null

  const goalLabel = GOAL_OPTIONS.find((g) => g.value === answers.goal)?.label
  const activityLabel = ACTIVITY_OPTIONS.find(
    (a) => a.value === answers.activityLevel
  )?.label

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <motion.header {...fadeIn(0)} className="mb-6">
        <h1 className="text-2xl font-bold">Hola de nuevo</h1>
        <p className="text-muted-foreground">Meta: {goalLabel}</p>
      </motion.header>

      <motion.blockquote
        {...fadeIn(1)}
        className="mb-6 flex gap-3 border-l-2 border-primary pl-4 text-lg italic"
      >
        <Quote aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
        <p>{quote}</p>
      </motion.blockquote>

      {/* Tarjeta principal: toda ella es un enlace a /macros, así que se
          puede tocar en cualquier punto, no solo en "Ver detalle". */}
      <motion.div {...fadeIn(2)}>
        <Link
          to="/macros"
          className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="mb-4 transition-colors group-hover:border-foreground/30">
            <CardContent className="flex flex-col gap-4">
              <div>
                <span className="text-sm text-muted-foreground">
                  Objetivo de hoy
                </span>
                <div className="text-4xl font-bold tabular-nums tracking-tight">
                  {numberFormat.format(summary.targetKcal)}
                  <span className="ml-2 text-lg font-medium text-muted-foreground">
                    kcal
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {summary.macros.map((macro) => (
                    <li key={macro.key} className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: MACRO_META[macro.key].color }}
                      />
                      <span className="text-muted-foreground">
                        {MACRO_META[macro.key].label}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {numberFormat.format(macro.grams)} g
                      </span>
                    </li>
                  ))}
                </ul>
                <span className="flex items-center gap-1 text-sm font-medium">
                  Ver detalle
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </motion.div>

      <motion.div {...fadeIn(3)} className="grid grid-cols-2 gap-4">
        <StatCard
          icon={Scale}
          label="Peso actual"
          value={`${numberFormat.format(Number(answers.weight))} ${answers.weightUnit}`}
        />
        <StatCard icon={Activity} label="Actividad" value={activityLabel ?? ""} />
      </motion.div>

      <AddToHomeScreen />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Scale
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Icon aria-hidden className="h-4 w-4" />
          {label}
        </span>
        <span className="text-xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  )
}
