import { getToken } from "@/lib/authToken"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Forma en la que SIEMPRE responde el backend cuando algo sale mal
// (ver exceptions/error_handlers.py): { "error": "mensaje" }
type ApiErrorBody = { error: string }

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { body, headers, ...rest } = options
  const token = getToken()

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Algunos endpoints devuelven body vacio (ej: "", 201 o "", 204) - leemos
  // el texto crudo primero y solo intentamos parsear JSON si hay algo,
  // en vez de asumir "vacio" = un status code puntual como 204.
  const text = await response.text()
  const data = text ? JSON.parse(text) : undefined

  if (!response.ok) {
    const errorBody = data as ApiErrorBody | undefined
    throw new ApiError(
      response.status,
      errorBody?.error ?? "Error desconocido"
    )
  }

  return data as T
}
