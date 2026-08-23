// Refleja la forma exacta que devuelve GET /api/exercise-categories
// (ver routes/exercise_category_routes.py -> list_categories)
export type ExerciseCategory = {
  id: string
  name: string
}

// Refleja _serialize() en routes/exercise_routes.py y
// routes/exercise_favorite_routes.py (misma forma en ambos lados)
export type Exercise = {
  id: string
  category_id: string
  name: string
  video_url: string
}
