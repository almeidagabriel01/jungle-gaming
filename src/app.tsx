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
  // A entrada que perdeu o hash (abaixo) guarda a chave da que ela substituiu: as duas são a mesma tela para a
  // restauração, mesmo que outra navegação atropele a troca antes de ela terminar.
  getScrollRestorationKey: (location) => location.state.scrollKey ?? location.state.__TSR_key ?? location.href,
})

/*
 * Rolagem além do scrollRestoration do router (os listeners dele vêm do `createRouter`, então rodam antes destes):
 * - Link para a própria tela (Início ou logo já no início): o router recarrega na mesma entrada do histórico e
 *   restauraria a posição atual. Como num link comum, vai ao topo. `invalidate` (troca de sessão) não conta.
 * - O hash (#mercado, #diario) é um pedido de rolagem, não estado da tela: depois que o router rola até a âncora,
 *   a entrada vira a mesma URL sem o hash, sem mexer na rolagem. Recarregar ou compartilhar o link não pula de novo
 *   para a seção e o `redirect` do login não carrega a âncora. Voltar e avançar restauram a posição.
 *   O `replace` cria uma chave nova; o `scrollKey` mantém a da entrada original (ver getScrollRestorationKey).
 */
let sameLocationLink = false
router.subscribe('onBeforeNavigate', ({ fromLocation, toLocation, hrefChanged }) => {
  // Mesma entrada (mesma chave): não é voltar/avançar entre duas entradas com a mesma URL.
  const sameEntry = fromLocation?.state.__TSR_key === toLocation.state.__TSR_key
  sameLocationLink = !!fromLocation && !hrefChanged && sameEntry && !router.state.matches.some((match) => match.invalid)
})
router.subscribe('onRendered', ({ toLocation }) => {
  if (sameLocationLink) {
    sameLocationLink = false
    window.scrollTo(0, 0)
  }
  if (!toLocation.hash) return
  const scrollKey = toLocation.state.scrollKey ?? toLocation.state.__TSR_key
  void router.navigate({ href: toLocation.pathname + toLocation.searchStr, replace: true, resetScroll: false, state: { scrollKey } })
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
  interface HistoryState {
    /** Chave de restauração herdada da entrada substituída (troca do hash). */
    scrollKey?: string
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
