// Esquemas de los formularios del diario (spec 022): gramos y alimento
// personalizado, con los mismos mensajes que la API.
import { describe, expect, it } from "vitest"
import {
  CALORIES_RANGE_MESSAGE,
  CUSTOM_NAME_MAX_LENGTH,
  GRAMS_DECIMALS_MESSAGE,
  GRAMS_RANGE_MESSAGE,
  MACROS_RANGE_MESSAGE,
  MACROS_SUM_MESSAGE,
  NAME_REQUIRED_MESSAGE,
  PER_100G_REQUIRED_MESSAGE,
  customFoodFormSchema,
  customItemPayload,
  diaryResponseSchema,
  gramsFormSchema,
  mealPhotoAnalysisSchema,
  mealResponseSchema,
  parseDecimalText,
  proposalFormSchema,
  type CustomFoodFormValues,
} from "./schemas"
import type { ProposalEntry } from "./types"

const VALID_CUSTOM: CustomFoodFormValues = {
  name: "Gallo pinto",
  grams: "250",
  calories: "160",
  protein: "5,5",
  carbs: "27",
  fat: "3.2",
}

function gramsMessage(grams: string): string | undefined {
  const result = gramsFormSchema.safeParse({ grams })
  return result.success ? undefined : result.error.issues[0].message
}

// Mensajes de error por campo (el primero de cada campo).
function customIssues(overrides: Partial<CustomFoodFormValues>): Record<string, string> {
  const result = customFoodFormSchema.safeParse({ ...VALID_CUSTOM, ...overrides })
  if (result.success) return {}
  const messages: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0])
    if (!(field in messages)) messages[field] = issue.message
  }
  return messages
}

describe("mensajes de validación", () => {
  // SDD: 022 REQ-011 AC-011.5
  it("coinciden con los de la API cuando los esquemas rechazan un valor", () => {
    expect(gramsMessage("0")).toBe("Los gramos deben estar entre 1 y 2000.")
    expect(gramsMessage("1,25")).toBe("Los gramos admiten como mucho un decimal.")
    expect(customIssues({ name: "" }).name).toBe("Escribe el nombre del alimento.")
    expect(customIssues({ fat: "" }).fat).toBe(
      "Indica las calorías, proteína, carbohidratos y grasa por 100 g."
    )
    expect(customIssues({ calories: "901" }).calories).toBe(
      "Las calorías por 100 g deben estar entre 0 y 900."
    )
    expect(customIssues({ protein: "101" }).protein).toBe(
      "Los macros por 100 g deben estar entre 0 y 100 g."
    )
    expect(customIssues({ protein: "50", carbs: "50", fat: "1" }).macroSum).toBe(
      "La proteína, los carbohidratos y la grasa no pueden sumar más de 100 g por 100 g."
    )
    expect(customIssues({ name: "x".repeat(CUSTOM_NAME_MAX_LENGTH + 1) }).name).toBeDefined()
    expect(customIssues({ name: "x".repeat(CUSTOM_NAME_MAX_LENGTH) }).name).toBeUndefined()
  })
})

describe("parseDecimalText", () => {
  // SDD: 022 REQ-011 AC-011.5
  it.each([
    ["150", 150],
    ["150.5", 150.5],
    ["150,5", 150.5],
    ["  12  ", 12],
    ["0", 0],
  ])("acepta %j como %d (coma o punto)", (text, expected) => {
    expect(parseDecimalText(text)).toBe(expected)
  })

  // SDD: 022 REQ-011 AC-011.5
  it.each([["", "vacío"], ["   ", "espacios"], ["abc", "texto"], ["1,2,3", "dos comas"], ["-5", "negativo"], ["1e3", "notación"], ["12 g", "con unidad"]])(
    "devuelve null para %j (%s)",
    (text) => {
      expect(parseDecimalText(text)).toBeNull()
    }
  )
})

