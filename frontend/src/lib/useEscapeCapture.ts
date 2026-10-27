import { useEffect, useRef } from "react"

// Escape en captura sobre window mientras `active` sea true: llega antes que el listener de
// Radix en `document` y no sigue su camino, así un diálogo no se cierra con la confirmación abierta.
export function useEscapeCapture(onEscape: () => void, active: boolean): void {
  const handlerRef = useRef(onEscape)
  useEffect(() => {
    handlerRef.current = onEscape
  })

  useEffect(() => {
    if (!active) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      handlerRef.current()
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [active])
}
