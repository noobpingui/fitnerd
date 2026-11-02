import { useMemo } from "react"
import { motion } from "motion/react"
import { Quote } from "lucide-react"
import { AddToHomeScreen } from "@/features/home/components/AddToHomeScreen"
import { useRandomQuote } from "@/features/home/useRandomQuote"
import { useProfile } from "@/features/profile/hooks"
import { answersFromProfile } from "@/features/profile/mappers"
import { GOAL_OPTIONS } from "@/features/onboarding/constants"
import { calculateMacros } from "@/features/macros/calculations"
import { MacrosOverview } from "@/features/macros/components/MacrosOverview"

// Aparición escalonada de los bloques del home, de arriba abajo.
function fadeIn(index: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, delay: index * 0.06 },
  }
}

// El home es un resumen personal: la meta y el objetivo de hoy con su reparto
// de macros (lo que antes era /macros), en lugar de accesos directos (para
// navegar ya están la barra superior y la inferior).
export function HomePage() {
  const quote = useRandomQuote()
  const { data: profile } = useProfile()
  const answers = useMemo(
    () => (profile ? answersFromProfile(profile) : null),
    [profile]
  )
  const summary = useMemo(
    () => (answers ? calculateMacros(answers) : null),
    [answers]
  )

  if (!answers || !summary) return null

  const goalLabel = GOAL_OPTIONS.find((g) => g.value === answers.goal)?.label

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
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

      <motion.div {...fadeIn(2)}>
        <MacrosOverview summary={summary} />
      </motion.div>

      <AddToHomeScreen />
    </div>
  )
}
