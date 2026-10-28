// API de la biblioteca de alimentos (spec 028): rutas, métodos, codificación del
// identificador y validación de las respuestas con zod. Toda llamada pasa por
// apiFetch (Art. P2 frontend 2), que aquí se sustituye; no hay red.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "@/lib/apiClient"
import {
  makeBananaFood,
  makeCustomLibraryFood,
  makeLibraryFood,
  makeRecentFood,
} from "@/test/foodLibraryFixtures"
import {
  deleteCustomFood,
  getFavoriteFoods,
  getRecentFoods,
  searchFoodLibrary,
  setFoodFavorite,
  updateCustomFood,
} from "./api"

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  apiFetch: vi.fn(),
}))

const apiFetchMock = vi.mocked(apiFetch)

function lastCall(): { path: string; method: string } {
  const [path, options] = apiFetchMock.mock.calls[apiFetchMock.mock.calls.length - 1]
  const method = (options as { method?: string } | undefined)?.method ?? "GET"
  return { path, method }
}

describe("searchFoodLibrary", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  // SDD: 028 REQ-007 AC-007.1
  it("pide GET /api/food-library/search con la consulta en `q`", async () => {
    apiFetchMock.mockResolvedValue({ results: [] })

    await searchFoodLibrary("arroz blanco")

    const { path, method } = lastCall()
    const url = new URL(path, "http://localhost")
    expect(url.pathname).toBe("/api/food-library/search")
    expect(url.searchParams.get("q")).toBe("arroz blanco")
    expect(method).toBe("GET")
  })

  // SDD: 028 REQ-007 AC-007.6
  it("codifica una consulta con signos que cambiarían la dirección", async () => {
    apiFetchMock.mockResolvedValue({ results: [] })

    await searchFoodLibrary("a&b=c#d")

    const url = new URL(lastCall().path, "http://localhost")
    expect(url.searchParams.get("q")).toBe("a&b=c#d")
    expect(Array.from(url.searchParams.keys())).toEqual(["q"])
  })

  // SDD: 028 REQ-007 AC-007.1
  it("devuelve la lista `results` del catálogo y propios, validada", async () => {
    const results = [makeLibraryFood(), makeCustomLibraryFood({ favorite: true })]
    apiFetchMock.mockResolvedValue({ results })

    expect(await searchFoodLibrary("po")).toEqual(results)
  })

  // SDD: 028 REQ-007 AC-007.1
  it("rechaza una respuesta con un `kind` desconocido", async () => {
    // Una respuesta valida pasa; la misma con otro `kind` se rechaza.
    apiFetchMock.mockResolvedValueOnce({ results: [makeLibraryFood()] })
    expect(await searchFoodLibrary("po")).toHaveLength(1)
    apiFetchMock.mockResolvedValueOnce({ results: [{ ...makeLibraryFood(), kind: "usda" }] })

    await expect(searchFoodLibrary("po")).rejects.toThrow()
  })

  // SDD: 028 REQ-007 AC-007.1
  it("rechaza un alimento propio con identificador de texto y uno del catálogo con identificador numérico", async () => {
    apiFetchMock.mockResolvedValueOnce({ results: [makeCustomLibraryFood(), makeLibraryFood()] })
    expect(await searchFoodLibrary("po")).toHaveLength(2)
    apiFetchMock.mockResolvedValueOnce({ results: [{ ...makeCustomLibraryFood(), id: "12" }] })
    apiFetchMock.mockResolvedValueOnce({ results: [{ ...makeLibraryFood(), id: 5 }] })

    await expect(searchFoodLibrary("po")).rejects.toThrow()
    await expect(searchFoodLibrary("po")).rejects.toThrow()
  })

  // SDD: 028 REQ-007 AC-007.4
  it("rechaza un alimento sin el campo `favorite` o con valores por 100 g incompletos", async () => {
    const { favorite: _favorite, ...withoutFavorite } = makeLibraryFood()
    apiFetchMock.mockResolvedValueOnce({ results: [makeLibraryFood()] })
    expect(await searchFoodLibrary("po")).toHaveLength(1)
    apiFetchMock.mockResolvedValueOnce({ results: [withoutFavorite] })
    apiFetchMock.mockResolvedValueOnce({
      results: [{ ...makeLibraryFood(), per_100g: { calories_kcal: 1 } }],
    })

    await expect(searchFoodLibrary("po")).rejects.toThrow()
    await expect(searchFoodLibrary("po")).rejects.toThrow()
  })

  // SDD: 028 REQ-007 AC-007.1
  it("rechaza una respuesta sin `results`", async () => {
    apiFetchMock.mockResolvedValueOnce({ results: [] })
    expect(await searchFoodLibrary("po")).toEqual([])
    apiFetchMock.mockResolvedValueOnce({})

    await expect(searchFoodLibrary("po")).rejects.toThrow()
  })

  // SDD: 028 REQ-007 AC-007.6
  it("deja pasar el error del servidor tal cual", async () => {
    const failure = new Error("boom")
    apiFetchMock.mockRejectedValue(failure)

    await expect(searchFoodLibrary("po")).rejects.toBe(failure)
  })
})

