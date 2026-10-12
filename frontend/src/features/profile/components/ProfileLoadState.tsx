import { Button } from "@/components/ui/button"

export function ProfileLoading({ className = "min-h-dvh" }: { className?: string }) {
  return (
    <div
      role="status"
      className={`flex ${className} items-center justify-center text-muted-foreground`}
    >
      Cargando…
    </div>
  )
}

export function ProfileLoadError({
  onRetry,
  className = "min-h-dvh",
}: {
  onRetry: () => void
  className?: string
}) {
  return (
    <div className={`flex ${className} flex-col items-center justify-center gap-4 p-4 text-center`}>
      <p>No se pudo cargar tu perfil.</p>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  )
}
