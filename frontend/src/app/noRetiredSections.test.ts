// Escaneo del código fuente del frontend (spec 012, NFR-001): no quedan
// referencias a los endpoints retirados ni al interruptor del catálogo. Los
// tests quedan fuera porque este mismo archivo nombra las cadenas buscadas.
import { describe, expect, it } from "vitest"

const sources = import.meta.glob(["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const FORBIDDEN = [
  "/api/body-regions",
  "/api/exercise-categories",
  "/api/exercises",
  "/api/favorites",
  "/api/weekly-plan",
  "CATALOG_ENABLED",
  "app/sections",
]

describe("código fuente del frontend", () => {
  // SDD: 012 NFR-001 AC-N001.1
  it("no referencia los endpoints retirados ni el interruptor del catálogo", () => {
    expect(Object.keys(sources)).toContain("/src/app/router.tsx")

    const offenders: string[] = []
    for (const [file, content] of Object.entries(sources)) {
      for (const text of FORBIDDEN) {
        if (content.includes(text)) offenders.push(`${file}: ${text}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
