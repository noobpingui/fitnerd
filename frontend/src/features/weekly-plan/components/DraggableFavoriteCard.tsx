import { useDraggable } from "@dnd-kit/core"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Exercise } from "@/features/exercises/types"

type DraggableFavoriteCardProps = {
  exercise: Exercise
  onRemoveFavorite: () => void
  isRemoving: boolean
}

// Version arrastrable de ExerciseCard para esta pantalla en particular. No
// reutilizamos ExerciseCard tal cual porque ExercisesPage (nivel 3 del
// catalogo) tambien lo usa y ahi NO debe ser arrastrable - separarlo evita
// meterle a ese componente compartido una prop que solo aplica aca.
//
// Es una "ficha" chica a proposito (mismo tamano/estilo que los items
// dentro de DayColumn: mismo padding, mismo text-xs, mismo rounded-md) -
// asi la lista de favoritos y las columnas de dias se leen como parte del
// mismo sistema visual, en vez de una Card grande arriba de fichas chicas.
export function DraggableFavoriteCard({
  exercise,
  onRemoveFavorite,
  isRemoving,
}: DraggableFavoriteCardProps) {
  // useDraggable es el hook de dnd-kit que convierte un elemento en algo
  // arrastrable. "id" es como identificamos DESPUES, en onDragEnd, que
  // ejercicio se solto - usamos el id del ejercicio directamente.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: exercise.id,
  })

  return (
    <div
      ref={setNodeRef}
      // attributes/listeners van en TODA la ficha, no en un handle aparte
      // - se puede arrastrar agarrando de cualquier parte. Esto funciona
      // sin romper el link ni el boton de adentro gracias al
      // activationConstraint del PointerSensor/TouchSensor (ver
      // FavoritesPage.tsx): un click/tap normal, sin mover el dedo/mouse
      // mas alla del umbral, nunca se interpreta como el inicio de un
      // arrastre - solo un movimiento real lo activa. touch-none evita
      // que el navegador intente hacer scroll de la pagina mientras
      // arrastras desde el celular.
      {...attributes}
      {...listeners}
      className={cn(
        "flex touch-none items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs shadow-sm",
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <a
        href={exercise.video_url}
        target="_blank"
        rel="noreferrer"
        className="max-w-[9rem] truncate font-medium underline-offset-4 hover:underline"
      >
        {exercise.name}
      </a>

      <button
        type="button"
        disabled={isRemoving}
        onClick={onRemoveFavorite}
        // stopPropagation en pointerDown (no en onClick): asi dnd-kit ni
        // siquiera empieza a rastrear un posible drag desde este boton en
        // particular - un mini-movimiento accidental al tocar el corazon
        // nunca puede "robarle" el click al arrastre de la ficha entera.
        onPointerDown={(event) => event.stopPropagation()}
        aria-label="Quitar de favoritos"
        className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        <Heart className="h-3.5 w-3.5 fill-destructive text-destructive" />
      </button>
    </div>
  )
}
