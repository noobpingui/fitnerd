# Plan 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-18)
- **Ámbitos:** frontend

## 1. Resumen de la solución

Seis cambios pequeños, todos en `frontend/`, sin API ni migraciones:

1. **REQ-001:** el esquema compartido de datos físicos (`features/onboarding/schemas.ts`) calcula el mensaje de la altura
   con una función nueva, `heightMessage`, que devuelve «Entre 0 y 11 in» cuando los pies son válidos y las pulgadas no.
   `PhysicalDataForm` marca el campo de pies solo cuando los pies fallan. El onboarding no cambia: no muestra mensajes
   de altura.
2. **NFR-001:** `inRange` pasa tal cual a `src/lib/inRange.ts` (como `clamp.ts`); onboarding, perfil y métricas la
   importan de ahí.
3. **NFR-002:** supresión de `only-export-components` en la línea del export de `buttonVariants` y `useFormField`, con
   un comentario que explica el motivo.
4. **NFR-003 y NFR-004:** cambios solo en archivos de test; los hace el `test-author`.
5. **REQ-002, REQ-003 y NFR-005:** `router.tsx` carga bajo demanda cada pantalla (y también `OnboardingRoute`,
   `OnboardingGuard` y `AppLayout`) con `React.lazy`, envuelta en un `RouteSuspense` nuevo (error boundary y `Suspense`).
   Ver ADR-0026.

Se respeta la organización por feature (Art. P2.1 frontend): lo de enrutado va en `src/app/`, la utilidad pura en
`src/lib/` y lo de cada formulario en su feature.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| frontend | Utilidades (`src/lib`) | `frontend/src/lib/inRange.ts` | — | NFR-001: regla de rango compartida |
| frontend | Esquemas del onboarding | — | `frontend/src/features/onboarding/schemas.ts` | NFR-001 (quita `inRange` e importa la de `@/lib/inRange`); REQ-001 (`INCHES_RANGE_MESSAGE`, `isHeightFeetValid`, `heightMessage`) |
| frontend | Esquemas del perfil | — | `frontend/src/features/profile/schemas.ts` | NFR-001: importa `inRange` de `@/lib/inRange` |
| frontend | Esquemas de métricas | — | `frontend/src/features/body-metrics/schemas.ts` | NFR-001: importa `inRange` de `@/lib/inRange` |
| frontend | Formulario del perfil | — | `frontend/src/features/profile/components/PhysicalDataForm.tsx` | REQ-001: `aria-invalid` del campo de pies solo si fallan los pies |
| frontend | Componentes de UI (shadcn) | — | `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/form.tsx` | NFR-002: supresión justificada en la línea del export |
| frontend | Enrutado (`src/app`) | `frontend/src/app/lazyNamed.ts`, `frontend/src/app/RouteSuspense.tsx` | `frontend/src/app/router.tsx` | REQ-002, REQ-003, NFR-005 |
| frontend | Tests (solo `test-author`) | `frontend/src/lib/inRange.test.ts`, `frontend/src/app/lazyNamed.test.ts`, `frontend/src/app/RouteSuspense.test.tsx`, `frontend/src/app/lazyRoutes.test.tsx`, `frontend/src/app/sourceCleanup017.test.ts` | `frontend/src/features/onboarding/schemas.test.ts`, `frontend/src/features/profile/schemas.test.ts`, `frontend/src/features/profile/pages/ProfilePage.test.tsx`, `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`, `frontend/src/features/auth/components/LoginForm.test.tsx`, `frontend/src/features/auth/components/ForgotPasswordForm.test.tsx`, `frontend/src/test/setup.ts` | Cobertura de todos los AC; NFR-003 y NFR-004 son cambios de tests |

No se tocan `vite.config.ts`, `.oxlintrc.json`, `package.json`, `OnboardingRoute.tsx`, `OnboardingGuard.tsx` ni
`AppLayout.tsx`.

## 3. Diseño

### 3.1 Datos y migraciones

