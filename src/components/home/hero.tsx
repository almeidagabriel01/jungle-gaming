import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from '@/components/icons/shell-icons'
import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Nft } from '@/contracts/nft'
import { usePrefersReducedMotion } from '@/lib/use-media-query'
import { useFeaturedNfts } from '@/queries/catalog'

const SLIDES = 3
const INTERVAL_MS = 6000

/** Carrossel dos destaques: avança sozinho, pausa com hover/foco e com movimento reduzido. */
function useSlides(items: Nft[] | undefined) {
  const slides = items?.slice(0, SLIDES) ?? []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = usePrefersReducedMotion()
  const count = slides.length
  useEffect(() => {
    if (paused || reduced || count < 2) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count)
    }, INTERVAL_MS)
    return () => {
      clearInterval(id)
    }
  }, [paused, reduced, count])
  const pause = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
  }
  return { slides, index: count ? index % count : 0, setIndex, pause }
}

/**
 * Pontos do carrossel. O layout tem pontos de 8 px a cada 16 px; cada um vira um alvo de 24 px
 * (WCAG 2.5.8), então o passo entre eles sobe para 24 px — único desvio.
 */
function Dots({ slides, index, onSelect, dot, className }: { slides: Nft[]; index: number; onSelect: (i: number) => void; dot: string; className?: string }) {
  if (slides.length < 2) return null
  return (
    <div className={cn('flex', className)}>
      {slides.map((nft, i) => (
        <button
          key={nft.id}
          type="button"
          aria-label={`Destaque ${i + 1} de ${slides.length}: ${nft.name}`}
          aria-current={i === index ? 'true' : undefined}
          onClick={() => onSelect(i)}
          className="group grid size-6 cursor-pointer place-items-center"
        >
          <span className={cn(dot, 'rounded-full bg-primary transition-opacity duration-300', i === index ? 'opacity-100' : 'opacity-40 group-hover:opacity-100')} />
        </button>
      ))}
    </div>
  )
}

/** Artes empilhadas com crossfade (só opacity); a primeira é a imagem LCP. */
function SlideArt({ slides, index, sizes, className }: { slides: Nft[]; index: number; sizes: string; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {slides.map((nft, i) => (
        <Link
          key={nft.id}
          to="/nfts/$nftId"
          params={{ nftId: nft.id }}
          tabIndex={i === index ? 0 : -1}
          aria-hidden={i === index ? undefined : true}
          aria-label={`Ver ${nft.name}`}
          className={cn('absolute inset-0 transition-opacity duration-1000 ease-out', i === index ? 'opacity-100' : 'pointer-events-none opacity-0')}
        >
          <img
            src={nft.images[0]!.url}
            srcSet={`${nft.images[0]!.thumbnailUrl} 480w, ${nft.images[0]!.url} 960w`}
            sizes={sizes}
            alt={nft.images[0]!.alt}
            width={960}
            height={960}
            loading={i === 0 ? 'eager' : 'lazy'}
            fetchPriority={i === 0 ? 'high' : 'auto'}
            decoding={i === 0 ? 'sync' : 'async'}
            className={cn('size-full object-cover transition-transform duration-[6000ms] ease-linear', i === index && 'scale-[1.03] motion-reduce:scale-100')}
          />
        </Link>
      ))}
    </div>
  )
}

/**
 * Arte do herói quando `/nfts/featured` falha: no mesmo espaço do skeleton (sem deslocamento),
 * com aviso e nova tentativa. Sem isso o skeleton ficaria para sempre.
 */
function HeroArtError({ onRetry, className }: { onRetry: () => void; className: string }) {
  return (
    <div role="alert" className={cn('grid place-content-center justify-items-center gap-2 overflow-hidden bg-card p-2 text-center', className)}>
      <p className="text-xs leading-4 text-muted-foreground md:text-sm">Destaques indisponíveis</p>
      <Button type="button" variant="outline" onClick={onRetry} className="h-auto min-h-8 px-2 py-1 text-xs whitespace-normal md:min-h-10 md:px-4 md:text-sm">
        Tentar novamente
      </Button>
    </div>
  )
}

