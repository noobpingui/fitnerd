import { parseLocalDate, todayIsoDate } from "@/lib/dates"

// Se reexportan desde src/lib/dates.ts para no romper a quien las importa de aquí.
export { parseLocalDate, todayIsoDate }

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

// true si isoDate cae dentro de los ultimos `months` meses contando desde
// hoy (inclusive). Usado para recortar el historial completo a la ventana
// que muestran los charts de progreso.
export function isWithinLastMonths(isoDate: string, months: number) {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  return parseLocalDate(isoDate) >= cutoff
}
