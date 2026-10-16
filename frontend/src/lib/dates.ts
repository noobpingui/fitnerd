// new Date("YYYY-MM-DD") interpreta el string como medianoche UTC: en un
// huso horario negativo (como Costa Rica, UTC-6) eso puede mostrar el día
// ANTERIOR al formatear o comparar. Partimos el string a mano y
// construimos la fecha en hora LOCAL para evitar ese corrimiento.
export function parseLocalDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(year, month - 1, day)
}

// Suma (o resta, con días negativos) días a una fecha "YYYY-MM-DD" y devuelve
// otra "YYYY-MM-DD". Opera en UTC para no depender del huso ni del horario de verano.
export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  const y = String(shifted.getUTCFullYear()).padStart(4, "0")
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  const d = String(shifted.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// Fecha de hoy en formato "YYYY-MM-DD", en hora LOCAL: new Date().toISOString()
// siempre convierte a UTC primero.
export function todayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
