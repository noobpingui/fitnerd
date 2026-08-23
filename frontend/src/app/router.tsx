import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { ProtectedRoute } from "@/app/ProtectedRoute"
import { AppLayout } from "@/app/AppLayout"
import { LoginPage } from "@/features/auth/pages/LoginPage"
import { RegisterPage } from "@/features/auth/pages/RegisterPage"
import { CategoriesPage } from "@/features/exercises/pages/CategoriesPage"
import { ExercisesPage } from "@/features/exercises/pages/ExercisesPage"
import { FavoritesPage } from "@/features/exercises/pages/FavoritesPage"

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas publicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Rutas protegidas: ProtectedRoute exige token, AppLayout pone el
            navbar alrededor de cualquier pagina que matchee mas adentro */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/categories" element={<CategoriesPage />} />
            <Route
              path="/categories/:categoryId"
              element={<ExercisesPage />}
            />
            <Route path="/favorites" element={<FavoritesPage />} />
          </Route>
        </Route>

        {/* No hay un "home"/dashboard todavia - / manda directo al catalogo.
            Cuando exista una pantalla de inicio real, este redirect cambia. */}
        <Route path="/" element={<Navigate to="/categories" replace />} />
        <Route path="*" element={<Navigate to="/categories" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