No aplica: no hay cambios de datos, de API ni migraciones.

### 3.2 Contratos e interfaces

Firmas exactas de los símbolos nuevos que importarán los tests (el `implementer` crea sus esqueletos según el
Art. P1.5 frontend: `throw new Error("not implemented");` y parámetros con prefijo `_`).

**`frontend/src/lib/inRange.ts`** (NFR-001):

```ts
// Texto numérico dentro de [min, max]; vacío o solo espacios no está en rango.
export function inRange(
  value: string,
  { min, max }: { min: number; max: number },
  integer = false
): boolean
```

El esqueleto conserva la forma (con el segundo parámetro sin desestructurar y prefijado: `_limits`, y `_integer = false`).

**`frontend/src/features/onboarding/schemas.ts`** (REQ-001), añadidos:

```ts
// "Entre 0 y 11 in", construido desde LIMITS.heightIn.
export const INCHES_RANGE_MESSAGE: string

// Pies enteros entre LIMITS.heightFt.min y max (3 y 8).
export function isHeightFeetValid(
  a: Pick<OnboardingAnswers, "heightFt">
): boolean

// null si la altura es válida; si no, el mensaje que corresponde según la tabla de la sección 6 de la spec.
export function heightMessage(
  a: Pick<OnboardingAnswers, "heightUnit" | "heightCm" | "heightFt" | "heightIn">
): string | null
```

`INCHES_RANGE_MESSAGE` es un valor real desde el esqueleto (es una constante, no lógica). Se eliminan la definición de
`inRange` y cualquier reexport desde este módulo. Se conservan sin cambios de firma `heightRangeMessage`,
`isHeightValid`, `isWeightValid`, `addPhysicalDataIssues`, `makePhysicalDataSchema` y `fieldMessages`.

**`frontend/src/app/lazyNamed.ts`** (REQ-002; archivo `.ts` sin JSX para no sumar warnings de
`only-export-components`):

```ts
import type { ComponentType, LazyExoticComponent } from "react"

// React.lazy para un módulo con export con nombre: lazyNamed(() => import("…"), "LoginPage").
export function lazyNamed<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K
): LazyExoticComponent<ComponentType>

// Recarga la app en la misma ruta. Recibe la location para poder probarla sin navegar.
export function reloadPage(location: Pick<Location, "reload"> = window.location): void
```

Esqueletos: `lazyNamed(_load, _name)` y `reloadPage(_location = window.location)` lanzan `not implemented`.

**`frontend/src/app/RouteSuspense.tsx`** (REQ-002 y REQ-003):

```tsx
import { Component, type ReactNode } from "react"

export const PAGE_LOAD_ERROR_MESSAGE = "No se pudo cargar la página."

// Aviso de error de descarga con el botón «Recargar».
export function PageLoadError({ onReload }: { onReload: () => void }): ReactNode

type BoundaryProps = { children: ReactNode; onReload?: () => void }
type BoundaryState = { failed: boolean }

// Captura el rechazo de React.lazy (y cualquier error de render de la pantalla) y muestra PageLoadError.
export class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState
  static getDerivedStateFromError(): BoundaryState
  render(): ReactNode
}

// PageErrorBoundary + Suspense con ProfileLoading («Cargando…») como fallback.
// onReload por defecto: () => reloadPage().
export function RouteSuspense({
  children,
  onReload,
}: {
  children: ReactNode
  onReload?: () => void
}): ReactNode
```

Esqueletos: `PageLoadError({ onReload: _onReload })` y `RouteSuspense({ children: _children, onReload: _onReload })`
lanzan `not implemented`; `PageErrorBoundary` declara `state = { failed: false }` (sin lanzar en la construcción) y su
`render()` y `getDerivedStateFromError()` lanzan `not implemented`. `erasableSyntaxOnly` está activo: nada de
parámetros de constructor con modificadores.

### 3.3 Lógica

