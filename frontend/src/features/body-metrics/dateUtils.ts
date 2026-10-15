import { parseLocalDate } from "@/lib/dates"

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

// Inicio del periodo: la misma fecha de hace `months` meses. Si ese día no
// existe (31 de marzo menos 1 mes), se usa el último día de ese mes.
export function periodStart(today: string, months: number): string {
  const [y, m, d] = today.split("-").map(Number)
  const total = y * 12 + (m - 1) - months
  const year = Math.floor(total / 12)
  const month = total - year * 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const pad = (n: number, len = 2) => String(n).padStart(len, "0")
  return `${pad(year, 4)}-${pad(month + 1)}-${pad(Math.min(d, lastDay))}`
}
