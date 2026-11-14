import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { cn } from 'cn'
import { Skeleton } from '@/components/ui/skeleton'
import type { Nft } from '@/contracts/nft'
import { RARITY_LABEL } from '@/lib/labels'
import { eth } from '@/lib/money'
import { FavoriteButton } from './favorite-button'
import { Price } from './price'

/** Preço anterior (riscado) da edição que define o menor preço do NFT. */
const compareAtOf = (nft: Nft) => nft.editions.find((e) => eth.eq(e.price, nft.minPrice) && e.compareAtPrice)?.compareAtPrice ?? null

/**
 * Card do catálogo e dos carrosséis: arte emoldurada, nome e preço. O link do nome cobre o card
 * inteiro (um único alvo de foco); o coração fica acima do link.
 */
export function NftCard({
  nft,
  index = 0,
  priority = false,
  favorite = false,
  className,
}: {
  nft: Nft
  /** Posição na lista, para a entrada escalonada. */
  index?: number
  /** Primeiras imagens visíveis: carregam já (LCP), as demais sob demanda. */
  priority?: boolean
  /** Coração no canto (layout mobile do catálogo). */
  favorite?: boolean
  className?: string
}) {
  const image = nft.images[0]!
  const soldOut = nft.available === 0
  return (
    <article style={{ '--i': index } as CSSProperties} className={cn('group relative grid content-start gap-3', className)}>
      <div className="relative overflow-hidden rounded-[18px] bg-card p-1 transition-[background-color,box-shadow] duration-300 group-hover:bg-raised group-hover:shadow-[0_18px_40px_-18px_rgb(210_138_76/0.45)]">
        <img
          src={image.thumbnailUrl}
          srcSet={`${image.thumbnailUrl} 480w, ${image.url} 960w`}
          sizes="(min-width: 1024px) 260px, (min-width: 768px) 33vw, 50vw"
          alt={image.alt}
          width={480}
          height={480}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cn(
            'aspect-square w-full rounded-[16px] object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-[1.04] motion-reduce:group-hover:scale-100',
            soldOut && 'grayscale-[0.6]',
          )}
        />
        {nft.rarity !== 'common' && (
          <span className="absolute top-1 left-1 rounded-br-md rounded-tl-[16px] bg-primary px-3 py-1.5 text-[13px] font-bold tracking-wide text-primary-foreground uppercase">
            {RARITY_LABEL[nft.rarity]}
          </span>
        )}
        {soldOut && (
          <span className="absolute right-3 bottom-3 rounded-sm bg-background/90 px-2 py-1 text-xs font-bold uppercase">Esgotado</span>
        )}
      </div>
      <div className="grid gap-1">
        <h3 className="text-[15px] leading-5">
          <Link to="/nfts/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:rounded-[18px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ring">
            {nft.name}
          </Link>
        </h3>
        <Price value={nft.minPrice} compareAt={compareAtOf(nft)} />
      </div>
      {favorite && <FavoriteButton nft={nft} variant="icon" className="absolute top-3 right-3 z-10" />}
    </article>
  )
}

/** Mesmas dimensões do card (sem deslocamento ao carregar). */
export function NftCardSkeleton() {
  return (
    <div className="grid content-start gap-3">
      <div className="rounded-[18px] bg-card p-1">
        <Skeleton className="aspect-square w-full rounded-[16px]" />
      </div>
      <div className="grid gap-1.5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-[22px] w-1/3" />
      </div>
    </div>
  )
}
