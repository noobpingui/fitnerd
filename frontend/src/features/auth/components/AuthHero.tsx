import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Dumbbell, Heart, Sparkles } from "lucide-react"

const rotatingWords = [
  "con criterio.",
  "sin perder tiempo.",
  "de forma inteligente.",
]

const features = [
  { icon: Dumbbell, label: "Catalogo con tecnica de ejecucion" },
  { icon: Heart, label: "Guarda tus ejercicios favoritos" },
  { icon: Sparkles, label: "AI Coach online" },
]

export function AuthHero() {
  const [wordIndex, setWordIndex] = useState(0)

  // Rota la palabra destacada del titular cada ~2.2s - efecto tipico de
  // landing pages modernas, sin depender de que el usuario interactue.
  useEffect(() => {
    const id = setInterval(() => {
      setWordIndex((current) => (current + 1) % rotatingWords.length)
    }, 2200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mb-6 flex flex-col items-center gap-4 text-center">
      <motion.h2
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-2xl font-bold sm:text-3xl"
      >
        Entrena{" "}
        <AnimatePresence mode="wait">
          <motion.span
            key={rotatingWords[wordIndex]}
            className="inline-block text-primary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {rotatingWords[wordIndex]}
          </motion.span>
        </AnimatePresence>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="max-w-sm text-sm text-muted-foreground"
      >
        Resolve tus dudas con un coach de IA online entrenado en contenido real de fitness basado en ciencia - no mas respuestas
        genericas o mitos de influencers fitness.
      </motion.p>

      <div className="flex flex-wrap justify-center gap-2">
        {features.map((feature, index) => (
          <motion.div
            key={feature.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 + index * 0.08 }}
            className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground"
          >
            <feature.icon className="h-3.5 w-3.5" />
            {feature.label}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
