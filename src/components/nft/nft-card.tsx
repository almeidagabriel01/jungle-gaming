import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { cn } from 'cn'
import { Skeleton } from '@/components/ui/skeleton'
import type { Nft } from '@/contracts/nft'
import { RARITY_LABEL } from '@/lib/labels'
import { eth } from '@/lib/money'
import { FavoriteButton } from './favorite-button'
import { Price } from './price'

/** Preço anterior da edição que define o menor preço do NFT. */
const compareAtOf = (nft: Nft) => nft.editions.find((e) => eth.eq(e.price, nft.minPrice) && e.compareAtPrice)?.compareAtPrice ?? null

/**
 * Card do catálogo e dos carrosséis (frames "Product Grid"): desktop 258×300 com a arte 250 r15
 * sobre Surface Card; mobile 175×200 r20 em gradiente com a arte 168 r16. O link do nome cobre o
 * card inteiro (um único alvo de foco); o coração fica acima do link.
 */
export function NftCard({
  nft,
  index = 0,
  priority = false,
  favorite = false,
  compact = false,
  artAlign = 'center',
  className,
}: {
  nft: Nft
  /** Posição na lista, para a entrada escalonada. */
  index?: number
  /** Primeiras imagens visíveis: carregam já (LCP), as demais sob demanda. */
  priority?: boolean
  /** Coração no canto (layout mobile do catálogo). */
  favorite?: boolean
  /** Tipografia dos carrosséis do layout em todas as larguras: nome 15/20 e preço 16/16, sem espaço entre eles. */
  compact?: boolean
  /** Grade mobile do layout: arte no alto na coluna esquerda e embaixo na direita (12/20 px). */
  artAlign?: 'start' | 'center' | 'end'
  className?: string
}) {
  const image = nft.images[0]!
  const soldOut = nft.available === 0
  return (
    <article style={{ '--i': index } as CSSProperties} className={cn('group relative grid content-start gap-2 md:gap-3', className)}>
      <div
        className={cn(
          'relative flex aspect-[175/200] items-center overflow-hidden rounded-[20px] bg-linear-to-b from-card to-raised px-1 md:aspect-[258/300] md:items-center md:rounded-none md:bg-card md:bg-none md:py-0',
          artAlign === 'start' && 'items-start pt-3',
          artAlign === 'end' && 'items-end pb-3',
        )}
      >
        <img
          src={image.thumbnailUrl}
          srcSet={`${image.thumbnailUrl} 480w, ${image.url} 960w`}
          sizes="(min-width: 1024px) 250px, (min-width: 768px) 30vw, 45vw"
          alt={image.alt}
          width={480}
          height={480}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cn(
            'aspect-square w-full rounded-[16px] object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-[1.03] motion-reduce:group-hover:scale-100 md:rounded-[15px]',
            soldOut && 'grayscale-[0.6]',
          )}
        />
        {nft.rarity !== 'common' && (
          <span className="absolute top-[8%] left-0 bg-primary px-2 py-2 text-[13px] leading-4 font-medium text-primary-foreground uppercase">
            {RARITY_LABEL[nft.rarity]}
          </span>
        )}
        {soldOut && (
          <span className="absolute right-3 bottom-3 rounded-md bg-background/90 px-2 py-1 text-[13px] leading-4 font-medium uppercase">Esgotado</span>
        )}
      </div>
      <div className={cn('grid gap-0 pl-2 md:pl-0', !compact && 'md:gap-1.5')}>
        <h3 className={cn('text-[15px] leading-5', !compact && 'md:text-base md:leading-4')}>
          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            className="after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ring md:after:rounded-none"
          >
            {nft.name}
          </Link>
        </h3>
        <Price value={nft.minPrice} compareAt={compareAtOf(nft)} className={cn('text-base leading-4', !compact && 'md:text-lg')} />
      </div>
      {favorite && <FavoriteButton nft={nft} variant="icon" className="absolute top-3 right-2.5 z-10" />}
    </article>
  )
}

/** Mesmas dimensões do card (sem deslocamento ao carregar). */
export function NftCardSkeleton() {
  return (
    <div className="grid content-start gap-2 md:gap-3">
      <div className="flex aspect-[175/200] items-center rounded-[20px] bg-card px-1 md:aspect-[258/300] md:rounded-none">
        <Skeleton className="aspect-square w-full rounded-[16px] md:rounded-[15px]" />
      </div>
      <div className="grid gap-1.5 pl-2 md:pl-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}
