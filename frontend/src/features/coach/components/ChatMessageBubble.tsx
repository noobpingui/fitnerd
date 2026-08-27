import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/features/coach/types"

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    // justify-end/start alinea la burbuja a la derecha (usuario) o
    // izquierda (coach) - la convencion universal de cualquier chat.
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border bg-card text-card-foreground"
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
