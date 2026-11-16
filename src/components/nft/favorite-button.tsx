import { useNavigate, useRouterState } from '@tanstack/react-router'
import type { MouseEvent } from 'react'
import { HeartFilledIcon, HeartIcon } from '@/components/icons/shell-icons'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import type { Nft } from '@/contracts/nft'
import { useFavorites, useToggleFavorite } from '@/queries/catalog'
import { useUser } from '@/session/session'

/**
 * Favoritar (mutation otimista com rollback em `useToggleFavorite`). Visitante vai ao login
 * e volta para a mesma tela. `icon` é o coração redondo do card e da barra mobile.
 */
export function FavoriteButton({
  nft,
  variant = 'button',
  className,
  onToggle,
}: {
  nft: Nft
  variant?: 'button' | 'icon'
  className?: string
  /** Chamado antes da mutation (ex.: a lista de interesse move o foco antes de o card sair). */
  onToggle?: (favorite: boolean, button: HTMLButtonElement) => void
}) {
  const user = useUser()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const isFavorite = favorites.data?.items.some((n) => n.id === nft.id) ?? false
  const label = isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!user) {
      void navigate({ to: '/login', search: { redirect: href } })
      return
    }
    onToggle?.(!isFavorite, event.currentTarget)
    toggle.mutate({ nft, favorite: !isFavorite })
  }
  const heart = isFavorite ? <HeartFilledIcon className="animate-[rise_300ms_var(--ease-out-quint)]" /> : <HeartIcon />

  if (variant === 'icon') {
    return (
      <button
        type="button"
        aria-pressed={isFavorite}
        aria-label={label}
        disabled={user !== null && favorites.isPending}
        onClick={onClick}
        className={cn(
          'grid size-7 cursor-pointer place-items-center rounded-full border border-border bg-raised text-accent-text transition-transform active:scale-90 disabled:opacity-50 [&_svg]:h-auto [&_svg]:w-[15px]',
          className,
        )}
      >
        {heart}
      </button>
    )
  }

  return (
    <Button variant="outline" aria-pressed={isFavorite} aria-label={label} disabled={user !== null && favorites.isPending} onClick={onClick} className={cn('font-medium', className)}>
      {heart}
      {isFavorite ? 'Favoritado' : 'Favoritar'}
    </Button>
  )
}
