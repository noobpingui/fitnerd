import type { MacroKey, MacroResult } from "@/features/macros/calculations"
import { MACRO_META } from "@/features/macros/constants"

// Gráfico de pastel "3D" dibujado a mano en SVG (ninguna librería de la app
// hace pasteles 3D). El truco: la tapa es una elipse (un círculo visto en
// perspectiva) y, debajo, se dibuja la "pared" de cada porción solo en la
// mitad delantera, que es la única que se vería en un pastel real.

const CX = 160
const CY = 92
const RX = 140
const RY = 72
const DEPTH = 26
const LIFT = 10

function point(angle: number, dy = 0) {
  return `${CX + RX * Math.cos(angle)} ${CY + RY * Math.sin(angle) + dy}`
}

export function Pie3D({
  macros,
  activeKey,
  onActiveChange,
}: {
  macros: MacroResult[]
  activeKey: MacroKey | null
  onActiveChange: (key: MacroKey | null) => void
}) {
  // Cada porción empieza donde terminó la anterior, desde arriba (-90°) y en
  // sentido horario.
  const slices = macros.map((macro, i) => {
    const before = macros.slice(0, i).reduce((sum, m) => sum + m.share, 0)
    const start = -Math.PI / 2 + before * 2 * Math.PI
    const end = start + macro.share * 2 * Math.PI
    return { macro, start, end }
  })

  // La porción activa se dibuja al final para que quede por encima de las
  // demás al levantarse.
  const ordered = [...slices].sort(
    (a, b) =>
      Number(a.macro.key === activeKey) - Number(b.macro.key === activeKey)
  )

  const summary = macros
    .map((m) => `${MACRO_META[m.key].label} ${Math.round(m.share * 100)} %`)
    .join(", ")

  return (
    <svg
      viewBox="0 0 320 210"
      role="img"
      aria-label={`Reparto de macronutrientes: ${summary}`}
      className="w-full max-w-sm overflow-visible"
      onMouseLeave={() => onActiveChange(null)}
    >
      {ordered.map(({ macro, start, end }) => {
        const { color } = MACRO_META[macro.key]
        const active = macro.key === activeKey
        const large = end - start > Math.PI ? 1 : 0

        // Pared delantera: la parte de la porción que cae en [0, π], la
        // mitad de la elipse más cercana a quien mira.
        const sideStart = Math.max(start, 0)
        const sideEnd = Math.min(end, Math.PI)
        const hasSide = sideStart < sideEnd

        const mid = (start + end) / 2
        const labelX = CX + RX * 0.6 * Math.cos(mid)
        const labelY = CY + RY * 0.6 * Math.sin(mid)

        return (
          <g
            key={macro.key}
            tabIndex={0}
            aria-label={`${MACRO_META[macro.key].label}: ${macro.grams} g`}
            onMouseEnter={() => onActiveChange(macro.key)}
            onFocus={() => onActiveChange(macro.key)}
            onBlur={() => onActiveChange(null)}
            style={{
              transform: `translateY(${active ? -LIFT : 0}px)`,
              transition: "transform 200ms ease-out",
            }}
            className="cursor-pointer outline-none"
          >
            {hasSide && (
              <path
                d={`M ${point(sideStart)} A ${RX} ${RY} 0 0 1 ${point(sideEnd)} L ${point(sideEnd, DEPTH)} A ${RX} ${RY} 0 0 0 ${point(sideStart, DEPTH)} Z`}
                fill={color}
                stroke="var(--card)"
                strokeWidth={2}
                style={{ filter: "brightness(0.6)" }}
              />
            )}
            <path
              d={`M ${CX} ${CY} L ${point(start)} A ${RX} ${RY} 0 ${large} 1 ${point(end)} Z`}
              fill={color}
              stroke="var(--card)"
              strokeWidth={2}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none fill-white text-[15px] font-semibold"
            >
              {Math.round(macro.share * 100)} %
            </text>
          </g>
        )
      })}
    </svg>
  )
}
