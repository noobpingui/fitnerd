// Un texto vacío no está en rango; los campos opcionales lo comprueban antes.
export function inRange(
  value: string,
  { min, max }: { min: number; max: number },
  integer = false
): boolean {
  if (value.trim() === "") return false
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) return false
  return !integer || Number.isInteger(n)
}
