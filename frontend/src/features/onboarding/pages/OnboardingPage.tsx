import { useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/layout/Logo"
import { ChoiceList } from "@/features/onboarding/components/ChoiceList"
import { Input } from "@/components/ui/input"
import { NumberField } from "@/features/onboarding/components/NumberField"
import { UnitToggle } from "@/features/onboarding/components/UnitToggle"
import {
  ACTIVITY_OPTIONS,
  EMPTY_ANSWERS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
} from "@/features/onboarding/constants"
import type { OnboardingAnswers } from "@/features/onboarding/types"
import { convertHeight, convertWeight } from "@/features/onboarding/units"
import {
  dateOfBirthError,
  isHeightValid,
  isWeightValid,
} from "@/features/onboarding/validation"
import { useSaveProfile } from "@/features/profile/hooks"
import { payloadFromAnswers } from "@/features/profile/mappers"

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

// Fecha de hoy en local como "YYYY-MM-DD", para el atributo max del campo.
function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function OnboardingPage({
  initialDateOfBirth,
}: {
  initialDateOfBirth: string | null
}) {
  const navigate = useNavigate()
  const saveProfile = useSaveProfile()
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    ...EMPTY_ANSWERS,
    dateOfBirth: initialDateOfBirth ?? "",
  })
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  // Evita que un doble clic rápido en una opción salte dos preguntas.
  const advancing = useRef(false)
  // Evita un segundo envío antes de que isPending se refleje en pantalla.
  const submitting = useRef(false)

  function update(patch: Partial<OnboardingAnswers>) {
    setAnswers((current) => ({ ...current, ...patch }))
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

  const dobError = dateOfBirthError(answers)

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
      id: "date-of-birth",
      title: "¿Cuál es tu fecha de nacimiento?",
      isValid: dobError === null,
      autoAdvance: false,
      content: (
        <div className="flex flex-col gap-2">
          <Input
            type="date"
            aria-label="Fecha de nacimiento"
            autoFocus
            max={todayIso()}
            value={answers.dateOfBirth}
            aria-invalid={dobError ? true : undefined}
            onChange={(e) => update({ dateOfBirth: e.target.value })}
            className="h-14 text-center text-xl"
          />
          {dobError && (
            <p className="text-center text-sm text-destructive">{dobError}</p>
          )}
        </div>
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
            onChange={(unit) => update(convertHeight(answers, unit))}
          />
          {answers.heightUnit === "cm" ? (
            <NumberField
              large
              autoFocus
              key="cm"
              value={answers.heightCm}
              onChange={(heightCm) => update({ heightCm })}
              suffix="cm"
              placeholder="Ej. 175"
            />
          ) : (
            <div key="ft" className="flex w-full gap-3">
              <NumberField
                large
                autoFocus
                value={answers.heightFt}
                onChange={(heightFt) => update({ heightFt })}
                suffix="ft"
                inputMode="numeric"
                placeholder="5"
              />
              <NumberField
                large
                value={answers.heightIn}
                onChange={(heightIn) => update({ heightIn })}
                suffix="in"
                inputMode="numeric"
                placeholder="9"
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
            onChange={(unit) => update(convertWeight(answers, unit))}
          />
          <NumberField
            large
            autoFocus
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
      if (submitting.current) return
      submitting.current = true
      saveProfile.mutate(payloadFromAnswers(answers), {
        onSuccess: () => navigate("/home", { replace: true }),
        onError: () => {
          submitting.current = false
        },
      })
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
            {saveProfile.isError && (
              <p role="alert" className="text-sm text-destructive">
                No se pudo guardar tu perfil. Inténtalo de nuevo.
              </p>
            )}
            {(!step.autoAdvance || step.isValid) && (
              <Button
                type="submit"
                className="ml-auto min-w-32"
                disabled={!step.isValid || saveProfile.isPending}
              >
                {saveProfile.isPending
                  ? "Guardando…"
                  : isLast
                    ? "Comenzar"
                    : "Siguiente"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
