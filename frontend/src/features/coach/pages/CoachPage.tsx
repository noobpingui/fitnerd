import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/apiClient"
import { ChatMessageBubble } from "@/features/coach/components/ChatMessageBubble"
import { useAskCoach } from "@/features/coach/hooks"
import type { ChatMessage } from "@/features/coach/types"

const MAX_QUESTION_LENGTH = 500

export function CoachPage() {
  // El historial vive ACA, en memoria del componente - no hay
  // persistencia del lado del backend todavia (ver CoachService.ask). Si
  // refrescas la pagina, la conversacion se pierde - limitacion conocida
  // y aceptada para esta primera version.
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState("")
  const askCoach = useAskCoach()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al ultimo mensaje (o al indicador de "escribiendo") cada
  // vez que la conversacion cambia - el mismo comportamiento de
  // cualquier app de chat.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, askCoach.isPending])

  function handleSubmit() {
    const trimmed = question.trim()
    if (!trimmed || askCoach.isPending) return

    // El historial que se manda es el de ANTES de esta pregunta - lo que
    // ya se dijo en la conversacion hasta este punto, sin incluir el
    // mensaje que estamos por agregar.
    const history = messages

    setMessages((prev) => [...prev, { role: "user", content: trimmed }])
    setQuestion("")

    askCoach.mutate(
      { question: trimmed, history },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.answer },
          ])
        },
        // En error no revertimos el mensaje del usuario - queda visible
        // en la conversacion, con el error debajo, para que sepa que
        // ESA pregunta puntual fallo y pueda reintentar sin perder el
        // resto del hilo.
      }
    )
  }

  // Enter manda la pregunta, Shift+Enter agrega un salto de linea -
  // convencion estandar en cualquier chat (WhatsApp, Slack, etc.).
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-2xl font-bold">AI Coach</h1>
      <p className="mb-6 text-muted-foreground">
        Preguntale lo que quieras sobre fitness, basado en contenido real
        de entrenadores.
      </p>

      {/* Altura fija (65vh) en vez de calcular "resto de la pantalla
          menos el navbar" - mas simple y no se rompe si el navbar vuelve
          a cambiar de tamano (ya paso un par de veces en este proyecto). */}
      <div className="flex h-[65vh] flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Sparkles className="h-6 w-6" />
              Empeza la conversacion - preguntale algo al coach.
            </div>
          )}

          {messages.map((message, index) => (
            <ChatMessageBubble key={index} message={message} />
          ))}

          {askCoach.isPending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                Escribiendo...
              </div>
            </div>
          )}

          {askCoach.isError && (
            <p className="text-sm text-destructive">
              Error (
              {askCoach.error instanceof ApiError
                ? askCoach.error.status
                : "?"}
              ): {askCoach.error.message}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2 border-t p-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="Escribi tu pregunta..."
            rows={1}
            className="min-h-9 resize-none"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={!question.trim() || askCoach.isPending}
            aria-label="Enviar pregunta"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
