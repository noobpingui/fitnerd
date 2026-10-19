export const HISTORY_PAGE_SIZE = 10
export type RevealRequest = { date: string; seq: number }

/** Filas visibles necesarias para que `date` lo sea, creciendo en bloques de `pageSize`; nunca menos que `visibleCount`. */
export function visibleCountToReveal(
  sortedDates: readonly string[],
  date: string,
  visibleCount: number,
  pageSize: number = HISTORY_PAGE_SIZE
): number {
  const index = sortedDates.indexOf(date)
  if (index < 0 || index < visibleCount) return visibleCount
  return visibleCount + Math.ceil((index + 1 - visibleCount) / pageSize) * pageSize
}
