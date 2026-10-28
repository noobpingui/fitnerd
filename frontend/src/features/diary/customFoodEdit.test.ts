// Lógica del formulario de edición de un alimento propio (spec 029): valores
// iniciales, cuerpo del PATCH y regla de «cambio» que habilita «Guardar».
import { describe, expect, it } from "vitest"
import { makeCustomLibraryFood } from "@/test/foodLibraryFixtures"
import {
  customFoodEditDefaults,
  customFoodEditPayload,
  isCustomFoodEditUnchanged,
} from "./customFoodEdit"
import type { CustomFoodEditValues } from "./schemas"

const GALLO = makeCustomLibraryFood() // «Gallo pinto»: 180 kcal, 6 g, 30 g y 4 g

const SAME: CustomFoodEditValues = {
  name: "Gallo pinto",
  calories: "180",
  protein: "6",
  carbs: "30",
  fat: "4",
}

describe("customFoodEditDefaults", () => {
  // SDD: 029 REQ-008 AC-008.1
  it("rellena los cinco campos con el nombre y los valores del alimento", () => {
    expect(customFoodEditDefaults(GALLO)).toEqual(SAME)
  })

  // SDD: 029 REQ-008 AC-008.1
  it("escribe los decimales con coma y sin ceros de más", () => {
    const food = makeCustomLibraryFood({
      per_100g: { calories_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.57 },
    })

    expect(customFoodEditDefaults(food)).toEqual({
      name: "Gallo pinto",
      calories: "165",
      protein: "31",
      carbs: "0",
      fat: "3,57",
    })
    expect(
      customFoodEditDefaults(
        makeCustomLibraryFood({ per_100g: { calories_kcal: 180, protein_g: 6.5, carbs_g: 30, fat_g: 4 } })
      ).protein
    ).toBe("6,5")
  })

  // SDD: 029 REQ-008 AC-008.1
  it("los valores iniciales no cuentan como cambio", () => {
    expect(isCustomFoodEditUnchanged(customFoodEditDefaults(GALLO), GALLO)).toBe(true)
  })
})

describe("customFoodEditPayload", () => {
  // SDD: 029 REQ-010 AC-010.1
  it("recorta el nombre y convierte los cuatro valores en números", () => {
    expect(
      customFoodEditPayload({
        name: " Gallo pinto con huevo ",
        calories: "200",
        protein: "9",
        carbs: "28",
        fat: "6",
      })
    ).toEqual({
      name: "Gallo pinto con huevo",
      per_100g: { calories_kcal: 200, protein_g: 9, carbs_g: 28, fat_g: 6 },
    })
  })

  // SDD: 029 REQ-010 AC-010.1
  it("admite coma o punto como separador decimal", () => {
    expect(
      customFoodEditPayload({ name: "Gallo", calories: "180,5", protein: "6.5", carbs: "30", fat: " 4,25 " })
        .per_100g
    ).toEqual({ calories_kcal: 180.5, protein_g: 6.5, carbs_g: 30, fat_g: 4.25 })
  })

  // SDD: 029 REQ-010 AC-010.1
  it("el cuerpo solo lleva `name` y `per_100g`", () => {
    expect(Object.keys(customFoodEditPayload(SAME)).sort()).toEqual(["name", "per_100g"])
  })
})

describe("isCustomFoodEditUnchanged", () => {
  // SDD: 029 REQ-008 AC-008.1
  it("los mismos valores no son un cambio", () => {
    expect(isCustomFoodEditUnchanged(SAME, GALLO)).toBe(true)
  })

  // SDD: 029 REQ-008 AC-008.2
  it.each([
    ["las calorías", { calories: "190" }],
    ["la proteína", { protein: "7" }],
    ["los carbohidratos", { carbs: "31" }],
    ["la grasa", { fat: "5" }],
  ])("cambiar %s es un cambio", (_name, change) => {
    expect(isCustomFoodEditUnchanged({ ...SAME, ...change }, GALLO)).toBe(false)
  })

  // SDD: 029 REQ-008 AC-008.2
  it("volver a dejar las calorías en 180 deja de ser un cambio", () => {
    expect(isCustomFoodEditUnchanged({ ...SAME, calories: "190" }, GALLO)).toBe(false)
    expect(isCustomFoodEditUnchanged({ ...SAME, calories: "180" }, GALLO)).toBe(true)
  })

  // SDD: 029 REQ-008 AC-008.3
  it("cambiar una mayúscula o una tilde del nombre es un cambio", () => {
    expect(isCustomFoodEditUnchanged({ ...SAME, name: "gallo pinto" }, GALLO)).toBe(false)
    expect(isCustomFoodEditUnchanged({ ...SAME, name: "Gállo pinto" }, GALLO)).toBe(false)
    expect(isCustomFoodEditUnchanged({ ...SAME, name: "Gallo pinto con huevo" }, GALLO)).toBe(false)
  })

  // SDD: 029 REQ-008 AC-008.4
  it("los espacios de los extremos del nombre no son un cambio", () => {
    expect(isCustomFoodEditUnchanged({ ...SAME, name: "  Gallo pinto  " }, GALLO)).toBe(true)
    expect(isCustomFoodEditUnchanged({ ...SAME, name: "Gallo pinto " }, GALLO)).toBe(true)
  })

  // SDD: 029 REQ-008 AC-008.4
  it.each(["6", "6,0", "6.0", " 6 ", "06"])("la proteína %j cuenta como 6", (protein) => {
    expect(isCustomFoodEditUnchanged({ ...SAME, protein }, GALLO)).toBe(true)
  })

  // SDD: 029 REQ-008 AC-008.4
  it("un decimal distinto sí es un cambio", () => {
    expect(isCustomFoodEditUnchanged({ ...SAME, protein: "6,1" }, GALLO)).toBe(false)
  })

  // SDD: 029 REQ-008 AC-008.5
  it.each(["", "   ", "abc", "-1", "12 g"])(
    "un campo no válido (%j) cuenta como cambio",
    (calories) => {
      expect(isCustomFoodEditUnchanged({ ...SAME, calories }, GALLO)).toBe(false)
    }
  )

  // SDD: 029 REQ-008 AC-008.5
  it("un nombre vacío cuenta como cambio", () => {
    expect(isCustomFoodEditUnchanged({ ...SAME, name: "   " }, GALLO)).toBe(false)
  })
})
