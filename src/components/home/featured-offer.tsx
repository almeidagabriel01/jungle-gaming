import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useFeaturedNfts } from '@/queries/catalog'

/** "NFT em destaque / Oferta limitada": o destaque com preço riscado (desconto real da API). */
export function FeaturedOffer() {
  const featured = useFeaturedNfts()
  const items = featured.data?.items ?? []
  const offer = items.find((n) => n.editions.some((e) => e.compareAtPrice)) ?? items[0]
  if (featured.isError || (featured.isSuccess && !offer)) return null
  return (
    <section aria-labelledby="offer-title" className="grid gap-4 bg-linear-to-b from-primary/10 to-primary/[0.03] pt-6 pb-1">
      <div className="grid gap-4 px-5">
        <h2 id="offer-title" className="text-2xl leading-8 font-bold text-accent-text uppercase">
          NFT em destaque
        </h2>
        <p className="text-center text-[22px] leading-4 font-bold uppercase">Oferta limitada</p>
      </div>
      {offer ? (
        <Link to="/nfts/$nftId" params={{ nftId: offer.id }} className="group block overflow-hidden rounded-[22px]" aria-label={`Ver oferta: ${offer.name}`}>
          <img
            src={offer.images[0]!.thumbnailUrl}
            srcSet={`${offer.images[0]!.thumbnailUrl} 480w, ${offer.images[0]!.url} 960w`}
            sizes="310px"
            alt={offer.images[0]!.alt}
            width={480}
            height={560}
            loading="lazy"
            className="aspect-[310/368] w-full object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-105"
          />
        </Link>
      ) : (
        <Skeleton className="aspect-[310/368] w-full rounded-[22px]" />
      )}
    </section>
  )
}