describe("getRecentFoods", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  // SDD: 028 REQ-008 AC-008.1
  it("pide GET /api/food-library/recent y devuelve los recientes con `last_grams`", async () => {
    const results = [
      makeRecentFood(makeBananaFood(), 150),
      makeRecentFood(makeCustomLibraryFood(), 200),
    ]
    apiFetchMock.mockResolvedValue({ results })

    const recents = await getRecentFoods()

    expect(lastCall()).toEqual({ path: "/api/food-library/recent", method: "GET" })
    expect(recents).toEqual(results)
  })

  // SDD: 028 REQ-008 AC-008.1
  it("rechaza un reciente sin `last_grams`", async () => {
    const valid = makeRecentFood(makeBananaFood(), 150)
    apiFetchMock.mockResolvedValueOnce({ results: [valid] })
    expect(await getRecentFoods()).toEqual([valid])
    apiFetchMock.mockResolvedValueOnce({ results: [makeBananaFood()] })

    await expect(getRecentFoods()).rejects.toThrow()
  })

  // SDD: 028 REQ-008 AC-008.6
  it("una respuesta vacía da una lista vacía", async () => {
    apiFetchMock.mockResolvedValue({ results: [] })

    expect(await getRecentFoods()).toEqual([])
  })
})

describe("getFavoriteFoods", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  // SDD: 028 REQ-010 AC-010.1
  it("pide GET /api/food-library/favorites y devuelve la lista", async () => {
    const results = [makeBananaFood({ favorite: true }), makeCustomLibraryFood({ favorite: true })]
    apiFetchMock.mockResolvedValue({ results })

    const favorites = await getFavoriteFoods()

    expect(lastCall()).toEqual({ path: "/api/food-library/favorites", method: "GET" })
    expect(favorites).toEqual(results)
  })

  // SDD: 028 REQ-010 AC-010.3
  it("rechaza una respuesta que no sea `{ results: [...] }`", async () => {
    apiFetchMock.mockResolvedValueOnce({ results: [] })
    expect(await getFavoriteFoods()).toEqual([])
    apiFetchMock.mockResolvedValueOnce([])

    await expect(getFavoriteFoods()).rejects.toThrow()
  })
})