**`inRange` (NFR-001).** Se mueve el cuerpo actual sin cambios: `value.trim() === ""` → `false`; `Number(value)` no
finito o fuera de `[min, max]` → `false`; con `integer`, exige `Number.isInteger`. El comentario deja de hablar del
onboarding («Un texto vacío no está en rango; los campos opcionales lo comprueban antes»). Cambios de imports:

- `features/onboarding/schemas.ts`: `import { inRange } from "@/lib/inRange"`.
- `features/profile/schemas.ts`: sale `inRange` del import de `@/features/onboarding/schemas` y entra
  `import { inRange } from "@/lib/inRange"`; `optionalInRange` se queda como está.
- `features/body-metrics/schemas.ts`: `import { inRange } from "@/lib/inRange"` en lugar del de onboarding.

**Mensaje de altura (REQ-001).** En `features/onboarding/schemas.ts`:

```text
isHeightFeetValid(a)  = inRange(a.heightFt, LIMITS.heightFt, true)
heightMessage(a):
  si isHeightValid(a)                                  → null
  si a.heightUnit === "ft" y isHeightFeetValid(a)      → INCHES_RANGE_MESSAGE   ("Entre 0 y 11 in")
  si no                                                → heightRangeMessage(a.heightUnit)
```

`isHeightValid` reutiliza `isHeightFeetValid` para los pies (mismo resultado que hoy). `addPhysicalDataIssues` pasa a
usar `heightMessage(values)`: si no es `null`, añade el issue en `path: ["height"]` con ese mensaje. Las pulgadas vacías
siguen contando como 0 (lo hace `isHeightValid`). La ruta del issue sigue siendo la clave virtual `height`, así que
`fieldMessages`, `PhysicalDataErrorKey` y `ProfileFormErrorKey` no cambian.

**Campos marcados en el perfil (REQ-001).** En `PhysicalDataForm.tsx`:

```ts
const heightOk = !errors.height
// Con el mensaje de pulgadas solo se marca el campo de pulgadas.
const feetOk = heightOk || (draft.heightUnit === "ft" && isHeightFeetValid(draft))
```

El `NumberField` de pies usa `invalid={!feetOk}`; el de pulgadas y el de cm siguen con `invalid={!heightOk}`. «Guardar»
sigue dependiendo de `allValid`, así que se deshabilita con cualquiera de los dos mensajes. `isHeightFeetValid` se
importa de `@/features/onboarding/schemas`, junto a `fieldMessages`.

**Onboarding (AC-001.6).** `OnboardingPage.tsx` no pinta `errors.height` (solo usa la validez para «Siguiente»), así que
no cambia; el test lo fija.

**Warnings de lint (NFR-002).** Encima de la línea que produce el aviso:

- `button.tsx`, antes de `export { Button, buttonVariants }`:
  ```tsx
  // buttonVariants no es un componente, pero shadcn lo exporta desde aquí y otros componentes de UI lo importan de
  // este módulo: se suprime el aviso de Fast Refresh solo en esta línea.
  // oxlint-disable-next-line react/only-export-components
  ```
- `form.tsx`, dentro del bloque `export { … }`, justo antes de la línea `useFormField,`: el mismo patrón, con el motivo
  de `useFormField` (hook de shadcn que usan los componentes `Form*` y que se importa desde este módulo).

El `implementer` comprueba con `npm run lint` que el aviso desaparece: si oxlint informa el aviso en otra línea o con
otro identificador de regla (p. ej. `react-refresh/…`), ajusta la directiva a lo que diga la salida, manteniendo una
sola supresión por archivo. `.oxlintrc.json` no cambia.

**Carga bajo demanda (REQ-002, REQ-003, NFR-005).**

- `lazyNamed(load, name)` = `lazy(() => load().then((m) => ({ default: m[name] })))`.
- `reloadPage(location)` = `location.reload()`.
- `PageErrorBoundary`: `getDerivedStateFromError` → `{ failed: true }`; `render` devuelve
  `<PageLoadError onReload={this.props.onReload ?? (() => reloadPage())} />` si `failed`, o `children` si no.
