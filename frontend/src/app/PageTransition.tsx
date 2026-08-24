import type { ReactNode } from "react"
import { motion } from "motion/react"

// Wrapper reutilizable para animar la entrada/salida de una pantalla
// completa al cambiar de ruta. Se usa solo donde se pide explicitamente
// (ver router.tsx) - el resto de las rutas sigue con el swap instantaneo
// de siempre, sin efecto secundario.
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  )
}
