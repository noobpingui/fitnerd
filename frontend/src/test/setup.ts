// Corre automaticamente antes de cada archivo de test (ver setupFiles en
// vite.config.ts). Este import por si solo no exporta nada que usemos
// directo - lo que hace es "extender" expect() de Vitest con matchers
// pensados para el DOM (toBeInTheDocument, toBeDisabled, toHaveTextContent,
// etc.) que sin esto no existirian.
import '@testing-library/jest-dom/vitest'
import { afterEach } from "vitest"
import { cleanup, configure } from "@testing-library/react"

// Spec 017: las pantallas se cargan bajo demanda, así que los tests que montan
// el router esperan también la importación dinámica dentro de findBy y waitFor.
// Un segundo de espera por defecto puede quedarse corto en CI.
configure({ asyncUtilTimeout: 3000 })

// Sin "globals: true" en vite.config.ts (a proposito - ver el comentario
// ahi), React Testing Library no puede detectar solo un afterEach global
// para desmontar cada componente renderizado entre tests. Sin este
// cleanup explicito, el componente de un test queda pegado en el DOM
// cuando arranca el siguiente - un test que renderiza el MISMO componente
// dos veces en el mismo archivo terminaria viendo dos copias a la vez
// (esto paso de verdad armando el primer test de un componente).
afterEach(() => {
  cleanup()
})
