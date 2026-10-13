// Solo dos opciones a propósito: la fórmula de gasto calórico necesita el
// sexo para su constante y no hay un valor correcto para un tercer caso.
export type Gender = "male" | "female"

export type ActivityLevel = "low" | "moderate" | "high" | "very_high" | "athlete"

export type Goal =
  | "lose"
  | "lose_slow"
  | "maintain"
  | "gain_slow"
  | "gain"

export type HeightUnit = "cm" | "ft"

export type WeightUnit = "kg" | "lb"

// Respuestas tal como las escribe el usuario: los números se guardan como
// texto mientras se editan (un input vacío es "", no 0) y se convierten al
// validar cada paso.
export type OnboardingAnswers = {
  gender: Gender | null
  // "" o "YYYY-MM-DD"; la edad se calcula a partir de la fecha.
  dateOfBirth: string
  heightUnit: HeightUnit
  heightCm: string
  heightFt: string
  heightIn: string
  weightUnit: WeightUnit
  weight: string
  activityLevel: ActivityLevel | null
  goal: Goal | null
}

export type ChoiceOption<T extends string> = {
  value: T
  label: string
  description?: string
}