- `PageLoadError`: contenedor con el mismo estilo que `ProfileLoadError` (`min-h-dvh`, centrado), `<p>` con
  `PAGE_LOAD_ERROR_MESSAGE` y `<Button onClick={onReload}>Recargar</Button>` (reutiliza `@/components/ui/button`).
- `RouteSuspense`: `<PageErrorBoundary onReload={onReload}><Suspense fallback={<ProfileLoading />}>{children}</Suspense></PageErrorBoundary>`.
  Reutiliza `ProfileLoading` de `features/profile/components/ProfileLoadState.tsx`, que ya muestra «Cargando…» con
  `role="status"`; no se crea un segundo componente de carga.
- `router.tsx`:
  - Sustituye los imports estáticos de las 12 pantallas y de `OnboardingRoute`, `OnboardingGuard` y `AppLayout` por
    constantes de módulo `const LoginPage = lazyNamed(() => import("@/features/auth/pages/LoginPage"), "LoginPage")`,
    etc. Se quedan estáticos `ProtectedRoute` (sin dependencias pesadas), `PageTransition` (motion ya está en el
    chunk de entrada por `AnimatePresence`) y lo de `react-router`.
  - Cada `element` va envuelto en `RouteSuspense`: `<PageTransition><RouteSuspense><LoginPage /></RouteSuspense></PageTransition>`
    en las cuatro rutas de autenticación; `<RouteSuspense><PrivacyPolicyPage /></RouteSuspense>` en las legales;
    `element={<RouteSuspense><OnboardingRoute /></RouteSuspense>}`, `element={<RouteSuspense><OnboardingGuard /></RouteSuspense>}`,
    `element={<RouteSuspense><AppLayout /></RouteSuspense>}` y cada pantalla protegida, también envuelta, dentro del
    `Outlet` de `AppLayout` (así el aviso aparece dentro de la navegación).
  - Se mantienen `AnimatePresence mode="wait"` y `<Routes location={location} key={location.pathname}>`: el `key`
    remonta el árbol en cada navegación, de modo que un boundary en error se reinicia al cambiar de ruta.
  - Los comentarios que se toquen quedan en español correcto (Art. P2.1 General); los demás no se reescriben.
- No se cambia `vite.config.ts`: ni `chunkSizeWarningLimit` (lo prohíbe la spec) ni `manualChunks` (sacar dependencias a
  otro chunk que el de entrada importa de forma estática bajaría la cifra sin reducir lo que descarga el usuario).

**Presupuesto estimado del chunk de entrada:** React y React DOM, React Router, motion, TanStack Query, `ProtectedRoute`,
`PageTransition`, `RouteSuspense`, `ProfileLoading` y `Button` (con `radix-ui` Slot, `cva` y `tailwind-merge`). zod,
react-hook-form, Radix de menús y diálogos, recharts y el código de las pantallas salen del chunk de entrada. Si aun así
supera 500 kB, ver Riesgos.

### 3.4 Interfaz de usuario

- **Perfil, «Datos físicos», ft / in:** tabla de la sección 6 de la spec. Mensaje bajo la altura en el `Field`
  existente; `aria-invalid="true"` en pulgadas (y en pies solo con el mensaje de pies). Sin cambios en cm.
- **Onboarding:** sin cambios visibles.
- **Carga de pantallas:** «Cargando…» (`ProfileLoading`, `role="status"`) en el hueco de la pantalla; dentro de
  `AppLayout` aparece bajo la navegación. Error: «No se pudo cargar la página.» y botón «Recargar» (variant por
  defecto de `Button`), centrados.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `features/onboarding/schemas.ts` (`INCHES_RANGE_MESSAGE`, `isHeightFeetValid`, `heightMessage`, `addPhysicalDataIssues`); `features/profile/components/PhysicalDataForm.tsx` (`feetOk`); tests de la 015 actualizados en `onboarding/schemas.test.ts`, `profile/schemas.test.ts` (si aplica) y `ProfilePage.test.tsx` |
