import { useEffect, useState, type ReactNode } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import type {
  ActivityLevel,
  ChoiceOption,
  Goal,
  OnboardingAnswers,
} from "@/features/onboarding/types"
import {
  convertHeight,
  convertWeight,
  KG_PER_LB,
} from "@/features/onboarding/units"
import { useCreateBodyMetric } from "@/features/body-metrics/hooks"
import { FAT_LIMITS, MUSCLE_LIMITS } from "@/features/body-metrics/schemas"
import {
  dateOfBirthError,
  isHeightValid,
  isWeightValid,
} from "@/features/onboarding/validation"
import { todayIsoDate } from "@/lib/dates"
import { useSaveProfile } from "@/features/profile/hooks"
import { payloadFromAnswers } from "@/features/profile/mappers"

// Los mismos datos del onboarding, pero todos a la vista en un formulario:
// aquí el usuario ya sabe qué es cada cosa y solo quiere cambiar una o dos.
// Composición corporal opcional (texto mientras se edita, "" = sin dato).
export type BodyComposition = { fat: string; muscle: string }

// Opcional: vacío es válido; si hay algo escrito, debe estar en rango.
function optionalInRange(value: string, { min, max }: { min: number; max: number }) {
  if (value.trim() === "") return true
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max
}

export function PhysicalDataForm({
  initial,
  initialBody,
}: {
  initial: OnboardingAnswers
  initialBody: BodyComposition
}) {
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [savedBody, setSavedBody] = useState(initialBody)
  const [body, setBody] = useState(initialBody)
  const [justSaved, setJustSaved] = useState(false)
  const createMetric = useCreateBodyMetric()
  const saveProfile = useSaveProfile()

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

  function updateBody(patch: Partial<BodyComposition>) {
    setBody((current) => ({ ...current, ...patch }))
    setJustSaved(false)
  }

  const dobError = dateOfBirthError(draft)
  const dobOk = dobError === null
  const heightOk = isHeightValid(draft)
  const weightOk = isWeightValid(draft)
  const fatOk = optionalInRange(body.fat, FAT_LIMITS)
  const muscleOk = optionalInRange(body.muscle, MUSCLE_LIMITS)
  const allValid = dobOk && heightOk && weightOk && fatOk && muscleOk

  const weightKg = (a: OnboardingAnswers) =>
    a.weightUnit === "kg" ? Number(a.weight) : Number(a.weight) * KG_PER_LB
  // Una medición nueva solo si cambió algo medible (peso o composición);
  // cambiar la unidad sin cambiar el peso no cuenta como medición.
  const measurementChanged =
    Math.abs(weightKg(draft) - weightKg(saved)) > 0.05 ||
    body.fat !== savedBody.fat ||
    body.muscle !== savedBody.muscle
  // Comparar el JSON basta aquí: son objetos planos con el mismo orden de
  // claves, así que "hay cambios" equivale a "el texto es distinto".
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(saved) || measurementChanged

  function commit() {
    setSaved(draft)
    setSavedBody(body)
    setJustSaved(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dirty || !allValid) return
    createMetric.reset()
    saveProfile.reset()
    // 1. Perfil completo (PUT, idempotente). Si falla, no se toca `saved`.
    try {
      await saveProfile.mutateAsync(payloadFromAnswers(draft))
    } catch {
      return
    }
    // 2. Cada cambio de peso o composición queda como medición de hoy en el
    // historial (POST /api/body-metrics): es lo que alimenta los gráficos y
    // la racha de Métricas. La grasa y el músculo solo se envían si se
    // cambiaron ahora: si no, se copiaría a hoy una medición antigua como
    // si fuera nueva. Si falla, `saved` no se actualiza: un reintento vuelve
    // a detectar el cambio y registra la medición.
    if (measurementChanged) {
      const fatChanged = body.fat.trim() !== "" && body.fat !== savedBody.fat
      const muscleChanged =
        body.muscle.trim() !== "" && body.muscle !== savedBody.muscle
      try {
        await createMetric.mutateAsync({
          weight: Math.round(weightKg(draft) * 10) / 10,
          recorded_at: todayIsoDate(),
          ...(fatChanged && { body_fat_percentage: Number(body.fat) }),
          ...(muscleChanged && { muscle_mass_percentage: Number(body.muscle) }),
        })
      } catch {
        return
      }
    }
    commit()
  }

  function discard() {
    setDraft(saved)
    setBody(savedBody)
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
          label="Fecha de nacimiento"
          htmlFor="profile-dob"
          error={
            dobError ||
            (draft.dateOfBirth === "" ? "Indica tu fecha de nacimiento" : undefined)
          }
        >
          <Input
            id="profile-dob"
            type="date"
            max={todayIsoDate()}
            value={draft.dateOfBirth}
            onChange={(e) => update({ dateOfBirth: e.target.value })}
            aria-invalid={!dobOk || undefined}
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

        <Field
          label="% Grasa corporal (opcional)"
          htmlFor="profile-fat"
          error={
            fatOk
              ? undefined
              : `Entre ${FAT_LIMITS.min} y ${FAT_LIMITS.max} %`
          }
        >
          <NumberField
            id="profile-fat"
            value={body.fat}
            onChange={(fat) => updateBody({ fat })}
            suffix="%"
            invalid={!fatOk}
          />
        </Field>

        <Field
          label="% Masa muscular (opcional)"
          htmlFor="profile-muscle"
          error={
            muscleOk
              ? undefined
              : `Entre ${MUSCLE_LIMITS.min} y ${MUSCLE_LIMITS.max} %`
          }
        >
          <NumberField
            id="profile-muscle"
            value={body.muscle}
            onChange={(muscle) => updateBody({ muscle })}
            suffix="%"
            invalid={!muscleOk}
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
        {saveProfile.isError && (
          <span role="alert" className="text-sm text-destructive">
            No se pudieron guardar los cambios. Inténtalo de nuevo.
          </span>
        )}
        {createMetric.isError && (
          <span role="alert" className="text-sm text-destructive">
            No se pudo guardar la medición. Inténtalo de nuevo.
          </span>
        )}
        {dirty && (
          <Button type="button" variant="ghost" onClick={discard}>
            Descartar
          </Button>
        )}
        <Button
          type="submit"
          disabled={
            !dirty || !allValid || createMetric.isPending || saveProfile.isPending
          }
        >
          {createMetric.isPending || saveProfile.isPending
            ? "Guardando…" : "Guardar cambios"}
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
