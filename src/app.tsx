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

// O hash (#mercado, #diario) é um pedido de rolagem, não estado da tela. Depois que o router rola até a âncora
// (o listener dele vem do `createRouter`, antes deste), a entrada é trocada pela mesma URL sem o hash e sem mexer
// na rolagem. Assim recarregar ou compartilhar o link não pula de novo para a seção e o `redirect` do login não
// carrega a âncora. Voltar e avançar restauram a posição normalmente.
router.subscribe('onRendered', ({ toLocation }) => {
  if (!toLocation.hash) return
  void router.navigate({ href: toLocation.pathname + toLocation.searchStr, replace: true, resetScroll: false })
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
