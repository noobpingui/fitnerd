// Fechas navegables del diario (spec 026): lógica pura, sin red ni reloj.
import { shiftIsoDate } from "@/lib/dates"
import { DIARY_PAST_DAYS } from "./constants"

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

// AAAA-MM-DD y fecha real del calendario ("2026-02-30" no lo es).
export function isIsoDate(text: string): boolean {
  const match = ISO_DATE.exec(text)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function diaryDateBounds(today: string): { min: string; max: string } {
  return { min: shiftIsoDate(today, -DIARY_PAST_DAYS), max: today }
}

// Las fechas ISO se comparan como texto. `normalize` pide dejar la dirección sin parámetro.
export function resolveDiaryDate(
  param: string | null,
  today: string
): { date: string; normalize: boolean } {
  const { min, max } = diaryDateBounds(today)
  const date = param !== null && isIsoDate(param) && param >= min && param <= max ? param : today
  return { date, normalize: param !== null && date === today }
}
