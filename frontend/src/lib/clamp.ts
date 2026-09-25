/**
 * Limita `value` al rango cerrado e inclusivo `[min, max]`.
 *
 * Orden de evaluación (obligatorio, ver plan §3.3):
 * 1. Si `min` o `max` es `NaN`, el rango no está definido: lanza `RangeError`.
 * 2. Si `min > max`, el rango es inválido: lanza `RangeError` (se comprueba
 *    antes de mirar `value`, así que también aplica si `value` coincide con
 *    uno de los límites).
 * 3. Si `value` es `NaN`, se devuelve `NaN` sin ocultar el error de origen,
 *    incluso con un rango degenerado (`min === max`).
 * 4. En cualquier otro caso, se devuelve el valor acotado a `[min, max]`.
 *    `-Infinity` e `Infinity` funcionan como límites o valores sin
 *    tratamiento especial, porque son números ordenables.
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(min) || Number.isNaN(max)) {
    throw new RangeError("clamp: min y max deben ser números válidos")
  }

  if (min > max) {
    throw new RangeError(`clamp: min (${min}) no puede ser mayor que max (${max})`)
  }

  if (Number.isNaN(value)) {
    return NaN
  }

  return Math.min(Math.max(value, min), max)
}
