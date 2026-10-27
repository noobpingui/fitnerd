import type { ReactElement } from "react"

export function ConfirmDialog(_props: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  isPending?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}): ReactElement {
  throw new Error("not implemented")
}
