// Funciones puras de la propuesta del análisis de una foto (spec 025):
// construcción, macros, total y carga útil de guardado.
import { beforeEach, describe, expect, it } from "vitest"
import { CHICKEN, RICE, TOMATO_SAUCE, makeAnalysis } from "@/test/analysisFixtures"
import { makeBananaFood, makeCustomLibraryFood, makeLibraryFood } from "@/test/foodLibraryFixtures"
import { formatPortionPreview } from "./format"
import {
  confidenceLabel,
  customEntry,
  entryNutrients,
  entryTag,
  formatProposalTotal,
  isSavable,
  libraryEntry,
  mergeProposalEntries,
  proposalFromAnalysis,
  proposalItems,
  proposalTotals,
  unlinkCustomFood,
  withEntryKey,
} from "./proposal"
import type { CustomItemPayload, ProposalEntry, ProposalFormEntry } from "./types"

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

describe("libraryEntry (catálogo) y customEntry", () => {
  // SDD: 025 REQ-009 AC-009.2
  // SDD: 028 REQ-020
  it("un alimento elegido del catálogo queda marcado como «user»", () => {
    const entry = libraryEntry(makeLibraryFood({ id: "aguacate", name: "Aguacate" }), "100")

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
  // SDD: 028 REQ-020
  it("un alimento elegido por el usuario lleva «Añadido por ti»", () => {
    expect(entryTag(libraryEntry(makeLibraryFood(), "100"))).toBe("Añadido por ti")
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
  // SDD: 028 REQ-020
  it("un alimento del catálogo repetido se envía dos veces", () => {
    const [rice] = fullProposal()
    const again = libraryEntry(
      makeLibraryFood({ id: "arroz-blanco-cocido", name: "Arroz blanco cocido" }),
      "100"
    )

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

// ---------------------------------------------------------------------------
// Spec 028: alimentos propios en la propuesta y totales siempre al día
// ---------------------------------------------------------------------------

const BANANO = makeBananaFood()
const GALLO_PROPIO = makeCustomLibraryFood()

function keyed(entry: ProposalEntry, key: string): ProposalFormEntry {
  return { ...entry, key }
}

describe("libraryEntry", () => {
  // SDD: 028 REQ-018 AC-018.5
  it("un alimento del catálogo entra como el de la 025: marcado como «user» y con los gramos dados", () => {
    expect(libraryEntry(BANANO, "150")).toEqual({
      kind: "catalog",
      catalogId: "banano",
      name: "Banano",
      per100g: BANANO.per_100g,
      grams: "150",
      tag: "user",
    })
  })

  // SDD: 028 REQ-018 AC-018.2
  it("un alimento propio entra como personalizado con su identificador, sus valores y los gramos dados", () => {
    expect(libraryEntry(GALLO_PROPIO, "200")).toEqual({
      kind: "custom",
      customFoodId: 12,
      name: "Gallo pinto",
      per100g: GALLO_PROPIO.per_100g,
      grams: "200",
    })
  })

  // SDD: 028 REQ-018 AC-018.2
  it("la etiqueta de un alimento propio es «Personalizado» y la del catálogo, «Añadido por ti»", () => {
    expect(entryTag(libraryEntry(GALLO_PROPIO, "200"))).toBe("Personalizado")
    expect(entryTag(libraryEntry(BANANO, "100"))).toBe("Añadido por ti")
  })

  // SDD: 028 REQ-019 AC-019.1
  it("los nutrientes salen de los valores por 100 g y los gramos", () => {
    const entry = libraryEntry(GALLO_PROPIO, "250")

    expect(preview(entry)).toBe("450 kcal · 15,0 g proteína · 75,0 g carbohidratos · 10,0 g grasa")
  })
})

describe("withEntryKey", () => {
  // SDD: 028 REQ-019 AC-019.3
  it("añade una clave de texto y conserva el resto de la entrada", () => {
    const entry = libraryEntry(BANANO, "100")

    const result = withEntryKey(entry)

    expect(typeof result.key).toBe("string")
    expect(result.key).not.toBe("")
    expect(result).toMatchObject(entry)
  })

  // SDD: 028 REQ-019 AC-019.3
  it("cada llamada da una clave distinta, también con la misma entrada", () => {
    const entry = libraryEntry(BANANO, "100")

    const keys = [withEntryKey(entry), withEntryKey(entry), withEntryKey(entry)].map((e) => e.key)

    expect(new Set(keys).size).toBe(3)
  })

  // SDD: 028 REQ-019 AC-019.3
  it("no modifica la entrada original", () => {
    const entry = libraryEntry(BANANO, "100")

    withEntryKey(entry)

    expect("key" in entry).toBe(false)
  })

  // SDD: 028 REQ-019 AC-019.2
  it("sirve también para una entrada sin coincidencia", () => {
    const [, , sauce] = fullProposal()

    expect(withEntryKey(sauce)).toMatchObject({ kind: "unmatched", name: "Salsa de tomate" })
  })
})

describe("mergeProposalEntries", () => {
  // Se crean antes de cada test (no al declarar el describe) para que un fallo
  // de `libraryEntry` sea el de ese test y no impida recolectar el archivo.
  let banano: ProposalFormEntry
  let gallo: ProposalFormEntry

  beforeEach(() => {
    banano = keyed(libraryEntry(BANANO, "100"), "k-banano")
    gallo = keyed(libraryEntry(GALLO_PROPIO, "200"), "k-gallo")
  })

  // SDD: 028 REQ-019 AC-019.1
  it("toma los gramos observados de la entrada con la misma clave", () => {
    const merged = mergeProposalEntries(
      [banano, gallo],
      [
        { key: "k-banano", grams: "200" },
        { key: "k-gallo", grams: "200" },
      ]
    )

    expect(merged.map((entry) => entry.grams)).toEqual(["200", "200"])
    expect(merged.map((entry) => entry.key)).toEqual(["k-banano", "k-gallo"])
  })

  // SDD: 028 REQ-019 AC-019.1
  it("conserva el nombre, los valores por 100 g y la clase de cada entrada", () => {
    const [merged] = mergeProposalEntries([banano], [{ key: "k-banano", grams: "200" }])

    expect(merged).toMatchObject({
      kind: "catalog",
      catalogId: "banano",
      name: "Banano",
      per100g: BANANO.per_100g,
      grams: "200",
    })
  })

  // SDD: 028 REQ-019 AC-019.1
  it("sin valores observados devuelve las entradas tal cual", () => {
    expect(mergeProposalEntries([banano, gallo], undefined)).toEqual([banano, gallo])
  })

  // SDD: 028 REQ-019 AC-019.2
  it("una entrada nueva que aún no está en lo observado conserva sus propios gramos", () => {
    const merged = mergeProposalEntries([banano, gallo], [{ key: "k-banano", grams: "250" }])

    expect(merged.map((entry) => entry.grams)).toEqual(["250", "200"])
  })

  // SDD: 028 REQ-019 AC-019.4
  it("empareja por clave y no por posición: tras quitar una entrada, lo observado obsoleto no se aplica a otra", () => {
    // Se quitó `banano`; lo observado todavía trae las dos filas con las posiciones antiguas.
    const merged = mergeProposalEntries(
      [gallo],
      [
        { key: "k-banano", grams: "999" },
        { key: "k-gallo", grams: "250" },
      ]
    )

    expect(merged).toHaveLength(1)
    expect(merged[0].grams).toBe("250")
  })

  // SDD: 028 REQ-019 AC-019.2
  it("una entrada sustituida (clave nueva) no recibe los gramos observados de la anterior", () => {
    const replaced = keyed(libraryEntry(GALLO_PROPIO, "180"), "k-nuevo")

    const merged = mergeProposalEntries([replaced], [{ key: "k-banano", grams: "100" }])

    expect(merged[0].grams).toBe("180")
  })

  // SDD: 028 REQ-019 AC-019.3
  it("lo observado en otro orden se empareja igual por su clave", () => {
    const merged = mergeProposalEntries(
      [banano, gallo],
      [
        { key: "k-gallo", grams: "300" },
        { key: "k-banano", grams: "120" },
      ]
    )

    expect(merged.map((entry) => entry.grams)).toEqual(["120", "300"])
  })

  // SDD: 028 REQ-019 AC-019.1
  it("un valor observado vacío o sin gramos no pisa los gramos de la entrada", () => {
    const merged = mergeProposalEntries(
      [banano, gallo],
      [undefined, { key: "k-gallo" }]
    )

    expect(merged.map((entry) => entry.grams)).toEqual(["100", "200"])
  })

  // SDD: 028 REQ-019 AC-019.1
  it("un texto vacío de gramos sí se respeta: es lo que el usuario está escribiendo", () => {
    const merged = mergeProposalEntries([banano], [{ key: "k-banano", grams: "" }])

    expect(merged[0].grams).toBe("")
  })

  // SDD: 028 REQ-019 AC-019.1
  it("no modifica las entradas de entrada", () => {
    mergeProposalEntries([banano], [{ key: "k-banano", grams: "500" }])

    expect(banano.grams).toBe("100")
  })

  // SDD: 028 REQ-019 AC-019.2
  it("deja las entradas sin coincidencia como estaban", () => {
    const [, , sauce] = fullProposal()
    const unmatched = keyed(sauce, "k-salsa")

    const merged = mergeProposalEntries([unmatched], [{ key: "k-salsa" }])

    expect(merged).toEqual([unmatched])
  })
})

describe("proposalItems con alimentos propios", () => {
  // SDD: 028 REQ-018 AC-018.4
  it("un alimento propio elegido se envía como custom_food_id y gramos", () => {
    expect(proposalItems([libraryEntry(GALLO_PROPIO, "250")])).toEqual([
      { custom_food_id: 12, grams: 250 },
    ])
  })

  // SDD: 028 REQ-018 AC-018.4
  it("el elegido (250 g) y el creado en la propuesta se envían cada uno a su manera, en orden", () => {
    const items = proposalItems([libraryEntry(GALLO_PROPIO, "250"), customEntry(GALLO)])

    expect(items).toEqual([
      { custom_food_id: 12, grams: 250 },
      { name: "Gallo pinto", grams: 200, per_100g: GALLO.per_100g },
    ])
  })

  // SDD: 028 REQ-018 AC-018.4
  it("un alimento propio solo lleva custom_food_id y gramos, sin nombre ni valores", () => {
    const [item] = proposalItems([libraryEntry(GALLO_PROPIO, "250")])

    expect(Object.keys(item).sort()).toEqual(["custom_food_id", "grams"])
  })

  // SDD: 028 REQ-018 AC-018.4
  it("los gramos con coma decimal se envían como número", () => {
    expect(proposalItems([libraryEntry(GALLO_PROPIO, "150,5")])).toEqual([
      { custom_food_id: 12, grams: 150.5 },
    ])
  })

  // SDD: 028 REQ-018 AC-018.5
  it("un reciente del catálogo se envía como catalog_id y gramos", () => {
    expect(proposalItems([libraryEntry(BANANO, "150")])).toEqual([
      { catalog_id: "banano", grams: 150 },
    ])
  })

  // SDD: 028 REQ-018 AC-018.4
  it("la clave interna de la entrada no llega a la carga útil", () => {
    const [item] = proposalItems([withEntryKey(libraryEntry(GALLO_PROPIO, "250"))])

    expect(JSON.stringify(item)).not.toContain("key")
  })
})

describe("unlinkCustomFood", () => {
  const PER_100G = GALLO_PROPIO.per_100g

  // SDD: 028 REQ-018 AC-018.7
  it("la fila del alimento borrado queda sin identificador ni clave, con nombre, valores y gramos", () => {
    const entry = withEntryKey(libraryEntry(GALLO_PROPIO, "250"))

    const unlinked = unlinkCustomFood(entry, 12)

    expect(unlinked).toEqual({ kind: "custom", name: "Gallo pinto", per100g: PER_100G, grams: "250" })
    expect(unlinked).not.toHaveProperty("customFoodId")
    expect(unlinked).not.toHaveProperty("key")
    expect(entryTag(unlinked as ProposalEntry)).toBe("Personalizado")
  })

  // SDD: 028 REQ-018 AC-018.7
  it("devuelve null para otro identificador, una fila del catálogo, una sin coincidencia o un personalizado creado en la propuesta", () => {
    const [rice, , unmatched] = fullProposal()

    expect(unlinkCustomFood(libraryEntry(GALLO_PROPIO, "250"), 99)).toBeNull()
    expect(unlinkCustomFood(rice, 12)).toBeNull()
    expect(unlinkCustomFood(unmatched, 12)).toBeNull()
    expect(unlinkCustomFood(customEntry(GALLO), 12)).toBeNull()
    // Contraste: la fila vinculada con ese identificador sí se desvincula.
    expect(unlinkCustomFood(libraryEntry(GALLO_PROPIO, "250"), 12)).not.toBeNull()
  })

  // SDD: 028 REQ-018 AC-018.7
  it("la fila desvinculada se envía con name, grams y per_100g, sin custom_food_id", () => {
    const unlinked = unlinkCustomFood(libraryEntry(GALLO_PROPIO, "250"), 12) as ProposalEntry

    const items = proposalItems([unlinked])

    expect(items).toEqual([{ name: "Gallo pinto", grams: 250, per_100g: PER_100G }])
    expect(Object.keys(items[0]).sort()).toEqual(["grams", "name", "per_100g"])
  })
})