| REQ-002 | `app/lazyNamed.ts` (`lazyNamed`), `app/RouteSuspense.tsx` (`RouteSuspense` con `ProfileLoading`), `app/router.tsx` |
| REQ-003 | `app/RouteSuspense.tsx` (`PageErrorBoundary`, `PageLoadError`, `PAGE_LOAD_ERROR_MESSAGE`), `app/lazyNamed.ts` (`reloadPage`) |
| NFR-001 | `lib/inRange.ts`; imports en `onboarding/schemas.ts`, `profile/schemas.ts` y `body-metrics/schemas.ts` |
| NFR-002 | `components/ui/button.tsx` y `components/ui/form.tsx` (una supresión comentada cada uno) |
| NFR-003 | `features/auth/components/LoginForm.test.tsx` y `ForgotPasswordForm.test.tsx` (los edita el `test-author`) |
| NFR-004 | `features/onboarding/pages/OnboardingPage.test.tsx` (lo edita el `test-author`) |
| NFR-005 | `app/router.tsx` sin imports estáticos de pantallas, guard ni layout; `vite.config.ts` sin cambios |

## 5. Estrategia de pruebas

Ámbito **frontend** únicamente. Vitest con jsdom, `globals: false` (cada archivo importa `describe`, `it`, `expect` y
`vi` de `vitest`), nombres de test en español y marcadores `// SDD: 017 …` (Art. P1.1). La red se simula con
`vi.mock("@/features/<feature>/api", …)` como en `router.test.tsx` y `accountSwitch.test.tsx` (Art. P1.4 frontend). No
hacen falta servicios externos ni dobles nuevos: se reutilizan `makeProfileResponse`, `makeAnswers` y
`makePendingResponse` de `src/test/profileFixtures.ts` y los helpers de los propios archivos (`renderPage`,
`spinbuttons`, `setValue`, `saveButton`, `toHeightStep`, `noRangeMessage`…).

**Unitarios**

| Archivo | AC | Qué |
|---|---|---|
| `src/lib/inRange.test.ts` (nuevo) | AC-N001.1, AC-N001.2 | Valores exactos de la spec (3–8: «3», «8», «5.5» verdadero; «», «   », «2.9», «8.1», «abc» falso; con enteros «5» verdadero y «5.5» falso) |
| `src/features/onboarding/schemas.test.ts` (modificar) | AC-001.5 | Nuevo test 017: 5 ft/12 in y 5 ft/2.5 in → «Entre 0 y 11 in»; 9 ft/12 in y 5.5 ft/vacías → «Entre 3 y 8 ft». En los tests existentes de la 015, el caso `["5", "12"]` de AC-003.4 y `["5", "2.5"]` de AC-003.5 pasan a esperar «Entre 0 y 11 in» (o se sacan a un test aparte con su marcador de la 015 y el de la 017); los demás casos no cambian. Opcional: tests directos de `heightMessage` e `isHeightFeetValid` con el mismo marcador |
| `src/features/profile/schemas.test.ts` (revisar) | AC-001.5 | El caso existente (5.5 ft, vacías) sigue esperando «Entre 3 y 8 ft»; se puede añadir el caso 5 ft/12 in del esquema del perfil |
| `src/app/lazyNamed.test.ts` (nuevo) | AC-002.1, AC-003.2 | `lazyNamed` resuelve el export con nombre (renderizado dentro de `Suspense`); `reloadPage({ reload: spy })` llama a `reload` una vez |
| `src/app/RouteSuspense.test.tsx` (nuevo) | AC-002.1, AC-003.1, AC-003.2 | Con una promesa controlada (`lazyNamed(() => deferred.promise, "Screen")`): se ve «Cargando…»; al resolver desaparece y se ve la pantalla. Con una promesa rechazada: «No se pudo cargar la página.», botón «Recargar» y sin «Cargando…». Pulsar «Recargar» llama al `onReload` inyectado. React registra el error capturado con `console.error`: se silencia con `vi.spyOn(console, "error").mockImplementation(() => {})` y se restaura |

