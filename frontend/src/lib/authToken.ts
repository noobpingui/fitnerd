// Guarda/lee el JWT en localStorage. Aislado en su propio archivo para que,
// el dia que cambiemos de estrategia (ej: httpOnly cookie), solo haya que
// tocar este archivo y no cada lugar que hace un fetch.

const TOKEN_KEY = "fitnerd_token"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}
