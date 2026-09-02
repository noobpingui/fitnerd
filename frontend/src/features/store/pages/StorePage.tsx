import { motion } from "motion/react"
import { Construction } from "lucide-react"
import { STORES } from "@/features/store/constants"
import { StoreCard } from "@/features/store/components/StoreCard"

export function StorePage() {
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold">Visita las diferentes tiendas</h1>

      {/* Mismo recurso de linea divisoria que ya se usa en /home y
          /favorites, para separar el titulo de la grilla de abajo. */}
      <div className="mb-6 border-t" />

      {/* Placeholder temporal mientras STORES esta vacio (ver constants.ts) -
          mismo lenguaje visual que otros estados vacios de la app (ej.
          FavoritesPage "Todavia no marcaste ningun ejercicio como
          favorito"), pero con un icono en vez de solo texto porque esto no
          es un estado que dependa de datos del usuario - es la pantalla
          entera todavia sin contenido cargado. Reemplazar este bloque por
          la grilla de abajo apenas STORES tenga elementos. */}
      {STORES.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <Construction className="h-10 w-10" />
          <p className="max-w-xs">
            En construcción - muy pronto vas a poder encontrar
            acá las tiendas locales de ropa, suplementos, etc, que apoyamos.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {STORES.map((store, index) => (
          <motion.div
            key={store.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            <StoreCard {...store} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
