import { cn } from "@/lib/utils"
import { CoachFeedbackButtons } from "@/features/coach/components/CoachFeedbackButtons"
import type { ConversationMessage } from "@/features/coach/types"

export function ChatMessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user"

  return (
    // justify-end/start alinea la burbuja a la derecha (usuario) o
    // izquierda (coach) - la convencion universal de cualquier chat.
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[80%] flex-col", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-card-foreground"
          )}
        >
          {message.content}
        </div>
        {!isUser && typeof message.feedbackId === "string" && (
          <CoachFeedbackButtons feedbackId={message.feedbackId} />
        )}
      </div>
    </div>
  )
}
