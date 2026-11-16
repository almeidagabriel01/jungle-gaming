import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useNotices } from '@/lib/announcer'
import { MobileNav } from '@/components/layout/mobile-nav'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { useShowsMobileNav } from '@/components/layout/use-shows-mobile-nav'
import { ensureSession } from '@/session/session'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Recupera e valida a sessão salva antes da primeira tela (refresh mantém o login).
  beforeLoad: () => ensureSession(),
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const showsMobileNav = useShowsMobileNav()
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-sm bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      {/* min-h: o rodapé começa fora da dobra, então o conteúdo que chega da API não o empurra na tela (CLS). */}
      <main id="conteudo" tabIndex={-1} className={cn('min-h-dvh outline-none', showsMobileNav && 'pb-24 md:pb-0')}>
        <Outlet />
      </main>
      <SiteFooter />
      {showsMobileNav && <MobileNav />}
      <NoticesToToasts />
      <Toaster position="top-right" />
    </>
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
      const action = notice.retry && { label: 'Tentar novamente', onClick: notice.retry }
      if (notice.tone === 'error') toast.error(notice.message, action ? { action } : undefined)
      else toast(notice.message)
    }
  }, [notices])
  return null
}

function NotFound() {
  return (
    <section aria-labelledby="nf-title" className="page grid justify-items-start gap-4 py-24">
      <p className="text-sm font-bold tracking-[0.2em] text-accent-text">ERRO 404</p>
      <h1 id="nf-title" className="text-3xl font-bold md:text-[43px] md:leading-[70px]">
        Página não encontrada
      </h1>
      <p className="text-muted-foreground">O endereço acessado não existe ou foi removido.</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  )
}
