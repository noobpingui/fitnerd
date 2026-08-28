import { Link } from "react-router"
import { motion } from "motion/react"
import { Dumbbell, Heart, LineChart, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

// Por ahora este "home" es solo un punto de entrada con accesos directos a
// las secciones existentes. A futuro (resumen de metricas recientes,
// progreso, etc.) esta pantalla va a crecer, pero arrancamos simple.
const shortcuts = [
  {
    to: "/categories",
    label: "Categorías",
    description: "Explora el catálogo de ejercicios",
    icon: Dumbbell,
  },
  {
    to: "/favorites",
    label: "Favoritos",
    description: "Tus ejercicios guardados",
    icon: Heart,
  },
  {
    to: "/body-metrics",
    label: "Métricas",
    description: "Registra y revisa tu progreso",
    icon: LineChart,
  },
  {
    to: "/coach",
    label: "Coach",
    description: "Preguntale al AI Coach",
    icon: Sparkles,
  },
]

export function HomePage() {
  return (
    // max-w-3xl (antes max-w-2xl): con el 4to shortcut (Coach), 3xl da
    // mas aire a la grilla sin llegar al max-w-4xl que usa Metricas.
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-bold">Bienvenido de vuelta</h1>
      <p className="mb-6 text-muted-foreground">
        Elegi por donde queres continuar.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((shortcut, index) => (
          <motion.div
            key={shortcut.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.06 }}
          >
            <Link to={shortcut.to}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="flex flex-col items-start gap-2">
                  <shortcut.icon className="h-6 w-6 text-primary" />
                  <span className="font-medium">{shortcut.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {shortcut.description}
                  </span>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
