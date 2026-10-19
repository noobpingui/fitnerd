export const HISTORY_PAGE_SIZE = 10
export type RevealRequest = { date: string; seq: number }

/** Filas visibles necesarias para que `date` lo sea, creciendo en bloques de `pageSize`; nunca menos que `visibleCount`. */
export function visibleCountToReveal(
  _sortedDates: readonly string[],
  _date: string,
  _visibleCount: number,
  _pageSize: number = HISTORY_PAGE_SIZE
): number {
  throw new Error("not implemented")
}
