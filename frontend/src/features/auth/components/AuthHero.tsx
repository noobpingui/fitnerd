import { motion } from "motion/react"
import { ChartPie, Sparkles, TrendingUp } from "lucide-react"
import { TextAnimate } from "@/components/ui/text-animate"

const features = [
  { icon: ChartPie, label: "Trackeo de macros" },
  { icon: TrendingUp, label: "Análisis de progreso" },
  { icon: Sparkles, label: "AI Coach nutricional" },
]

export function AuthHero() {
  return (
    <div className="mb-6 flex flex-col items-center gap-4 text-center">
      <TextAnimate
        as="h2"
        className="text-2xl font-bold sm:text-3xl"
        highlightFrom={3}
        highlightClassName="text-glint"
      >
        Cumple con tus objetivos nutricionales
      </TextAnimate>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="max-w-sm text-sm text-white"
      >
        Entrenar es solo la mitad del trabajo: lo que comes define tu energía, tu recuperación y tus resultados.
        Registra tus comidas y apóyate en un coach de IA experto en nutrición.
      </motion.p>

      <div className="flex flex-wrap justify-center gap-2">
        {features.map((feature, index) => (
          <motion.div
            key={feature.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 + index * 0.08 }}
            className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-white"
          >
            <feature.icon className="h-3.5 w-3.5" />
            {feature.label}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
