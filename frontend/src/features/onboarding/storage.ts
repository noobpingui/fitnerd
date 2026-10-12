import type { OnboardingAnswers } from "@/features/onboarding/types"

// TEMPORAL (fase de diseño): simula en localStorage lo que después hará el
// backend (columna users.onboarding_completed_at y tabla user_profiles).
// Cuando exista la API, este archivo se sustituye por llamadas con apiFetch.
//
// Ojo: localStorage es por navegador, no por usuario - si dos cuentas usan
// el mismo navegador, comparten este estado. Aceptable solo para el diseño.
const STORAGE_KEY = "fitnerd_onboarding_mock"

export function getOnboardingAnswers(): OnboardingAnswers | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as OnboardingAnswers) : null
  } catch {
    return null
  }
}

export function isOnboardingCompleted(): boolean {
  return getOnboardingAnswers() !== null
}

export function saveOnboardingAnswers(answers: OnboardingAnswers): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
  } catch {
    // Sin almacenamiento disponible (modo privado, etc.): el onboarding
    // volverá a aparecer, que es el comportamiento seguro.
  }
}

export function resetOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nada que limpiar.
  }
}
