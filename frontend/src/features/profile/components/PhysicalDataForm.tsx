import { useEffect, useState, type ReactNode } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NumberField } from "@/features/onboarding/components/NumberField"
import { UnitToggle } from "@/features/onboarding/components/UnitToggle"
import {
  ACTIVITY_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  LIMITS,
} from "@/features/onboarding/constants"
import { saveOnboardingAnswers } from "@/features/onboarding/storage"
import type {
  ActivityLevel,
  ChoiceOption,
  Goal,
  OnboardingAnswers,
} from "@/features/onboarding/types"
import { convertHeight, convertWeight } from "@/features/onboarding/units"
import {
  isAgeValid,
  isHeightValid,
  isWeightValid,
} from "@/features/onboarding/validation"

// Los mismos datos del onboarding, pero todos a la vista en un formulario:
// aquí el usuario ya sabe qué es cada cosa y solo quiere cambiar una o dos.
export function PhysicalDataForm({ initial }: { initial: OnboardingAnswers }) {
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [justSaved, setJustSaved] = useState(false)

  // El aviso "Cambios guardados" desaparece solo a los 3 segundos.
  useEffect(() => {
    if (!justSaved) return
    const id = setTimeout(() => setJustSaved(false), 3000)
    return () => clearTimeout(id)
  }, [justSaved])

  function update(patch: Partial<OnboardingAnswers>) {
    setDraft((current) => ({ ...current, ...patch }))
    setJustSaved(false)
  }

  const ageOk = isAgeValid(draft)
  const heightOk = isHeightValid(draft)
  const weightOk = isWeightValid(draft)
  const allValid = ageOk && heightOk && weightOk
  // Comparar el JSON basta aquí: son objetos planos con el mismo orden de
  // claves, así que "hay cambios" equivale a "el texto es distinto".
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dirty || !allValid) return
    saveOnboardingAnswers(draft)
    setSaved(draft)
    setJustSaved(true)
  }

  const weightLimits = draft.weightUnit === "kg" ? LIMITS.kg : LIMITS.lb

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Género">
          <UnitToggle
            units={GENDER_OPTIONS}
            value={draft.gender ?? "male"}
            onChange={(gender) => update({ gender })}
          />
        </Field>

        <Field
          label="Edad"
          htmlFor="profile-age"
          error={
            ageOk
              ? undefined
              : `Entre ${LIMITS.age.min} y ${LIMITS.age.max} años`
          }
        >
          <NumberField
            id="profile-age"
            value={draft.age}
            onChange={(age) => update({ age })}
            suffix="años"
            inputMode="numeric"
            invalid={!ageOk}
          />
        </Field>

        <Field
          label="Altura"
          action={
            <UnitToggle
              units={[
                { value: "cm", label: "cm" },
                { value: "ft", label: "ft / in" },
              ]}
              value={draft.heightUnit}
              onChange={(unit) => update(convertHeight(draft, unit))}
            />
          }
          error={
            heightOk
              ? undefined
              : draft.heightUnit === "cm"
                ? `Entre ${LIMITS.heightCm.min} y ${LIMITS.heightCm.max} cm`
                : `Entre ${LIMITS.heightFt.min} y ${LIMITS.heightFt.max} ft`
          }
        >
          {draft.heightUnit === "cm" ? (
            <NumberField
              value={draft.heightCm}
              onChange={(heightCm) => update({ heightCm })}
              suffix="cm"
              invalid={!heightOk}
            />
          ) : (
            <div className="flex gap-3">
              <NumberField
                value={draft.heightFt}
                onChange={(heightFt) => update({ heightFt })}
                suffix="ft"
                inputMode="numeric"
                invalid={!heightOk}
              />
              <NumberField
                value={draft.heightIn}
                onChange={(heightIn) => update({ heightIn })}
                suffix="in"
                inputMode="numeric"
                invalid={!heightOk}
              />
            </div>
          )}
        </Field>

        <Field
          label="Peso"
          action={
            <UnitToggle
              units={[
                { value: "kg", label: "kg" },
                { value: "lb", label: "lb" },
              ]}
              value={draft.weightUnit}
              onChange={(unit) => update(convertWeight(draft, unit))}
            />
          }
          error={
            weightOk
              ? undefined
              : `Entre ${weightLimits.min} y ${weightLimits.max} ${draft.weightUnit}`
          }
        >
          <NumberField
            value={draft.weight}
            onChange={(weight) => update({ weight })}
            suffix={draft.weightUnit}
            invalid={!weightOk}
          />
        </Field>

        <OptionSelect<ActivityLevel>
          label="Nivel de actividad"
          options={ACTIVITY_OPTIONS}
          value={draft.activityLevel}
          onChange={(activityLevel) => update({ activityLevel })}
        />

        <OptionSelect<Goal>
          label="Meta"
          options={GOAL_OPTIONS}
          value={draft.goal}
          onChange={(goal) => update({ goal })}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {justSaved && (
          <span
            role="status"
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Check className="h-4 w-4" />
            Cambios guardados
          </span>
        )}
        {dirty && (
          <Button type="button" variant="ghost" onClick={() => setDraft(saved)}>
            Descartar
          </Button>
        )}
        <Button type="submit" disabled={!dirty || !allValid}>
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}

// Etiqueta + control + (opcional) un control a la derecha de la etiqueta,
// como el selector de unidades, y un mensaje de error debajo.
function Field({
  label,
  htmlFor,
  action,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  action?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-9 items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {action}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// Desplegable con la descripción de la opción elegida debajo: en el
// desplegable solo cabe el nombre, y la descripción es la que explica qué
// significa cada nivel o meta.
function OptionSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ChoiceOption<T>[]
  value: T | null
  onChange: (value: T) => void
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <Field label={label}>
      <Select value={value ?? undefined} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected?.description && (
        <p className="text-xs text-muted-foreground">{selected.description}</p>
      )}
    </Field>
  )
}
