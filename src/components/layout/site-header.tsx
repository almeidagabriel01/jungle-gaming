import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { ChevronDown, LogIn, Search, ShoppingCart } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { unavailable } from '@/lib/unavailable'
import { useCartCount } from '@/queries/cart'
import { useLogout, useUser } from '@/session/session'
import { SearchDialog } from './search-dialog'

type Section = 'home' | 'market' | 'learn' | null

/** Item ativo do menu: o detalhe, o carrinho e o pagamento ficam em "Mercado", como no layout. */
function useSection(): Section {
  const { pathname, hash } = useRouterState({ select: (s) => ({ pathname: s.location.pathname, hash: s.location.hash }) })
  if (/^\/(nfts|cart|checkout|orders)(\/|$)/.test(pathname)) return 'market'
  if (pathname !== '/') return null
  if (hash === 'mercado') return 'market'
  if (hash === 'diario') return 'learn'
  return 'home'
}

/** O Link só se marca ativo com caminho e hash exatos; o resto da regra é de `useSection`. */
const EXACT_HASH = { exact: true, includeHash: true } as const

const navItem = 'relative block py-[22px] text-[15px] transition-colors hover:text-accent-text'
const indicator =
  'after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 after:ease-[var(--ease-out-quint)] aria-[current=page]:font-bold aria-[current=page]:text-accent-text aria-[current=page]:after:scale-x-100'

/** Cabeçalho desktop (≥ md). No mobile a navegação é a barra inferior. */
export function SiteHeader() {
  const section = useSection()
  const count = useCartCount()
  const current = (s: Section) => (section === s ? ('page' as const) : undefined)

  return (
    <header className="max-md:hidden">
      <div className="page grid grid-cols-[1fr_auto_1fr] items-center border-b border-border-soft">
        <Link to="/" className="justify-self-start text-sm font-bold tracking-[0.1em]" aria-label="Kurio, página inicial">
          KURIO
        </Link>
        <nav aria-label="Principal">
          <ul className="flex gap-10">
            <li>
              <Link to="/" hash="" activeOptions={EXACT_HASH} aria-current={current('home')} className={cn(navItem, indicator)}>
                Início
              </Link>
            </li>
            <li>
              <Link to="/" hash="mercado" activeOptions={EXACT_HASH} aria-current={current('market')} className={cn(navItem, indicator)}>
                Mercado
              </Link>
            </li>
            <li>
              <button type="button" className={cn(navItem, 'cursor-pointer')} onClick={() => unavailable('A página de criadores')}>
                Criadores
              </button>
            </li>
            <li>
              <Link to="/" hash="diario" activeOptions={EXACT_HASH} aria-current={current('learn')} className={cn(navItem, indicator)}>
                Aprenda
              </Link>
            </li>
          </ul>
        </nav>
        <div className="flex items-center gap-4 justify-self-end">
          <SearchDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label="Buscar NFTs">
                <Search className="size-6" />
              </Button>
            }
          />
          <Link
            to="/cart"
            aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
            className="relative grid size-10 place-items-center rounded-md transition-colors hover:bg-raised"
          >
            <ShoppingCart className="size-6" />
            {count > 0 && (
              <span key={count} aria-hidden="true" className="absolute top-0.5 right-0 grid min-w-4 animate-[rise_400ms_var(--ease-out-quint)] place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}

function AccountMenu() {
  const user = useUser()
  const logout = useLogout()
  const router = useRouter()
  const href = useRouterState({ select: (s) => s.location.href })

  if (!user) {
    return (
      <Button asChild size="sm" className="h-[35px] px-2.5 text-base font-medium">
        <Link to="/login" search={{ redirect: href === '/login' ? undefined : href }}>
          <LogIn className="size-5" />
          Entrar
        </Link>
      </Button>
    )
  }

  const item = 'flex cursor-pointer items-center rounded-sm px-3 py-2 text-sm outline-none data-highlighted:bg-raised data-highlighted:text-accent-text'
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" className="h-[35px] gap-2 px-2 font-medium text-foreground" aria-label={`Conta de ${user.name}`}>
          <span aria-hidden="true" className="grid size-6 place-items-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" /> : user.name.charAt(0)}
          </span>
          {user.name.split(' ')[0]}
          <ChevronDown className="size-4 text-accent-text" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-48 animate-[rise_250ms_var(--ease-out-quint)] rounded-md border border-border-soft bg-card p-1 shadow-xl">
          <DropdownMenu.Label className="px-3 py-2 text-xs text-muted-foreground">{user.email}</DropdownMenu.Label>
          <DropdownMenu.Item asChild className={item}>
            <Link to="/profile">Meu perfil</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={item}>
            <Link to="/wallets">Carteiras</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={item}>
            <Link to="/favorites">Lista de interesse</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border-soft" />
          <DropdownMenu.Item
            className={item}
            disabled={logout.isPending}
            onSelect={() => {
              logout.mutate(undefined, { onSuccess: () => void router.navigate({ to: '/' }) })
            }}
          >
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
