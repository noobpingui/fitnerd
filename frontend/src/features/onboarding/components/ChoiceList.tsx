import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChoiceOption } from "@/features/onboarding/types"

// Lista de opciones grandes y clicables (una por fila). Se usa en vez de un
// <select> porque en el onboarding cada opción necesita espacio para su
// descripción y es más cómoda de tocar en el móvil.
export function ChoiceList<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: ChoiceOption<T>[]
  value: T | null
  onSelect: (value: T) => void
}) {
  return (
    <div role="radiogroup" className="flex flex-col gap-2">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring",
              selected && "border-primary bg-primary/10"
            )}
          >
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.description && (
                <span className="block text-sm text-muted-foreground">
                  {option.description}
                </span>
              )}
            </span>
            <Check
              className={cn(
                "h-5 w-5 shrink-0 text-primary transition-opacity",
                selected ? "opacity-100" : "opacity-0"
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
