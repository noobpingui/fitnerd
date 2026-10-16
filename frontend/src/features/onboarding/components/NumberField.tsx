import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Campo numérico con la unidad a la derecha. "large" es la versión grande
// y centrada del onboarding (una pregunta por pantalla); la normal encaja
// en formularios como el del perfil.
export function NumberField({
  value,
  onChange,
  suffix,
  placeholder,
  inputMode = "decimal",
  autoFocus = false,
  large = false,
  id,
  invalid = false,
  "aria-describedby": ariaDescribedBy,
}: {
  value: string
  onChange: (value: string) => void
  suffix: string
  placeholder?: string
  inputMode?: "numeric" | "decimal"
  autoFocus?: boolean
  large?: boolean
  id?: string
  invalid?: boolean
  "aria-describedby"?: string
}) {
  return (
    <div className="relative w-full">
      <Input
        id={id}
        type="number"
        inputMode={inputMode}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          // Oculta las flechitas de subir/bajar del navegador.
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          large
            ? "h-14 pr-16 text-center text-2xl font-semibold md:text-2xl"
            : "pr-12"
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          large ? "right-4" : "right-3 text-sm"
        )}
      >
        {suffix}
      </span>
    </div>
  )
}
