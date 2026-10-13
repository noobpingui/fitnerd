# Idea original · 006-user-profile

Fecha: 2026-10-11

Guardar en el backend el perfil del usuario que hoy se simula en localStorage: añadir users.onboarding_completed_at (NULL = onboarding pendiente, así los usuarios existentes lo ven al entrar) y una tabla user_profiles con género (masculino/femenino), edad, altura y peso con su unidad elegida, nivel de actividad y meta; endpoints para leer y guardar el perfil; y que el frontend (OnboardingGuard, onboarding, perfil, home y Macros) use la API en lugar de localStorage.
