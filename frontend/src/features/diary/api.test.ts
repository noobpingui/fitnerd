// analyzeMealPhoto (spec 025): la subida pasa por apiFetch (Art. P2 frontend 2),
// que aquí se sustituye; no hay red.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "@/lib/apiClient"
import { RICE, TOMATO_SAUCE, makeAnalysis } from "@/test/analysisFixtures"
import { makeMeal } from "@/test/diaryFixtures"
import { analyzeMealPhoto, deleteMeal, removeMealItem, restoreMealItem } from "./api"

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  apiFetch: vi.fn(),
}))

const apiFetchMock = vi.mocked(apiFetch)

function jpeg(bytes = 2048): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" })
}

function lastRequest(): { path: string; options: { method?: string; body?: unknown } } {
  const [path, options] = apiFetchMock.mock.calls[0]
  return { path, options: options as { method?: string; body?: unknown } }
}

describe("analyzeMealPhoto", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue(makeAnalysis({ items: [RICE], unmatched: [TOMATO_SAUCE] }))
  })

  // SDD: 025 REQ-004 AC-004.1
  it("llama a POST /api/meals/analyze con un FormData", async () => {
    await analyzeMealPhoto(jpeg())

    const { path, options } = lastRequest()
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(path).toBe("/api/meals/analyze")
    expect(options.method).toBe("POST")
    expect(options.body).toBeInstanceOf(FormData)
  })

  // SDD: 025 REQ-004 AC-004.1
  it("el FormData lleva un único valor en `image`, que es la imagen JPEG", async () => {
    const image = jpeg(4096)

    await analyzeMealPhoto(image)

    const form = lastRequest().options.body as FormData
    expect(Array.from(form.keys())).toEqual(["image"])
    expect(form.getAll("image")).toHaveLength(1)
    const sent = form.get("image") as File
    expect(sent.type).toBe("image/jpeg")
    expect(sent.size).toBe(image.size)
    expect(sent.name).toBe("comida.jpg")
  })

  // SDD: 025 REQ-004 AC-004.4
  it("una imagen generada a partir de una foto HEIC se envía igual, como JPEG", async () => {
    await analyzeMealPhoto(jpeg())

    const sent = (lastRequest().options.body as FormData).get("image") as File
    expect(sent.type).toBe("image/jpeg")
  })

  // SDD: 025 REQ-006 AC-006.1
  it("devuelve la respuesta del análisis ya validada", async () => {
    const result = await analyzeMealPhoto(jpeg())

    expect(result.items[0].name).toBe("Arroz blanco cocido")
    expect(result.unmatched[0].name).toBe("Salsa de tomate")
  })

  // SDD: 025 REQ-006 AC-006.1
  it("rechaza una respuesta con una forma inesperada", async () => {
    apiFetchMock.mockResolvedValue({ items: "no es una lista" })

    await expect(analyzeMealPhoto(jpeg())).rejects.toBeDefined()
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("removeMealItem", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  // SDD: 026 REQ-007 AC-007.3
  it("llama a DELETE /api/meals/1/items/2?undo=1 y devuelve el token de restauración", async () => {
    apiFetchMock.mockResolvedValue({ restore_token: "payload.firma" })

    const token = await removeMealItem(1, 2)

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    const [path, options] = apiFetchMock.mock.calls[0]
    expect(path).toBe("/api/meals/1/items/2?undo=1")
    expect(options).toMatchObject({ method: "DELETE" })
    expect(token).toBe("payload.firma")
  })

  // SDD: 026 REQ-007 AC-007.3
  it.each([undefined, null, "", {}, { restore_token: "" }, { restore_token: 5 }])(
    "si la respuesta no trae un token válido (%j), devuelve null",
    async (response) => {
      apiFetchMock.mockResolvedValue(response)

      await expect(removeMealItem(1, 2)).resolves.toBeNull()
      expect(apiFetchMock).toHaveBeenCalledTimes(1)
      expect(apiFetchMock.mock.calls[0][0]).toBe("/api/meals/1/items/2?undo=1")
    }
  )

  // SDD: 026 REQ-007 AC-007.3
  it("si la petición falla, propaga el error", async () => {
    apiFetchMock.mockRejectedValue(new Error("boom"))

    await expect(removeMealItem(1, 2)).rejects.toThrow("boom")
    expect(apiFetchMock.mock.calls[0][0]).toBe("/api/meals/1/items/2?undo=1")
  })
})

describe("restoreMealItem", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  // SDD: 026 REQ-007 AC-007.3
  it("hace POST /api/meals/restore con { restore_token } y devuelve la comida validada", async () => {
    apiFetchMock.mockResolvedValue(makeMeal())

    const meal = await restoreMealItem("payload.firma")

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    const [path, options] = apiFetchMock.mock.calls[0]
    expect(path).toBe("/api/meals/restore")
    expect(options).toMatchObject({ method: "POST", body: { restore_token: "payload.firma" } })
    expect(meal.id).toBe(12)
    expect(meal.items).toHaveLength(1)
  })

  // SDD: 026 REQ-007 AC-007.3
  it("rechaza una respuesta con una forma inesperada", async () => {
    apiFetchMock.mockResolvedValue({ items: "no es una lista" })

    await expect(restoreMealItem("t.f")).rejects.toMatchObject({ name: "ZodError" })
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/meals/restore",
      expect.objectContaining({ method: "POST" }),
    )
  })
})

describe("deleteMeal", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue(undefined)
  })

  // SDD: 026 REQ-006 AC-006.3
  it("hace DELETE /api/meals/1", async () => {
    await deleteMeal(1)

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    const [path, options] = apiFetchMock.mock.calls[0]
    expect(path).toBe("/api/meals/1")
    expect(options).toMatchObject({ method: "DELETE" })
  })
})
