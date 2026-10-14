// Tests UNITARIOS puros de los indicadores de Métricas (spec 009): sin React
// ni red. Las funciones reciben "hoy" como argumento, así que no se falsea el
// reloj.
import { describe, expect, it } from "vitest"
import {
  composition,
  isUnrealisticRate,
  latestWithDelta,
  median,
  rateWindow,
  suspiciousPoint,
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
  it("usa como referencia la medición más reciente con 30 días o más de antigüedad respecto a la última", () => {
    /** Referencia: la del 2026-09-10 (81), no la primera (82). */
    const result = latestWithDelta(
      seriesOf([m("2026-09-01", 82), m("2026-09-10", 81), m("2026-10-11", 78.5)], "weight")
    )

    expect(result?.value).toBe(78.5)
    expect(result?.delta).toBeCloseTo(-2.5, 5)
  })

  // SDD: REQ-001 AC-001.2
  it("acepta una referencia exactamente 30 días antes de la última", () => {
    /** 2026-09-11 está a 30 días exactos de 2026-10-11. */
    const result = latestWithDelta(
      seriesOf([m("2026-09-11", 80), m("2026-10-11", 78.5)], "weight")
    )

    expect(result?.delta).toBeCloseTo(-1.5, 5)
  })

  // SDD: REQ-001 AC-001.3
  it("usa la primera medición cuando el historial dura menos de 30 días", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-09-25", 80), m("2026-10-11", 78.5)], "weight")
    )

    expect(result?.delta).toBeCloseTo(-1.5, 5)
  })

  // SDD: REQ-001 AC-001.4
  it("no tiene variación con una sola medición", () => {
    const result = latestWithDelta(seriesOf([m("2026-10-11", 78.5)], "weight"))

    expect(result?.value).toBe(78.5)
    expect(result?.delta).toBeNull()
  })

  // SDD: REQ-001 AC-001.8
  it("devuelve variación cero cuando el peso no cambió", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-09-10", 80), m("2026-10-11", 80)], "weight")
    )

    expect(result?.delta).toBe(0)
  })

  // SDD: REQ-001 AC-001.9
  it("calcula la variación contra la última medición aunque sea antigua", () => {
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
  it("calcula una variación negativa de grasa en 30 días", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-09-10", null, 22), m("2026-10-11", null, 20)], "body_fat_percentage")
    )

    expect(result?.value).toBe(20)
    expect(result?.delta).toBeCloseTo(-2, 5)
  })

  // SDD: REQ-002 AC-002.2
  it("calcula una variación positiva de grasa en 30 días", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-09-10", null, 18.5), m("2026-10-11", null, 20)], "body_fat_percentage")
    )

    expect(result?.delta).toBeCloseTo(1.5, 5)
  })

  // SDD: REQ-002 AC-002.3
  it("no tiene variación de grasa con una sola medición", () => {
    const result = latestWithDelta(
      seriesOf([m("2026-10-11", 80, 20)], "body_fat_percentage")
    )

    expect(result?.value).toBe(20)
    expect(result?.delta).toBeNull()
  })
})

