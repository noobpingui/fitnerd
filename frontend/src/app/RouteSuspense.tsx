import { Component, type ReactNode } from "react"

export const PAGE_LOAD_ERROR_MESSAGE = "No se pudo cargar la página."

// Aviso de error de descarga con el botón «Recargar».
export function PageLoadError({
  onReload: _onReload,
}: {
  onReload: () => void
}): ReactNode {
  throw new Error("not implemented")
}

type BoundaryProps = { children: ReactNode; onReload?: () => void }
type BoundaryState = { failed: boolean }

// Captura el rechazo de React.lazy (y cualquier error de render de la pantalla) y muestra PageLoadError.
export class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    throw new Error("not implemented")
  }

  render(): ReactNode {
    throw new Error("not implemented")
  }
}

// PageErrorBoundary + Suspense con ProfileLoading («Cargando…») como fallback.
export function RouteSuspense({
  children: _children,
  onReload: _onReload,
}: {
  children: ReactNode
  onReload?: () => void
}): ReactNode {
  throw new Error("not implemented")
}
