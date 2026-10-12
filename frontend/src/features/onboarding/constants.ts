import type {
  ActivityLevel,
  ChoiceOption,
  Gender,
  Goal,
  OnboardingAnswers,
} from "@/features/onboarding/types"

export const GENDER_OPTIONS: ChoiceOption<Gender>[] = [
  { value: "male", label: "Masculino" },
  { value: "female", label: "Femenino" },
]

export const ACTIVITY_OPTIONS: ChoiceOption<ActivityLevel>[] = [
  {
    value: "low",
    label: "Bajo",
    description: "Poco o ningún ejercicio, la mayor parte del tiempo sentado",
  },
  {
    value: "moderate",
    label: "Moderado",
    description: "Ejercicio ligero 1-3 días por semana",
  },
  {
    value: "high",
    label: "Alto",
    description: "Ejercicio moderado 3-5 días por semana",
  },
  {
    value: "very_high",
    label: "Muy alto",
    description: "Ejercicio intenso 6-7 días por semana",
  },
  {
    value: "athlete",
    label: "Atleta",
    description:
      "Entrenamiento muy intenso de más de 2 horas al día o atleta competitivo",
  },
]

export const GOAL_OPTIONS: ChoiceOption<Goal>[] = [
  {
    value: "lose",
    label: "Perder peso",
    description: "Reduce tu requerimiento calórico un 20 %",
  },
  {
    value: "lose_slow",
    label: "Perder peso lentamente",
    description: "Reduce tu requerimiento calórico un 10 %",
  },
  {
    value: "maintain",
    label: "Mantener peso",
    description: "Mantiene tu requerimiento calórico",
  },
  {
    value: "gain_slow",
    label: "Aumentar peso lentamente",
    description: "Aumenta tu requerimiento calórico un 10 %",
  },
  {
    value: "gain",
    label: "Aumentar peso",
    description: "Aumenta tu requerimiento calórico un 20 %",
  },
]

// Rangos razonables para evitar errores de tipeo (ej. 1750 cm en vez de
// 175). Son límites de validación de la UI, no consejos médicos.
export const LIMITS = {
  age: { min: 14, max: 100 },
  heightCm: { min: 100, max: 250 },
  heightFt: { min: 3, max: 8 },
  heightIn: { min: 0, max: 11 },
  kg: { min: 30, max: 300 },
  lb: { min: 66, max: 660 },
}

export const EMPTY_ANSWERS: OnboardingAnswers = {
  gender: null,
  age: "",
  heightUnit: "cm",
  heightCm: "",
  heightFt: "",
  heightIn: "",
  weightUnit: "kg",
  weight: "",
  activityLevel: null,
  goal: null,
}