describe("gramsFormSchema", () => {
  // SDD: 022 REQ-011 AC-011.5
  it.each(["", "   ", "0", "0,5", "2001", "abc"])(
    "rechaza %j con el mensaje de rango",
    (grams) => {
      expect(gramsMessage(grams)).toBe(GRAMS_RANGE_MESSAGE)
    }
  )

  // SDD: 022 REQ-011 AC-011.5
  it.each(["150,25", "150.25", "1,05"])("rechaza %j con el mensaje de decimales", (grams) => {
    expect(gramsMessage(grams)).toBe(GRAMS_DECIMALS_MESSAGE)
  })

  // SDD: 022 REQ-011 AC-011.5
  it.each(["1", "2000", "150", "150,5", "150.5"])("acepta %j", (grams) => {
    expect(gramsFormSchema.safeParse({ grams }).success).toBe(true)
  })
})

describe("customFoodFormSchema", () => {
  // SDD: 022 REQ-012 AC-012.2
  it("acepta el gallo pinto de la spec", () => {
    expect(customFoodFormSchema.safeParse(VALID_CUSTOM).success).toBe(true)
  })

  // SDD: 022 REQ-012 AC-012.4
  it.each(["", "    "])("rechaza el nombre %j", (name) => {
    expect(customIssues({ name }).name).toBe(NAME_REQUIRED_MESSAGE)
  })

  // SDD: 022 REQ-012 AC-012.4
  it("rechaza unos gramos fuera de rango o con dos decimales", () => {
    expect(customIssues({ grams: "0" }).grams).toBe(GRAMS_RANGE_MESSAGE)
    expect(customIssues({ grams: "2001" }).grams).toBe(GRAMS_RANGE_MESSAGE)
    expect(customIssues({ grams: "10,25" }).grams).toBe(GRAMS_DECIMALS_MESSAGE)
  })

  // SDD: 022 REQ-012 AC-012.4
  it.each(["calories", "protein", "carbs", "fat"] as const)(
    "rechaza el valor por 100 g vacío de %s con el mensaje de obligatorio",
    (field) => {
      expect(customIssues({ [field]: "" })[field]).toBe(PER_100G_REQUIRED_MESSAGE)
    }
  )

  // SDD: 022 REQ-012 AC-012.4
  it("rechaza calorías fuera de 0 a 900 y acepta los límites", () => {
    expect(customIssues({ calories: "901" }).calories).toBe(CALORIES_RANGE_MESSAGE)
    expect(customIssues({ calories: "0" }).calories).toBeUndefined()
    expect(customIssues({ calories: "900" }).calories).toBeUndefined()
  })

  // SDD: 022 REQ-012 AC-012.4
  it.each(["protein", "carbs", "fat"] as const)(
    "rechaza %s por encima de 100 g",
    (field) => {
      expect(customIssues({ [field]: "101" })[field]).toBe(MACROS_RANGE_MESSAGE)
    }
  )

  // SDD: 022 REQ-012 AC-012.4
  it("rechaza una suma de macros mayor que 100 g con el error de suma", () => {
    const issues = customIssues({ protein: "50", carbs: "50", fat: "1" })

    expect(issues.macroSum).toBe(MACROS_SUM_MESSAGE)
  })

  // SDD: 022 REQ-012 AC-012.4
  it("acepta una suma de macros de exactamente 100 g (33,3 + 33,3 + 33,4)", () => {
    expect(customIssues({ protein: "33,3", carbs: "33,3", fat: "33,4" })).toEqual({})
  })
})

const NUTRIENTS = { calories_kcal: 195, protein_g: 4.05, carbs_g: 42.3, fat_g: 0.45 }

function mealBody(items: unknown[]) {
  return {
    id: 12,
    date: "2026-10-21",
    meal_type: "lunch",
    items,
    totals: NUTRIENTS,
    incomplete: [],
  }
}

// El esquema aún no declara `custom_food_id` hasta la implementación (T-123): se
// lee con un tipo abierto para que el test compile y falle por comportamiento.
function customFoodIdOf(data: { items: object[] } | undefined): unknown {
  return (data?.items[0] as { custom_food_id?: unknown } | undefined)?.custom_food_id
}

