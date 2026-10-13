import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { NumberField } from "@/features/onboarding/components/NumberField"
import type { WeightUnit } from "@/features/onboarding/types"
import { useUpdateBodyMetric } from "@/features/body-metrics/hooks"
import {
  correctionPayload,
  makeMetricCorrectionSchema,
  weightDisplayOf,
  type MetricCorrectionValues,
} from "@/features/body-metrics/schemas"
import type { BodyMetric } from "@/features/body-metrics/types"

type MetricEditFormProps = {
  metric: BodyMetric
  weightUnit: WeightUnit
  onDone: () => void
  onCancel: () => void
}

export function MetricEditForm({
  metric,
  weightUnit,
  onDone,
  onCancel,
}: MetricEditFormProps) {
  const mutation = useUpdateBodyMetric()

  const defaultValues = useMemo<MetricCorrectionValues>(
    () => ({
      weight: weightDisplayOf(metric.weight, weightUnit),
      fat: metric.body_fat_percentage === null ? "" : String(metric.body_fat_percentage),
      muscle:
        metric.muscle_mass_percentage === null
          ? ""
          : String(metric.muscle_mass_percentage),
    }),
    // Los valores iniciales se fijan al abrir el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const schema = useMemo(
    () =>
      makeMetricCorrectionSchema(
        weightUnit,
        defaultValues.weight,
        metric.weight
      ),
    [weightUnit, defaultValues.weight, metric.weight]
  )

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<MetricCorrectionValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues,
  })
  const values = watch()
  const allEmpty =
    values.weight.trim() === "" &&
    values.fat.trim() === "" &&
    values.muscle.trim() === ""

  const id = metric.id
  const onValue = (field: keyof MetricCorrectionValues) => (value: string) =>
    setValue(field, value, { shouldValidate: true, shouldDirty: true })

  const onSubmit = handleSubmit(async (submitted) => {
    try {
      await mutation.mutateAsync({
        id: metric.id,
        payload: correctionPayload(submitted, weightUnit, metric),
      })
    } catch {
      return
    }
    onDone()
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 py-2">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`metric-weight-${id}`}>Peso ({weightUnit})</Label>
          <NumberField
            id={`metric-weight-${id}`}
            value={values.weight}
            onChange={onValue("weight")}
            suffix={weightUnit}
            invalid={!!errors.weight}
          />
          {errors.weight && (
            <p className="text-xs text-destructive">{errors.weight.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`metric-fat-${id}`}>% Grasa corporal</Label>
          <NumberField
            id={`metric-fat-${id}`}
            value={values.fat}
            onChange={onValue("fat")}
            suffix="%"
            invalid={!!errors.fat}
          />
          {errors.fat && (
            <p className="text-xs text-destructive">{errors.fat.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`metric-muscle-${id}`}>% Masa muscular</Label>
          <NumberField
            id={`metric-muscle-${id}`}
            value={values.muscle}
            onChange={onValue("muscle")}
            suffix="%"
            invalid={!!errors.muscle}
          />
          {errors.muscle && (
            <p className="text-xs text-destructive">{errors.muscle.message}</p>
          )}
        </div>
      </div>

      {allEmpty && (
        <p className="text-xs text-destructive">Registra al menos un valor</p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo guardar la medición. Inténtalo de nuevo.
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid || mutation.isPending}>
          {mutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  )
}
