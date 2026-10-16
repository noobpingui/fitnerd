import type { ReactElement } from "react"
import type { BodyMetric } from "@/features/body-metrics/types"
import type { WeightUnit } from "@/features/onboarding/types"

type RegisterMetricDialogProps = {
  metrics: BodyMetric[] // para el aviso de fecha con medición
  weightUnit: WeightUnit
  onClose: () => void // al cancelar o al guardar con éxito
}

export function RegisterMetricDialog(
  _props: RegisterMetricDialogProps
): ReactElement {
  throw new Error("not implemented")
}
