import type { MacroKey } from "@/features/macros/calculations"

// Colores de cada macro (paleta categórica validada para daltonismo y
// contraste sobre el fondo oscuro de la app). El color sigue al macro, no a
// su posición: las proteínas son siempre naranjas, en el gráfico y en las
// tarjetas.
export const MACRO_META: Record<MacroKey, { label: string; color: string }> = {
  carbs: { label: "Carbohidratos", color: "#3987e5" },
  protein: { label: "Proteínas", color: "#d95926" },
  fat: { label: "Grasas", color: "#199e70" },
}