describe("mealResponseSchema", () => {
  const catalogItem = {
    id: 33,
    source: "catalog",
    catalog_id: "arroz-blanco-cocido",
    fdc_id: null,
    name: "Arroz blanco cocido",
    data_type: null,
    grams: 150,
    per_100g: { calories_kcal: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3 },
    nutrients: NUTRIENTS,
  }

  // SDD: 023 REQ-008 AC-008.1
  // SDD: 023 REQ-010 AC-010.1
  it("acepta un alimento del catálogo con su `catalog_id`", () => {
    const result = mealResponseSchema.safeParse(mealBody([catalogItem]))

    expect(result.success).toBe(true)
    expect(result.data?.items[0].source).toBe("catalog")
    expect(result.data?.items[0].catalog_id).toBe("arroz-blanco-cocido")
  })

  // SDD: 023 REQ-008 AC-008.1
  it("un alimento de USDA o personalizado con `catalog_id: null` lo conserva nulo", () => {
    const usda = { ...catalogItem, id: 31, source: "usda", catalog_id: null, fdc_id: 171477,
      data_type: "sr_legacy" }
    const custom = { ...catalogItem, id: 32, source: "custom", catalog_id: null }

    const result = mealResponseSchema.safeParse(mealBody([usda, custom]))

    expect(result.success).toBe(true)
    expect(result.data?.items.map((item) => item.catalog_id)).toEqual([null, null])
  })

  // SDD: 023 REQ-008 AC-008.1
  it("un alimento sin el campo `catalog_id` (respuesta anterior a la 023) queda con `catalog_id: null`", () => {
    const { catalog_id: _catalogId, ...withoutField } = catalogItem
    const usda = { ...withoutField, source: "usda", fdc_id: 171477, data_type: "sr_legacy" }

    const result = mealResponseSchema.safeParse(mealBody([usda]))

    expect(result.success).toBe(true)
    expect(result.data?.items[0].catalog_id).toBeNull()
  })

  // SDD: 023 REQ-008 AC-008.1
  it("sigue rechazando un origen desconocido", () => {
    expect(mealResponseSchema.safeParse(mealBody([catalogItem])).data?.items[0].source).toBe(
      "catalog"
    )
    const result = mealResponseSchema.safeParse(mealBody([{ ...catalogItem, source: "otro" }]))

    expect(result.success).toBe(false)
  })

  // SDD: 023 REQ-008 AC-008.1
  it("el diario completo acepta alimentos de los tres orígenes", () => {
    const usda = { ...catalogItem, id: 31, source: "usda", catalog_id: null, fdc_id: 171477,
      data_type: "foundation" }
    const body = { date: "2026-10-21", meals: [mealBody([catalogItem, usda])],
      totals: NUTRIENTS, incomplete: [] }

    expect(diaryResponseSchema.safeParse(body).success).toBe(true)
  })

  // SDD: 028 REQ-001 AC-001.9
  it("un personalizado vinculado a un alimento propio conserva su `custom_food_id`", () => {
    const custom = { ...catalogItem, id: 32, source: "custom", catalog_id: null, custom_food_id: 12 }

    const result = mealResponseSchema.safeParse(mealBody([custom]))

    expect(result.success).toBe(true)
    expect(customFoodIdOf(result.data)).toBe(12)
  })

  // SDD: 028 REQ-001 AC-001.9
  it("un alimento con `custom_food_id: null` lo conserva nulo", () => {
    const result = mealResponseSchema.safeParse(mealBody([{ ...catalogItem, custom_food_id: null }]))

    expect(result.success).toBe(true)
    expect(customFoodIdOf(result.data)).toBeNull()
  })

  // SDD: 028 REQ-004 AC-004.1
  it("un alimento sin el campo `custom_food_id` (respuesta anterior a la 028) queda con `custom_food_id: null`", () => {
    const result = mealResponseSchema.safeParse(mealBody([catalogItem]))

    expect(result.success).toBe(true)
    expect(customFoodIdOf(result.data)).toBeNull()
  })

  // SDD: 028 REQ-001 AC-001.9
  it("rechaza un `custom_food_id` que no es un número", () => {
    const custom = { ...catalogItem, source: "custom", catalog_id: null, custom_food_id: "12" }

    expect(mealResponseSchema.safeParse(mealBody([custom])).success).toBe(false)
  })
})

