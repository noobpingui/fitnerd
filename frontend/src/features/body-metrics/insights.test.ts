// Tests UNITARIOS puros de los indicadores de Métricas (spec 009): sin React
// ni red. Las funciones reciben "hoy" como argumento, así que no se falsea el
// reloj.
import { describe, expect, it } from "vitest"
import {
  composition,
  latestWithDelta,
  paceStatusFromPercent,
  ratePercent,
  rateIndicator,
  seriesOf,
  streak,
  trendChartData,
} from "./insights"
import type { BodyMetric } from "@/features/body-metrics/types"
import type { Goal } from "@/features/onboarding/types"

function m(
  recorded_at: string,
  weight: number | null,
  fat: number | null = null
): BodyMetric {
  return {
    id: recorded_at,
    weight,
    body_fat_percentage: fat,
    muscle_mass_percentage: null,
    notes: null,
    recorded_at,
  }
}

const TODAY = "2026-10-12"
const round1 = (n: number) => Math.round(n * 10) / 10

// Mediciones de AC-003.1: bajada constante de 0,5 kg por semana.
const WEEKLY = [
  m("2026-09-20", 80),
  m("2026-09-27", 79.5),
  m("2026-10-04", 79),
  m("2026-10-11", 78.5),
]

function rateOf(metrics: BodyMetric[], today = TODAY) {
  return rateIndicator(seriesOf(metrics, "weight"), today)
}

function expectRate(result: ReturnType<typeof rateIndicator>, kgPerWeek: number) {
  expect(result.kind).toBe("ok")
  if (result.kind === "ok") {
    expect(round1(result.kgPerWeek)).toBeCloseTo(kgPerWeek, 5)
  }
}

describe("latestWithDelta - peso", () => {
  // SDD: REQ-001 AC-001.1
  it("uses the most recent measurement 30 days or more before the latest as reference", () => {
    /** Referencia: la del 2026-09-10 (81), no la primera (82). */
    const result = latestWithDelta(
      seriesOf([m("2026-09-01", 82), m("2026-09-10", 81), m("2026-10-11", 78.5)], "weight")
    )

    expect(result?.value).toBe(78.5)
    expect(result?.delta).toBeCloseTo(-2.5, 5)
  })

  // SDD: REQ-001 AC-001.2
  it("accepts a reference exactly 30 days before the latest", () => {
    /** 2026-09-11 está a 30 días exactos de 2026-10-11. */
    const result = latestWithDelta(
      seriesOf([m("2026-09-11", 80), m("2026-10-11", 78.5)], "weight")
    )

    expect(result?.delta).toBeCloseTo(-1.5, 5)
  })

  // SDD: REQ-001 AC-001.3
  it("falls back to the first measurement when the history is shorter than 30 days", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-09-25", 80), m("2026-10-11", 78.5)], "weight")
    )

    expect(result?.delta).toBeCloseTo(-1.5, 5)
  })

  // SDD: REQ-001 AC-001.4
  it("has no delta with a single measurement", () => {
    const result = latestWithDelta(seriesOf([m("2026-10-11", 78.5)], "weight"))

    expect(result?.value).toBe(78.5)
    expect(result?.delta).toBeNull()
  })

  // SDD: REQ-001 AC-001.8
  it("returns a zero delta when the weight did not change", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-09-10", 80), m("2026-10-11", 80)], "weight")
    )

    expect(result?.delta).toBe(0)
  })

  // SDD: REQ-001 AC-001.9
  it("still computes the delta against the latest measurement when it is old", () => {
    const result = latestWithDelta(
      seriesOf(
        [m("2026-08-17", 80), m("2026-08-24", 79.5), m("2026-08-31", 79), m("2026-09-07", 78.5)],
        "weight"
      )
    )

    expect(result?.value).toBe(78.5)
    expect(result?.delta).toBeCloseTo(-1.5, 5)
  })
})

