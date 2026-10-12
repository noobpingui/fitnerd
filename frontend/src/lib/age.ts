import { parseLocalDate } from "@/lib/dates"

// Edad en años cumplidos a partir de "YYYY-MM-DD", con la fecha local del
// dispositivo. Se parte el texto a mano (en vez de new Date(isoDate), que
// interpreta UTC) para no desplazar el día según la zona horaria.
export function ageFromIsoDate(isoDate: string, today: Date = new Date()): number {
  const dob = parseLocalDate(isoDate)
  const year = dob.getFullYear()
  const month = dob.getMonth() + 1
  const day = dob.getDate()
  const beforeBirthday =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  return today.getFullYear() - year - (beforeBirthday ? 1 : 0)
}
