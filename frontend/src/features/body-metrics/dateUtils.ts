// new Date("YYYY-MM-DD") interpreta el string como medianoche UTC - en un
// huso horario negativo (como Costa Rica, UTC-6) eso puede mostrar el dia
// ANTERIOR al formatear o comparar. Partimos el string a mano y
// construimos la fecha en hora LOCAL para evitar ese corrimiento en toda
// la feature.
export function parseLocalDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function formatDate(isoDate: string) {
  return parseLocalDate(isoDate).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// Version corta para ejes de charts, sin el anio (12 meses de datos ya
// dejan el anio implicito).
export function formatShortDate(isoDate: string) {
  return parseLocalDate(isoDate).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
  })
}

// Fecha de hoy en formato "YYYY-MM-DD", en hora LOCAL - mismo motivo que
// arriba: new Date().toISOString() siempre convierte a UTC primero.
export function todayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// true si isoDate cae dentro de los ultimos `months` meses contando desde
// hoy (inclusive). Usado para recortar el historial completo a la ventana
// que muestran los charts de progreso.
export function isWithinLastMonths(isoDate: string, months: number) {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  return parseLocalDate(isoDate) >= cutoff
}
