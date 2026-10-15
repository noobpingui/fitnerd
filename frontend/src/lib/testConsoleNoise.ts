// Avisos conocidos que ensucian la salida de los tests sin indicar ningún fallo.
// Solo lo usa la configuración de Vitest; la app no lo importa.
const GOOGLE_CLIENT_ID_WARNING = "VITE_GOOGLE_CLIENT_ID no esta configurado"
const RECHARTS_SIZE_WARNING =
  /The width\(-?\d+\) and height\(-?\d+\) of chart should be greater than 0/

export function isTestConsoleNoise(log: string): boolean {
  return log.includes(GOOGLE_CLIENT_ID_WARNING) || RECHARTS_SIZE_WARNING.test(log)
}
