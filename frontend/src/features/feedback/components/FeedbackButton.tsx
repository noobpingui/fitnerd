import { useState } from "react"
import { MessageSquarePlus } from "lucide-react"
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

// Boton flotante fijo, montado una sola vez en AppLayout - por eso aparece
// en TODAS las pantallas protegidas (login/register no lo tienen, porque no
// usan AppLayout, y tampoco tendria sentido pedir feedback antes de entrar).
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
        {/* right-4 bottom-20 en mobile: 5rem de margen inferior para no
            quedar tapado por BottomTabBar (fixed, alto ~4rem + safe-area).
            md:bottom-6: en desktop no existe BottomTabBar, alcanza con
            separarlo un poco del borde. z-30, un escalon por debajo del
            z-40 de BottomTabBar, aunque en la practica no llegan a
            superponerse por la diferencia de bottom. */}
        <Button
          size="icon"
          className="fixed right-4 bottom-20 z-30 h-12 w-12 rounded-full shadow-lg md:bottom-6"
          aria-label="Enviar feedback"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        {submitted ? (
          <DialogHeader>
            <DialogTitle>¡Gracias por tu feedback!</DialogTitle>
            <DialogDescription>
              Lo vamos a revisar. Podés cerrar esta ventana cuando quieras.
            </DialogDescription>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enviar feedback</DialogTitle>
              <DialogDescription>
                Contanos qué te parece la app, qué te gustaría que tuviera, o
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
