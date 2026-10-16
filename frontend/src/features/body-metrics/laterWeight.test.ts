// Tests de laterWeightMetric (spec 016): función pura, sin red ni DOM.
import { describe, expect, it } from "vitest"
import { laterWeightMetric } from "@/features/body-metrics/laterWeight"
import type { BodyMetric } from "@/features/body-metrics/types"

const TODAY = "2026-10-12"

function metric(overrides: Partial<BodyMetric> = {}): BodyMetric {
  return {
    id: "m1",
    weight: 80,
    body_fat_percentage: null,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at: "2026-10-11",
    ...overrides,
  }
}

describe("laterWeightMetric", () => {
  // SDD: 016 REQ-009 AC-009.1
  it("devuelve la medición con peso posterior a hoy", () => {
    const later = metric({ id: "later", recorded_at: "2026-10-13" })

    expect(laterWeightMetric([metric(), later], TODAY)).toBe(later)
  })

  // SDD: 016 REQ-009 AC-009.3
  it("ignora una posterior a hoy que no tiene peso", () => {
    const noWeight = metric({
      id: "later",
      weight: null,
      body_fat_percentage: 20,
      recorded_at: "2026-10-13",
    })

    expect(laterWeightMetric([metric(), noWeight], TODAY)).toBeNull()
  })

  // SDD: 016 REQ-009 AC-009.3
  it("no cuenta la medición de hoy ni las anteriores", () => {
    const list = [
      metric({ id: "today", recorded_at: TODAY }),
      metric({ id: "past", recorded_at: "2026-10-01" }),
    ]

    expect(laterWeightMetric(list, TODAY)).toBeNull()
  })

  // SDD: 016 REQ-009 AC-009.3
  it("devuelve null con una lista vacía", () => {
    expect(laterWeightMetric([], TODAY)).toBeNull()
  })

  // SDD: 016 REQ-009 AC-009.1
  it("con varias posteriores devuelve la de fecha mayor, sin importar el orden", () => {
    const near = metric({ id: "near", recorded_at: "2026-10-13" })
    const far = metric({ id: "far", recorded_at: "2026-10-15" })

    expect(laterWeightMetric([near, far], TODAY)).toBe(far)
    expect(laterWeightMetric([far, near], TODAY)).toBe(far)
  })
})
