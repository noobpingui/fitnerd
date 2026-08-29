// Refleja la forma exacta que devuelve GET /api/body-regions (nivel 1 del
// catalogo: Tren Superior, Tren Inferior, Zona Media).
export type BodyRegion = {
  id: string
  name: string
}

// Refleja la forma exacta que devuelve GET /api/exercise-categories
// (ver routes/exercise_category_routes.py -> list_categories). Nivel 2 del
// catalogo, siempre dentro de una BodyRegion.
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
