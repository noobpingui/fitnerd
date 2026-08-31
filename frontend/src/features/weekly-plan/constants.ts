// Mismo criterio que day_of_week en el backend (models/weekly_plan_entry.py):
// 0 = Domingo ... 6 = Sabado, igual que Date.getDay() en JS. El array ya
// esta en el orden en que se debe mostrar en pantalla (Domingo a Sabado).
export const WEEK_DAYS = [
  { day: 0, label: "Domingo" },
  { day: 1, label: "Lunes" },
  { day: 2, label: "Martes" },
  { day: 3, label: "Miércoles" },
  { day: 4, label: "Jueves" },
  { day: 5, label: "Viernes" },
  { day: 6, label: "Sábado" },
] as const
