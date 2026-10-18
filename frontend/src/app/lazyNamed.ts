import type { ComponentType, LazyExoticComponent } from "react"

// React.lazy para un módulo con export con nombre: lazyNamed(() => import("…"), "LoginPage").
export function lazyNamed<K extends string>(
  _load: () => Promise<Record<K, ComponentType>>,
  _name: K
): LazyExoticComponent<ComponentType> {
  throw new Error("not implemented")
}

// Recarga la app en la misma ruta. Recibe la location para poder probarla sin navegar.
export function reloadPage(
  _location: Pick<Location, "reload"> = window.location
): void {
  throw new Error("not implemented")
}
