import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { ProtectedRoute } from "@/app/ProtectedRoute"
import { AppLayout } from "@/app/AppLayout"
import { LoginPage } from "@/features/auth/pages/LoginPage"
import { RegisterPage } from "@/features/auth/pages/RegisterPage"
import { CategoriesPage } from "@/features/exercises/pages/CategoriesPage"

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
            <Route path="/" element={<CategoriesPage />} />
          </Route>
        </Route>

        {/* Cualquier URL desconocida vuelve al home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
