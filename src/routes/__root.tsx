import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useNotices } from '@/lib/announcer'
import { useCart } from '@/queries/cart'
import { realtimeStatus } from '@/realtime/realtime'
import { ensureSession, useLogout, useUser } from '@/session/session'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Recupera e valida a sessão salva antes da primeira tela (refresh mantém o login).
  beforeLoad: () => ensureSession(),
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:p-2">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-6 outline-none">
        <Outlet />
      </main>
      <NoticesToToasts />
      <Toaster position="top-right" />
    </>
  )
}

function Header() {
  const user = useUser()
  const cart = useCart()
  const logout = useLogout()
  const router = useRouter()
  const count = cart.data?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0
  const status = useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.get)

  return (
    <header className="border-b">
      <nav aria-label="Principal" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link to="/" className="font-semibold">
          NFT Marketplace
        </Link>
        <Link to="/cart" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
          Carrinho ({count})
        </Link>
        {user ? (
          <>
            <Link to="/favorites">Favoritos</Link>
            <Link to="/profile">Perfil</Link>
            <Link to="/wallets">Carteiras</Link>
            <span className="text-sm text-muted-foreground">Olá, {user.name}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={logout.isPending}
              onClick={() => {
                logout.mutate(undefined, { onSuccess: () => void router.navigate({ to: '/' }) })
              }}
            >
              Sair
            </Button>
          </>
        ) : (
          <>
            <Link to="/login">Entrar</Link>
            <Link to="/register">Criar conta</Link>
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground" data-testid="realtime-status">
          Tempo real: {status === 'connected' ? 'conectado' : status === 'connecting' ? 'conectando' : 'desconectado'}
        </span>
      </nav>
    </header>
  )
}

/** Espelha os avisos (mutations e tempo real) em toasts; o Toaster já é uma região aria-live. */
function NoticesToToasts() {
  const notices = useNotices()
  const shown = useRef(new Set<number>())
  useEffect(() => {
    for (const notice of notices) {
      if (shown.current.has(notice.id)) continue
      shown.current.add(notice.id)
      if (notice.tone === 'error') toast.error(notice.message)
      else toast(notice.message)
    }
  }, [notices])
  return null
}

function NotFound() {
  return (
    <section aria-labelledby="nf-title" className="grid gap-3">
      <h1 id="nf-title" className="text-2xl font-semibold">
        Página não encontrada
      </h1>
      <p>O endereço acessado não existe.</p>
      <Link to="/" className="underline">
        Voltar ao início
      </Link>
    </section>
  )
}
