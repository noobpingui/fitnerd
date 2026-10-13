import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { Info } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { UnitToggle } from "@/features/onboarding/components/UnitToggle"
import { GOAL_OPTIONS } from "@/features/onboarding/constants"
import { useProfile } from "@/features/profile/hooks"
import { answersFromProfile } from "@/features/profile/mappers"
import { Pie3D } from "@/features/macros/components/Pie3D"
import { MACRO_META } from "@/features/macros/constants"
import {
  calculateMacros,
  KJ_PER_KCAL,
  type MacroKey,
} from "@/features/macros/calculations"

type EnergyUnit = "kcal" | "kj"

const numberFormat = new Intl.NumberFormat("es-ES")

export function MacrosPage() {
  const [unit, setUnit] = useState<EnergyUnit>("kcal")
  // Macro resaltado: lo comparten el gráfico y las tarjetas, así que pasar
  // el ratón por una porción ilumina su tarjeta y viceversa.
  const [activeKey, setActiveKey] = useState<MacroKey | null>(null)

  // OnboardingGuard garantiza que el perfil existe antes de llegar aquí.
  const { data: profile } = useProfile()
  const answers = useMemo(
    () => (profile ? answersFromProfile(profile) : null),
    [profile]
  )
  const summary = useMemo(
    () => (answers ? calculateMacros(answers) : null),
    [answers]
  )

  if (!answers || !summary) return null

  const energy = (kcal: number) =>
    numberFormat.format(unit === "kcal" ? kcal : Math.round(kcal * KJ_PER_KCAL))
  const unitLabel = unit === "kcal" ? "kcal" : "kJ"
  const goalLabel = GOAL_OPTIONS.find((g) => g.value === answers.goal)?.label

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold">Macros</h1>
          <p className="text-muted-foreground">
            Tu objetivo diario según tus datos y tu meta.
          </p>
        </div>
        <UnitToggle
          units={[
            { value: "kcal", label: "kcal" },
            { value: "kj", label: "kJ" },
          ]}
          value={unit}
          onChange={setUnit}
        />
      </div>

      {/* Número protagonista: el objetivo calórico es lo primero que el
          usuario necesita ver, así que va solo y en grande. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="mb-4">
          <CardContent className="flex flex-col items-center gap-1 py-2 text-center">
            <span className="text-sm text-muted-foreground">
              Objetivo diario
            </span>
            <span className="text-5xl font-bold tabular-nums tracking-tight">
              {energy(summary.targetKcal)}
              <span className="ml-2 text-xl font-medium text-muted-foreground">
                {unitLabel}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">
              Meta: {goalLabel} · Mantenimiento:{" "}
              {energy(summary.maintenanceKcal)} {unitLabel}
            </span>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.08 }}
      >
        <Card>
          <CardContent className="grid items-center gap-6 md:grid-cols-[1fr_1fr]">
            <div className="flex justify-center">
              <Pie3D
                macros={summary.macros}
                activeKey={activeKey}
                onActiveChange={setActiveKey}
              />
            </div>

            {/* Las tarjetas hacen también de leyenda: cada una lleva la
                muestra de color de su porción. */}
            <ul className="flex flex-col gap-3">
              {summary.macros.map((macro) => {
                const meta = MACRO_META[macro.key]
                const active = macro.key === activeKey
                return (
                  <li
                    key={macro.key}
                    onMouseEnter={() => setActiveKey(macro.key)}
                    onMouseLeave={() => setActiveKey(null)}
                    className={cn(
                      "flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors",
                      active && "border-foreground/40 bg-muted"
                    )}
                  >
                    <span
                      aria-hidden
                      className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{meta.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(macro.share * 100)} % del total
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-xl font-semibold">
                        {numberFormat.format(macro.grams)} g
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {energy(macro.kcal)} {unitLabel}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      {/* Nota informativa: explica de dónde salen las cifras sin competir
          con ellas (texto pequeño y en gris, al final de la pantalla). */}
      <div className="mt-6 flex gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Calculado con la fórmula de <strong className="font-medium text-foreground">Mifflin-St Jeor</strong>,
          una de las más precisas para estimar el gasto calórico. Parte de tu
          peso, altura, edad y sexo para obtener lo que tu cuerpo gasta en
          reposo, lo multiplica según tu nivel de actividad y lo ajusta a tu
          meta, sin bajar de 1200 kcal en mujeres ni de 1500 kcal en hombres.
          Las proteínas se fijan en 2 g por kg de peso (si tu peso supera el
          que corresponde a un IMC de 27 para tu altura, se usa ese peso), las
          grasas en el 25 % de las calorías y el resto son carbohidratos, con
          un mínimo de 100 g: si no llegan, se reducen primero las grasas
          (hasta el 20 %) y después las proteínas. Es una estimación: úsala
          como punto de partida y ajústala según tu progreso.
        </p>
      </div>
    </div>
  )
}
