import { clearToken, getToken } from "@/lib/authToken"

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

    // Un 401 significa dos cosas distintas segun si la peticion llevaba
    // token o no: SIN token, es un error de negocio normal (ej. password
    // incorrecta en login) - lo dejamos pasar como cualquier otro error,
    // para que la pantalla que llamo lo muestre como quiera. CON token, es
    // que el backend lo rechazo (vencido o invalido) - ahi la sesion ya no
    // sirve para nada, la cerramos y mandamos al usuario de vuelta a
    // login. window.location (no react-router) es deliberado: apiClient
    // es un modulo plano, no un componente, no tiene acceso a useNavigate();
    // ademas un reload completo de paso limpia toda cache/estado en
    // memoria (TanStack Query incluida), que es justo lo que queremos al
    // cerrar sesion - no dejar datos del usuario anterior dando vueltas.
    if (response.status === 401 && token) {
      clearToken()
      window.location.href = "/login"
    }

    throw new ApiError(
      response.status,
      errorBody?.error ?? "Error desconocido"
    )
  }

  return data as T
}
