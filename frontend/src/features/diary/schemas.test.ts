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
  mealResponseSchema,
  parseDecimalText,
  type CustomFoodFormValues,
} from "./schemas"

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
