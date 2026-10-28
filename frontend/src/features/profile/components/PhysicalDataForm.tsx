import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { formatDate } from "@/features/body-metrics/dateUtils"
import {
  bodyMetricsKeys,
  useCreateBodyMetric,
  useRefreshMetricsAndProfile,
} from "@/features/body-metrics/hooks"
import {
  PROFILE_REFRESH_FAILED_MESSAGE,
  RefreshFailedNotice,
} from "@/features/body-metrics/components/RefreshFailedNotice"
import { laterWeightMetric } from "@/features/body-metrics/laterWeight"
import type { BodyMetric } from "@/features/body-metrics/types"
import { NumberField } from "@/features/onboarding/components/NumberField"
import { UnitToggle } from "@/features/onboarding/components/UnitToggle"
import {
  ACTIVITY_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
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
import { fieldMessages, isHeightFeetValid } from "@/features/onboarding/schemas"
import { makeProfileFormSchema } from "@/features/profile/schemas"
import type {
  BodyComposition,
  PhysicalDataFormValues,
  ProfileResponse,
} from "@/features/profile/types"
import type { ProfileFormErrorKey } from "@/features/profile/schemas"
import { todayIsoDate } from "@/lib/dates"
import { profileKeys, useSaveProfile } from "@/features/profile/hooks"
import { answersFromProfile, payloadFromAnswers } from "@/features/profile/mappers"

// Los mismos datos del onboarding, pero todos a la vista en un formulario:
// aquí el usuario ya sabe qué es cada cosa y solo quiere cambiar una o dos.
export function PhysicalDataForm({
  initial,
  initialBody,
}: {
  initial: OnboardingAnswers
  initialBody: BodyComposition
}) {
  const defaultValues: PhysicalDataFormValues = { ...initial, ...initialBody }
  const [saved, setSaved] = useState<PhysicalDataFormValues>(defaultValues)
  const [justSaved, setJustSaved] = useState(false)
  const [laterDate, setLaterDate] = useState<string | null>(null)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [pendingFinish, setPendingFinish] = useState<{
    values: PhysicalDataFormValues
    hadProfile: boolean
  } | null>(null)
  const queryClient = useQueryClient()
  const refresh = useRefreshMetricsAndProfile()
  const createMetric = useCreateBodyMetric()
  const saveProfile = useSaveProfile()
  const schema = useMemo(() => makeProfileFormSchema(), [])
  const form = useForm<PhysicalDataFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const draft = useWatch({ control: form.control }) as PhysicalDataFormValues
  // Los mensajes salen del mismo esquema, evaluado de forma síncrona.
  const errors = fieldMessages<ProfileFormErrorKey>(schema, draft)
  const dobOk = !errors.dateOfBirth
  const heightOk = !errors.height
  // Con el mensaje de pulgadas solo se marca el campo de pulgadas.
  const feetOk =
    heightOk || (draft.heightUnit === "ft" && isHeightFeetValid(draft))
  const weightOk = !errors.weight
  const fatOk = !errors.fat
  const muscleOk = !errors.muscle
  const allValid = Object.keys(errors).length === 0

  // El aviso "Cambios guardados" desaparece solo a los 3 segundos.
  useEffect(() => {
    if (!justSaved) return
    const id = setTimeout(() => setJustSaved(false), 3000)
    return () => clearTimeout(id)
  }, [justSaved])

  function update(patch: Partial<PhysicalDataFormValues>) {
    for (const key of Object.keys(patch) as (keyof PhysicalDataFormValues)[]) {
      form.setValue(key, patch[key] as never, { shouldDirty: true })
    }
    setJustSaved(false)
    setLaterDate(null)
  }

  const weightKg = (a: OnboardingAnswers) =>
    a.weightUnit === "kg" ? Number(a.weight) : Number(a.weight) * KG_PER_LB
  // Una medición nueva solo si cambió algo medible (peso o composición);
  // cambiar la unidad sin cambiar el peso no cuenta como medición.
  const measurementChanged =
    Math.abs(weightKg(draft) - weightKg(saved)) > 0.05 ||
    draft.fat !== saved.fat ||
    draft.muscle !== saved.muscle
  // Comparación campo a campo: no depende del orden de las claves.
  const dirty =
    (Object.keys(saved) as (keyof PhysicalDataFormValues)[]).some(
      (key) => draft[key] !== saved[key]
    ) || measurementChanged

  async function onSave(values: PhysicalDataFormValues) {
    if (!dirty || !allValid) return
    createMetric.reset()
    saveProfile.reset()
    // Sin perfil en la caché al empezar no se sabe qué peso tiene el perfil:
    // no se afirma nada de él (ni aviso ni peso ajeno).
    const hadProfile = !!queryClient.getQueryData<ProfileResponse>(
      profileKeys.detail
    )?.profile
    // 1. Perfil completo (PUT, idempotente). Si falla, no se toca `saved`.
    try {
      await saveProfile.mutateAsync(payloadFromAnswers(values))
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
      const fatChanged = values.fat.trim() !== "" && values.fat !== saved.fat
      const muscleChanged =
        values.muscle.trim() !== "" && values.muscle !== saved.muscle
      let refreshed: boolean
      try {
        ;({ refreshed } = await createMetric.mutateAsync({
          weight: Math.round(weightKg(values) * 10) / 10,
          recorded_at: todayIsoDate(),
          ...(fatChanged && { body_fat_percentage: Number(values.fat) }),
          ...(muscleChanged && { muscle_mass_percentage: Number(values.muscle) }),
        }))
      } catch {
        return
      }
      if (!refreshed) {
        // Lo guardado ya está en el servidor, pero la pantalla no pudo
        // releerlo: se deja el formulario sin cambios pendientes y se avisa;
        // el paso 3 espera a que «Reintentar» relea con éxito.
        setSaved(values)
        form.reset(values)
        setJustSaved(false)
        setLaterDate(null)
        setRefreshFailed(true)
        setPendingFinish({ values, hadProfile })
        return
      }
    }
    if (measurementChanged) {
      setRefreshFailed(false)
      setPendingFinish(null)
    } else if (pendingFinish) {
      // Sin medición no hay relectura: el aviso sigue hasta que «Reintentar»
      // relea bien, y se actualizan los valores que se darán por guardados.
      setPendingFinish({ ...pendingFinish, values })
    }
    finishSave(values, hadProfile, measurementChanged)
  }

  // 3. Si quedó una medición de peso posterior a hoy, el servidor mantiene
  // en el perfil el peso de esa medición: se muestra el peso real y se
  // avisa, en vez de "Cambios guardados".
  function finishSave(
    values: PhysicalDataFormValues,
    hadProfile: boolean,
    measured: boolean,
    keepDraft = false
  ) {
    let next = values
    let later: ReturnType<typeof laterWeightMetric> = null
    if (measured) {
      const cachedMetrics = queryClient.getQueryData<BodyMetric[]>(
        bodyMetricsKeys.list
      )
      const cachedProfile = queryClient.getQueryData<ProfileResponse>(
        profileKeys.detail
      )
      if (hadProfile && cachedMetrics && cachedProfile?.profile) {
        later = laterWeightMetric(cachedMetrics, todayIsoDate())
        if (later) {
          const real = answersFromProfile(cachedProfile)
          next = { ...values, weight: real.weight, weightUnit: real.weightUnit }
        }
      }
    }
    setSaved(next)
    // Con ediciones sin guardar no se descarta el borrador del usuario.
    if (!keepDraft) form.reset(next)
    if (later) {
      setLaterDate(later.recorded_at)
      setJustSaved(false)
    } else {
      setLaterDate(null)
      setJustSaved(true)
    }
  }

  // Reintenta solo la relectura: no vuelve a guardar perfil ni medición.
  async function retryRefresh() {
    const ok = await refresh.mutateAsync()
    if (!ok || !pendingFinish) return
    setRefreshFailed(false)
    finishSave(pendingFinish.values, pendingFinish.hadProfile, true, dirty)
    setPendingFinish(null)
  }

  function discard() {
    form.reset(saved)
  }

  return (
    <form autoComplete="off" onSubmit={form.handleSubmit(onSave)} className="flex flex-col gap-5">
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
          error={errors.dateOfBirth}
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
          error={errors.height}
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
                invalid={!feetOk}
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
          error={errors.weight}
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
          error={errors.fat}
        >
          <NumberField
            id="profile-fat"
            value={draft.fat}
            onChange={(fat) => update({ fat })}
            suffix="%"
            invalid={!fatOk}
          />
        </Field>

        <Field
          label="% Masa muscular (opcional)"
          htmlFor="profile-muscle"
          error={errors.muscle}
        >
          <NumberField
            id="profile-muscle"
            value={draft.muscle}
            onChange={(muscle) => update({ muscle })}
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
        {refreshFailed && (
          <RefreshFailedNotice
            message={PROFILE_REFRESH_FAILED_MESSAGE}
            retrying={refresh.isPending}
            onRetry={() => void retryRefresh()}
          />
        )}
        {justSaved && !refreshFailed && (
          <span
            role="status"
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Check className="h-4 w-4" />
            Cambios guardados
          </span>
        )}
        {laterDate && (
          <span role="status" className="text-sm text-muted-foreground">
            Guardamos tu medición de hoy, pero tu peso del perfil es el de tu
            medición más reciente, del {formatDate(laterDate)}. Puedes
            corregirla o borrarla en Métricas.
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
