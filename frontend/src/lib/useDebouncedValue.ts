import { useCallback, useEffect, useState } from "react"

// Devuelve el valor con retraso y `flush`, que lo aplica en el momento (p. ej. con Intro).
// Cada cambio reinicia la espera. Si el valor pendiente es el mismo que se aplicó con `flush`,
// al vencer el retardo no cambia nada.
export function useDebouncedValue<T>(value: T, delayMs: number): [T, (next: T) => void] {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timerId = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timerId)
  }, [value, delayMs])

  const flush = useCallback((next: T) => setDebounced(next), [])

  return [debounced, flush]
}
