import { describe, expect, it } from "vitest"
import { homeGreeting } from "./greeting"

describe("homeGreeting (spec 033)", () => {
  // SDD: 033 REQ-009 AC-009.1
  it("saluda con el nombre y una coma", () => {
    expect(homeGreeting("Ana")).toBe("Hola de nuevo, Ana")
  })

  // SDD: 033 REQ-009 AC-009.1
  it("recorta los espacios de los extremos del nombre", () => {
    expect(homeGreeting("  Beatriz ")).toBe("Hola de nuevo, Beatriz")
  })

  // SDD: 033 REQ-009 AC-009.2
  it.each([null, undefined])("sin nombre (%s) saluda sin coma ni nombre", (value) => {
    expect(homeGreeting(value)).toBe("Hola de nuevo")
  })

  // SDD: 033 REQ-009 AC-009.3
  it("con un nombre de solo espacios saluda sin coma ni nombre", () => {
    expect(homeGreeting("   ")).toBe("Hola de nuevo")
  })
})
