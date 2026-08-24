import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router"
import { AnimatePresence } from "motion/react"
import { ProtectedRoute } from "@/app/ProtectedRoute"
import { AppLayout } from "@/app/AppLayout"
import { PageTransition } from "@/app/PageTransition"
import { LoginPage } from "@/features/auth/pages/LoginPage"
import { RegisterPage } from "@/features/auth/pages/RegisterPage"
import { CategoriesPage } from "@/features/exercises/pages/CategoriesPage"
import { ExercisesPage } from "@/features/exercises/pages/ExercisesPage"
import { FavoritesPage } from "@/features/exercises/pages/FavoritesPage"

export function AppRouter() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    // key={location.pathname} en <Routes> es lo que le avisa a
    // AnimatePresence "esto cambio, tratalo como que se va uno y entra
    // otro" - sin esto, React Router simplemente reemplaza el contenido
    // sin darle a AnimatePresence la chance de animar la salida.
    // mode="wait" espera a que termine la salida antes de montar la nueva;
    // como el resto de las rutas no tiene PageTransition, esa espera es
    // instantanea para ellas - solo login/registro se ven afectadas.
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Rutas publicas */}
        <Route
          path="/login"
          element={
            <PageTransition>
              <LoginPage />
            </PageTransition>
          }
        />
        <Route
          path="/register"
          element={
            <PageTransition>
              <RegisterPage />
            </PageTransition>
          }
        />

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
    </AnimatePresence>
  )
}
