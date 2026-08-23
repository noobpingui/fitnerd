import { apiFetch } from "@/lib/apiClient"
import type {
  AuthResponse,
  CurrentUser,
  LoginCredentials,
  RegisterPayload,
} from "@/features/auth/types"

export function login(credentials: LoginCredentials) {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: credentials,
  })
}

export function register(payload: RegisterPayload) {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: payload,
  })
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/api/auth/me")
}
