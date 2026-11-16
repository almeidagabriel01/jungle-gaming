/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Camada de mocks: só o `tough-cookie` (usado pelo MSW) recebe a versão mínima do `tldts`, sem a lista de
 * sufixos públicos (ver src/mocks/public-suffix.ts). Qualquer outro importador continua com o pacote real.
 */
function mockCookieSuffixes(): Plugin {
  const shim = fileURLToPath(new URL('./src/mocks/public-suffix.ts', import.meta.url))
  return {
    name: 'mock-cookie-suffixes',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === 'tldts' && importer?.includes('/tough-cookie/')) return shim
    },
  }
}

export default defineConfig({
  plugins: [
    // Must come before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    mockCookieSuffixes(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  // Testes unitários só em src/; os specs do Playwright (e2e/) ficam fora.
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