**Integración (componente o router montado)**

| Archivo | AC | Qué |
|---|---|---|
| `src/features/profile/pages/ProfilePage.test.tsx` (modificar) | AC-001.1–AC-001.4 | Con `FT_LB_RESPONSE`: 12 in → «Entre 0 y 11 in», sin «Entre 3 y 8 ft», pulgadas `aria-invalid="true"`, pies sin él, «Guardar» deshabilitado; 2.5 y -1 in → mismo mensaje; de 12 a 11 o vacío → sin mensaje, ningún campo marcado y «Guardar» habilitado; 2, 9 y 5.5 ft con 9 o 12 in → «Entre 3 y 8 ft», sin «Entre 0 y 11 in», los dos campos marcados. En los `it.each` existentes de la 015 se retira `["5", "12"]` de AC-003.4 y `["5", "2.5"]` de AC-003.5 (cubiertos ahora por los tests 017 con el comportamiento nuevo; se puede añadir al marcador de los tests nuevos el de la 015: `// SDD: 017 REQ-001 AC-001.1 · 015 REQ-003 AC-003.4`) |
| `src/features/onboarding/pages/OnboardingPage.test.tsx` (modificar) | AC-001.6 | Test 017: 5 ft y 12 in en el paso de altura → «Siguiente» deshabilitado y ningún texto que empiece por «Entre» (`noRangeMessage`) |
| `src/app/lazyRoutes.test.tsx` (nuevo) | AC-002.2, AC-002.3, AC-002.4 | Monta `AppRouter` con los mismos `vi.mock` de `router.test.tsx`. Sin sesión: /login, /register, /forgot-password, /reset-password (con `?token=abc`), /privacy y /terms muestran su formulario o su título legal y `window.location.pathname` no cambia. Con sesión y `makeProfileResponse()`: /home, /macros, /body-metrics, /coach, /store y /profile muestran su `h1` y la navegación (`Navbar`). Con sesión y perfil pendiente (`makePendingResponse`): /onboarding muestra la primera pregunta. `Element.prototype.scrollIntoView = vi.fn()` para el coach |

**Escaneos de código** (`src/app/sourceCleanup017.test.ts`, nuevo; sigue el patrón de `sourceCleanup013.test.ts`:
`import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true })`, cadenas buscadas
construidas por partes y el propio archivo excluido del barrido; los archivos de fuera de `src` se leen con
`import.meta.glob("/vite.config.ts", …)` y `import.meta.glob("/.oxlintrc.json", …)`):

