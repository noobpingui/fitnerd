// Test del gráfico "Evolución" (spec 009). Solo comprueba las leyendas, que
// están fuera del SVG; los valores de los puntos se cubren en insights.test.ts.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { BodyMetric } from "@/features/body-metrics/types"
import { TrendChart } from "./TrendChart"

// jsdom no trae ResizeObserver y Recharts lo necesita: fake escrito a mano.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function metric(recorded_at: string, weight: number, fat: number): BodyMetric {
  return {
    id: recorded_at,
    weight,
    body_fat_percentage: fat,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at,
  }
}

const METRICS = [
  metric("2026-10-05", 80, 21),
  metric("2026-10-08", 79, 20.5),
  metric("2026-10-11", 78.5, 20),
]

beforeAll(() => {
  globalThis.ResizeObserver =
    FakeResizeObserver as unknown as typeof globalThis.ResizeObserver
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 12, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("TrendChart", () => {
  // SDD: REQ-005 AC-005.6
  it("muestra la tendencia solo con el peso y la oculta con el % de grasa", async () => {
    const user = userEvent.setup()
    render(
      <TrendChart metrics={METRICS} weightUnit="kg" toDisplayWeight={(kg) => kg} />
    )

    expect(screen.getByText("Registro")).toBeInTheDocument()
    expect(screen.getByText("Tendencia (7 días)")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "% Grasa" }))

    expect(screen.queryByText("Tendencia (7 días)")).not.toBeInTheDocument()
  })
})
