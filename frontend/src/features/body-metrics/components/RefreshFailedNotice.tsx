import type { ReactElement } from "react"

export const METRICS_REFRESH_FAILED_MESSAGE =
  "Guardamos tu medición, pero no pudimos actualizar los datos de la pantalla."
export const PROFILE_REFRESH_FAILED_MESSAGE =
  "Guardamos tus cambios, pero no pudimos actualizar los datos de la pantalla."

export function RefreshFailedNotice(_props: {
  message: string
  onRetry: () => void
  retrying: boolean
}): ReactElement {
  throw new Error("not implemented")
}
