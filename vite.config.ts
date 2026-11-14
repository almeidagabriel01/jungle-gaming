import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // Must come before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Camada de mocks: lista de sufixos públicos sem uso (ver src/mocks/public-suffix.ts).
      tldts: fileURLToPath(new URL('./src/mocks/public-suffix.ts', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