describe("latestWithDelta - % de grasa", () => {
  // SDD: REQ-002 AC-002.1
  it("computes a negative fat delta over 30 days", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-09-10", null, 22), m("2026-10-11", null, 20)], "body_fat_percentage")
    )

    expect(result?.value).toBe(20)
    expect(result?.delta).toBeCloseTo(-2, 5)
  })

  // SDD: REQ-002 AC-002.2
  it("computes a positive fat delta over 30 days", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-09-10", null, 18.5), m("2026-10-11", null, 20)], "body_fat_percentage")
    )

    expect(result?.delta).toBeCloseTo(1.5, 5)
  })

  // SDD: REQ-002 AC-002.3
  it("has no fat delta with a single measurement", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-10-11", 80, 20)], "body_fat_percentage")
    )

    expect(result?.value).toBe(20)
    expect(result?.delta).toBeNull()
  })
})

describe("rateIndicator", () => {
  // SDD: REQ-003 AC-003.1
  it("computes the weekly slope with least squares", () => {
    expectRate(rateOf(WEEKLY), -0.5)
  })

  // SDD: REQ-003 AC-003.1
  it("returns the latest weight in kg together with the rate", () => {
    const result = rateOf(WEEKLY)

    expect(result.kind).toBe("ok")
    if (result.kind === "ok") expect(result.latestKg).toBe(78.5)
  })

  // SDD: REQ-003 AC-003.3
  it("accepts three measurements that cover exactly 10 days", () => {
    expectRate(rateOf([m("2026-10-01", 80), m("2026-10-06", 79.5), m("2026-10-11", 79)]), -0.7)
  })

  // SDD: REQ-003 AC-003.4
  it("is insufficient when the three measurements cover only 9 days", () => {
    const result = rateOf([m("2026-10-02", 80), m("2026-10-06", 79.5), m("2026-10-11", 79)])

    expect(result.kind).toBe("insufficient")
  })

  // SDD: REQ-003 AC-003.5
  it("is insufficient with two measurements", () => {
    const result = rateOf([m("2026-09-20", 80), m("2026-10-11", 78.5)])

    expect(result.kind).toBe("insufficient")
  })

  // SDD: REQ-003 AC-003.6
  it("includes a measurement exactly 28 days before the latest in the window", () => {
    expectRate(rateOf([m("2026-09-13", 81.4), m("2026-09-27", 80), m("2026-10-11", 78.6)]), -0.7)
  })

  // SDD: REQ-003 AC-003.7
  it("excludes a measurement 29 days before the latest and becomes insufficient", () => {
    const result = rateOf([m("2026-09-12", 81.4), m("2026-09-27", 80), m("2026-10-11", 78.6)])

    expect(result.kind).toBe("insufficient")
  })

  // SDD: REQ-003 AC-003.8
  it("returns a zero rate when the weight is constant", () => {
    const result = rateOf([
      m("2026-09-20", 80),
      m("2026-09-27", 80),
      m("2026-10-04", 80),
      m("2026-10-11", 80),
    ])

    expect(result.kind).toBe("ok")
    if (result.kind === "ok") expect(result.kgPerWeek).toBeCloseTo(0, 5)
  })

  // SDD: REQ-003 AC-003.10
  it("is stale when the latest weight is more than 28 days before today", () => {
    const result = rateOf([
      m("2026-08-17", 80),
      m("2026-08-24", 79.5),
      m("2026-08-31", 79),
      m("2026-09-07", 78.5),
    ])

    expect(result.kind).toBe("stale")
  })

  // SDD: REQ-003 AC-003.11
  it("keeps a latest weight exactly 28 days before today as recent", () => {
    const result = rateOf([
      m("2026-08-24", 80),
      m("2026-08-31", 79.5),
      m("2026-09-07", 79),
      m("2026-09-14", 78.5),
    ])

    expectRate(result, -0.5)
  })

  // SDD: REQ-003 AC-003.12
  it("is stale when the latest weight is 29 days before today", () => {
    const result = rateOf([
      m("2026-08-23", 80),
      m("2026-08-30", 79.5),
      m("2026-09-06", 79),
      m("2026-09-13", 78.5),
    ])

    expect(result.kind).toBe("stale")
  })

  // SDD: REQ-003 AC-003.13
  it("reports stale before insufficient when there are few old measurements", () => {
    const result = rateOf([m("2026-08-20", 80), m("2026-09-07", 79)])

    expect(result.kind).toBe("stale")
  })
})

