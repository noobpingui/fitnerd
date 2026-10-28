// Clave de nombre de los alimentos propios (spec 029, regla de nombres de la 028).
import { describe, expect, it } from "vitest"
import { customFoodNameKey } from "./names"

describe("customFoodNameKey", () => {
  // SDD: 029 REQ-009
  it("no distingue mayúsculas", () => {
    expect(customFoodNameKey("GALLO Pinto")).toBe(customFoodNameKey("gallo pinto"))
    expect(customFoodNameKey("gallo PINTO")).toBe("gallo pinto")
  })

  // SDD: 029 REQ-009
  it("no distingue tildes", () => {
    expect(customFoodNameKey("Arroz con pollo de mamá")).toBe(
      customFoodNameKey("Arroz con pollo de mama")
    )
    expect(customFoodNameKey("Ñoquis")).toBe(customFoodNameKey("Noquis"))
  })

  // SDD: 029 REQ-009
  it("quita los espacios de los extremos", () => {
    expect(customFoodNameKey("  Gallo pinto \t")).toBe("gallo pinto")
  })

  // SDD: 029 REQ-009
  it("cuenta los espacios repetidos como uno", () => {
    expect(customFoodNameKey("Gallo    pinto")).toBe("gallo pinto")
  })

  // SDD: 029 REQ-009
  it("«  ARROZ con   pollo de mama » es igual que «Arroz con pollo de mamá»", () => {
    expect(customFoodNameKey("  ARROZ con   pollo de mama ")).toBe(
      customFoodNameKey("Arroz con pollo de mamá")
    )
  })

  // SDD: 029 REQ-009
  it("dos nombres distintos dan claves distintas", () => {
    expect(customFoodNameKey("Gallo pinto")).not.toBe(customFoodNameKey("Gallo pinto con huevo"))
  })

  // SDD: 029 REQ-009
  it("un nombre vacío o solo de espacios da la clave vacía", () => {
    expect(customFoodNameKey("")).toBe("")
    expect(customFoodNameKey("   ")).toBe("")
  })
})
