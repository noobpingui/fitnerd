// Funciones puras de la propuesta del análisis de una foto (spec 025):
// construcción, macros, total y carga útil de guardado.
import { describe, expect, it } from "vitest"
import { CHICKEN, RICE, TOMATO_SAUCE, makeAnalysis } from "@/test/analysisFixtures"
import { makeCatalogFood } from "@/test/catalogFixtures"
import { formatPortionPreview } from "./format"
import {
  catalogEntry,
  confidenceLabel,
  customEntry,
  entryNutrients,
  entryTag,
  formatProposalTotal,
  isSavable,
  proposalFromAnalysis,
  proposalItems,
  proposalTotals,
} from "./proposal"
import type { CustomItemPayload, ProposalEntry } from "./types"

const GALLO: CustomItemPayload = {
  name: "Gallo pinto",
  grams: 200,
  per_100g: { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
}

function fullProposal(): ProposalEntry[] {
  return proposalFromAnalysis(makeAnalysis({ items: [RICE, CHICKEN], unmatched: [TOMATO_SAUCE] }))
}

function preview(entry: ProposalEntry): string {
  const nutrients = entryNutrients(entry)
  if (!nutrients) throw new Error("la entrada no tiene macros")
  return formatPortionPreview(nutrients)
}

describe("proposalFromAnalysis", () => {
  // SDD: 025 REQ-006 AC-006.1
  it("convierte los alimentos de items en su orden y después los de unmatched", () => {
    const entries = fullProposal()

    expect(entries).toEqual([
      {
        kind: "catalog",
        catalogId: "arroz-blanco-cocido",
        name: "Arroz blanco cocido",
        per100g: RICE.per_100g,
        grams: "150",
        tag: "high",
      },
      {
        kind: "catalog",
        catalogId: "pechuga-de-pollo-a-la-plancha",
        name: "Pechuga de pollo a la plancha",
        per100g: CHICKEN.per_100g,
        grams: "100",
        tag: "medium",
      },
      { kind: "unmatched", name: "Salsa de tomate", grams: 30, confidence: "low" },
    ])
  })

  // SDD: 025 REQ-006 AC-006.3
  it("una respuesta solo con unmatched da solo entradas sin coincidencia", () => {
    const entries = proposalFromAnalysis(makeAnalysis({ items: [], unmatched: [TOMATO_SAUCE] }))

    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe("unmatched")
  })
})

describe("catalogEntry y customEntry", () => {
  // SDD: 025 REQ-009 AC-009.2
  it("un alimento elegido del catálogo queda marcado como «user»", () => {
    const entry = catalogEntry(makeCatalogFood({ id: "aguacate", name: "Aguacate" }), "100")

    expect(entry).toMatchObject({
      kind: "catalog",
      catalogId: "aguacate",
      name: "Aguacate",
      grams: "100",
      tag: "user",
    })
  })

  // SDD: 025 REQ-010 AC-010.3
  it("un personalizado conserva nombre y macros por 100 g y guarda los gramos como texto", () => {
    expect(customEntry(GALLO)).toEqual({
      kind: "custom",
      name: "Gallo pinto",
      per100g: GALLO.per_100g,
      grams: "200",
    })
  })

  // SDD: 025 REQ-010 AC-010.3
  it("un personalizado con 150,5 g guarda los gramos con coma decimal", () => {
    expect(customEntry({ ...GALLO, grams: 150.5 })).toMatchObject({ grams: "150,5" })
  })
})

describe("isSavable", () => {
  // SDD: 025 REQ-011 AC-011.4
  it("son guardables las del catálogo y las personalizadas, no las sin coincidencia", () => {
    const [rice, , sauce] = fullProposal()

    expect(isSavable(rice)).toBe(true)
    expect(isSavable(customEntry(GALLO))).toBe(true)
    expect(isSavable(sauce)).toBe(false)
  })
})

describe("entryNutrients", () => {
  // SDD: 025 REQ-006 AC-006.1
  it("el arroz de 150 g muestra 195 kcal · 4,0 g proteína · 42,3 g carbohidratos · 0,4 g grasa", () => {
    const [rice] = fullProposal()

    expect(preview(rice)).toBe("195 kcal · 4,0 g proteína · 42,3 g carbohidratos · 0,4 g grasa")
  })

  // SDD: 025 REQ-007 AC-007.1
  it("con 200 g el arroz pasa a 260 kcal · 5,4 g proteína · 56,3 g carbohidratos · 0,6 g grasa", () => {
    const [rice] = fullProposal()

    expect(preview({ ...rice, grams: "200" } as ProposalEntry)).toBe(
      "260 kcal · 5,4 g proteína · 56,3 g carbohidratos · 0,6 g grasa"
    )
  })

  // SDD: 025 REQ-007 AC-007.1
  it("admite la coma decimal en los gramos", () => {
    const [rice] = fullProposal()

    expect(preview({ ...rice, grams: "100,0" } as ProposalEntry)).toBe(
      "130 kcal · 2,7 g proteína · 28,2 g carbohidratos · 0,3 g grasa"
    )
  })

  // SDD: 025 REQ-010 AC-010.3
  it("el gallo pinto personalizado de 200 g muestra 320 kcal · 11,0 g proteína · 54,0 g carbohidratos · 6,4 g grasa", () => {
    expect(preview(customEntry(GALLO))).toBe(
      "320 kcal · 11,0 g proteína · 54,0 g carbohidratos · 6,4 g grasa"
    )
  })

  // SDD: 025 REQ-006 AC-006.3
  it("una entrada sin coincidencia no tiene macros", () => {
    const [, , sauce] = fullProposal()

    expect(entryNutrients(sauce)).toBeNull()
  })
})

describe("proposalTotals y formatProposalTotal", () => {
  // SDD: 025 REQ-006 AC-006.4
  it("el total suma arroz y pollo y no cuenta la salsa sin coincidencia", () => {
    expect(formatProposalTotal(proposalTotals(fullProposal()))).toBe(
      "Total: 360 kcal · 35,0 g proteína · 42,3 g carbohidratos · 4,0 g grasa"
    )
  })

  // SDD: 025 REQ-008 AC-008.1
  it("al quitar la pechuga el total pasa a 195 kcal · 4,0 g proteína · 42,3 g carbohidratos · 0,4 g grasa", () => {
    const [rice, , sauce] = fullProposal()

    expect(formatProposalTotal(proposalTotals([rice, sauce]))).toBe(
      "Total: 195 kcal · 4,0 g proteína · 42,3 g carbohidratos · 0,4 g grasa"
    )
  })

  // SDD: 025 REQ-008 AC-008.2
  it("una propuesta vacía o solo con sin coincidencia suma cero", () => {
    const [, , sauce] = fullProposal()

    expect(proposalTotals([])).toEqual({
      calories_kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    })
    expect(proposalTotals([sauce]).calories_kcal).toBe(0)
  })

  // SDD: 025 REQ-010 AC-010.3
  it("el total incluye el personalizado que sustituye a un sin coincidencia", () => {
    const [rice] = fullProposal()

    expect(formatProposalTotal(proposalTotals([rice, customEntry(GALLO)]))).toBe(
      "Total: 515 kcal · 15,0 g proteína · 96,3 g carbohidratos · 6,8 g grasa"
    )
  })
})

describe("confidenceLabel y entryTag", () => {
  // SDD: 025 REQ-006 AC-006.2
  it.each([
    ["high", "Confianza alta"],
    ["medium", "Confianza media"],
    ["low", "Confianza baja"],
  ] as const)("la confianza %s se escribe «%s»", (confidence, label) => {
    expect(confidenceLabel(confidence)).toBe(label)
  })

  // SDD: 025 REQ-006 AC-006.2
  it("la etiqueta de un alimento del análisis es su confianza en texto", () => {
    const [rice, chicken] = fullProposal()

    expect(entryTag(rice)).toBe("Confianza alta")
    expect(entryTag(chicken)).toBe("Confianza media")
  })

  // SDD: 025 REQ-009 AC-009.2
  it("un alimento elegido por el usuario lleva «Añadido por ti»", () => {
    expect(entryTag(catalogEntry(makeCatalogFood(), "100"))).toBe("Añadido por ti")
  })

  // SDD: 025 REQ-010 AC-010.3
  it("un personalizado lleva «Personalizado»", () => {
    expect(entryTag(customEntry(GALLO))).toBe("Personalizado")
  })
})

describe("proposalItems", () => {
  // SDD: 025 REQ-011 AC-011.1
  it("devuelve los guardables en el orden de la propuesta y sin los sin coincidencia", () => {
    expect(proposalItems(fullProposal())).toEqual([
      { catalog_id: "arroz-blanco-cocido", grams: 150 },
      { catalog_id: "pechuga-de-pollo-a-la-plancha", grams: 100 },
    ])
  })

  // SDD: 025 REQ-007 AC-007.2
  it("«150,5» se envía como 150.5 gramos", () => {
    const [rice] = fullProposal()

    expect(proposalItems([{ ...rice, grams: "150,5" } as ProposalEntry])).toEqual([
      { catalog_id: "arroz-blanco-cocido", grams: 150.5 },
    ])
  })

  // SDD: 025 REQ-011 AC-011.2
  it("un personalizado se envía con nombre, gramos y per_100g, entre los demás y en su sitio", () => {
    const [rice, , sauce] = fullProposal()

    expect(proposalItems([rice, sauce, customEntry(GALLO)])).toEqual([
      { catalog_id: "arroz-blanco-cocido", grams: 150 },
      {
        name: "Gallo pinto",
        grams: 200,
        per_100g: { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
      },
    ])
  })

  // SDD: 025 REQ-009 AC-009.4
  it("un alimento del catálogo repetido se envía dos veces", () => {
    const [rice] = fullProposal()
    const again = catalogEntry(makeCatalogFood({ id: "arroz-blanco-cocido", name: "Arroz blanco cocido" }), "100")

    expect(proposalItems([rice, again])).toEqual([
      { catalog_id: "arroz-blanco-cocido", grams: 150 },
      { catalog_id: "arroz-blanco-cocido", grams: 100 },
    ])
  })

  // SDD: 025 NFR-001 AC-N001.1
  it("la carga útil solo lleva los campos del contrato, sin datos de la imagen", () => {
    const items = proposalItems([...fullProposal(), customEntry(GALLO)])

    expect(Object.keys(items[0]).sort()).toEqual(["catalog_id", "grams"])
    expect(Object.keys(items[2]).sort()).toEqual(["grams", "name", "per_100g"])
    expect(JSON.stringify(items)).not.toMatch(/image|blob|jpeg|data:/i)
  })
})
