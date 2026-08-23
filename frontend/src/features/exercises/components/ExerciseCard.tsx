import { Heart } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Exercise } from "@/features/exercises/types"

export function ExerciseCard({
  exercise,
  isFavorite,
  onToggleFavorite,
  isToggling,
}: {
  exercise: Exercise
  isFavorite: boolean
  onToggleFavorite: () => void
  isToggling: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <a
          href={exercise.video_url}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline-offset-4 hover:underline"
        >
          {exercise.name}
        </a>

        <motion.div whileTap={{ scale: 0.85 }}>
          <Button
            variant="ghost"
            size="icon"
            disabled={isToggling}
            onClick={onToggleFavorite}
            aria-label={
              isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
            }
          >
            <Heart
              className={cn(
                "h-5 w-5",
                isFavorite && "fill-destructive text-destructive"
              )}
            />
          </Button>
        </motion.div>
      </CardContent>
    </Card>
  )
}
