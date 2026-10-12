import { useState } from "react"
import { QUOTES } from "@/features/home/quotes"

const LAST_QUOTE_KEY = "fitnerd_last_quote"

// Elige una frase al azar al montar el home, distinta de la última que se
// mostró (se recuerda en localStorage). Así, aunque la elección sea
// aleatoria, nunca se repite la misma frase dos veces seguidas.
export function useRandomQuote() {
  const [quote] = useState(() => {
    let last = -1
    try {
      last = Number(localStorage.getItem(LAST_QUOTE_KEY) ?? -1)
    } catch {
      // Sin almacenamiento: simplemente no evitamos la repetición.
    }

    let index = Math.floor(Math.random() * QUOTES.length)
    if (index === last) index = (index + 1) % QUOTES.length

    try {
      localStorage.setItem(LAST_QUOTE_KEY, String(index))
    } catch {
      // Ídem.
    }
    return QUOTES[index]
  })

  return quote
}
