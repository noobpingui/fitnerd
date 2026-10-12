import { useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/layout/Logo"
import { ChoiceList } from "@/features/onboarding/components/ChoiceList"
import { UnitToggle } from "@/features/onboarding/components/UnitToggle"
import {
  ACTIVITY_OPTIONS,
  EMPTY_ANSWERS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
} from "@/features/onboarding/constants"
import { saveOnboardingAnswers } from "@/features/onboarding/storage"
import type {
  HeightUnit,
  OnboardingAnswers,
  WeightUnit,
} from "@/features/onboarding/types"
import {
  isAgeValid,
  isHeightValid,
  isWeightValid,
} from "@/features/onboarding/validation"

const KG_PER_LB = 0.45359237
const CM_PER_IN = 2.54

type Step = {
  id: string
  title: string
  subtitle?: string
  isValid: boolean
  // Las preguntas de opciones avanzan solas al elegir; las de números
  // necesitan el botón "Siguiente" (o Enter).
  autoAdvance: boolean
  content: ReactNode
}

// Animación de cada pregunta: entra desde el lado hacia el que se avanza y
// sale por el contrario. "direction" es 1 al ir adelante y -1 al volver.
const slide = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 40 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -40 }),
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS)
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  // Evita que un doble clic rápido en una opción salte dos preguntas.
  const advancing = useRef(false)

  function update(patch: Partial<OnboardingAnswers>) {
    setAnswers((current) => ({ ...current, ...patch }))
  }

  // Al cambiar de unidad se convierte el valor ya escrito, para que el
  // usuario no tenga que volver a calcularlo.
  function changeHeightUnit(unit: HeightUnit) {
    if (unit === answers.heightUnit) return
    if (unit === "ft" && isHeightValid(answers)) {
      const totalIn = Number(answers.heightCm) / CM_PER_IN
      const ft = Math.floor(totalIn / 12)
      const inches = Math.round(totalIn - ft * 12)
      update({
        heightUnit: unit,
        heightFt: String(inches === 12 ? ft + 1 : ft),
        heightIn: String(inches === 12 ? 0 : inches),
      })
    } else if (unit === "cm" && isHeightValid(answers)) {
      const totalIn =
        Number(answers.heightFt) * 12 + Number(answers.heightIn || 0)
      update({ heightUnit: unit, heightCm: String(Math.round(totalIn * CM_PER_IN)) })
    } else {
      update({ heightUnit: unit })
    }
  }

  function changeWeightUnit(unit: WeightUnit) {
    if (unit === answers.weightUnit) return
    if (isWeightValid(answers)) {
      const w = Number(answers.weight)
      const converted = unit === "lb" ? w / KG_PER_LB : w * KG_PER_LB
      update({ weightUnit: unit, weight: String(Math.round(converted * 10) / 10) })
    } else {
      update({ weightUnit: unit })
    }
  }

  // Elegir una opción guarda la respuesta y, tras una pausa corta para que
  // se vea la marca de seleccionado, pasa a la siguiente pregunta. Solo la
  // usan pasos que no son el último (la meta se confirma con el botón).
  function choose(patch: Partial<OnboardingAnswers>) {
    update(patch)
    if (advancing.current) return
    advancing.current = true
    setTimeout(() => {
      advancing.current = false
      setDirection(1)
      setStepIndex((i) => i + 1)
    }, 250)
  }

  const steps: Step[] = [
    {
      id: "gender",
      title: "¿Cuál es tu género?",
      subtitle: "Lo usamos para estimar tu gasto calórico.",
      isValid: answers.gender !== null,
      autoAdvance: true,
      content: (
        <ChoiceList
          options={GENDER_OPTIONS}
          value={answers.gender}
          onSelect={(gender) => choose({ gender })}
        />
      ),
    },
    {
      id: "age",
      title: "¿Cuántos años tienes?",
      isValid: isAgeValid(answers),
      autoAdvance: false,
      content: (
        <NumberField
          value={answers.age}
          onChange={(age) => update({ age })}
          suffix="años"
          inputMode="numeric"
          placeholder="Ej. 28"
        />
      ),
    },
    {
      id: "height",
      title: "¿Cuánto mides?",
      isValid: isHeightValid(answers),
      autoAdvance: false,
      content: (
        <div className="flex flex-col items-center gap-4">
          <UnitToggle
            units={[
              { value: "cm", label: "cm" },
              { value: "ft", label: "ft / in" },
            ]}
            value={answers.heightUnit}
            onChange={changeHeightUnit}
          />
          {answers.heightUnit === "cm" ? (
            <NumberField
              key="cm"
              value={answers.heightCm}
              onChange={(heightCm) => update({ heightCm })}
              suffix="cm"
              placeholder="Ej. 175"
            />
          ) : (
            <div key="ft" className="flex w-full gap-3">
              <NumberField
                value={answers.heightFt}
                onChange={(heightFt) => update({ heightFt })}
                suffix="ft"
                inputMode="numeric"
                placeholder="5"
              />
              <NumberField
                value={answers.heightIn}
                onChange={(heightIn) => update({ heightIn })}
                suffix="in"
                inputMode="numeric"
                placeholder="9"
                autoFocus={false}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      id: "weight",
      title: "¿Cuánto pesas?",
      isValid: isWeightValid(answers),
      autoAdvance: false,
      content: (
        <div className="flex flex-col items-center gap-4">
          <UnitToggle
            units={[
              { value: "kg", label: "kg" },
              { value: "lb", label: "lb" },
            ]}
            value={answers.weightUnit}
            onChange={changeWeightUnit}
          />
          <NumberField
            value={answers.weight}
            onChange={(weight) => update({ weight })}
            suffix={answers.weightUnit}
            placeholder={answers.weightUnit === "kg" ? "Ej. 72" : "Ej. 160"}
          />
        </div>
      ),
    },
    {
      id: "activity",
      title: "¿Cuál es tu nivel de actividad física?",
      isValid: answers.activityLevel !== null,
      autoAdvance: true,
      content: (
        <ChoiceList
          options={ACTIVITY_OPTIONS}
          value={answers.activityLevel}
          onSelect={(activityLevel) => choose({ activityLevel })}
        />
      ),
    },
    {
      id: "goal",
      title: "¿Cuál es tu meta?",
      isValid: answers.goal !== null,
      // Última pregunta: no avanza sola, el usuario confirma con el botón.
      autoAdvance: false,
      content: (
        <ChoiceList
          options={GOAL_OPTIONS}
          value={answers.goal}
          onSelect={(goal) => update({ goal })}
        />
      ),
    },
  ]

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1
  const progress = ((stepIndex + 1) / steps.length) * 100

  function goNext() {
    if (!step.isValid) return
    if (isLast) {
      saveOnboardingAnswers(answers)
      navigate("/home", { replace: true })
      return
    }
    setDirection(1)
    setStepIndex((i) => i + 1)
  }

  function goBack() {
    if (stepIndex === 0) return
    setDirection(-1)
    setStepIndex((i) => i - 1)
  }

  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center overflow-hidden bg-background px-4 py-8">
      {/* Misma mancha decorativa animada que las pantallas de login/registro,
          para que el onboarding se sienta como la continuación del registro. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="flex w-full max-w-md flex-1 flex-col">
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Logo className="text-2xl" />
            <span className="text-sm text-muted-foreground">
              {stepIndex + 1} de {steps.length}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
          {stepIndex === 0 && (
            <p className="text-sm text-muted-foreground">
              Antes de empezar, cuéntanos un poco sobre ti. Solo te llevará un
              minuto.
            </p>
          )}
        </header>

        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            goNext()
          }}
        >
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.section
              key={step.id}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col gap-6"
            >
              <div>
                <h1 className="text-2xl font-bold">{step.title}</h1>
                {step.subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.subtitle}
                  </p>
                )}
              </div>
              {step.content}
            </motion.section>
          </AnimatePresence>

          <div className="mt-auto flex items-center gap-3 pt-8">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0}
              className={stepIndex === 0 ? "invisible" : undefined}
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
            {(!step.autoAdvance || step.isValid) && (
              <Button
                type="submit"
                className="ml-auto min-w-32"
                disabled={!step.isValid}
              >
                {isLast ? "Comenzar" : "Siguiente"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// Campo numérico grande con la unidad a la derecha. autoFocus por defecto
// para que, al llegar a la pregunta, se pueda escribir sin hacer clic.
function NumberField({
  value,
  onChange,
  suffix,
  placeholder,
  inputMode = "decimal",
  autoFocus = true,
}: {
  value: string
  onChange: (value: string) => void
  suffix: string
  placeholder?: string
  inputMode?: "numeric" | "decimal"
  autoFocus?: boolean
}) {
  return (
    <div className="relative w-full">
      <Input
        type="number"
        inputMode={inputMode}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 pr-16 text-center text-2xl font-semibold md:text-2xl [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
        {suffix}
      </span>
    </div>
  )
}
