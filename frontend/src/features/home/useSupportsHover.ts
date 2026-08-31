import { useEffect, useState } from "react"

// (hover: hover) es la misma media query que usa CSS para decidir si
// aplica los estilos :hover - true en mouse/trackpad, false en pantallas
// tactiles (no existe "pasar por encima" sin soltar el dedo). La usamos
// en JS para decidir COMO se llena el slideshow de /home: si el
// dispositivo no soporta hover, no tiene sentido esperar a que el
// usuario "pase el mouse" sobre una card - ahi el slideshow autoplay-ea
// solo (ver HomePage.tsx).
export function useSupportsHover() {
  const [supportsHover, setSupportsHover] = useState(
    () => window.matchMedia("(hover: hover)").matches
  )

  useEffect(() => {
    const query = window.matchMedia("(hover: hover)")

    function handleChange(event: MediaQueryListEvent) {
      setSupportsHover(event.matches)
    }

    // Cubre el caso raro pero real de una tablet/2-en-1 a la que le
    // conectan un mouse despues de cargar la pagina.
    query.addEventListener("change", handleChange)
    return () => query.removeEventListener("change", handleChange)
  }, [])

  return supportsHover
}
