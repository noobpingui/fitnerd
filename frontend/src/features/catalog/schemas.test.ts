// Esquema de la respuesta de GET /api/catalog/search (spec 023).
import { describe, expect, it } from "vitest"
import { catalogSearchResponseSchema } from "./schemas"

const RESPONSE = {
  results: [
    {
      id: "pechuga-de-pollo-a-la-plancha",
      name: "Pechuga de pollo a la plancha",
      per_100g: { calories_kcal: 165.0, protein_g: 31.0, carbs_g: 0.0, fat_g: 3.57 },
    },
  ],
}

// Contraparte de cada rechazo: la respuesta válida se acepta, así que el
// esquema rechaza por la forma del cuerpo y no por rechazar todo.
function expectValidBodyAccepted() {
  expect(catalogSearchResponseSchema.safeParse(RESPONSE).success).toBe(true)
}

describe("catalogSearchResponseSchema", () => {
  // SDD: 023 REQ-009 AC-009.2
  it("acepta la respuesta de la spec", () => {
    const result = catalogSearchResponseSchema.safeParse(RESPONSE)

    expect(result.success).toBe(true)
    expect(result.data).toEqual(RESPONSE)
  })

  // SDD: 023 REQ-009 AC-009.2
  it("acepta una lista de resultados vacía", () => {
    expect(catalogSearchResponseSchema.safeParse({ results: [] }).success).toBe(true)
  })

  // SDD: 023 REQ-009 AC-009.2
  it.each(["calories_kcal", "protein_g", "carbs_g", "fat_g"])(
    "rechaza un valor %s nulo, porque el catálogo siempre tiene los cuatro valores",
    (key) => {
      expectValidBodyAccepted()
      const body = {
        results: [
          { ...RESPONSE.results[0], per_100g: { ...RESPONSE.results[0].per_100g, [key]: null } },
        ],
      }

      expect(catalogSearchResponseSchema.safeParse(body).success).toBe(false)
    }
  )

  // SDD: 023 REQ-009 AC-009.2
  it("rechaza un valor ausente por 100 g", () => {
    expectValidBodyAccepted()
    const body = {
      results: [
        {
          ...RESPONSE.results[0],
          per_100g: { calories_kcal: 165, protein_g: 31, carbs_g: 0 },
        },
      ],
    }

    expect(catalogSearchResponseSchema.safeParse(body).success).toBe(false)
  })

  // SDD: 023 REQ-009 AC-009.2
  it("rechaza un resultado sin identificador o con el nombre nulo", () => {
    expectValidBodyAccepted()
    const { id: _id, ...withoutId } = RESPONSE.results[0]

    expect(catalogSearchResponseSchema.safeParse({ results: [withoutId] }).success).toBe(false)
    expect(
      catalogSearchResponseSchema.safeParse({ results: [{ ...RESPONSE.results[0], name: null }] })
        .success
    ).toBe(false)
  })

  // SDD: 023 REQ-009 AC-009.2
  it.each([null, undefined, {}, { results: null }, { results: "pollo" }, []])(
    "rechaza la respuesta %j",
    (body) => {
      expectValidBodyAccepted()
      expect(catalogSearchResponseSchema.safeParse(body).success).toBe(false)
    }
  )
})