/** Herói desktop (frame Desktop / Início › Hero: 1200×450, texto 600 + arte 450 r24, gap 110). */
export function HeroDesktop() {
  const featured = useFeaturedNfts()
  const { slides, index, setIndex, pause } = useSlides(featured.data?.items)
  return (
    <section aria-labelledby="hero-title" className="grid h-[450px] grid-cols-[minmax(0,600px)_450px] items-center justify-between gap-6 pl-10" {...pause}>
      <div className="grid justify-items-start gap-11">
        <div className="grid justify-items-start gap-8">
          <div className="grid gap-1">
            <div className="grid gap-2">
              <p className="animate-rise text-sm leading-4 font-medium tracking-[1.4px]">Bem-vindo à Kurio</p>
              <h1 id="hero-title" className="animate-rise text-[43px] leading-[70px] font-bold uppercase [animation-delay:80ms]">
                Seja dono do futuro
                <br />
                da arte digital
              </h1>
            </div>
            <p className="max-w-[557px] animate-rise text-sm leading-6 text-muted-foreground [animation-delay:160ms]">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
            </p>
          </div>
          <Button asChild className="h-10 w-[140px] animate-rise pr-9 pl-7 text-base leading-5 font-bold [animation-delay:240ms]">
            <Link to="/" hash="mercado">
              EXPLORAR
            </Link>
          </Button>
        </div>
        <Dots slides={slides} index={index} onSelect={setIndex} dot="size-2" className="-my-2 -mr-2 justify-self-end" />
      </div>
      {featured.isPending ? (
        <Skeleton className="size-[450px] rounded-[24px]" />
      ) : featured.isError && !featured.data ? (
        <HeroArtError onRetry={() => void featured.refetch()} className="size-[450px] rounded-[24px]" />
      ) : (
        <SlideArt slides={slides} index={index} sizes="450px" className="size-[450px] animate-fade rounded-[24px] bg-card" />
      )}
    </section>
  )
}

/**
 * Herói mobile (frame Mobile / Início › Hero Banner: 366×190 r30, texto 188 + artes 138/58 r16).
 * O frame tem 414 px; abaixo disso a arte encolhe (até 96 px) e o texto mantém os 188 px, senão o título
 * quebra em três linhas e o EXPLORAR sai do banner. Em telas ainda menores o banner cresce em vez de cortar.
 */
export function HeroMobile() {
  const featured = useFeaturedNfts()
  const { slides, index, setIndex, pause } = useSlides(featured.data?.items)
  const next = slides.length > 1 ? slides[(index + 1) % slides.length] : undefined
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate grid min-h-[190px] grid-cols-[minmax(0,188px)_clamp(96px,calc(100%-196px),138px)] content-start justify-between gap-x-2 overflow-hidden rounded-[30px] bg-background bg-linear-to-b from-primary/20 to-primary/10 px-4 pt-1.5 pb-7"
      {...pause}
    >
      <div aria-hidden="true" className="absolute -top-[31px] -left-20 -z-10 size-[248px] rounded-full bg-linear-to-b from-[#dd9a5f]/40 to-[#d28a4c]/5" />
      <div aria-hidden="true" className="absolute -top-2.5 left-[73px] -z-10 size-[248px] rounded-full bg-linear-to-b from-[#dd9a5f]/35 to-transparent" />
      <div className="grid min-h-[156px] grid-rows-[1fr_auto]">
        <div className="grid content-start gap-1.5">
          <p className="text-xs leading-4 font-medium">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-lg leading-[29px] font-bold uppercase">
            Seja dono da
            <br />
            cultura digital
          </h1>
          <p className="text-xs leading-[18px] text-muted-foreground">Descubra NFTs selecionados de criadores do mundo todo.</p>
        </div>
        <Link to="/" hash="mercado" className="inline-flex items-center gap-2 justify-self-start text-xs leading-[14px] font-bold text-accent-text">
          EXPLORAR <ArrowRightIcon className="size-4 text-primary" />
        </Link>
      </div>
      <div className="relative mt-1.5 aspect-[138/146] w-full">
        {featured.isPending ? (
          <Skeleton className="aspect-square w-full rounded-[16px]" />
        ) : featured.isError && !featured.data ? (
          <HeroArtError onRetry={() => void featured.refetch()} className="aspect-square w-full rounded-[16px]" />
        ) : (
          <>
            <SlideArt slides={slides} index={index} sizes="138px" className="aspect-square w-full rounded-[16px] bg-card" />
            {next && (
              <img
                src={next.images[0]!.thumbnailUrl}
                alt=""
                width={480}
                height={480}
                loading="lazy"
                className="absolute top-[64%] left-[10%] aspect-square w-[42%] rounded-[16px] object-cover"
              />
            )}
          </>
        )}
      </div>
      <Dots slides={slides} index={index} onSelect={setIndex} dot="size-[7px]" className="absolute bottom-0.5 left-1/2 -translate-x-1/2" />
    </section>
  )
}
