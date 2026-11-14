import { Link, useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Heart, House, ScanSearch, ShoppingCart, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { useCartCount } from '@/queries/cart'
import { useUser } from '@/session/session'
import { SearchDialog } from './search-dialog'

const tab =
  'relative grid size-12 place-items-center rounded-full text-subtle transition-colors hover:text-foreground aria-[current=page]:text-accent-text [&_svg]:size-6'

/** Barra de navegação inferior do mobile (frame Mobile / Início). */
export function MobileNav() {
  const user = useUser()
  const count = useCartCount()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const current = (path: string) => (pathname === path ? ('page' as const) : undefined)

  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <ul className="relative mx-auto flex h-[72px] max-w-[480px] items-center justify-around rounded-t-[28px] border-t border-border bg-card px-4 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgb(0_0_0/0.45)]">
        <li>
          <Link to="/" aria-current={current('/')} className={tab} aria-label="Início">
            <House />
          </Link>
        </li>
        <li>
          <Link to="/favorites" aria-current={current('/favorites')} className={tab} aria-label="Lista de interesse">
            <Heart />
          </Link>
        </li>
        <li className="-mt-10">
          <SearchDialog
            trigger={
              <button
                type="button"
                aria-label="Buscar NFTs"
                className="grid size-16 cursor-pointer place-items-center rounded-full border-4 border-background bg-gradient-to-br from-[#dd9a5f] to-[#a96a38] text-primary-foreground shadow-lg transition-transform active:scale-95 [&_svg]:size-7"
              >
                <ScanSearch />
              </button>
            }
          />
        </li>
        <li>
          <Link to="/cart" className={tab} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <ShoppingCart />
            {count > 0 && (
              <span aria-hidden="true" className="absolute top-1.5 right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </li>
        <li>
          <Link
            to={user ? '/profile' : '/login'}
            aria-current={current('/profile')}
            className={tab}
            aria-label={user ? `Perfil de ${user.name}` : 'Entrar'}
          >
            <UserRound />
          </Link>
        </li>
      </ul>
    </nav>
  )
}

/**
 * Barra superior das telas mobile (voltar + título + ação), como nos frames de detalhe,
 * carrinho e pagamento. Sem histórico (acesso direto), "voltar" leva ao início.
 */
export function MobileTopBar({ title, action, className }: { title?: string; action?: ReactNode; className?: string }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <div className={cn('grid grid-cols-[40px_1fr_40px] items-center gap-2 py-4 md:hidden', className)}>
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => {
          if (canGoBack) router.history.back()
          else void router.navigate({ to: '/' })
        }}
        className="grid size-10 cursor-pointer place-items-center rounded-full bg-raised text-accent-text transition-transform active:scale-95"
      >
        <ChevronLeft className="size-5" />
      </button>
      {title ? <p className="text-center text-lg font-bold">{title}</p> : <span />}
      <div className="justify-self-end">{action}</div>
    </div>
  )
}
