// Formas que espera/devuelve el backend (ver routes/auth_routes.py)

export type LoginCredentials = {
  email: string
  password: string
}

export type RegisterPayload = {
  email: string
  password: string
  first_name: string
  last_name: string
  date_of_birth: string // "YYYY-MM-DD"
}

export type AuthResponse = {
  token: string
}

export type CurrentUser = {
  id: string
  email: string
}
