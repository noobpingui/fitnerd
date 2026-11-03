export const PERSONAL_CONTEXT_STORAGE_KEY = "fitnerd_coach_personal_context"

// Activado por defecto: solo el valor "off" lo desactiva. Si localStorage no está
// disponible, se queda activado (la elección no se puede recordar).
export function readPersonalContextPreference(): boolean {
  try {
    return localStorage.getItem(PERSONAL_CONTEXT_STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

export function writePersonalContextPreference(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.removeItem(PERSONAL_CONTEXT_STORAGE_KEY)
    } else {
      localStorage.setItem(PERSONAL_CONTEXT_STORAGE_KEY, "off")
    }
  } catch {
    // Sin almacenamiento, la elección vale solo mientras la pantalla esté abierta.
  }
}
