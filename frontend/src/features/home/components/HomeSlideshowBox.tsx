import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"

const SLIDE_INTERVAL_MS = 3000

type HomeSlideshowBoxProps = {
  images?: string[]
}

// Caja grande, compartida por las 4 cards de /home. HomePage le pasa las
// imagenes de la card que esta en hover en ese momento (o undefined si no
// hay ninguna en hover, o si esa card no tiene imagenes todavia). Este
// componente no sabe de cards ni de hover - solo sabe ciclar+crossfadear
// el array que le llega.
export function HomeSlideshowBox({ images }: HomeSlideshowBoxProps) {
  const [index, setIndex] = useState(0)

  // Cada vez que cambia la card en hover (osea cambia el array de
  // imagenes que nos llega), volvemos a arrancar desde la primera imagen.
  useEffect(() => {
    setIndex(0)
  }, [images])

  useEffect(() => {
    if (!images || images.length < 2) return

    const id = setInterval(() => {
      setIndex((current) => (current + 1) % images.length)
    }, SLIDE_INTERVAL_MS)

    return () => clearInterval(id)
  }, [images])

  return (
    // Sin border/bg propios: en reposo no debe notarse que hay una caja
    // ahi - la idea es que la imagen "aparezca de la nada" al hacer hover,
    // no que se vea un recuadro vacio esperando contenido. object-contain
    // en la imagen (mas abajo) evita que se recorte cuando su proporcion
    // no calza con la del box; overflow-hidden + rounded-lg quedan por si
    // el crossfade genera un desborde momentaneo entre la imagen saliente
    // y la entrante.
    <div className="relative mt-3 h-[40rem] w-full overflow-hidden rounded-lg sm:h-[50rem]">
      <AnimatePresence>
        {images && images.length > 0 && (
          <motion.img
            key={images[index]}
            src={images[index]}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </AnimatePresence>
    </div>
  )
}
