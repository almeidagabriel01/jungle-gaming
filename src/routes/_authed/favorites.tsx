import { createFileRoute, Link } from '@tanstack/react-router'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/money'
import { useFavorites, useToggleFavorite } from '@/queries/catalog'

export const Route = createFileRoute('/_authed/favorites')({
  component: FavoritesPage,
})

function FavoritesPage() {
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  return (
    <section aria-labelledby="fav-title" className="grid gap-4">
      <h1 id="fav-title" className="text-2xl font-semibold">
        Favoritos
      </h1>
      {favorites.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : favorites.isError ? (
        <QueryError error={favorites.error} onRetry={() => void favorites.refetch()} />
      ) : favorites.data.items.length === 0 ? (
        <p>
          Você ainda não favoritou nenhum NFT.{' '}
          <Link to="/" className="underline">
            Explorar o catálogo
          </Link>
        </p>
      ) : (
        <ul className="grid gap-3" data-testid="favorites-list">
          {favorites.data.items.map((nft) => (
            <li key={nft.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Link to="/nfts/$nftId" params={{ nftId: nft.id }} className="hover:underline">
                {nft.name}
              </Link>
              <span className="tabular-nums">{formatEth(nft.minPrice)}</span>
              <Button variant="ghost" size="sm" onClick={() => toggle.mutate({ nft, favorite: false })}>
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
