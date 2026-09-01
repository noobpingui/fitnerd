import { useDroppable } from "@dnd-kit/core"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Exercise } from "@/features/exercises/types"

type ScheduledItem = {
  entryId: string
  exercise: Exercise
}

type DayColumnProps = {
  day: number
  label: string
  items: ScheduledItem[]
  onRemove: (entryId: string) => void
  removingEntryId: string | null
  // Para casos puntuales de ubicacion dentro de la grilla del padre (ver
  // Sabado en FavoritesPage.tsx, que va centrado en su propia fila) - se
  // combina con las clases propias del componente, no las reemplaza.
  className?: string
}

// El "day-<n>" del id es la convencion que usa handleDragEnd en
// FavoritesPage.tsx para reconocer sobre que dia se solto el ejercicio.
export function DayColumn({
  day,
  label,
  items,
  onRemove,
  removingEntryId,
  className,
}: DayColumnProps) {
  // useDroppable es el otro lado del par de dnd-kit: convierte este div en
  // una zona valida donde soltar. isOver se pone true SOLO mientras el
  // usuario esta arrastrando algo por encima de esta columna en particular
  // - lo usamos para resaltarla como feedback visual de "aca cae".
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // min-w-0: sin esto, un grid item no se achica mas alla del ancho
        // de su contenido - con nombres de ejercicio largos eso rompe el
        // grid (el truncate de mas abajo necesita que el contenedor SI se
        // pueda achicar para poder cortar el texto).
        "flex min-w-0 flex-col gap-1.5 rounded-lg border bg-muted/10 p-2 transition-colors",
        isOver && "border-primary bg-primary/10",
        className
      )}
    >
      <span className="px-1 text-xs font-semibold text-muted-foreground">
        {label}
      </span>

      {items.length === 0 && (
        <span className="px-1 text-xs text-muted-foreground/60">
          Suelta acá un ejercicio
        </span>
      )}

      {items.map(({ entryId, exercise }) => (
        <div
          key={entryId}
          className="flex items-center justify-between gap-1 rounded-md border bg-card px-2 py-1.5 text-xs"
        >
          <a
            href={exercise.video_url}
            target="_blank"
            rel="noreferrer"
            className="truncate underline-offset-2 hover:underline"
          >
            {exercise.name}
          </a>
          <button
            type="button"
            onClick={() => onRemove(entryId)}
            disabled={removingEntryId === entryId}
            aria-label={`Quitar ${exercise.name} de ${label}`}
            className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
