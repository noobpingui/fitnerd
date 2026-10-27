import type { ReactElement } from "react"

export function NutrientProgress({
  label,
  percent,
  over = false,
}: {
  label: string
  percent: number
  over?: boolean
}): ReactElement {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-over={over ? "true" : undefined}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-primary"}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
