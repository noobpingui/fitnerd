import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

const SWITCH_ID = "coach-personal-context"
export const PERSONAL_CONTEXT_HELP_ON =
  "El coach tiene en cuenta tu nombre, tu perfil, tus macros y tu progreso."
export const PERSONAL_CONTEXT_HELP_OFF =
  "El coach no usa tus datos personales. Los mensajes anteriores de esta conversación se siguen enviando al coach y pueden incluirlos."

const HELP_ID = "coach-personal-context-help"

export function PersonalContextToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Switch
          id={SWITCH_ID}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-describedby={HELP_ID}
        />
        <Label htmlFor={SWITCH_ID}>Usar mis datos para personalizar las respuestas</Label>
      </div>
      <p id={HELP_ID} className="mt-1 text-sm text-muted-foreground">
        {checked ? PERSONAL_CONTEXT_HELP_ON : PERSONAL_CONTEXT_HELP_OFF}
      </p>
    </div>
  )
}
