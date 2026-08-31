import { useState } from "react"
import { Dumbbell, Heart, LineChart, Sparkles } from "lucide-react"
import { homeCardImages } from "@/features/home/images"
import { ShortcutCard } from "@/features/home/components/ShortcutCard"
import { HomeSlideshowBox } from "@/features/home/components/HomeSlideshowBox"

// Por ahora este "home" es solo un punto de entrada con accesos directos a
// las secciones existentes. A futuro (resumen de metricas recientes,
// progreso, etc.) esta pantalla va a crecer, pero arrancamos simple.
//
// "slug" es el nombre de la carpeta en src/assets/home/ de donde salen las
// imagenes del slideshow compartido (ver images.ts).
const shortcuts = [
  {
    to: "/categories",
    label: "Catálogo",
    description: "Explora el catálogo de ejercicios",
    icon: Dumbbell,
    slug: "categories",
  },
  {
    to: "/favorites",
    label: "Favoritos",
    description: "Tus ejercicios guardados",
    icon: Heart,
    slug: "favorites",
  },
  {
    to: "/body-metrics",
    label: "Métricas",
    description: "Registra y revisa tu progreso",
    icon: LineChart,
    slug: "body-metrics",
  },
  {
    to: "/coach",
    label: "Coach",
    description: "Preguntale al AI Coach",
    icon: Sparkles,
    slug: "coach",
  },
]

export function HomePage() {
  // Guarda el slug de la card sobre la que esta el mouse ahora mismo (o
  // null si no hay ninguna). HomeSlideshowBox recibe las imagenes de ese
  // slug - asi la caja de abajo "sigue" a la card en hover.
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const activeImages = hoveredSlug ? homeCardImages[hoveredSlug] : undefined

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
          <ShortcutCard
            key={shortcut.to}
            to={shortcut.to}
            label={shortcut.label}
            description={shortcut.description}
            icon={shortcut.icon}
            index={index}
            onHoverChange={(isHovered) =>
              setHoveredSlug(isHovered ? (shortcut.slug ?? null) : null)
            }
          />
        ))}
      </div>

      {/* Division visual entre la grilla de cards y el slideshow compartido */}
      <div className="mt-6 border-t" />

      <HomeSlideshowBox images={activeImages} />
    </div>
  )
}
