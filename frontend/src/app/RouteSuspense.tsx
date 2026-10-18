import { Component, Suspense, type ReactNode } from "react"
import { reloadPage } from "@/app/lazyNamed"
import { Button } from "@/components/ui/button"
import { ProfileLoading } from "@/features/profile/components/ProfileLoadState"

export const PAGE_LOAD_ERROR_MESSAGE = "No se pudo cargar la página."

// Aviso de error de descarga con el botón «Recargar».
export function PageLoadError({
  onReload,
}: {
  onReload: () => void
}): ReactNode {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      <p>{PAGE_LOAD_ERROR_MESSAGE}</p>
      <Button onClick={onReload}>Recargar</Button>
    </div>
  )
}

type BoundaryProps = { children: ReactNode; onReload?: () => void }
type BoundaryState = { failed: boolean }

// Captura el rechazo de React.lazy (y cualquier error de render de la pantalla) y muestra PageLoadError.
export class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <PageLoadError onReload={this.props.onReload ?? (() => reloadPage())} />
      )
    }
    return this.props.children
  }
}

// PageErrorBoundary + Suspense con ProfileLoading («Cargando…») como fallback.
export function RouteSuspense({
  children,
  onReload,
}: {
  children: ReactNode
  onReload?: () => void
}): ReactNode {
  return (
    <PageErrorBoundary onReload={onReload}>
      <Suspense fallback={<ProfileLoading />}>{children}</Suspense>
    </PageErrorBoundary>
  )
}
