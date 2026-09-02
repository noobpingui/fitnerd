// Lista fija de tiendas - a diferencia de las imagenes del slideshow de
// /home (que se auto-descubren con import.meta.glob porque la cantidad por
// card varia y crece con el tiempo), aca cada tienda es una entrada
// deliberada con su propio nombre/logo/link, asi que un array a mano tiene
// mas sentido que un descubrimiento automatico de carpeta.
export type Store = {
  name: string
  logo: string
  url: string
}

export const STORES: Store[] = []
