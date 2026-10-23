// Corre automáticamente antes de cada archivo de test (ver setupFiles en
// vite.config.ts). Este import por sí solo no exporta nada que se use
// directamente: lo que hace es "extender" expect() de Vitest con matchers
// pensados para el DOM (toBeInTheDocument, toBeDisabled, toHaveTextContent,
// etc.) que sin esto no existirían.
import '@testing-library/jest-dom/vitest'
import { afterEach } from "vitest"
import { cleanup, configure } from "@testing-library/react"

// Spec 017: las pantallas se cargan bajo demanda, así que los tests que montan
// el router esperan también la importación dinámica dentro de findBy y waitFor.
// Un segundo de espera por defecto puede quedarse corto en CI.
configure({ asyncUtilTimeout: 3000 })

// Sin "globals: true" en vite.config.ts (a propósito; ver el comentario
// allí), React Testing Library no puede detectar un afterEach global
// para desmontar cada componente renderizado entre tests. Sin este
// cleanup explícito, el componente de un test queda pegado en el DOM
// cuando arranca el siguiente: un test que renderiza el MISMO componente
// dos veces en el mismo archivo terminaría viendo dos copias a la vez
// (esto pasó de verdad al armar el primer test de un componente).
afterEach(() => {
  cleanup()
})