describe("rateIndicator", () => {
  // SDD: REQ-003 AC-003.1
  it("calcula la pendiente semanal con mínimos cuadrados", () => {
    expectRate(rateOf(WEEKLY), -0.5)
  })

  // SDD: REQ-003 AC-003.1
  it("devuelve el último peso en kg junto con el ritmo", () => {
    const result = rateOf(WEEKLY)

    expect(result.kind).toBe("ok")
    if (result.kind === "ok") expect(result.latestKg).toBe(78.5)
  })

  // SDD: REQ-003 AC-003.3
  it("acepta tres mediciones que cubren exactamente 10 días", () => {
    expectRate(rateOf([m("2026-10-01", 80), m("2026-10-06", 79.5), m("2026-10-11", 79)]), -0.7)
  })

  // SDD: REQ-003 AC-003.4
  it("es insuficiente cuando las tres mediciones cubren solo 9 días", () => {
    const result = rateOf([m("2026-10-02", 80), m("2026-10-06", 79.5), m("2026-10-11", 79)])

    expect(result.kind).toBe("insufficient")
  })

  // SDD: REQ-003 AC-003.5
  it("es insuficiente con dos mediciones", () => {
    const result = rateOf([m("2026-09-20", 80), m("2026-10-11", 78.5)])

    expect(result.kind).toBe("insufficient")
  })

  // SDD: REQ-003 AC-003.6
  it("incluye en la ventana una medición exactamente 28 días antes de la última", () => {
    expectRate(rateOf([m("2026-09-13", 81.4), m("2026-09-27", 80), m("2026-10-11", 78.6)]), -0.7)
  })

  // SDD: REQ-003 AC-003.7
  it("excluye una medición 29 días antes de la última y queda insuficiente", () => {
    const result = rateOf([m("2026-09-12", 81.4), m("2026-09-27", 80), m("2026-10-11", 78.6)])

    expect(result.kind).toBe("insufficient")
  })

  // SDD: REQ-003 AC-003.8
  it("devuelve ritmo cero cuando el peso es constante", () => {
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
  it("está desactualizado cuando el último peso es de hace más de 28 días respecto a hoy", () => {
    const result = rateOf([
      m("2026-08-17", 80),
      m("2026-08-24", 79.5),
      m("2026-08-31", 79),
      m("2026-09-07", 78.5),
    ])

    expect(result.kind).toBe("stale")
  })

  // SDD: REQ-003 AC-003.11
  it("considera reciente un último peso de exactamente 28 días antes de hoy", () => {
    const result = rateOf([
      m("2026-08-24", 80),
      m("2026-08-31", 79.5),
      m("2026-09-07", 79),
      m("2026-09-14", 78.5),
    ])

    expectRate(result, -0.5)
  })

  // SDD: REQ-003 AC-003.12
  it("está desactualizado cuando el último peso es de hace 29 días", () => {
    const result = rateOf([
      m("2026-08-23", 80),
      m("2026-08-30", 79.5),
      m("2026-09-06", 79),
      m("2026-09-13", 78.5),
    ])

    expect(result.kind).toBe("stale")
  })

  // SDD: REQ-003 AC-003.13
  it("informa desactualizado antes que insuficiente cuando hay pocas mediciones antiguas", () => {
    const result = rateOf([m("2026-08-20", 80), m("2026-09-07", 79)])

    expect(result.kind).toBe("stale")
  })
})

describe("ratePercent y paceStatusFromPercent", () => {
  const pctOf = () => ratePercent(-0.5, 78.5)

  // SDD: REQ-004 AC-004.1
  it("calcula el ritmo como porcentaje del último peso", () => {
    expect(pctOf()).toBeCloseTo(-0.637, 2)
  })

  // SDD: REQ-004 AC-004.1
  it("va según lo previsto para lose con -0,64 % por semana", () => {
    expect(paceStatusFromPercent(pctOf(), "lose")).toBe("on_track")
  })

  // SDD: REQ-004 AC-004.2
  it("es demasiado rápido para lose_slow con -0,64 % por semana", () => {
    expect(paceStatusFromPercent(pctOf(), "lose_slow")).toBe("too_fast")
  })

  // SDD: REQ-004 AC-004.3
  it("es demasiado lento para gain con -0,64 % por semana", () => {
    expect(paceStatusFromPercent(pctOf(), "gain")).toBe("too_slow")
  })

  // SDD: REQ-004 AC-004.4
  it("está fuera de rango para maintain con -0,64 % por semana", () => {
    expect(paceStatusFromPercent(pctOf(), "maintain")).toBe("off_range")
  })

  // SDD: REQ-004 AC-004.5
  it("va según lo previsto para maintain con ritmo cero", () => {
    expect(paceStatusFromPercent(0, "maintain")).toBe("on_track")
  })

  // SDD: REQ-004 AC-004.6
  it("es demasiado lento por debajo del rango y demasiado rápido por encima al perder", () => {
    expect(paceStatusFromPercent(-0.3, "lose")).toBe("too_slow")
    expect(paceStatusFromPercent(-1.2, "lose")).toBe("too_fast")
  })

  // SDD: REQ-004 AC-004.7
  it("es demasiado lento cuando la dirección es opuesta a una meta de perder", () => {
    expect(paceStatusFromPercent(0.3, "lose")).toBe("too_slow")
  })

  // SDD: REQ-004 AC-004.8
  it("es demasiado rápido por encima del rango y demasiado lento por debajo al ganar despacio", () => {
    expect(paceStatusFromPercent(0.3, "gain_slow")).toBe("too_fast")
    expect(paceStatusFromPercent(0.05, "gain_slow")).toBe("too_slow")
  })

  // SDD: REQ-004 AC-004.9
  it("incluye ambos límites del rango para cada meta", () => {
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
  it("trata un límite de coma flotante como -0,2 dentro del rango", () => {
    /** -0,16 kg sobre 80 kg da -0,2 con error de coma flotante. */
    expect(paceStatusFromPercent(ratePercent(-0.16, 80), "maintain")).toBe("on_track")
    expect(paceStatusFromPercent(ratePercent(0.16, 80), "maintain")).toBe("on_track")
  })

  // SDD: REQ-004 AC-004.12
  it("está fuera de rango para maintain por ambos lados", () => {
    expect(paceStatusFromPercent(0.3, "maintain")).toBe("off_range")
    expect(paceStatusFromPercent(-0.3, "maintain")).toBe("off_range")
  })
})

describe("trendChartData", () => {
  const identity = (kg: number) => kg
  const toLb = (kg: number) => Math.round((kg / 0.45359237) * 10) / 10

  // SDD: REQ-005 AC-005.1
  it("promedia mediciones anteriores al inicio del periodo pero solo dibuja el periodo", () => {
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
  it("no cuenta una medición de 7 días antes", () => {
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
  it("redondea el promedio de 7 días a un decimal", () => {
    const data = trendChartData(
      [m("2026-10-05", 80), m("2026-10-08", 79), m("2026-10-11", 78.5)],
      "weight",
      "2026-10-01",
      identity
    )

    expect(data.map((p) => p.trend)).toEqual([80, 79.5, 79.2])
  })

  // SDD: REQ-005 AC-005.4
  it("calcula el promedio en kg y convierte a la unidad de visualización al final", () => {
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
  it("ignora las mediciones sin peso", () => {
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
  it("no tiene tendencia para el porcentaje de grasa", () => {
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

  // `composition` acepta una altura ausente (plan §3.3).
  const compose = (metrics: BodyMetric[], heightCm: number | null) =>
    composition(metrics, heightCm)

  // SDD: REQ-006 AC-006.1
  it("calcula masa grasa, masa magra y FFMI con el último peso y la última grasa", () => {
    const result = composition([FULL], 175)

    expect(result.fatKg).toBeCloseTo(16, 5)
    expect(result.leanKg).toBeCloseTo(64, 5)
    expect(round1(result.ffmi as number)).toBe(20.9)
    expect(result.date).toBe("2026-10-05")
  })

  // SDD: REQ-006 AC-006.2
  it("conserva la composición de la última medición que tiene ambos valores", () => {
    const result = composition([FULL, m("2026-10-11", 78.5)], 175)

    expect(result.fatKg).toBeCloseTo(16, 5)
    expect(result.leanKg).toBeCloseTo(64, 5)
    expect(round1(result.ffmi as number)).toBe(20.9)
    expect(result.date).toBe("2026-10-05")
  })

  // SDD: REQ-006 AC-006.4
  it("calcula el FFMI con una altura de 175,26 cm (5 ft 9 in)", () => {
    expect(round1(composition([FULL], 175.26).ffmi as number)).toBe(20.8)
  })

  // SDD: REQ-006 AC-006.5
  it("devuelve nulos cuando ninguna medición tiene porcentaje de grasa", () => {
    const result = composition([m("2026-10-05", 80), m("2026-10-11", 79)], 175)

    expect(result.fatKg).toBeNull()
    expect(result.leanKg).toBeNull()
    expect(result.ffmi).toBeNull()
    expect(result.date).toBeNull()
  })

  // SDD: REQ-006 AC-006.6
  it("no combina peso y grasa de mediciones distintas", () => {
    const result = composition([m("2026-10-11", null, 20), m("2026-10-05", 80)], 175)

    expect(result.fatKg).toBeNull()
    expect(result.leanKg).toBeNull()
    expect(result.ffmi).toBeNull()
  })

  // SDD: REQ-007 AC-007.1
  it("calcula el IMC con el último peso y la altura", () => {
    const result = composition([m("2026-10-11", 78.5)], 175)

    expect(round1(result.bmi as number)).toBe(25.6)
  })

  // SDD: REQ-007 AC-007.2
  it("usa el último peso para el IMC, no el de la composición", () => {
    const result = composition([FULL, m("2026-10-11", 78.5)], 175)

    expect(round1(result.bmi as number)).toBe(25.6)
  })

  // SDD: REQ-007 AC-007.3
  it("calcula el IMC con una altura de 5 ft 9 in", () => {
    const result = composition([m("2026-10-11", 80)], 175.26)

    expect(round1(result.bmi as number)).toBe(26)
  })

  // SDD: REQ-007 AC-007.4
  it("no tiene IMC sin pesos", () => {
    const result = composition([m("2026-10-11", null, 20)], 175)

    expect(result.bmi).toBeNull()
  })

  // SDD: REQ-010 AC-010.1
  it("devuelve IMC y FFMI nulos cuando la altura es nula, cero o no finita", () => {
    for (const height of [null, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = compose([FULL], height)

      expect(result.bmi).toBeNull()
      expect(result.ffmi).toBeNull()
    }
  })

  // SDD: REQ-010 AC-010.1
  it("sigue calculando masa grasa y magra cuando no hay altura", () => {
    const result = compose([FULL], null)

    expect(result.fatKg).toBeCloseTo(16, 5)
    expect(result.leanKg).toBeCloseTo(64, 5)
    expect(result.date).toBe("2026-10-05")
  })
})

describe("streak - semanas", () => {
  // SDD: REQ-008 AC-008.1
  it("cuenta semanas consecutivas desde la actual", () => {
    const metrics = [m("2026-10-12", 80), m("2026-10-05", 80), m("2026-09-28", 80)]

    expect(streak(metrics, TODAY).weeks).toBe(3)
  })

  // SDD: REQ-008 AC-008.2
  it("no rompe la racha cuando la semana actual aún no tiene mediciones", () => {
    const metrics = [m("2026-10-09", 80), m("2026-10-01", 80)]

    expect(streak(metrics, TODAY).weeks).toBe(2)
  })

  // SDD: REQ-008 AC-008.3
  it("deja de contar en la primera semana sin mediciones", () => {
    const metrics = [m("2026-10-12", 80), m("2026-09-28", 80)]

    expect(streak(metrics, TODAY).weeks).toBe(1)
  })

  // SDD: REQ-008 AC-008.4
  it("es cero cuando ni la semana actual ni la anterior tienen mediciones", () => {
    expect(streak([m("2026-09-30", 80)], TODAY).weeks).toBe(0)
  })

  // SDD: REQ-008 AC-008.5
  it("trata el lunes y el domingo de la misma semana como una sola semana", () => {
    const metrics = [m("2026-10-12", 80), m("2026-10-05", 80)]

    expect(streak(metrics, "2026-10-18").weeks).toBe(2)
  })

  // SDD: REQ-008 AC-008.6
  it("cuenta una sola vez varias mediciones de la misma semana", () => {
    const metrics = [m("2026-10-06", 80), m("2026-10-08", 80), m("2026-10-11", 80)]

    expect(streak(metrics, TODAY).weeks).toBe(1)
  })
})

describe("streak - registros", () => {
  // SDD: REQ-009 AC-009.1
  it("cuenta las mediciones desde 30 días antes de hoy, con ambos extremos incluidos", () => {
    const metrics = [m("2026-09-11", 80), m("2026-09-12", 80), m("2026-10-12", 80)]
    const result = streak(metrics, TODAY)

    expect(result.last30).toBe(2)
    expect(result.total).toBe(3)
  })

  // SDD: REQ-009 AC-009.3
  it("devuelve cero en los últimos 30 días cuando todas las mediciones son anteriores", () => {
    const metrics = [m("2026-09-11", 80), m("2026-08-01", 80)]

    expect(streak(metrics, TODAY).last30).toBe(0)
  })

  // SDD: REQ-009 AC-009.4
  it("cuenta mediciones con cualquier valor y devuelve la fecha de la última", () => {
    const metrics = [m("2026-10-05", 80), m("2026-10-11", null, 20)]
    const result = streak(metrics, TODAY)

    expect(result.last30).toBe(2)
    expect(result.lastDate).toBe("2026-10-11")
  })
})

// --- Spec 011: ritmo poco realista y medición sospechosa ---

// Fixtures de la spec 011 (hoy = 2026-10-12).
const JUMP_UP = [m("2026-10-01", 80), m("2026-10-06", 80), m("2026-10-11", 98)]
const JUMP_DOWN = [m("2026-10-01", 98), m("2026-10-06", 80), m("2026-10-11", 80)]
const LIMIT = [m("2026-09-27", 96), m("2026-10-04", 98), m("2026-10-11", 100)]
const JUST_ABOVE = [m("2026-09-27", 96), m("2026-10-04", 98), m("2026-10-11", 100.2)]
const TIE = [
  m("2026-09-27", 80),
  m("2026-10-02", 80),
  m("2026-10-07", 98),
  m("2026-10-11", 98),
]

function unrealistic(metrics: BodyMetric[]) {
  const rate = rateOf(metrics)
  expect(rate.kind).toBe("ok")
  if (rate.kind !== "ok") return null
  return isUnrealisticRate(rate.kgPerWeek, rate.latestKg)
}

describe("ritmo poco realista (spec 011)", () => {
  // SDD: REQ-001 AC-001.1
  it("el salto de 80, 80 a 98 kg es un ritmo poco realista", () => {
    expect(unrealistic(JUMP_UP)).toBe(true)
  })

  // SDD: REQ-001 AC-001.2
  it("el salto de 98 a 80, 80 kg es un ritmo poco realista", () => {
    expect(unrealistic(JUMP_DOWN)).toBe(true)
  })

  // SDD: REQ-001 AC-001.3
  it("exactamente el 2 % por semana no es poco realista", () => {
    expect(unrealistic(LIMIT)).toBe(false)
    expect(isUnrealisticRate(1.6, 80)).toBe(false)
  })

  // SDD: REQ-001 AC-001.4
  it("justo por encima del 2 % por semana es poco realista", () => {
    expect(unrealistic(JUST_ABOVE)).toBe(true)
  })

  // SDD: REQ-001 AC-001.6
  it("un ritmo de -0,5 kg/sem no es poco realista", () => {
    expect(unrealistic(WEEKLY)).toBe(false)
  })
})

describe("median", () => {
  // SDD: REQ-009 AC-009.3
  it("con un número par de valores es la media de los dos centrales", () => {
    expect(median([80, 80, 98, 98])).toBe(89)
  })

  // SDD: REQ-009 AC-009.1
  it("con un número impar de valores es el central, sin importar el orden", () => {
    expect(median([80, 80, 98])).toBe(80)
    expect(median([98, 80, 80])).toBe(80)
  })
})

describe("rateWindow y suspiciousPoint", () => {
  const dateOf = (metrics: BodyMetric[]) =>
    suspiciousPoint(rateWindow(seriesOf(metrics, "weight")))?.date

  // SDD: REQ-009 AC-009.1
  it("en el salto hacia arriba señala la medición del 2026-10-11", () => {
    expect(dateOf(JUMP_UP)).toBe("2026-10-11")
  })

  // SDD: REQ-009 AC-009.2
  it("en el salto hacia abajo señala la medición del 2026-10-01", () => {
    expect(dateOf(JUMP_DOWN)).toBe("2026-10-01")
  })

  // SDD: REQ-009 AC-009.3
  it("en un empate señala la más reciente", () => {
    expect(dateOf(TIE)).toBe("2026-10-11")
  })

  // SDD: REQ-009 AC-009.4
  it("la ventana excluye las mediciones de hace más de 28 días", () => {
    const series = seriesOf([m("2026-09-01", 120), ...JUMP_UP], "weight")

    const window = rateWindow(series)

    expect(window.map((p) => p.date)).not.toContain("2026-09-01")
    expect(suspiciousPoint(window)?.date).toBe("2026-10-11")
  })

  // SDD: REQ-009 AC-009.4
  it("la ventana incluye la última medición de peso", () => {
    const window = rateWindow(seriesOf(JUMP_UP, "weight"))

    expect(window.map((p) => p.date)).toEqual([
      "2026-10-01",
      "2026-10-06",
      "2026-10-11",
    ])
  })

  // SDD: REQ-009 AC-009.1
  it("con una ventana vacía no hay medición sospechosa", () => {
    expect(suspiciousPoint([])).toBeNull()
  })
})
