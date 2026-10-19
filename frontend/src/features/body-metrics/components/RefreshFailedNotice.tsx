import type { ReactElement } from "react"
import { Button } from "@/components/ui/button"

export const METRICS_REFRESH_FAILED_MESSAGE =
  "Guardamos tu medición, pero no pudimos actualizar los datos de la pantalla."
export const PROFILE_REFRESH_FAILED_MESSAGE =
  "Guardamos tus cambios, pero no pudimos actualizar los datos de la pantalla."

export function RefreshFailedNotice({
  message,
  onRetry,
  retrying,
}: {
  message: string
  onRetry: () => void
  retrying: boolean
}): ReactElement {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 text-sm text-destructive"
    >
      <span>{message}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={retrying}
      >
        Reintentar
      </Button>
    </div>
  )
}
