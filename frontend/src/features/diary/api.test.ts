// analyzeMealPhoto (spec 025): la subida pasa por apiFetch (Art. P2 frontend 2),
// que aquí se sustituye; no hay red.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "@/lib/apiClient"
import { RICE, TOMATO_SAUCE, makeAnalysis } from "@/test/analysisFixtures"
import { analyzeMealPhoto } from "./api"

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
