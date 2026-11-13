import { createFileRoute, Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError } from '@/api/client'
import { FormError } from '@/components/field'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Nft } from '@/contracts/nft'
import { announce } from '@/lib/announcer'
import { apiFieldErrors } from '@/lib/forms'
import { NETWORK_LABEL, RARITY_LABEL } from '@/lib/labels'
import { formatEth } from '@/lib/money'
import { useAddToCart, useCart } from '@/queries/cart'
import { useFavorites, useNft, useToggleFavorite } from '@/queries/catalog'
import { useUser } from '@/session/session'

export const Route = createFileRoute('/nfts/$nftId')({
  component: NftDetailPage,
})

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const nft = useNft(nftId)

  if (nft.isPending) return <DetailSkeleton />
  if (nft.isError) {
    if (nft.error instanceof ApiError && nft.error.status === 404) {
      return (
        <section aria-labelledby="nf-title" className="grid gap-3">
          <h1 id="nf-title" className="text-2xl font-semibold">
            NFT não encontrado
          </h1>
          <p>Este NFT não existe ou foi removido.</p>
          <Link to="/" className="underline">
            Voltar ao catálogo
          </Link>
        </section>
      )
    }
    return <QueryError error={nft.error} onRetry={() => void nft.refetch()} title="Não foi possível carregar o NFT" />
  }
  return <NftDetail nft={nft.data} />
}

function NftDetail({ nft }: { nft: Nft }) {
  const [imageIndex, setImageIndex] = useState(0)
  const [editionId, setEditionId] = useState(() => (nft.editions.find((e) => e.available > 0) ?? nft.editions[0]!).id)
  const [quantity, setQuantity] = useState(1)
  const cart = useCart()
  const add = useAddToCart()
  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]!
  const inCart = cart.data?.items.find((i) => i.editionId === edition.id)?.quantity ?? 0
  const maxQuantity = Math.max(0, edition.available - inCart)
  const image = nft.images[imageIndex] ?? nft.images[0]!

  const changeQuantity = (value: number) => {
    setQuantity(Math.min(Math.max(1, Math.trunc(value) || 1), Math.max(1, maxQuantity)))
  }

  return (
    <article aria-labelledby="nft-title" className="grid gap-6 md:grid-cols-2">
      <section aria-label="Galeria" className="grid gap-3">
        <img src={image.url} alt={image.alt} width={800} height={800} className="aspect-square w-full rounded-lg object-cover" fetchPriority="high" />
        <div className="flex gap-2">
          {nft.images.map((img, i) => (
            <button
              key={img.url + String(i)}
              type="button"
              onClick={() => {
                setImageIndex(i)
              }}
              aria-label={`Ver imagem ${i + 1} de ${nft.images.length}`}
              aria-pressed={i === imageIndex}
              className="size-16 overflow-hidden rounded-md border aria-pressed:ring-2 aria-pressed:ring-ring"
            >
              <img src={img.thumbnailUrl} alt="" width={64} height={64} className="size-full object-cover" />
            </button>
          ))}
        </div>
      </section>

      <div className="grid content-start gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{nft.collection.name}</p>
          <h1 id="nft-title" className="text-3xl font-semibold">
            {nft.name}
          </h1>
          <p className="text-sm">Criado por {nft.creator.name}</p>
        </div>
        <p>{nft.description}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt>ID do token</dt>
          <dd>#{nft.tokenId}</dd>
          <dt>Atributos</dt>
          <dd>{[...nft.attributes, RARITY_LABEL[nft.rarity]].join(', ')}</dd>
          <dt>Rede</dt>
          <dd>{NETWORK_LABEL[nft.network]}</dd>
          <dt>Contrato</dt>
          <dd className="break-all">
            {nft.contract.address} · {nft.contract.standard}
          </dd>
          <dt>Direitos autorais</dt>
          <dd>{nft.royaltyPercent.toLocaleString('pt-BR')}% nas vendas secundárias</dd>
          <dt>Avaliações</dt>
          <dd>
            {nft.rating.average.toLocaleString('pt-BR')} de 5 · {nft.rating.count} avaliações de colecionadores
          </dd>
        </dl>

        <fieldset className="grid gap-2">
          <legend className="font-medium">Edição</legend>
          {nft.editions.map((e) => (
            <label key={e.id} className="flex items-center justify-between gap-3 rounded-md border p-3 has-[:checked]:border-foreground">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="edition"
                  value={e.id}
                  checked={e.id === edition.id}
                  onChange={() => {
                    setEditionId(e.id)
                    setQuantity(1)
                  }}
                />
                {e.name}
              </span>
              <span className="text-right text-sm tabular-nums">
                <span data-testid={`edition-price-${e.id}`}>{formatEth(e.price)}</span>
                <br />
                {e.available > 0 ? `${e.available} de ${e.supply} disponíveis` : 'Esgotada'}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex items-end gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Quantidade</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(1, maxQuantity)}
              step={1}
              value={quantity}
              disabled={maxQuantity === 0}
              onChange={(e) => {
                changeQuantity(e.target.valueAsNumber)
              }}
              aria-describedby="quantity-hint"
              className="h-9 w-24 rounded-md border px-2"
            />
          </label>
          <Button
            disabled={maxQuantity === 0 || add.isPending}
            onClick={() => {
              add.mutate(
                { nftId: nft.id, editionId: edition.id, quantity },
                {
                  onSuccess: () => {
                    announce(`${quantity}× ${nft.name} (${edition.name}) adicionado ao carrinho.`)
                    setQuantity(1)
                  },
                },
              )
            }}
          >
            {add.isPending ? 'Adicionando…' : 'Adicionar ao carrinho'}
          </Button>
          <FavoriteButton nft={nft} />
        </div>
        <p id="quantity-hint" className="text-sm text-muted-foreground">
          {edition.available === 0
            ? 'Esta edição está esgotada.'
            : maxQuantity === 0
              ? `Você já tem todas as ${edition.available} unidades disponíveis no carrinho.`
              : `Até ${maxQuantity} unidade(s)${inCart > 0 ? ` (${inCart} já no carrinho)` : ''}.`}
        </p>
        {add.isError && <FormError message={apiFieldErrors(add.error).quantity ?? apiFieldErrors(add.error)._} />}
      </div>
    </article>
  )
}

function FavoriteButton({ nft }: { nft: Nft }) {
  const user = useUser()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const isFavorite = favorites.data?.items.some((n) => n.id === nft.id) ?? false

  return (
    <Button
      variant="outline"
      aria-pressed={isFavorite}
      disabled={user !== null && favorites.isPending}
      onClick={() => {
        if (!user) {
          void navigate({ to: '/login', search: { redirect: href } })
          return
        }
        toggle.mutate({ nft, favorite: !isFavorite })
      }}
    >
      {isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
    </Button>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Carregando NFT" className="grid gap-6 md:grid-cols-2">
      <Skeleton className="aspect-square w-full" />
      <div className="grid content-start gap-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-1/2" />
      </div>
    </div>
  )
}
