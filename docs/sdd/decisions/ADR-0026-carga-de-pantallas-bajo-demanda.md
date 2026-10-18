# ADR-0026: Carga de pantallas bajo demanda por ruta

- **Estado:** Aceptada · 2026-10-18 (propuesta en el plan de `017-frontend-polish`, 2026-10-17)
- **Decidido por:** el `planner`, aceptada por el usuario en el gate de `review` (2026-10-18).

## Contexto
El build del frontend genera un único chunk de unos 1 087 kB, por encima del aviso de 500 kB de Vite. `src/app/router.tsx`
importa de forma estática todas las pantallas (`features/*/pages/*`), y también `OnboardingRoute`, `OnboardingGuard` y
`AppLayout`, que arrastran al chunk de entrada zod (vía `features/profile/api.ts` → `schemas.ts`), el widget de feedback
con react-hook-form y los componentes de Radix del menú de usuario. La spec 017 (REQ-002, REQ-003 y NFR-005) pide que el
chunk de entrada quede en 500 kB o menos sin subir el umbral de aviso, con un aviso «Cargando…» y otro de error con
«Recargar».

Opciones consideradas:
1. **`React.lazy` por ruta con `Suspense` y un error boundary propio** en cada elemento de ruta.
2. **`lazy` de las rutas de React Router 7** (`route.lazy`): exige pasar a `createBrowserRouter`, lo que obliga a
   rehacer `AnimatedRoutes` (`AnimatePresence` con `key` en `<Routes>`) y los tests que montan `AppRouter`.
3. **`build.rollupOptions.output.manualChunks`** para sacar las dependencias a chunks aparte: reduce el chunk de entrada
   «sobre el papel», pero el navegador sigue descargando lo mismo al abrir /login.
4. **Añadir `react-error-boundary`**: dependencia nueva para algo que es una clase de 20 líneas.

## Decisión
Opción 1.
- `src/app/lazyNamed.ts` envuelve `React.lazy` para módulos con exports con nombre (las pantallas no tienen export por
  defecto).
- `src/app/RouteSuspense.tsx` combina `PageErrorBoundary` (clase con `getDerivedStateFromError`) y `Suspense`, con
  `ProfileLoading` («Cargando…», ya existente) como aviso de carga y `PageLoadError` («No se pudo cargar la página.» y
  «Recargar», que llama a `window.location.reload()`) como aviso de error.
- `router.tsx` carga bajo demanda todas las pantallas y además `OnboardingRoute`, `OnboardingGuard` y `AppLayout`; cada
  elemento de ruta va envuelto en su propio `RouteSuspense`. `<Routes key={location.pathname}>` ya remonta el árbol en
  cada navegación, así que el boundary se reinicia solo al cambiar de ruta.
- No se toca `vite.config.ts` (ni `chunkSizeWarningLimit` ni `manualChunks`).

## Consecuencias
- (+) Quien abre /login solo descarga React, React Router, motion, TanStack Query y las piezas de enrutado; cada pantalla
  llega en su chunk.
- (+) Un fallo al descargar un chunk (p. ej. tras un despliegue con la pestaña abierta) muestra un aviso con salida en vez
  de una pantalla en blanco. Como el boundary envuelve la pantalla entera, también captura un error de render de la
  propia pantalla, que antes dejaba la app en blanco.
- (+) Sin dependencias nuevas ni cambio de API del router.
- (−) La primera visita a una ruta protegida encadena hasta tres descargas (guard, layout y pantalla); Vite las
  agrupa en chunks compartidos cuando puede.
- (−) Los tests que montan `AppRouter` esperan además la importación dinámica; por eso se sube `asyncUtilTimeout` de
  Testing Library en `src/test/setup.ts`.
