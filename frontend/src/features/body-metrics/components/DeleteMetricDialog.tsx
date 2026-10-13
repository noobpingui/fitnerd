import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/features/body-metrics/dateUtils"
import { useDeleteBodyMetric } from "@/features/body-metrics/hooks"
import type { BodyMetric } from "@/features/body-metrics/types"

type DeleteMetricDialogProps = {
  metric: BodyMetric
  onClose: () => void
  onFailed: () => void
}

export function DeleteMetricDialog({ metric, onClose, onFailed }: DeleteMetricDialogProps) {
  const mutation = useDeleteBodyMetric()

  async function handleDelete() {
    if (mutation.isPending) return
    try {
      await mutation.mutateAsync(metric.id)
    } catch {
      // Se cierra el diálogo y el aviso lo muestra el historial, para que la
      // lista siga accesible mientras se lee el error.
      onFailed()
      return
    }
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            ¿Borrar la medición del {formatDate(metric.recorded_at)}?
          </DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={mutation.isPending}
          >
            Borrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
