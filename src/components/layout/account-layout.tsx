import { Link, useRouter } from '@tanstack/react-router'
import { Download, Heart, LogOut, MapPin, Percent, ShoppingCart, TriangleAlert, UserRound, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { unavailable } from '@/lib/unavailable'
import { useLogout } from '@/session/session'

type Item = { label: string; Icon: LucideIcon } & ({ to: '/profile' | '/wallets' | '/favorites' } | { soon: true })

const ITEMS: Item[] = [
  { label: 'Dados do perfil', Icon: UserRound, to: '/profile' },
  { label: 'Carteiras', Icon: MapPin, to: '/wallets' },
  { label: 'Atividade', Icon: ShoppingCart, soon: true },
  { label: 'Lista de interesse', Icon: Heart, to: '/favorites' },
  { label: 'Ofertas', Icon: Percent, soon: true },
  { label: 'Arquivos baixados', Icon: Download, soon: true },
  { label: 'Suporte', Icon: TriangleAlert, soon: true },
]

const itemClass =
  'relative flex shrink-0 cursor-pointer items-center gap-3 rounded-sm px-4 py-3 text-[15px] text-accent-text transition-colors hover:bg-raised md:rounded-none md:py-[11px] aria-[current=page]:bg-raised aria-[current=page]:text-foreground md:aria-[current=page]:before:absolute md:aria-[current=page]:before:inset-y-0 md:aria-[current=page]:before:left-0 md:aria-[current=page]:before:w-1.5 md:aria-[current=page]:before:bg-primary [&_svg]:size-[18px] [&_svg]:shrink-0'

/**
 * Área do colecionador (frames Perfil e Carteiras): menu "Meu perfil" à esquerda no desktop,
 * faixa rolável no mobile. Itens fora do escopo avisam em vez de navegar.
 */
export function AccountLayout({ children }: { children: ReactNode }) {
  const logout = useLogout()
  const router = useRouter()
  return (
    <div className="page grid items-start gap-6 pt-4 md:grid-cols-[310px_1fr] md:gap-7 md:pt-8">
      <nav aria-labelledby="account-nav-title" className="md:rounded-sm md:bg-card md:pb-1">
        <h2 id="account-nav-title" className="px-2.5 pt-2 pb-2 text-xl font-bold md:pt-6">
          Meu perfil
        </h2>
        <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:block md:px-0 md:pb-0">
          {ITEMS.map(({ label, Icon, ...target }) => (
            <li key={label}>
              {'to' in target ? (
                <Link to={target.to} className={itemClass} activeProps={{ 'aria-current': 'page' }}>
                  <Icon aria-hidden="true" />
                  {label}
                </Link>
              ) : (
                <button type="button" className={itemClass} onClick={() => unavailable(label)}>
                  <Icon aria-hidden="true" />
                  {label}
                </button>
              )}
            </li>
          ))}
          <li className="md:mt-1 md:border-t md:border-border-soft">
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() => {
                logout.mutate(undefined, { onSuccess: () => void router.navigate({ to: '/' }) })
              }}
              className={`${itemClass} w-full font-bold text-foreground`}
            >
              <LogOut aria-hidden="true" className="text-accent-text" />
              Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
