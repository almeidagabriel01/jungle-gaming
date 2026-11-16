import { createFileRoute, Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { AccountLayout } from '@/components/layout/account-layout'
import { FavoriteButton } from '@/components/nft/favorite-button'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { moveFocusAfterRemoval } from '@/lib/focus'
import { useFavorites } from '@/queries/catalog'

export const Route = createFileRoute('/_authed/favorites')({
  component: FavoritesPage,
})

const grid = 'grid grid-cols-2 *:min-w-0 gap-x-6 gap-y-8 lg:grid-cols-3'

/** Lista de interesse: os favoritos do colecionador; o coração do card remove (otimista, com rollback). */
function FavoritesPage() {
  const favorites = useFavorites()
  return (
    <AccountLayout>
      <section aria-labelledby="fav-title" className="grid gap-6 md:pt-6">
        <h1 id="fav-title" tabIndex={-1} className="text-xl font-bold outline-none">
          Lista de interesse
        </h1>
        {/* Os cards usam h3: o nível intermediário existe só para leitores de tela. */}
        <h2 className="sr-only">NFTs favoritados</h2>
        {favorites.isPending ? (
          <div role="status" aria-label="Carregando favoritos" className={grid}>
            {Array.from({ length: 6 }, (_, i) => (
              <NftCardSkeleton key={i} />
            ))}
          </div>
        ) : favorites.isError ? (
          <QueryError error={favorites.error} onRetry={() => void favorites.refetch()} />
        ) : favorites.data.items.length === 0 ? (
          <div className="grid animate-rise justify-items-start gap-4 rounded-sm bg-card p-6">
            <p className="text-[15px] text-muted-foreground">Você ainda não favoritou nenhum NFT.</p>
            <Button asChild>
              <Link to="/" hash="mercado">
                Explorar o catálogo
              </Link>
            </Button>
          </div>
        ) : (
          <ul className={`${grid} stagger`} data-testid="favorites-list">
            {favorites.data.items.map((nft, i) => (
              <li key={nft.id} style={{ '--i': i } as CSSProperties} className="relative min-w-0">
                <NftCard nft={nft} />
                {/* O coração do card só aparece no mobile; aqui ele é a ação de remover em todas as larguras. */}
                <FavoriteButton
                  nft={nft}
                  variant="icon"
                  className="absolute top-3 right-2.5 z-10"
                  // A remoção é otimista (o card sai na hora): o foco vai antes para o card vizinho ou o título.
                  onToggle={(favorite, button) => {
                    if (!favorite) moveFocusAfterRemoval(button, 'button[aria-pressed]', document.getElementById('fav-title'))
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AccountLayout>
  )
}
