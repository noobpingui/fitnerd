import { lazy, type ComponentType, type LazyExoticComponent } from "react"

// React.lazy para un módulo con export con nombre: lazyNamed(() => import("…"), "LoginPage").
export function lazyNamed<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K
): LazyExoticComponent<ComponentType> {
  return lazy(() => load().then((m) => ({ default: m[name] })))
}

// Recarga la app en la misma ruta. Recibe la location para poder probarla sin navegar.
export function reloadPage(
  location: Pick<Location, "reload"> = window.location
): void {
  location.reload()
}
