import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

// Una unica instancia para toda la app: guarda la cache de todas las
// queries (categorias, ejercicios, favoritos, etc.) en memoria.
// Vive a nivel de modulo (no dentro del componente) para que no se
// recree -y se pierda la cache- en cada re-render.
const queryClient = new QueryClient()

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
