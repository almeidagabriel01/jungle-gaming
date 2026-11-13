import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { queryClient } from '@/lib/query-client'
import { startRealtime } from '@/realtime/realtime'
import { bindSession } from '@/session/session'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // O cache é do TanStack Query; o router não guarda dados de loader por conta própria.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Ligado antes do primeiro render: guards de rota já podem disparar expiração de sessão.
bindSession(queryClient, router)

function App() {
  useEffect(() => startRealtime(queryClient), [])
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export function renderApp(container: HTMLElement) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
