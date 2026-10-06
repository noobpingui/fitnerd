import { apiFetch } from "@/lib/apiClient"
import type {
  AuthResponse,
  CurrentUser,
  ForgotPasswordPayload,
  LoginCredentials,
  MessageResponse,
  RegisterPayload,
  ResetPasswordPayload,
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

// credential: el ID token que Google Identity Services le entrega al
// frontend (no es nuestro JWT - eso lo devuelve esta misma request, en
// la respuesta, igual que login/register).
export function loginWithGoogle(credential: string) {
  return apiFetch<AuthResponse>("/api/auth/google", {
    method: "POST",
    body: { credential },
  })
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/api/auth/me")
}

export function requestPasswordReset(payload: ForgotPasswordPayload) {
  return apiFetch<MessageResponse>("/api/auth/forgot-password", {
    method: "POST",
    body: payload,
  })
}

export function resetPassword(payload: ResetPasswordPayload) {
  return apiFetch<MessageResponse>("/api/auth/reset-password", {
    method: "POST",
    body: payload,
  })
}
