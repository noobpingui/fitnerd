import { useState } from "react"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/apiClient"
import { useSendCoachFeedback } from "@/features/coach/hooks"
import type { CoachFeedbackRating } from "@/features/coach/types"

type CoachFeedbackButtonsProps = {
  feedbackId: string
}

const GENERAL_ERROR = "No se pudo enviar tu valoración. Inténtalo de nuevo."

// Cada instancia tiene su propia mutación y su propia selección: votar una
// respuesta no afecta a las demás.
export function CoachFeedbackButtons({ feedbackId }: CoachFeedbackButtonsProps) {
  const [selected, setSelected] = useState<CoachFeedbackRating | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLimitError, setIsLimitError] = useState(false)
  const mutation = useSendCoachFeedback()

  function vote(rating: CoachFeedbackRating) {
    if (rating === selected) return

    mutation.mutate(
      { feedback_id: feedbackId, rating },
      {
        onSuccess: () => {
          setSelected(rating)
          setErrorMessage(null)
          setIsLimitError(false)
        },
        // En error la selección anterior no cambia.
        onError: (err) => {
          if (err instanceof ApiError && err.status === 429) {
            setErrorMessage(err.message)
            setIsLimitError(true)
          } else {
            setErrorMessage(GENERAL_ERROR)
            setIsLimitError(false)
          }
        },
      }
    )
  }

  return (
    <div className="mt-1">
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Respuesta útil"
          aria-pressed={selected === "up"}
          disabled={mutation.isPending}
          onClick={() => vote("up")}
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Respuesta no útil"
          aria-pressed={selected === "down"}
          disabled={mutation.isPending}
          onClick={() => vote("down")}
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>
      {errorMessage && (
        <p
          className={
            isLimitError
              ? "text-xs text-muted-foreground"
              : "text-xs text-destructive"
          }
        >
          {errorMessage}
        </p>
      )}
    </div>
  )
}
