# Idea original · 015-onboarding-profile-rhf

2026-10-16T04:11:19.344Z

Migrar los formularios de onboarding (OnboardingPage.tsx) y de datos físicos del perfil (PhysicalDataForm.tsx) de useState + onboarding/validation.ts a react-hook-form con zod, como el resto de formularios de la app (constitución Art. 6.8; desviación aceptada en el plan de la 006). Un único esquema zod reutilizado por los dos formularios, que sustituya las reglas duplicadas entre onboarding/validation.ts y profile/schemas.ts, y borrar validation.ts si queda sin uso. Mismo comportamiento visible: mismos campos, mensajes, conversiones de unidades y payload al API. Incluye 006 F8: recoger en la spec el mensaje "Indica tu fecha de nacimiento" que muestra el perfil con la fecha vacía (el onboarding no muestra mensaje) y cubrirlo con un test.
