// Test UNITARIO puro de isTestConsoleNoise (spec 013, NFR-005): decide qué
// avisos de la consola se quitan de la salida de `npm test`. Solo debe
// reconocer los dos avisos conocidos.
import { describe, expect, it } from "vitest"
import { isTestConsoleNoise } from "@/lib/testConsoleNoise"

const GOOGLE_WARNING =
  "VITE_GOOGLE_CLIENT_ID no esta configurado - el boton de Google no se va a mostrar."
const RECHARTS_WARNING =
  "The width(0) and height(0) of chart should be greater than 0,\n       please check the style of container, or the props width(100%) and height(100%),\n       or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the\n       height and width."

describe("isTestConsoleNoise", () => {
  // SDD: 013 NFR-005 AC-N005.1
  it("reconoce el aviso de VITE_GOOGLE_CLIENT_ID sin configurar", () => {
    expect(isTestConsoleNoise(GOOGLE_WARNING)).toBe(true)
  })

  // SDD: 013 NFR-005 AC-N005.2
  it("reconoce el aviso de Recharts por un gráfico de tamaño 0", () => {
    expect(isTestConsoleNoise(RECHARTS_WARNING)).toBe(true)
    expect(
      isTestConsoleNoise(
        "The width(0) and height(0) of chart should be greater than 0"
      )
    ).toBe(true)
  })

  // SDD: 013 NFR-005 AC-N005.2
  it("no oculta ningún otro aviso", () => {
    expect(isTestConsoleNoise("Warning: algo distinto")).toBe(false)
    expect(isTestConsoleNoise("")).toBe(false)
    expect(
      isTestConsoleNoise("The width(200) and height(100) of chart are fine")
    ).toBe(false)
  })
})
