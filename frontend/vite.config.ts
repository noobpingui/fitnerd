import path from 'node:path'
// defineConfig sale de "vitest/config" (no de "vite") especificamente para que
// TypeScript reconozca la clave "test" de mas abajo - vitest/config reexporta el
// defineConfig normal de Vite, con los tipos de Vitest ya mezclados encima.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // jsdom simula un DOM de navegador dentro de Node - sin esto, Vitest corre en
    // un entorno sin document/window, y cualquier test que use React Testing
    // Library (que necesita "renderizar" a un DOM real) fallaria de entrada.
    environment: 'jsdom',
    // Corre antes de CADA archivo de test - ahi importamos los matchers extra de
    // jest-dom (toBeInTheDocument, etc.), para no tener que importarlos a mano en
    // cada archivo.
    setupFiles: './src/test/setup.ts',
  },
})
