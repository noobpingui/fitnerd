// Lista de resultados del catálogo (spec 023): textos de cada alimento sin
// etiqueta de origen y botón «Elegir {nombre}» accesible.
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { makeCatalogFood } from "@/test/catalogFixtures"
import { CatalogResultList } from "./CatalogResultList"

const BANANA = makeCatalogFood({
  id: "banano",
  name: "Banano",
  per_100g: { calories_kcal: 89, protein_g: 1.09, carbs_g: 22.84, fat_g: 0.33 },
})

describe("CatalogResultList", () => {
  // SDD: 023 REQ-009 AC-009.2
  it("muestra el nombre y los cuatro valores por 100 g de la pechuga", () => {
    render(<CatalogResultList foods={[makeCatalogFood()]} onSelect={vi.fn()} />)

    expect(screen.getByText("Pechuga de pollo a la plancha")).toBeInTheDocument()
    expect(screen.getByText("165 kcal")).toBeInTheDocument()
    expect(screen.getByText("31,0 g proteína")).toBeInTheDocument()
    expect(screen.getByText("0,0 g carbohidratos")).toBeInTheDocument()
    expect(screen.getByText("3,6 g grasa")).toBeInTheDocument()
  })

  // SDD: 023 REQ-009 AC-009.2
  it("no muestra ninguna etiqueta de origen", () => {
    render(<CatalogResultList foods={[makeCatalogFood()]} onSelect={vi.fn()} />)

    const text = document.body.textContent ?? ""
    expect(text).not.toContain("Foundation")
    expect(text).not.toContain("SR Legacy")
    expect(text).not.toContain("USDA")
    expect(text).not.toContain("Personalizado")
  })

  // SDD: 023 REQ-009 AC-009.2
  it("formatea con coma decimal y un decimal", () => {
    render(<CatalogResultList foods={[BANANA]} onSelect={vi.fn()} />)

    expect(screen.getByText("89 kcal")).toBeInTheDocument()
    expect(screen.getByText("1,1 g proteína")).toBeInTheDocument()
    expect(screen.getByText("22,8 g carbohidratos")).toBeInTheDocument()
    expect(screen.getByText("0,3 g grasa")).toBeInTheDocument()
  })

  // SDD: 023 NFR-002 AC-N002.1
  it("es una lista «Resultados» con un elemento por alimento", () => {
    render(<CatalogResultList foods={[makeCatalogFood(), BANANA]} onSelect={vi.fn()} />)

    const list = screen.getByRole("list", { name: "Resultados" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)
  })

  // SDD: 023 NFR-002 AC-N002.1
  it("cada alimento tiene un botón «Elegir {nombre}»", () => {
    render(<CatalogResultList foods={[makeCatalogFood(), BANANA]} onSelect={vi.fn()} />)

    expect(
      screen.getByRole("button", { name: "Elegir Pechuga de pollo a la plancha" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Elegir Banano" })).toBeInTheDocument()
  })

  // SDD: 023 NFR-002 AC-N002.1
  it("al pulsar «Elegir» llama a `onSelect` con ese alimento", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CatalogResultList foods={[makeCatalogFood(), BANANA]} onSelect={onSelect} />)

    await user.click(screen.getByRole("button", { name: "Elegir Banano" }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(BANANA)
  })
})