const ANALYSIS_BODY = {
  items: [
    {
      catalog_id: "arroz-blanco-cocido",
      name: "Arroz blanco cocido",
      grams: 150,
      confidence: "high",
      per_100g: { calories_kcal: 130, protein_g: 2.69, carbs_g: 28.17, fat_g: 0.28 },
      nutrients: { calories_kcal: 195, protein_g: 4.04, carbs_g: 42.26, fat_g: 0.42 },
    },
  ],
  unmatched: [{ name: "Salsa de tomate", grams: 30, confidence: "low" }],
  totals: { calories_kcal: 195, protein_g: 4.04, carbs_g: 42.26, fat_g: 0.42 },
}

describe("mealPhotoAnalysisSchema", () => {
  // SDD: 025 REQ-006 AC-006.1
  it("acepta la respuesta de POST /api/meals/analyze de la spec 024", () => {
    const result = mealPhotoAnalysisSchema.safeParse(ANALYSIS_BODY)

    expect(result.success).toBe(true)
    expect(result.data?.items[0].name).toBe("Arroz blanco cocido")
    expect(result.data?.unmatched[0].name).toBe("Salsa de tomate")
  })

  // SDD: 025 REQ-006 AC-006.1
  it("acepta una respuesta sin ningún alimento", () => {
    const empty = { ...ANALYSIS_BODY, items: [], unmatched: [] }

    expect(mealPhotoAnalysisSchema.safeParse(empty).success).toBe(true)
  })

  // SDD: 025 REQ-006 AC-006.2
  it("rechaza una confianza desconocida en un alimento del catálogo", () => {
    const body = {
      ...ANALYSIS_BODY,
      items: [{ ...ANALYSIS_BODY.items[0], confidence: "certain" }],
    }

    expect(mealPhotoAnalysisSchema.safeParse(body).success).toBe(false)
  })

  // SDD: 025 REQ-006 AC-006.2
  it("rechaza una confianza desconocida en un alimento sin coincidencia", () => {
    const body = {
      ...ANALYSIS_BODY,
      unmatched: [{ name: "Salsa de tomate", grams: 30, confidence: "muy alta" }],
    }

    expect(mealPhotoAnalysisSchema.safeParse(body).success).toBe(false)
  })

  // SDD: 025 REQ-006 AC-006.1
  it("rechaza una respuesta sin la lista items", () => {
    const { items: _items, ...withoutItems } = ANALYSIS_BODY

    expect(mealPhotoAnalysisSchema.safeParse(withoutItems).success).toBe(false)
  })
})

const RICE_ENTRY: ProposalEntry = {
  kind: "catalog",
  catalogId: "arroz-blanco-cocido",
  name: "Arroz blanco cocido",
  per100g: { calories_kcal: 130, protein_g: 2.69, carbs_g: 28.17, fat_g: 0.28 },
  grams: "150",
  tag: "high",
}
const SAUCE_ENTRY: ProposalEntry = {
  kind: "unmatched",
  name: "Salsa de tomate",
  grams: 30,
  confidence: "low",
}

// Mensajes de la propuesta por posición de la entrada (path entries.i.grams).
function proposalIssues(entries: ProposalEntry[]): Record<number, string> {
  const result = proposalFormSchema.safeParse({ entries })
  const messages: Record<number, string> = {}
  if (result.success) return messages
  for (const issue of result.error.issues) {
    const [root, index, field] = issue.path
    if (root === "entries" && field === "grams" && typeof index === "number") {
      if (!(index in messages)) messages[index] = issue.message
    }
  }
  return messages
}

