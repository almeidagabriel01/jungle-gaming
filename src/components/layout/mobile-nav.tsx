import { Link, useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { ChevronLeftIcon, HeartFilledIcon, HomeIcon, ScanIcon, ShopIcon, UserIcon } from '@/components/icons/shell-icons'
import { useCartCount } from '@/queries/cart'
import { useUser } from '@/session/session'
import { SearchDialog } from './search-dialog'

/** Alvo de 44 px centrado no ícone de 20 px do frame (topo do ícone a 40 px do topo da barra). */
const tab =
  'absolute top-7 grid size-11 -translate-x-1/2 place-items-center text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-accent-text [&_svg]:size-5'
const BAR = 'h-[95px] bg-card'

/**
 * Barra inferior do frame Mobile / Início (Tab Bar 414×95, recorte central e botão de 65 px).
 * As laterais esticam em telas mais largas; o recorte (vetor do Figma) fica fixo no centro.
 */
export function MobileNav() {
  const user = useUser()
  const count = useCartCount()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const current = (path: string) => (pathname === path ? ('page' as const) : undefined)

  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] drop-shadow-[0_-10px_30px_rgb(10_6_4/0.45)] md:hidden">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[env(safe-area-inset-bottom)] bg-card" />
      <ul className="relative flex">
        <li className={`relative flex-1 rounded-tl-[29px] ${BAR}`}>
          <Link to="/" aria-current={current('/')} className={`${tab} left-[calc(27.5%+10px)]`} aria-label="Início">
            <HomeIcon />
          </Link>
          <Link to="/favorites" aria-current={current('/favorites')} className={`${tab} left-[calc(82.4%+10px)]`} aria-label="Lista de interesse">
            <HeartFilledIcon />
          </Link>
        </li>
        <li className="relative -mx-px h-[95px] w-[153.7px] shrink-0">
          <svg aria-hidden="true" viewBox="0 0 151.7 95" preserveAspectRatio="none" className="absolute inset-0 size-full fill-card">
            <path d="M0 0C13.75 0 25.98 8.2 31.83 20.65C39.59 37.18 56.39 48.62 75.85 48.62C95.31 48.62 112.11 37.17 119.87 20.65C125.72 8.2 137.94 0 151.7 0L151.7 95L0 95Z" />
          </svg>
          <SearchDialog
            trigger={
              <button
                type="button"
                aria-label="Buscar NFTs"
                className="absolute -top-[31px] left-1/2 grid size-[65px] -translate-x-1/2 cursor-pointer place-items-center rounded-full bg-linear-to-b from-primary/40 to-primary text-foreground transition-transform active:scale-95"
              >
                <ScanIcon className="h-6 w-[27px]" />
              </button>
            }
          />
        </li>
        <li className={`relative flex-1 rounded-tr-[29px] ${BAR}`}>
          <Link to="/cart" aria-current={current('/cart')} className={`${tab} left-[calc(6.9%+10px)]`} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <ShopIcon />
            {count > 0 && (
              <span aria-hidden="true" className="absolute top-1.5 left-[25px] grid h-4 min-w-4 place-items-center rounded-full bg-primary px-[3px] text-[10px] leading-[13px] font-medium text-primary-foreground ring-2 ring-card">
                {count}
              </span>
            )}
          </Link>
          <Link
            to={user ? '/profile' : '/login'}
            aria-current={current('/profile')}
            className={`${tab} left-[calc(54.2%+10px)]`}
            aria-label={user ? `Perfil de ${user.name}` : 'Entrar'}
          >
            <UserIcon />
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
    <div className={cn('grid grid-cols-[minmax(35px,auto)_1fr_minmax(35px,auto)] items-center gap-2 pt-8 pb-5 md:hidden', className)}>
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => {
          if (canGoBack) router.history.back()
          else void router.navigate({ to: '/' })
        }}
        className="grid size-[35px] cursor-pointer place-items-center rounded-full bg-raised text-accent-text transition-transform active:scale-95"
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      {title ? <p className="text-center text-lg font-bold">{title}</p> : <span />}
      <div className="justify-self-end">{action}</div>
    </div>
  )
}