| AC | Qué comprueba |
|---|---|
| AC-N001.3 | `features/onboarding/schemas.ts` no contiene `function inRange` ni la reexporta; ningún archivo importa `inRange` de `@/features/onboarding/schemas`; los tres esquemas la importan de `@/lib/inRange` |
| AC-N001.4 | Siguen existiendo `onboarding/schemas.test.ts`, `profile/schemas.test.ts`, `body-metrics/schemas.test.ts`, `OnboardingPage.test.tsx`, `ProfilePage.test.tsx` y los tests de métricas, con sus marcadores; que pasen lo garantiza `npm test` completo en verify |
| AC-N002.2 | Importa `@/components/ui/button` y `@/components/ui/form` y comprueba que exportan los nombres listados en la spec |
| AC-N002.3 | Siguen existiendo los tests de `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm` y del feedback; que pasen lo garantiza `npm test` |
| AC-N002.4 | `button.tsx` y `form.tsx`: como mucho una línea con `only-export-components`, precedida de un comentario `//` con texto; `.oxlintrc.json` no la pone a `"off"` ni la quita |
| AC-N002.1 | Parte comprobable por escaneo: la supresión existe en los dos archivos; la salida limpia de `npm run lint` la confirma el `verifier` |
| AC-N003.1 | `LoginForm.test.tsx` y `ForgotPasswordForm.test.tsx` no contienen, como palabra completa y distinguiendo mayúsculas, ninguna de las formas de la spec («validacion», «vacio», …, «esta en curso», «SI hay», «via»). Ojo: `\b` de JavaScript trata «í» como no alfanumérico, así que `\basi\b` no casa con «así», que es lo correcto |
| AC-N003.2 | 14 tests en `LoginForm.test.tsx` y 8 en `ForgotPasswordForm.test.tsx` (contar `it(`/`it.each(`, con la misma definición que se use al medir el estado actual antes de editar) y la lista de marcadores `SDD:` igual a la de antes (el `test-author` la copia del archivo actual) |
| AC-N004.1, AC-N004.2 | En `OnboardingPage.test.tsx` ya no están los dos tests de la 015 («la fecha prerrellenada 1995-05-20 deja…» y «la fecha prerrellenada 1900-01-01 muestra…»); existen exactamente una vez las dos líneas de marcador de la spec; siguen apareciendo `AC-009.1`, `AC-009.4` y `AC-007.5` |
| AC-N005.1 | `vite.config.ts` no contiene `chunkSizeWarningLimit` ni `manualChunks`. El tamaño del chunk de entrada (≤ 500 kB en la línea `dist/assets/index-*.js` de `npm run build`) lo mide el `verifier` |
| AC-N005.2 | `app/router.tsx` no tiene ningún `import … from "…/features/<x>/pages/…"` estático (sí `import("…")` dinámicos) |

**Trabajo del `test-author` que no es un test nuevo** (NFR-003 y NFR-004): corrige tildes y regionalismos en
comentarios y nombres de `LoginForm.test.tsx` y `ForgotPasswordForm.test.tsx` sin tocar aserciones, `it` ni marcadores;
en `OnboardingPage.test.tsx` borra los dos tests duplicados de la 015 (líneas 656–676 actuales) y cambia los marcadores
de los tests de la 006 de las líneas 196 y 258 por los de la spec. La fecha 1995-05-20 sigue en los tests de
AC-009.5 y AC-009.6 (cambian la fecha): el escaneo de AC-N004.1 debe contar solo los tests que comprueban la fecha
prerrellenada sin cambiarla.

**Entorno de tests:** en `src/test/setup.ts`, `configure({ asyncUtilTimeout: 3000 })` de `@testing-library/react`. Con
las rutas bajo demanda, los tests que montan `AppRouter` (`router.test.tsx`, `accountSwitch.test.tsx` y los nuevos)
esperan además la importación dinámica de la pantalla dentro del `findBy…`; 1 s por defecto puede quedarse corto en
CI. No debilita ninguna aserción.

**Rojo esperado:**
- Fallan por comportamiento ausente: AC-N001.1/2 (esqueleto de `inRange`), AC-001.1–AC-001.5 (mensaje de pulgadas),
  AC-002.1, AC-003.1, AC-003.2 (esqueletos de `lazyNamed`, `reloadPage` y `RouteSuspense`), AC-N001.3, AC-N002.4,
  AC-N005.2.
- Pasan ya en verde y el `test-author` lo declara (regresión o cambio solo de tests, como en los planes 003 y 007):
  AC-001.6, AC-002.2–AC-002.4, AC-N001.4, AC-N002.2, AC-N002.3, AC-N003.1, AC-N003.2, AC-N004.1–AC-N004.3 y la parte de
  configuración de AC-N005.1.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El chunk de entrada sigue por encima de 500 kB (React DOM, React Router y motion ya suman mucho) | Media | Alto (NFR-005 sin cumplir) | Se cargan bajo demanda también `OnboardingGuard` y `AppLayout`, que arrastran zod, react-hook-form y Radix. Si aun así no basta, el `implementer` no toca `vite.config.ts`: lo informa con el desglose (`npx vite build` y, si hace falta, el tamaño por dependencia) y el orquestador lo escala, porque las salidas (p. ej. cambiar `motion` por `LazyMotion`) amplían el alcance |
