// apiFetch con FormData (spec 025). Es la capa más baja: aquí, y solo aquí, se
// sustituye `fetch` (Art. P1 frontend 4).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "./apiClient"
import { clearToken, setToken } from "./authToken"

const fetchMock = vi.fn()

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  }
}

function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0]
  return { url: String(url), init: init as RequestInit }
}

function headersOf(init: RequestInit): Record<string, string> {
  return Object.fromEntries(
    Object.entries((init.headers ?? {}) as Record<string, string>).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  )
}

describe("apiFetch", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(okResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)
    setToken("token-de-prueba")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearToken()
  })

  // SDD: 025 REQ-004 AC-004.1
  it("con un FormData lo pasa tal cual como cuerpo", async () => {
    const form = new FormData()
    form.append("image", new Blob(["x"], { type: "image/jpeg" }), "comida.jpg")

    await apiFetch("/api/meals/analyze", { method: "POST", body: form })

    const { url, init } = lastCall()
    expect(url).toContain("/api/meals/analyze")
    expect(init.method).toBe("POST")
    expect(init.body).toBe(form)
  })

  // SDD: 025 REQ-004 AC-004.1
  it("con un FormData no envía Content-Type (lo fija el navegador con su boundary)", async () => {
    const form = new FormData()
    form.append("image", new Blob(["x"], { type: "image/jpeg" }), "comida.jpg")

    await apiFetch("/api/meals/analyze", { method: "POST", body: form })

    expect(headersOf(lastCall().init)).not.toHaveProperty("content-type")
  })

  // SDD: 025 REQ-004 AC-004.1
  it("con un FormData pasa el mismo FormData como body y conserva la cabecera Authorization", async () => {
    const form = new FormData()
    form.append("image", new Blob(["x"], { type: "image/jpeg" }), "comida.jpg")

    await apiFetch("/api/meals/analyze", { method: "POST", body: form })

    const { init } = lastCall()
    expect(init.body).toBe(form)
    expect(headersOf(init).authorization).toBe("Bearer token-de-prueba")
  })
})