describe("ratePercent y paceStatusFromPercent", () => {
  const pctOf = () => ratePercent(-0.5, 78.5)

  // SDD: REQ-004 AC-004.1
  it("computes the rate as a percentage of the latest weight", () => {
    expect(pctOf()).toBeCloseTo(-0.637, 2)
  })

  // SDD: REQ-004 AC-004.1
  it("is on track for lose with -0,64 % per week", () => {
    expect(paceStatusFromPercent(pctOf(), "lose")).toBe("on_track")
  })

  // SDD: REQ-004 AC-004.2
  it("is too fast for lose_slow with -0,64 % per week", () => {
    expect(paceStatusFromPercent(pctOf(), "lose_slow")).toBe("too_fast")
  })

  // SDD: REQ-004 AC-004.3
  it("is too slow for gain with -0,64 % per week", () => {
    expect(paceStatusFromPercent(pctOf(), "gain")).toBe("too_slow")
  })

  // SDD: REQ-004 AC-004.4
  it("is off range for maintain with -0,64 % per week", () => {
    expect(paceStatusFromPercent(pctOf(), "maintain")).toBe("off_range")
  })

  // SDD: REQ-004 AC-004.5
  it("is on track for maintain with a zero rate", () => {
    expect(paceStatusFromPercent(0, "maintain")).toBe("on_track")
  })

  // SDD: REQ-004 AC-004.6
  it("is too slow below the range and too fast above it when losing", () => {
    expect(paceStatusFromPercent(-0.3, "lose")).toBe("too_slow")
    expect(paceStatusFromPercent(-1.2, "lose")).toBe("too_fast")
  })

  // SDD: REQ-004 AC-004.7
  it("is too slow when the direction is opposite to a losing goal", () => {
    expect(paceStatusFromPercent(0.3, "lose")).toBe("too_slow")
  })

  // SDD: REQ-004 AC-004.8
  it("is too fast above the range and too slow below it when gaining slowly", () => {
    expect(paceStatusFromPercent(0.3, "gain_slow")).toBe("too_fast")
    expect(paceStatusFromPercent(0.05, "gain_slow")).toBe("too_slow")
  })

  // SDD: REQ-004 AC-004.9
  it("includes both limits of the range for every goal", () => {
    const limits: Record<Goal, [number, number]> = {
      lose: [-1, -0.5],
      lose_slow: [-0.5, -0.25],
      maintain: [-0.2, 0.2],
      gain_slow: [0.1, 0.25],
      gain: [0.25, 0.5],
    }

    for (const goal of Object.keys(limits) as Goal[]) {
      const [low, high] = limits[goal]
      expect(paceStatusFromPercent(low, goal)).toBe("on_track")
      expect(paceStatusFromPercent(high, goal)).toBe("on_track")
    }
  })

  // SDD: REQ-004 AC-004.9
  it("treats a floating point limit such as -0,2 as inside the range", () => {
    /** -0,16 kg sobre 80 kg da -0,2 con error de coma flotante. */
    expect(paceStatusFromPercent(ratePercent(-0.16, 80), "maintain")).toBe("on_track")
    expect(paceStatusFromPercent(ratePercent(0.16, 80), "maintain")).toBe("on_track")
  })

  // SDD: REQ-004 AC-004.12
  it("is off range for maintain on both sides", () => {
    expect(paceStatusFromPercent(0.3, "maintain")).toBe("off_range")
    expect(paceStatusFromPercent(-0.3, "maintain")).toBe("off_range")
  })
})

