// Escaneo del código fuente del frontend (spec 013, limpieza de las features
// 006 a 010): reexportaciones, casts, funciones sin uso y ortografía de
// comentarios. Sigue el patrón de noRetiredSections.test.ts. Las cadenas
// buscadas se construyen por partes y este archivo se excluye del barrido para
// no encontrarse a sí mismo.
import { describe, expect, it } from "vitest"

const SELF = "/src/app/sourceCleanup013.test.ts"

const all = import.meta.glob("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

function source(path: string): string {
  const content = all[path]
  expect(content, `no existe ${path}`).toBeDefined()
  return content
}

const DATE_UTILS = "/src/features/body-metrics/dateUtils.ts"
const DATE_UTILS_TEST = "/src/features/body-metrics/dateUtils.test.ts"
const INSIGHTS_TEST = "/src/features/body-metrics/insights.test.ts"
const INSIGHTS_VIEW = "/src/features/body-metrics/insightsView.ts"
const INSIGHTS_VIEW_TEST = "/src/features/body-metrics/insightsView.test.ts"
const ANALYSIS_REQUEST = "/src/features/body-metrics/analysisRequest.ts"
const TREND_CHART = "/src/features/body-metrics/components/TrendChart.tsx"
const PROGRESS_ANALYSIS = "/src/features/body-metrics/components/ProgressAnalysis.tsx"
const BODY_METRICS_API = "/src/features/body-metrics/api.ts"
const PAGE_TEST = "/src/features/body-metrics/pages/BodyMetricsPage.test.tsx"
const CALCULATIONS = "/src/features/macros/calculations.ts"
const CALCULATIONS_TEST = "/src/features/macros/calculations.test.ts"

describe("limpieza de las features 006 a 010 (spec 013)", () => {
  // SDD: 013 NFR-002 AC-N002.1
  it("dateUtils.ts no reexporta parseLocalDate ni todayIsoDate", () => {
    const reexport = /export\s*\{[^}]*\b(parseLocalDate|todayIsoDate)\b/

    expect(reexport.test(source(DATE_UTILS))).toBe(false)
  })

  // SDD: 013 NFR-002 AC-N002.1
  it("ningún archivo importa parseLocalDate ni todayIsoDate de dateUtils", () => {
    const importedFromDateUtils =
      /import\s*(?:type\s*)?\{[^}]*\b(parseLocalDate|todayIsoDate)\b[^}]*\}\s*from\s*["'][^"']*dateUtils["']/

    const offenders = Object.entries(all)
      .filter(([file]) => file !== SELF)
      .filter(([, content]) => importedFromDateUtils.test(content))
      .map(([file]) => file)

    expect(Object.keys(all)).toContain(DATE_UTILS)
    expect(offenders).toEqual([])
  })

  // SDD: 013 NFR-002 AC-N002.2
  it("el suelo calórico de calculations.ts tiene tipo explícito", () => {
    expect(source(CALCULATIONS)).toContain("MIN_TARGET_KCAL: Record<")
  })

  // SDD: 013 NFR-002 AC-N002.3
  it("calculations.test.ts no usa casts a Record<string, string>", () => {
    expect(source(CALCULATIONS_TEST)).not.toContain("as " + "Record<string, string>")
  })

  // SDD: 013 NFR-002 AC-N002.4
  it("calculations.ts reutiliza la conversión de altura del onboarding", () => {
    const content = source(CALCULATIONS)

    expect(content).toContain("heightCmFromAnswers")
    expect(content).not.toContain("CM_PER" + "_IN")
    expect(content).not.toContain("* 12")
  })

  // SDD: 013 NFR-002 AC-N002.5
  it("no queda ninguna referencia a la función sin uso del periodo", () => {
    const retired = "isWithin" + "LastMonths"

    const offenders = Object.entries(all)
      .filter(([file]) => file !== SELF)
      .filter(([, content]) => content.includes(retired))
      .map(([file]) => file)

    expect(offenders).toEqual([])
  })

  // SDD: 013 NFR-002 AC-N002.5
  it("siguen existiendo los marcadores REQ-005 AC-005.1 de la spec 009", () => {
    const marker = new RegExp("// SDD: " + "REQ-005 AC-005\\.1")

    expect(marker.test(source(DATE_UTILS_TEST))).toBe(true)
    expect(marker.test(source(INSIGHTS_TEST))).toBe(true)
  })

  // SDD: 013 NFR-002 AC-N002.6
  it("el comentario de la tendencia está justo antes de const isWeight", () => {
    const lines = source(TREND_CHART).split(/\r?\n/)
    const start = lines.findIndex((line) =>
      line.includes("La tendencia solo tiene sentido en el peso")
    )
    expect(start).toBeGreaterThanOrEqual(0)

    let next = start
    while (lines[next + 1].trim().startsWith("//")) next++
    const following = lines[next + 1]

    expect(following).toContain("const isWeight")
    expect(following).not.toContain("const from")
  })

  // SDD: 013 NFR-002 AC-N002.7
  it("insightsView y su test no usan casts de tipo", () => {
    for (const file of [INSIGHTS_VIEW, INSIGHTS_VIEW_TEST]) {
      const content = source(file)
      expect(content, file).not.toContain("as " + "Insights")
      expect(content, file).not.toContain("as unknown " + "as")
    }
  })

  // SDD: 013 NFR-002 AC-N002.8
  it("analysisRequest.ts comprueba que el ritmo está disponible una sola vez", () => {
    const check = 'rate.kind === "ok"'
    const content = source(ANALYSIS_REQUEST)

    expect(content.split(check).length - 1).toBe(1)
  })

  // SDD: 013 NFR-002 AC-N002.10
  it("renderLoaded espera algo visible y no vacía microtareas", () => {
    const content = source(PAGE_TEST).replace(/\r\n/g, "\n")
    const start = content.indexOf("async function renderLoaded(")
    expect(start).toBeGreaterThanOrEqual(0)
    const body = content.slice(start, content.indexOf("\n}\n", start))

    expect(body).toContain("findByText")
    expect(body).not.toContain("Promise." + "resolve()")
    expect(body).not.toContain("for " + "(")
  })

  // SDD: 013 NFR-003 AC-N003.2
  it("ProgressAnalysis.tsx y api.ts no tienen las palabras sin tilde señaladas", () => {
    for (const file of [PROGRESS_ANALYSIS, BODY_METRICS_API]) {
      const content = source(file)
      expect(content, file).not.toMatch(/\btecnicos\b/)
      expect(content, file).not.toMatch(/\bse envia\b/)
    }
  })
})
