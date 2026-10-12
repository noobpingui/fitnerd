import { cn } from "@/lib/utils"

// Interruptor de dos (o más) unidades, tipo "cm | ft". Visualmente es un
// control segmentado: la unidad activa queda resaltada.
export function UnitToggle<T extends string>({
  units,
  value,
  onChange,
}: {
  units: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-1">
      {units.map((unit) => (
        <button
          key={unit.value}
          type="button"
          aria-pressed={unit.value === value}
          onClick={() => onChange(unit.value)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            unit.value === value && "bg-card font-medium text-foreground shadow-sm"
          )}
        >
          {unit.label}
        </button>
      ))}
    </div>
  )
}