describe("trendChartData", () => {
  const identity = (kg: number) => kg
  const toLb = (kg: number) => Math.round((kg / 0.45359237) * 10) / 10

  // SDD: REQ-005 AC-005.1
  it("averages measurements before the period start but only draws the period", () => {
    const data = trendChartData(
      [m("2026-09-08", 82), m("2026-09-10", 81), m("2026-09-13", 80)],
      "weight",
      "2026-09-12",
      identity
    )

    expect(data).toHaveLength(1)
    expect(data[0].date).toBe("2026-09-13")
    expect(data[0].trend).toBe(81)
  })

  // SDD: REQ-005 AC-005.2
  it("does not count a measurement 7 days earlier", () => {
    const data = trendChartData(
      [m("2026-09-06", 90), m("2026-09-13", 80)],
      "weight",
      "2026-09-01",
      identity
    )
    const point = data.find((p) => p.date === "2026-09-13")

    expect(point?.trend).toBe(80)
  })

  // SDD: REQ-005 AC-005.3
  it("rounds the 7-day average to one decimal", () => {
    const data = trendChartData(
      [m("2026-10-05", 80), m("2026-10-08", 79), m("2026-10-11", 78.5)],
      "weight",
      "2026-10-01",
      identity
    )

    expect(data.map((p) => p.trend)).toEqual([80, 79.5, 79.2])
  })

  // SDD: REQ-005 AC-005.4
  it("computes the average in kg and converts to the display unit at the end", () => {
    const data = trendChartData(
      [m("2026-10-08", 80), m("2026-10-11", 81)],
      "weight",
      "2026-10-01",
      toLb
    )
    const point = data.find((p) => p.date === "2026-10-11")

    expect(point?.trend).toBe(177.5)
  })

  // SDD: REQ-005 AC-005.5
  it("ignores measurements without weight", () => {
    const data = trendChartData(
      [m("2026-10-08", 80), m("2026-10-11", null, 20)],
      "weight",
      "2026-10-01",
      identity
    )

    expect(data).toHaveLength(1)
    expect(data[0].date).toBe("2026-10-08")
    expect(data[0].trend).toBe(80)
  })

  // SDD: REQ-005 AC-005.6
  it("has no trend for the fat percentage", () => {
    const data = trendChartData(
      [m("2026-10-08", 80, 21), m("2026-10-11", 79, 20)],
      "body_fat_percentage",
      "2026-10-01",
      identity
    )

    expect(data).toHaveLength(2)
    expect(data.every((p) => p.trend === undefined)).toBe(true)
    expect(data.map((p) => p.value)).toEqual([21, 20])
  })
})