describe("proposalFormSchema", () => {
  // SDD: 025 REQ-007 AC-007.3
  it.each([
    ["", GRAMS_RANGE_MESSAGE],
    ["0", GRAMS_RANGE_MESSAGE],
    ["2001", GRAMS_RANGE_MESSAGE],
    ["150,25", GRAMS_DECIMALS_MESSAGE],
  ])("rechaza los gramos %j con «%s» en entries.0.grams", (grams, message) => {
    expect(proposalIssues([{ ...RICE_ENTRY, grams } as ProposalEntry])).toEqual({ 0: message })
  })

  // SDD: 025 REQ-007 AC-007.2
  it.each(["1", "2000", "150", "150,5", "150.5"])("acepta los gramos %j", (grams) => {
    const result = proposalFormSchema.safeParse({
      entries: [{ ...RICE_ENTRY, grams }],
    })

    expect(result.success).toBe(true)
  })

  // SDD: 025 REQ-007 AC-007.3
  it("valida también los gramos de un alimento personalizado", () => {
    const custom: ProposalEntry = {
      kind: "custom",
      name: "Gallo pinto",
      per100g: { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
      grams: "0",
    }

    expect(proposalIssues([RICE_ENTRY, custom])).toEqual({ 1: GRAMS_RANGE_MESSAGE })
  })

  // SDD: 025 REQ-007 AC-007.3
  it("no valida los gramos de los alimentos sin coincidencia", () => {
    const result = proposalFormSchema.safeParse({ entries: [RICE_ENTRY, SAUCE_ENTRY] })

    expect(result.success).toBe(true)
  })

  // SDD: 025 REQ-007 AC-007.3
  it("señala solo la posición del alimento con gramos no válidos", () => {
    const issues = proposalIssues([
      RICE_ENTRY,
      SAUCE_ENTRY,
      { ...RICE_ENTRY, grams: "" } as ProposalEntry,
    ])

    expect(Object.keys(issues)).toEqual(["2"])
  })

  // SDD: 028 REQ-019 AC-019.3
  it("conserva la `key` de cada entrada al validar (si no, no se emparejarían los gramos)", () => {
    const result = proposalFormSchema.safeParse({
      entries: [
        { ...RICE_ENTRY, key: "k1" },
        { ...SAUCE_ENTRY, key: "k2" },
        {
          kind: "custom",
          name: "Gallo pinto",
          per100g: { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
          grams: "200",
          key: "k3",
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.data?.entries.map((entry) => (entry as { key?: string }).key)).toEqual([
      "k1",
      "k2",
      "k3",
    ])
  })

  // SDD: 028 REQ-018 AC-018.4
  it("conserva el `customFoodId` de un alimento propio al validar", () => {
    const result = proposalFormSchema.safeParse({
      entries: [
        {
          kind: "custom",
          customFoodId: 12,
          name: "Gallo pinto",
          per100g: { calories_kcal: 180, protein_g: 6, carbs_g: 30, fat_g: 4 },
          grams: "250",
          key: "k1",
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.data?.entries[0]).toMatchObject({ kind: "custom", customFoodId: 12 })
  })

  // SDD: 028 REQ-018 AC-018.2
  it("un personalizado creado en la propuesta, sin `customFoodId`, sigue siendo válido", () => {
    const result = proposalFormSchema.safeParse({
      entries: [
        {
          kind: "custom",
          name: "Gallo pinto",
          per100g: { calories_kcal: 180, protein_g: 6, carbs_g: 30, fat_g: 4 },
          grams: "200",
        },
      ],
    })

    expect(result.success).toBe(true)
    // Contraste (028): con `customFoodId` el esquema si lo conserva.
    const linked = proposalFormSchema.safeParse({
      entries: [
        {
          kind: "custom",
          customFoodId: 12,
          name: "Gallo pinto",
          per100g: { calories_kcal: 180, protein_g: 6, carbs_g: 30, fat_g: 4 },
          grams: "200",
        },
      ],
    })
    expect(linked.data?.entries[0]).toMatchObject({ customFoodId: 12 })
  })

  // SDD: 028 REQ-019 AC-019.1
  it("valida los gramos de una entrada con clave igual que sin ella", () => {
    expect(
      proposalIssues([{ ...RICE_ENTRY, grams: "0", key: "k1" } as ProposalEntry])
    ).toEqual({ 0: GRAMS_RANGE_MESSAGE })
    // Y la entrada valida con clave conserva la clave (028).
    const valid = proposalFormSchema.safeParse({ entries: [{ ...RICE_ENTRY, key: "k1" }] })
    expect(valid.data?.entries[0]).toMatchObject({ key: "k1" })
  })
})

describe("customItemPayload", () => {
  // SDD: 022 REQ-012 AC-012.2
  it("convierte el formulario en el alimento personalizado de la API", () => {
    expect(customItemPayload({ ...VALID_CUSTOM, name: "  Gallo pinto  " })).toEqual({
      name: "Gallo pinto",
      grams: 250,
      per_100g: { calories_kcal: 160, protein_g: 5.5, carbs_g: 27, fat_g: 3.2 },
    })
  })
})
