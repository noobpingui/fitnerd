// Test del bloque "Ajuste de calorías sugerido" (spec 010, REQ-007): se pinta
// según el `kind` de la sugerencia que calcula el servidor. Sin red.
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CalorieSuggestionBlock } from "./CalorieSuggestionBlock"

type Suggestion = {
  kind: "adjust" | "floor_limited" | "at_floor" | "on_track"
  target_kcal: number
  suggested_kcal: number
  adjustment_kcal: number
  floor_kcal: number
}

const ESTIMATE =
  "Es una estimación basada en tu ritmo de las últimas 4 semanas y supone que sigues tu objetivo diario actual."

// El bloque se prueba por su texto visible completo (sin importar cómo se
// reparta en elementos).
function renderBlock(suggestion: Suggestion) {
  const { container } = render(<CalorieSuggestionBlock suggestion={suggestion} />)
  return (container.textContent ?? "").replace(/\s+/g, " ")
}

describe("CalorieSuggestionBlock", () => {
  // SDD: REQ-007 AC-007.1
  it("muestra el título, las cifras, el ajuste con signo y la estimación", () => {
    const text = renderBlock({
      kind: "adjust",
      target_kcal: 2200,
      suggested_kcal: 1750,
      adjustment_kcal: -450,
      floor_kcal: 1500,
    })

    expect(screen.getByText("Ajuste de calorías sugerido")).toBeInTheDocument()
    expect(text).toContain("2200 kcal → 1750 kcal al día")
    expect(text).toContain("(-450 kcal)")
    expect(text).toContain(ESTIMATE)
  })

  // SDD: REQ-007 AC-007.2
  it("un aumento se muestra con '+'", () => {
    const text = renderBlock({
      kind: "adjust",
      target_kcal: 2170,
      suggested_kcal: 2620,
      adjustment_kcal: 450,
      floor_kcal: 1500,
    })

    expect(text).toContain("2170 kcal → 2620 kcal al día")
    expect(text).toContain("(+450 kcal)")
    expect(text).toContain(ESTIMATE)
  })

  // SDD: REQ-007 AC-007.3
  it("limitado por el suelo muestra el aviso del mínimo", () => {
    const text = renderBlock({
      kind: "floor_limited",
      target_kcal: 1703,
      suggested_kcal: 1500,
      adjustment_kcal: -203,
      floor_kcal: 1500,
    })

    expect(text).toContain("1703 kcal → 1500 kcal al día")
    expect(text).toContain("(-203 kcal)")
    expect(text).toContain("No se sugiere bajar de 1500 kcal.")
    expect(text).toContain(ESTIMATE)
  })

  // SDD: REQ-007 AC-007.4
  it("con el objetivo ya en el mínimo no muestra flecha", () => {
    const text = renderBlock({
      kind: "at_floor",
      target_kcal: 1200,
      suggested_kcal: 1200,
      adjustment_kcal: 0,
      floor_kcal: 1200,
    })

    expect(text).toContain(
      "Tu objetivo ya está en el mínimo recomendado de 1200 kcal, así que no se sugiere bajarlo."
    )
    expect(text).not.toContain("→")
    expect(text).toContain(ESTIMATE)
  })

  // SDD: REQ-007 AC-007.5
  it("en ritmo indica que mantenga el objetivo", () => {
    const text = renderBlock({
      kind: "on_track",
      target_kcal: 2189,
      suggested_kcal: 2189,
      adjustment_kcal: 0,
      floor_kcal: 1500,
    })

    expect(text).toContain("Tu ritmo encaja con tu meta: mantén 2189 kcal al día.")
    expect(text).not.toContain("→")
    expect(text).toContain(ESTIMATE)
  })

  // SDD: REQ-007 AC-007.8
  it("las cifras siguen en kcal aunque el perfil use lb", () => {
    // El bloque no conoce la unidad de peso: solo recibe kcal del servidor.
    const text = renderBlock({
      kind: "adjust",
      target_kcal: 2200,
      suggested_kcal: 1750,
      adjustment_kcal: -450,
      floor_kcal: 1500,
    })

    expect(text).toContain("2200 kcal → 1750 kcal al día")
    expect(text).not.toMatch(/\blb\b/)
  })
})
