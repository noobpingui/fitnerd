import { useState } from "react"
import { Megaphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FeedbackForm } from "@/features/feedback/components/FeedbackForm"

// Vive DENTRO del <nav> (Navbar.tsx), a la izquierda del avatar - montado
// ahi (no en AppLayout) por eso aparece en TODAS las pantallas protegidas
// (login/register no tienen Navbar, y tampoco tendria sentido pedir
// feedback antes de entrar). Antes era un boton flotante fijo abajo a la
// derecha, pero en mobile se superponia con el boton de enviar mensaje
// del Coach - vivir en el nav evita ese problema de raiz, ya que el nav
// nunca se solapa con el contenido de la pantalla.
export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Al cerrar (click afuera, Esc, o la X) reseteamos "submitted" - asi la
    // proxima vez que se abra arranca de nuevo en el formulario en blanco,
    // no en el mensaje de agradecimiento de la vez anterior.
    if (!next) setSubmitted(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {/* variant="ghost": un boton mas de la barra, no uno flotante y
            "gritado" en color primario como antes - se comporta como
            cualquier otro icono del nav (transparente hasta el hover).
            size-16 pisa el "size-9" default de size="icon" - mismo
            tamano que el Avatar de al lado (tambien size-16), para que
            los dos queden a la misma escala visual. */}
        <Button
          variant="ghost"
          size="icon"
          className="size-16"
          aria-label="Enviar feedback"
        >
          <Megaphone className="h-8 w-8" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        {submitted ? (
          <DialogHeader>
            <DialogTitle>¡Gracias por tu feedback!</DialogTitle>
            <DialogDescription>
              Lo vamos a revisar. Puedes cerrar esta ventana cuando quieras.
            </DialogDescription>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enviar feedback</DialogTitle>
              <DialogDescription>
                Cuéntanos qué te parece la app, qué te gustaría que tuviera, o
                si encontraste algún problema.
              </DialogDescription>
            </DialogHeader>
            <FeedbackForm onSuccess={() => setSubmitted(true)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
