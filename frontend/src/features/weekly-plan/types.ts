// Refleja _serialize() en routes/weekly_plan_routes.py. exercise_id es
// solo el id - el detalle del ejercicio (nombre, video) sale de la cache
// de useFavorites(), no de aca (ver components/WeeklyPlanBoard.tsx).
export type WeeklyPlanEntry = {
  id: string
  exercise_id: string
  day_of_week: number // 0 = Domingo ... 6 = Sabado
}

export type AddWeeklyPlanEntryPayload = {
  exercise_id: string
  day_of_week: number
}