| Tests que montan `AppRouter` se vuelven intermitentes por la espera de la importación dinámica | Media | Medio | `asyncUtilTimeout` a 3 s en `setup.ts`; los `vi.mock` de los `api.ts` también se aplican a módulos importados dinámicamente |
| La directiva de oxlint no suprime el aviso (línea o nombre de regla distinto en el bloque `export { … }`) | Media | Bajo | El `implementer` ajusta la directiva a la salida real de `npm run lint`, con una sola supresión por archivo (AC-N002.4) |
| `AnimatePresence mode="wait"` y `Suspense` dentro de `PageTransition` causan un parpadeo o una salida doble entre login y registro | Baja | Bajo | El `Suspense` va dentro de `PageTransition`, así que la animación sigue siendo de la ruta; revisión manual de login ↔ registro en `npm run dev` antes de la review |
| El error boundary oculta un error de render real de una pantalla bajo «No se pudo cargar la página.» | Baja | Bajo | Hoy ese error deja la app en blanco; «Recargar» es una salida razonable. Se anota en el backlog distinguir el mensaje si hiciera falta |

## 7. Cumplimiento de la constitución

- **Art. B1:** cambio con spec aprobada; sin cambio de alcance (cargar también guard y layout bajo demanda es un medio
  para NFR-005, no un comportamiento nuevo).
- **Art. B2:** NFR-003 y NFR-004 son cambios de archivos de test y los hace el `test-author`; el `implementer` solo toca
  producción.
- **Art. B4:** todo REQ y NFR está en la sección 4 y todo AC tiene test previsto en la sección 5, con marcador
  `// SDD: 017 …`. AC-N002.1 y AC-N005.1 se completan con la salida de `npm run lint` y `npm run build`, que el
  `verifier` ejecuta de todos modos (Art. B7).
- **Art. B5.2:** los tests en verde desde el principio están enumerados en la sección 5 (regresión o cambios solo de
  tests); el resto debe fallar por comportamiento ausente gracias a los esqueletos de la sección 3.2.
- **Art. B5.3:** se cambian las expectativas de dos casos existentes de la 015 (5 ft 12 in y 5 ft 2.5 in) porque la spec
  017 cambia ese comportamiento (sección 1 de la spec); se borran dos tests duplicados de la 015 porque la spec lo pide
  (NFR-004) y sus AC siguen cubiertos por los tests de la 006 con marcador doble. No es debilitar tests.
- **Art. B5.6 y P1.5 frontend:** esqueletos con `throw new Error("not implemented");` y parámetros con `_`.
- **Art. B5.7 y P2.5 frontend:** sin errores de lint ni de tipos nuevos. `lazyNamed.ts` es `.ts` y `RouteSuspense.tsx`
  solo exporta componentes y una constante de texto (permitida por `allowConstantExport`), así que no suman avisos de
  `only-export-components`.
- **Art. P1 frontend:** tests junto al archivo que prueban, utilitarios en `src/test/`, `globals: false`, nombres en
  español y red simulada en los `api.ts`.
- **Art. P2 frontend:** organización por feature; `inRange` a `src/lib` porque la usan tres features; componentes de UI
  sin mover; formularios con react-hook-form y zod sin cambios de patrón; ninguna llamada HTTP nueva.
- **Art. P2.1 General:** comentarios y textos nuevos en español correcto.
- **Art. P3:** sin endpoints ni input externo nuevo; la validación con zod del perfil se mantiene.
- **Art. P4:** sin cambios de modelo ni pasos manuales en producción (Vercel despliega solo).
- No hay ningún «DEBERÍA» incumplido.

## 8. ADRs

- [ADR-0026](../../docs/sdd/decisions/ADR-0026-carga-de-pantallas-bajo-demanda.md): carga de pantallas bajo demanda por
  ruta con `React.lazy`, `RouteSuspense` propio y sin `manualChunks` ni cambio del umbral de Vite (Propuesta).
