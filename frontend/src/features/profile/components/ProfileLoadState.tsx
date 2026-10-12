import { Button } from "@/components/ui/button"

export function ProfileLoading() {
  return (
    <div
      role="status"
      className="flex min-h-dvh items-center justify-center text-muted-foreground"
    >
      Cargando…
    </div>
  )
}

export function ProfileLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      <p>No se pudo cargar tu perfil.</p>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  )
}
