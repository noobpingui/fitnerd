import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router"
import { AnimatePresence } from "motion/react"
import { ProtectedRoute } from "@/app/ProtectedRoute"
import { AppLayout } from "@/app/AppLayout"
import { PageTransition } from "@/app/PageTransition"
import { LoginPage } from "@/features/auth/pages/LoginPage"
import { RegisterPage } from "@/features/auth/pages/RegisterPage"
import { RegionsPage } from "@/features/exercises/pages/RegionsPage"
import { CategoriesPage } from "@/features/exercises/pages/CategoriesPage"
import { ExercisesPage } from "@/features/exercises/pages/ExercisesPage"
import { FavoritesPage } from "@/features/exercises/pages/FavoritesPage"
import { BodyMetricsPage } from "@/features/body-metrics/pages/BodyMetricsPage"
import { HomePage } from "@/features/home/pages/HomePage"
import { CoachPage } from "@/features/coach/pages/CoachPage"
import { StorePage } from "@/features/store/pages/StorePage"
import { PrivacyPolicyPage } from "@/features/legal/pages/PrivacyPolicyPage"
import { TermsOfServicePage } from "@/features/legal/pages/TermsOfServicePage"

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
        {/* Sin PageTransition: esa animacion es especifica del "swap" entre
            login/registro, no hace falta aca. */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />

        {/* Rutas protegidas: ProtectedRoute exige token, AppLayout pone el
            navbar alrededor de cualquier pagina que matchee mas adentro */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/categories" element={<RegionsPage />} />
            <Route
              path="/categories/:regionId"
              element={<CategoriesPage />}
            />
            <Route
              path="/categories/:regionId/:categoryId"
              element={<ExercisesPage />}
            />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/body-metrics" element={<BodyMetricsPage />} />
            <Route path="/coach" element={<CoachPage />} />
            <Route path="/store" element={<StorePage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
