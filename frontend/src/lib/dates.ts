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
export function shiftIsoDate(_isoDate: string, _days: number): string {
  throw new Error("not implemented")
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