describe("setFoodFavorite", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue(undefined)
  })

  // SDD: 028 REQ-009 AC-009.1
  it("marcar un alimento del catálogo pide PUT …/favorites/catalog/{id}", async () => {
    await setFoodFavorite({ kind: "catalog", id: "banano" }, true)

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(lastCall()).toEqual({
      path: "/api/food-library/favorites/catalog/banano",
      method: "PUT",
    })
  })

  // SDD: 028 REQ-009 AC-009.2
  it("quitar un alimento del catálogo pide DELETE …/favorites/catalog/{id}", async () => {
    await setFoodFavorite({ kind: "catalog", id: "banano" }, false)

    expect(lastCall()).toEqual({
      path: "/api/food-library/favorites/catalog/banano",
      method: "DELETE",
    })
  })

  // SDD: 028 REQ-009 AC-009.1
  it("un alimento propio usa …/favorites/custom/{id} con su identificador entero", async () => {
    await setFoodFavorite({ kind: "custom", id: 12 }, true)
    expect(lastCall()).toEqual({
      path: "/api/food-library/favorites/custom/12",
      method: "PUT",
    })

    await setFoodFavorite({ kind: "custom", id: 12 }, false)
    expect(lastCall()).toEqual({
      path: "/api/food-library/favorites/custom/12",
      method: "DELETE",
    })
  })

  // SDD: 028 REQ-009 AC-009.3
  it("codifica el identificador con encodeURIComponent", async () => {
    await setFoodFavorite({ kind: "catalog", id: "a b/c?d" }, true)

    expect(lastCall().path).toBe(
      `/api/food-library/favorites/catalog/${encodeURIComponent("a b/c?d")}`
    )
  })

  // SDD: 028 REQ-009 AC-009.1
  it("devuelve `undefined` (el servidor responde 204 sin cuerpo)", async () => {
    expect(await setFoodFavorite({ kind: "catalog", id: "banano" }, true)).toBeUndefined()
  })

  // SDD: 028 REQ-009 AC-009.4
  it("deja pasar el error del servidor tal cual", async () => {
    const failure = new Error("límite")
    apiFetchMock.mockRejectedValue(failure)

    await expect(setFoodFavorite({ kind: "catalog", id: "banano" }, true)).rejects.toBe(failure)
  })
})

describe("updateCustomFood", () => {
  const payload = {
    name: "Gallo pinto con huevo",
    per_100g: { calories_kcal: 200, protein_g: 9, carbs_g: 28, fat_g: 6 },
  }
  const edited = makeCustomLibraryFood({
    name: "Gallo pinto con huevo",
    per_100g: payload.per_100g,
    favorite: true,
  })

  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue(edited)
  })

  // SDD: 029 REQ-010 AC-010.1
  it("pide PATCH /api/food-library/custom/12 con el cuerpo y devuelve el alimento", async () => {
    const result = await updateCustomFood(12, payload)

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(lastCall()).toEqual({ path: "/api/food-library/custom/12", method: "PATCH" })
    const [, options] = apiFetchMock.mock.calls[0]
    expect((options as { body?: unknown }).body).toEqual(payload)
    expect(result).toEqual(edited)
  })

  // SDD: 029 REQ-010 AC-010.1
  it("rechaza una respuesta que no es un alimento propio", async () => {
    apiFetchMock.mockResolvedValueOnce(edited)
    await expect(updateCustomFood(12, payload)).resolves.toEqual(edited)

    apiFetchMock.mockResolvedValueOnce(makeBananaFood())
    await expect(updateCustomFood(12, payload)).rejects.toThrow()

    apiFetchMock.mockResolvedValueOnce({ id: 12, name: "Gallo pinto con huevo" })
    await expect(updateCustomFood(12, payload)).rejects.toThrow()

    apiFetchMock.mockResolvedValueOnce({ results: [edited] })
    await expect(updateCustomFood(12, payload)).rejects.toThrow()
  })

  // SDD: 029 REQ-010 AC-010.4
  it("deja pasar el error del servidor tal cual", async () => {
    const failure = new Error("404")
    apiFetchMock.mockRejectedValue(failure)

    await expect(updateCustomFood(12, payload)).rejects.toBe(failure)
  })
})

describe("deleteCustomFood", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue(undefined)
  })

  // SDD: 028 REQ-004 AC-004.1
  it("pide DELETE /api/food-library/custom/{id}", async () => {
    await deleteCustomFood(12)

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(lastCall()).toEqual({ path: "/api/food-library/custom/12", method: "DELETE" })
  })

  // SDD: 028 REQ-004 AC-004.2
  it("deja pasar el error del servidor tal cual", async () => {
    const failure = new Error("404")
    apiFetchMock.mockRejectedValue(failure)

    await expect(deleteCustomFood(12)).rejects.toBe(failure)
  })
})
