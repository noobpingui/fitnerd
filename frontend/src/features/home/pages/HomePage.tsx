import { useMemo, useState } from "react"
import { Dumbbell, Heart, LineChart, Sparkles } from "lucide-react"
import { homeCardImages } from "@/features/home/images"
import { useSupportsHover } from "@/features/home/useSupportsHover"
import { ShortcutCard } from "@/features/home/components/ShortcutCard"
import { HomeSlideshowBox } from "@/features/home/components/HomeSlideshowBox"
import { AddToHomeScreen } from "@/features/home/components/AddToHomeScreen"

// Fisher-Yates: mezcla el array SIN mutar el original (copia primero con
// [...array]) - devuelve un array nuevo en un orden aleatorio distinto
// cada vez que se llama.
function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

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
    description: "Pregúntale al AI Coach",
    icon: Sparkles,
    slug: "coach",
  },
]

export function HomePage() {
  // Guarda el slug de la card sobre la que esta el mouse ahora mismo (o
  // null si no hay ninguna). HomeSlideshowBox recibe las imagenes de ese
  // slug - asi la caja de abajo "sigue" a la card en hover.
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)

  // En touch (celular/tablet) no existe "pasar el mouse por encima" - ahi
  // el slideshow no puede depender de un hover que nunca va a pasar. Como
  // fallback, se arma una sola lista con las imagenes de TODAS las cards
  // y se la dejamos fija a HomeSlideshowBox: como esa caja ya
  // cicla+crossfadea cualquier array que reciba, esto la pone en autoplay
  // continuo sin que nadie tenga que tocar nada. shuffle() al armarla (en
  // vez de dejarla en el orden fijo de "shortcuts") es lo que hace que en
  // mobile las imagenes salgan sin un orden predecible - el array queda
  // mezclado una sola vez por carga de pantalla (deps vacias), no en cada
  // render.
  const allImages = useMemo(
    () =>
      shuffle(
        shortcuts.flatMap((shortcut) => homeCardImages[shortcut.slug] ?? [])
      ),
    []
  )

  const supportsHover = useSupportsHover()

  const activeImages = supportsHover
    ? hoveredSlug
      ? homeCardImages[hoveredSlug]
      : undefined
    : allImages

  return (
    // max-w-3xl (antes max-w-2xl): con el 4to shortcut (Coach), 3xl da
    // mas aire a la grilla sin llegar al max-w-4xl que usa Metricas.
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="mb-2 text-2xl font-bold">Bienvenido de vuelta</h1>
      <p className="mb-6 text-muted-foreground">
        Elige por donde quieres continuar.
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

      <AddToHomeScreen />
    </div>
  )
}
