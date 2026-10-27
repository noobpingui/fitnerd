import type { ReactElement } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

// Confirmación modal (rol alertdialog). El botón de confirmar no cierra por sí solo:
// quien lo usa decide cuándo cerrar, para poder mostrar un error y dejarlo abierto.
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  isPending = false,
  error = null,
  destructive = false,
  container,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  isPending?: boolean
  error?: string | null
  destructive?: boolean
  container?: HTMLElement | null
  onConfirm: () => void
  onCancel: () => void
}): ReactElement {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onCancel()
      }}
    >
      <AlertDialogContent container={container}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