describe("composition", () => {
  const FULL = m("2026-10-05", 80, 20)

  // El plan (§3.3) hace que `composition` acepte una altura ausente; el
  // andamiaje aún declara `number`, de ahí el cast.
  const compose = (metrics: BodyMetric[], heightCm: number | null) =>
    composition(metrics, heightCm as number)

  // SDD: REQ-006 AC-006.1
  it("computes fat mass, lean mass and FFMI from the latest weight and fat measurement", () => {
    const result = composition([FULL], 175)

    expect(result.fatKg).toBeCloseTo(16, 5)
    expect(result.leanKg).toBeCloseTo(64, 5)
    expect(round1(result.ffmi as number)).toBe(20.9)
    expect(result.date).toBe("2026-10-05")
  })

  // SDD: REQ-006 AC-006.2
  it("keeps the composition of the last measurement that has both values", () => {
    const result = composition([FULL, m("2026-10-11", 78.5)], 175)

    expect(result.fatKg).toBeCloseTo(16, 5)
    expect(result.leanKg).toBeCloseTo(64, 5)
    expect(round1(result.ffmi as number)).toBe(20.9)
    expect(result.date).toBe("2026-10-05")
  })

  // SDD: REQ-006 AC-006.4
  it("computes the FFMI with a height of 175,26 cm (5 ft 9 in)", () => {
    expect(round1(composition([FULL], 175.26).ffmi as number)).toBe(20.8)
  })

  // SDD: REQ-006 AC-006.5
  it("returns nulls when no measurement has a fat percentage", () => {
    const result = composition([m("2026-10-05", 80), m("2026-10-11", 79)], 175)

    expect(result.fatKg).toBeNull()
    expect(result.leanKg).toBeNull()
    expect(result.ffmi).toBeNull()
    expect(result.date).toBeNull()
  })

  // SDD: REQ-006 AC-006.6
  it("does not combine weight and fat from different measurements", () => {
    const result = composition([m("2026-10-11", null, 20), m("2026-10-05", 80)], 175)

    expect(result.fatKg).toBeNull()
    expect(result.leanKg).toBeNull()
    expect(result.ffmi).toBeNull()
  })

  // SDD: REQ-007 AC-007.1
  it("computes the BMI from the latest weight and the height", () => {
    const result = composition([m("2026-10-11", 78.5)], 175)

    expect(round1(result.bmi as number)).toBe(25.6)
  })

  // SDD: REQ-007 AC-007.2
  it("uses the latest weight for the BMI, not the weight of the composition", () => {
    const result = composition([FULL, m("2026-10-11", 78.5)], 175)

    expect(round1(result.bmi as number)).toBe(25.6)
  })

  // SDD: REQ-007 AC-007.3
  it("computes the BMI with a height of 5 ft 9 in", () => {
    const result = composition([m("2026-10-11", 80)], 175.26)

    expect(round1(result.bmi as number)).toBe(26)
  })

  // SDD: REQ-007 AC-007.4
  it("has no BMI without weights", () => {
    const result = composition([m("2026-10-11", null, 20)], 175)

    expect(result.bmi).toBeNull()
  })

  // SDD: REQ-010 AC-010.1
  it("returns null BMI and FFMI when the height is null, zero or not finite", () => {
    for (const height of [null, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = compose([FULL], height)

      expect(result.bmi).toBeNull()
      expect(result.ffmi).toBeNull()
    }
  })

  // SDD: REQ-010 AC-010.1
  it("still computes fat and lean mass when the height is not available", () => {
    const result = compose([FULL], null)

    expect(result.fatKg).toBeCloseTo(16, 5)
    expect(result.leanKg).toBeCloseTo(64, 5)
    expect(result.date).toBe("2026-10-05")
  })
})

describe("streak - semanas", () => {
  // SDD: REQ-008 AC-008.1
  it("counts consecutive weeks from the current one", () => {
    const metrics = [m("2026-10-12", 80), m("2026-10-05", 80), m("2026-09-28", 80)]

    expect(streak(metrics, TODAY).weeks).toBe(3)
  })

  // SDD: REQ-008 AC-008.2
  it("does not break the streak when the current week has no measurements yet", () => {
    const metrics = [m("2026-10-09", 80), m("2026-10-01", 80)]

    expect(streak(metrics, TODAY).weeks).toBe(2)
  })

  // SDD: REQ-008 AC-008.3
  it("stops counting at the first week without measurements", () => {
    const metrics = [m("2026-10-12", 80), m("2026-09-28", 80)]

    expect(streak(metrics, TODAY).weeks).toBe(1)
  })

  // SDD: REQ-008 AC-008.4
  it("is zero when neither the current nor the previous week have measurements", () => {
    expect(streak([m("2026-09-30", 80)], TODAY).weeks).toBe(0)
  })

  // SDD: REQ-008 AC-008.5
  it("treats Monday and Sunday of the same week as one week", () => {
    const metrics = [m("2026-10-12", 80), m("2026-10-05", 80)]

    expect(streak(metrics, "2026-10-18").weeks).toBe(2)
  })

  // SDD: REQ-008 AC-008.6
  it("counts several measurements in the same week once", () => {
    const metrics = [m("2026-10-06", 80), m("2026-10-08", 80), m("2026-10-11", 80)]

    expect(streak(metrics, TODAY).weeks).toBe(1)
  })
})

describe("streak - registros", () => {
  // SDD: REQ-009 AC-009.1
  it("counts measurements from 30 days before today, both ends included", () => {
    const metrics = [m("2026-09-11", 80), m("2026-09-12", 80), m("2026-10-12", 80)]
    const result = streak(metrics, TODAY)

    expect(result.last30).toBe(2)
    expect(result.total).toBe(3)
  })

  // SDD: REQ-009 AC-009.3
  it("returns zero in the last 30 days when all measurements are older", () => {
    const metrics = [m("2026-09-11", 80), m("2026-08-01", 80)]

    expect(streak(metrics, TODAY).last30).toBe(0)
  })

  // SDD: REQ-009 AC-009.4
  it("counts measurements with any value and returns the date of the latest", () => {
    const metrics = [m("2026-10-05", 80), m("2026-10-11", null, 20)]
    const result = streak(metrics, TODAY)

    expect(result.last30).toBe(2)
    expect(result.lastDate).toBe("2026-10-11")
  })
})
