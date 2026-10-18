import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router"
import { AnimatePresence } from "motion/react"
import { ProtectedRoute } from "@/app/ProtectedRoute"
import { PageTransition } from "@/app/PageTransition"
import { lazyNamed } from "@/app/lazyNamed"
import { RouteSuspense } from "@/app/RouteSuspense"

// Cada pantalla se descarga al visitar su ruta (ADR-0026).
const AppLayout = lazyNamed(() => import("@/app/AppLayout"), "AppLayout")
const OnboardingGuard = lazyNamed(() => import("@/app/OnboardingGuard"), "OnboardingGuard")
const OnboardingRoute = lazyNamed(() => import("@/app/OnboardingRoute"), "OnboardingRoute")
const LoginPage = lazyNamed(() => import("@/features/auth/pages/LoginPage"), "LoginPage")
const RegisterPage = lazyNamed(() => import("@/features/auth/pages/RegisterPage"), "RegisterPage")
const ForgotPasswordPage = lazyNamed(
  () => import("@/features/auth/pages/ForgotPasswordPage"),
  "ForgotPasswordPage"
)
const ResetPasswordPage = lazyNamed(
  () => import("@/features/auth/pages/ResetPasswordPage"),
  "ResetPasswordPage"
)
const MacrosPage = lazyNamed(() => import("@/features/macros/pages/MacrosPage"), "MacrosPage")
const BodyMetricsPage = lazyNamed(
  () => import("@/features/body-metrics/pages/BodyMetricsPage"),
  "BodyMetricsPage"
)
const HomePage = lazyNamed(() => import("@/features/home/pages/HomePage"), "HomePage")
const CoachPage = lazyNamed(() => import("@/features/coach/pages/CoachPage"), "CoachPage")
const StorePage = lazyNamed(() => import("@/features/store/pages/StorePage"), "StorePage")
const ProfilePage = lazyNamed(() => import("@/features/profile/pages/ProfilePage"), "ProfilePage")
const PrivacyPolicyPage = lazyNamed(
  () => import("@/features/legal/pages/PrivacyPolicyPage"),
  "PrivacyPolicyPage"
)
const TermsOfServicePage = lazyNamed(
  () => import("@/features/legal/pages/TermsOfServicePage"),
  "TermsOfServicePage"
)

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
              <RouteSuspense>
                <LoginPage />
              </RouteSuspense>
            </PageTransition>
          }
        />
        <Route
          path="/register"
          element={
            <PageTransition>
              <RouteSuspense>
                <RegisterPage />
              </RouteSuspense>
            </PageTransition>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PageTransition>
              <RouteSuspense>
                <ForgotPasswordPage />
              </RouteSuspense>
            </PageTransition>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PageTransition>
              <RouteSuspense>
                <ResetPasswordPage />
              </RouteSuspense>
            </PageTransition>
          }
        />
        {/* Sin PageTransition: esa animacion es especifica del "swap" entre
            login/registro, no hace falta aca. */}
        <Route
          path="/privacy"
          element={
            <RouteSuspense>
              <PrivacyPolicyPage />
            </RouteSuspense>
          }
        />
        <Route
          path="/terms"
          element={
            <RouteSuspense>
              <TermsOfServicePage />
            </RouteSuspense>
          }
        />

        {/* Rutas protegidas: ProtectedRoute exige token, AppLayout pone el
            navbar alrededor de cualquier pagina que matchee mas adentro */}
        <Route element={<ProtectedRoute />}>
          {/* El onboarding va fuera de AppLayout (sin navbar ni barra
              inferior, para que no haya a dónde "escaparse") y fuera de
              OnboardingGuard (si no, redirigiría a sí mismo en bucle). */}
          <Route
            path="/onboarding"
            element={
              <RouteSuspense>
                <OnboardingRoute />
              </RouteSuspense>
            }
          />
          <Route
            element={
              <RouteSuspense>
                <OnboardingGuard />
              </RouteSuspense>
            }
          >
            <Route
              element={
                <RouteSuspense>
                  <AppLayout />
                </RouteSuspense>
              }
            >
              <Route
                path="/home"
                element={
                  <RouteSuspense className="min-h-[50vh]">
                    <HomePage />
                  </RouteSuspense>
                }
              />
              <Route
                path="/macros"
                element={
                  <RouteSuspense className="min-h-[50vh]">
                    <MacrosPage />
                  </RouteSuspense>
                }
              />
              <Route
                path="/body-metrics"
                element={
                  <RouteSuspense className="min-h-[50vh]">
                    <BodyMetricsPage />
                  </RouteSuspense>
                }
              />
              <Route
                path="/coach"
                element={
                  <RouteSuspense className="min-h-[50vh]">
                    <CoachPage />
                  </RouteSuspense>
                }
              />
              <Route
                path="/store"
                element={
                  <RouteSuspense className="min-h-[50vh]">
                    <StorePage />
                  </RouteSuspense>
                }
              />
              <Route
                path="/profile"
                element={
                  <RouteSuspense className="min-h-[50vh]">
                    <ProfilePage />
                  </RouteSuspense>
                }
              />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
