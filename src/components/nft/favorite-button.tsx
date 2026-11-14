import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import type { Nft } from '@/contracts/nft'
import { useFavorites, useToggleFavorite } from '@/queries/catalog'
import { useUser } from '@/session/session'

/**
 * Favoritar (mutation otimista com rollback em `useToggleFavorite`). Visitante vai ao login
 * e volta para a mesma tela. `icon` é o coração redondo do card e da barra mobile.
 */
export function FavoriteButton({ nft, variant = 'button', className }: { nft: Nft; variant?: 'button' | 'icon'; className?: string }) {
  const user = useUser()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const isFavorite = favorites.data?.items.some((n) => n.id === nft.id) ?? false
  const label = isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`

  const onClick = () => {
    if (!user) {
      void navigate({ to: '/login', search: { redirect: href } })
      return
    }
    toggle.mutate({ nft, favorite: !isFavorite })
  }
  const heart = <Heart className={cn('transition-transform duration-300', isFavorite && 'scale-110 fill-current')} />

  if (variant === 'icon') {
    return (
      <button
        type="button"
        aria-pressed={isFavorite}
        aria-label={label}
        disabled={user !== null && favorites.isPending}
        onClick={onClick}
        className={cn(
          'grid size-[35px] cursor-pointer place-items-center rounded-full border border-border-soft bg-background/85 text-accent-text backdrop-blur-sm transition-transform active:scale-90 disabled:opacity-50 [&_svg]:size-[18px]',
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
