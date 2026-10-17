import { useMemo, type ReactElement, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/features/body-metrics/dateUtils"
import { useCreateBodyMetric } from "@/features/body-metrics/hooks"
import {
  makeMetricRegistrationSchema,
  REGISTRATION_PAST_DAYS,
  registrationPayload,
  type MetricRegistrationErrorKey,
  type MetricRegistrationValues,
} from "@/features/body-metrics/schemas"
import type { BodyMetric } from "@/features/body-metrics/types"
import { NumberField } from "@/features/onboarding/components/NumberField"
import { fieldMessages } from "@/features/onboarding/schemas"
import type { WeightUnit } from "@/features/onboarding/types"
import { shiftIsoDate, todayIsoDate } from "@/lib/dates"

type RegisterMetricDialogProps = {
  metrics: BodyMetric[] // para el aviso de fecha con medición
  weightUnit: WeightUnit
  onClose: () => void // al cancelar o al guardar con éxito
}

export function RegisterMetricDialog({
  metrics,
  weightUnit,
  onClose,
}: RegisterMetricDialogProps): ReactElement {
  const mutation = useCreateBodyMetric()
  const today = useMemo(() => todayIsoDate(), [])
  const schema = useMemo(
    () => makeMetricRegistrationSchema(weightUnit, today),
    [weightUnit, today]
  )
  const form = useForm<MetricRegistrationValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: today, weight: "", fat: "", muscle: "" },
  })
  const draft = useWatch({ control: form.control }) as MetricRegistrationValues
  const errors = fieldMessages<MetricRegistrationErrorKey>(schema, draft)
  const allValid = Object.keys(errors).length === 0
  const hasMetricOnDate = metrics.some((m) => m.recorded_at === draft.date)

  // Los errores del campo y el de "al menos un valor" describen al input.
  function describedBy(id: string, fieldError?: string): string | undefined {
    const ids = [
      fieldError ? `${id}-error` : null,
      errors.values ? "register-values-error" : null,
    ].filter(Boolean)
    return ids.length > 0 ? ids.join(" ") : undefined
  }

  function update(patch: Partial<MetricRegistrationValues>) {
    for (const key of Object.keys(patch) as (keyof MetricRegistrationValues)[]) {
      form.setValue(key, patch[key] as never, { shouldDirty: true })
    }
  }

  async function onSave(values: MetricRegistrationValues) {
    if (mutation.isPending || !allValid) return
    mutation.reset()
    try {
      await mutation.mutateAsync(registrationPayload(values, weightUnit))
    } catch {
      return
    }
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Registrar medición</DialogTitle>
          <DialogDescription>
            Si la fecha es anterior a tu última medición de peso, el peso de tu
            perfil no cambia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSave)} className="flex flex-col gap-4">
          <Field label="Fecha" htmlFor="register-date" error={errors.date}>
            <Input
              id="register-date"
              type="date"
              min={shiftIsoDate(today, -REGISTRATION_PAST_DAYS)}
              max={today}
              value={draft.date ?? ""}
              onChange={(e) => update({ date: e.target.value })}
              aria-invalid={!!errors.date || undefined}
              aria-describedby={errors.date ? "register-date-error" : undefined}
            />
          </Field>

          {hasMetricOnDate && (
            <p role="status" className="text-sm text-muted-foreground">
              Ya tienes una medición del {formatDate(draft.date)}. Los valores
              que escribas sustituirán a los de ese día; los campos vacíos se
              conservan.
            </p>
          )}

          <Field
            label={`Peso (${weightUnit})`}
            htmlFor="register-weight"
            error={errors.weight}
          >
            <NumberField
              id="register-weight"
              value={draft.weight ?? ""}
              onChange={(weight) => update({ weight })}
              suffix={weightUnit}
              invalid={!!errors.weight}
              aria-describedby={describedBy("register-weight", errors.weight)}
            />
          </Field>

          <Field label="% Grasa corporal" htmlFor="register-fat" error={errors.fat}>
            <NumberField
              id="register-fat"
              value={draft.fat ?? ""}
              onChange={(fat) => update({ fat })}
              suffix="%"
              invalid={!!errors.fat}
              aria-describedby={describedBy("register-fat", errors.fat)}
            />
          </Field>

          <Field
            label="% Masa muscular"
            htmlFor="register-muscle"
            error={errors.muscle}
          >
            <NumberField
              id="register-muscle"
              value={draft.muscle ?? ""}
              onChange={(muscle) => update({ muscle })}
              suffix="%"
              invalid={!!errors.muscle}
              aria-describedby={describedBy("register-muscle", errors.muscle)}
            />
          </Field>

          {errors.values && (
            <p id="register-values-error" className="text-xs text-destructive">{errors.values}</p>
          )}

          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              No se pudo guardar la medición. Inténtalo de nuevo.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!allValid || mutation.isPending}>
              {mutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
