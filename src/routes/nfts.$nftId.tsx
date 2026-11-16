import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { RadioGroup, Tabs } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { cn } from 'cn'
import { ApiError } from '@/api/client'
import { LinkedinIcon, TwitterIcon } from '@/components/brand-icons'
import { MessageIcon, StarIcon, ZoomIcon } from '@/components/icons/nft-detail-icons'
import { ShopIcon } from '@/components/icons/shell-icons'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { FavoriteButton } from '@/components/nft/favorite-button'
import { NftRail } from '@/components/nft/nft-rail'
import { Price } from '@/components/nft/price'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { QueryError } from '@/components/query-error'
import { Button, busyProps } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { Nft } from '@/contracts/nft'
import { announce } from '@/lib/announcer'
import { apiFieldErrors } from '@/lib/forms'
import { NETWORK_LABEL, RARITY_LABEL } from '@/lib/labels'
import { eth } from '@/lib/money'
import { useAddToCart, useCart, useCartCount } from '@/queries/cart'
import { useNft, useRelatedNfts } from '@/queries/catalog'

export const Route = createFileRoute('/nfts/$nftId')({
  component: NftDetailPage,
})

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const nft = useNft(nftId)

  if (nft.isPending) return <DetailSkeleton />
  if (nft.isError) {
    if (nft.error instanceof ApiError && nft.error.status === 404) return <NftNotFound />
    return (
      <div className="page pb-12">
        <MobileTopBar action={<CartLink />} />
        <div className="pt-4 md:pt-8">
          <QueryError error={nft.error} onRetry={() => void nft.refetch()} title="Não foi possível carregar o NFT" />
        </div>
      </div>
    )
  }
  // `key`: ao navegar para outro NFT (ex.: "Mais desta coleção"), edição, imagem e quantidade recomeçam.
  return <NftDetail key={nft.data.id} nft={nft.data} />
}

function NftNotFound() {
  return (
    <div className="page">
      <MobileTopBar action={<CartLink />} />
      <section aria-labelledby="nf-title" className="grid animate-rise justify-items-start gap-4 py-16 md:py-24">
        <p className="text-sm font-bold tracking-[0.2em] text-accent-text">ERRO 404</p>
        <h1 id="nf-title" className="text-3xl font-bold md:text-[43px] md:leading-[70px]">
          NFT não encontrado
        </h1>
        <p className="text-muted-foreground">Este NFT não existe ou foi removido.</p>
        <Button asChild>
          <Link to="/" hash="mercado">
            Voltar ao catálogo
          </Link>
        </Button>
      </section>
    </div>
  )
}

/** Carrinho na barra superior mobile: nesta rota a barra inferior some, então o carrinho fica aqui. */
function CartLink() {
  const count = useCartCount()
  return (
    <Link
      to="/cart"
      aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
      className="relative grid size-[35px] place-items-center rounded-full border border-border bg-raised text-accent-text transition-transform active:scale-90 [&_svg]:size-[18px]"
    >
      <ShopIcon />
      {count > 0 && (
        <span
          key={count}
          aria-hidden="true"
          className="absolute -top-1 -right-1 grid min-w-4 animate-rise place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground"
        >
          {count}
        </span>
      )}
    </Link>
  )
}

const plural = (count: number) => `${count} ${count === 1 ? 'avaliação' : 'avaliações'} de colecionadores`
const ratingText = (nft: Nft) => `Nota ${nft.rating.average.toFixed(1)} de 5`

function Stars({ average }: { average: number }) {
  return (
    <span aria-hidden="true" className="flex gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} className={cn('size-[15px]', i < Math.floor(average) ? 'text-primary' : 'text-muted-foreground')} />
      ))}
    </span>
  )
}

function NftDetail({ nft }: { nft: Nft }) {
  const navigate = useNavigate()
  // Começa na edição do menor preço (o mesmo do card no catálogo), como no layout (1/50).
  const [editionId, setEditionId] = useState(
    () => (nft.editions.find((e) => e.available > 0 && eth.eq(e.price, nft.minPrice)) ?? nft.editions.find((e) => e.available > 0) ?? nft.editions[0]!).id,
  )
  const [quantity, setQuantity] = useState(1)
  const cart = useCart()
  const add = useAddToCart()
  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]!
  const inCart = cart.data?.items.find((i) => i.editionId === edition.id)?.quantity ?? 0
  const maxQuantity = Math.max(0, edition.available - inCart)
  // Derivado no render: um `nft.updated` (ou o próprio carrinho) pode reduzir o limite.
  const qty = Math.min(quantity, Math.max(1, maxQuantity))
  const soldOut = maxQuantity === 0

  const addToCart = (then?: () => void) => {
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty },
      {
        onSuccess: () => {
          announce(`${qty}× ${nft.name} (${edition.name}) adicionado ao carrinho.`)
          setQuantity(1)
          then?.()
        },
        onError: (error) => {
          const errors = apiFieldErrors(error)
          announce(errors.quantity ?? errors._ ?? 'Não foi possível adicionar ao carrinho.', { tone: 'error' })
        },
      },
    )
  }
  const buy = () => {
    // Tudo o que há em estoque já está no carrinho: comprar é seguir para ele.
    if (soldOut && inCart > 0) void navigate({ to: '/cart' })
    else addToCart(() => void navigate({ to: '/cart' }))
  }
  const addError = add.isError ? (apiFieldErrors(add.error).quantity ?? apiFieldErrors(add.error)._) : undefined
  const stepper = (size: 'md' | 'sm') => (
    <QuantityStepper value={qty} max={Math.max(1, maxQuantity)} onChange={setQuantity} label={`Quantidade de ${nft.name}`} size={size} disabled={soldOut} />
  )
  const addLabel = add.isPending ? 'Adicionando ao carrinho…' : 'Adicionar ao carrinho'

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Início', link: { to: '/' } }, { label: 'Mercado', link: { to: '/', hash: 'mercado' } }, { label: nft.name }]} />
      <article aria-labelledby="nft-title" className="md:pt-2">
        <div className="grid md:gap-8 lg:grid-cols-[573px_minmax(0,1fr)]">
          <div className="max-md:-mx-4 max-md:bg-linear-[135deg] max-md:from-card max-md:to-raised max-md:px-[27px]">
            <MobileTopBar
              className="pt-[23px] pb-2"
              action={
                <div className="flex items-center gap-2">
                  <CartLink />
                  <FavoriteButton nft={nft} variant="icon" className="border-border bg-raised" />
                </div>
              }
            />
            <Gallery nft={nft} />
          </div>

          <div className="grid animate-rise content-start max-md:relative max-md:-mx-4 max-md:-mt-[30px] max-md:rounded-t-[31px] max-md:bg-card max-md:px-6 max-md:pt-8 max-md:pb-6">
            <div className="flex items-start justify-between gap-3">
              <h1 id="nft-title" className="text-xl font-bold md:text-[28px] md:leading-[37px]">
                {nft.name}
              </h1>
              <p className="flex h-[27px] shrink-0 items-center gap-1 rounded-[32px] border border-primary pr-2 pl-1.5 text-sm md:hidden">
                <StarIcon className="size-3.5 text-[#e3a44e]" />
                <span className="sr-only">{ratingText(nft)}, </span>
                <span aria-hidden="true" className="font-medium">
                  {nft.rating.average.toFixed(1)}
                </span>
                <span aria-hidden="true" className="text-muted-foreground">
                  ({nft.rating.count})
                </span>
                <span className="sr-only">{plural(nft.rating.count)}</span>
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-primary pb-3 max-md:hidden">
              <div data-testid={`edition-price-${edition.id}`}>
                <Price value={edition.price} compareAt={edition.compareAtPrice} className="text-[22px] leading-5" />
              </div>
              <p className="flex items-center gap-2 text-[15px] leading-5">
                <Stars average={nft.rating.average} />
                <span className="sr-only">{ratingText(nft)}, </span>
                {plural(nft.rating.count)}
              </p>
            </div>

            <h2 className="mt-3 text-[15px] leading-4 font-bold max-md:sr-only">Sobre este NFT:</h2>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{nft.summary}</p>

            <RadioGroup.Root
              value={edition.id}
              onValueChange={(id) => {
                setEditionId(id)
                setQuantity(1)
              }}
              aria-labelledby="edition-label"
              aria-describedby="quantity-hint"
              className="mt-3 grid gap-2 md:mt-2 md:gap-3"
            >
              <p id="edition-label" className="text-[15px] leading-4 font-bold">
                Edição:
              </p>
              <div className="flex flex-wrap gap-3 md:gap-1.5">
                {nft.editions.map((e) => (
                  <RadioGroup.Item
                    key={e.id}
                    value={e.id}
                    disabled={e.available === 0}
                    aria-label={e.name}
                    aria-describedby={e.available === 0 ? `${e.id}-out` : undefined}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-border px-[5px] text-sm text-muted-foreground uppercase transition-[border-color,color,transform] hover:border-border-soft active:scale-95 disabled:cursor-not-allowed disabled:text-subtle data-[state=checked]:border-primary data-[state=checked]:font-medium data-[state=checked]:text-accent-text"
                  >
                    <span className={cn(e.available === 0 && 'line-through')}>{e.name}</span>
                    {e.available === 0 && (
                      <span id={`${e.id}-out`} className="text-xs normal-case">
                        esgotada
                      </span>
                    )}
                  </RadioGroup.Item>
                ))}
              </div>
            </RadioGroup.Root>

            <div className="mt-3 flex flex-wrap items-start justify-between gap-4 max-md:hidden">
              {stepper('md')}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="icon" aria-label={addLabel} title="Adicionar ao carrinho" disabled={soldOut} pending={add.isPending} onClick={() => addToCart()}>
                  <ShopIcon className="size-[18px]" />
                </Button>
                <Button className="w-[130px]" disabled={soldOut && inCart === 0} pending={add.isPending} onClick={buy}>
                  COMPRAR
                </Button>
                <FavoriteButton nft={nft} className="w-[130px] [&_svg]:size-5" />
              </div>
            </div>
            <p id="quantity-hint" className={cn('mt-2 text-sm text-subtle', edition.available > 0 && maxQuantity > 0 && 'sr-only')}>
              {edition.available === 0
                ? 'Esta edição está esgotada.'
                : maxQuantity === 0
                  ? `Você já tem todas as ${edition.available} unidades disponíveis no carrinho.`
                  : `${edition.available} de ${edition.supply} disponíveis. Até ${maxQuantity} unidade(s)${inCart > 0 ? ` (${inCart} já no carrinho)` : ''}.`}
            </p>
            {addError && <p className="mt-1 text-sm text-destructive">{addError}</p>}

            <dl className="mt-3 grid gap-3 text-[15px] leading-5 text-subtle md:mt-3.5">
              <div>
                <dt className="inline">ID do token:</dt> <dd className="inline">#{nft.tokenId}</dd>
              </div>
              <div>
                <dt className="inline">Coleção:</dt> <dd className="inline">{nft.collection.name}</dd>
              </div>
              <div>
                <dt className="inline">Atributos:</dt> <dd className="inline">{[...nft.attributes, RARITY_LABEL[nft.rarity]].join(', ')}</dd>
              </div>
            </dl>
            <Share nft={nft} />
          </div>
        </div>

        <DetailTabs nft={nft} />
      </article>

      <RelatedRail nft={nft} />

      {/* Barra de compra mobile: `sticky` dentro da página, então nunca cobre o rodapé nem o conteúdo. */}
      <div className="sticky bottom-0 z-30 -mx-4 mt-10 grid gap-5 rounded-t-[40px] bg-card px-6 pt-5 pb-[calc(36px+env(safe-area-inset-bottom))] shadow-[0_0_20px_rgb(10_6_4/0.45)] md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-[15px] font-medium text-muted-foreground">
              Qtd.
            </span>
            {stepper('sm')}
          </div>
          <Price value={edition.price} compareAt={edition.compareAtPrice} className="justify-end text-xl leading-4" />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={soldOut && inCart === 0}
            {...busyProps(add.isPending, buy)}
            className="h-[60px] w-[196px] cursor-pointer rounded-[40px] bg-linear-[135deg] from-primary to-primary/80 text-base font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            Comprar NFT
          </button>
          <button
            type="button"
            aria-label={addLabel}
            disabled={soldOut}
            {...busyProps(add.isPending, () => addToCart())}
            className="grid size-[60px] cursor-pointer place-items-center rounded-full border border-border bg-raised text-subtle transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-5"
          >
            <ShopIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

function Gallery({ nft }: { nft: Nft }) {
  const [index, setIndex] = useState(0)
  const image = nft.images[index] ?? nft.images[0]!

  return (
    <section aria-label="Galeria" className="md:grid md:max-w-[572px] md:grid-cols-[100px_minmax(0,444px)] md:items-center md:gap-7">
      <ul className="grid gap-4 max-md:hidden">
        {nft.images.map((img, i) => (
          <li key={img.url}>
            <button
              type="button"
              onClick={() => {
                setIndex(i)
              }}
              aria-label={`Ver imagem ${i + 1} de ${nft.images.length}`}
              aria-pressed={i === index}
              className="block size-[100px] cursor-pointer overflow-hidden rounded-[8px] border-2 border-transparent bg-card transition-[border-color,transform] hover:border-border-soft active:scale-95 aria-pressed:border-primary"
            >
              <img src={img.thumbnailUrl} alt="" width={100} height={100} className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative md:rounded-[6px] md:bg-card md:p-5">
        <img
          key={image.url}
          src={image.url}
          srcSet={`${image.thumbnailUrl} 480w, ${image.url} 960w`}
          sizes="(min-width: 1024px) 404px, (min-width: 768px) 425px, 100vw"
          alt={image.alt}
          width={960}
          height={960}
          fetchPriority="high"
          className="aspect-square w-full animate-fade rounded-[24px] object-cover max-md:aspect-[361/356]"
        />
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Ampliar imagem"
              className="absolute top-[13px] right-3 size-[30px] cursor-pointer rounded-full text-foreground transition-transform hover:scale-110 active:scale-95 max-md:hidden"
            >
              <ZoomIcon className="size-full" />
            </button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined} className="p-2 sm:max-w-[min(90vw,900px)]">
            <DialogTitle className="sr-only">{image.alt}</DialogTitle>
            <img src={image.url} alt={image.alt} width={960} height={960} className="aspect-square max-h-[85vh] w-full rounded-[16px] object-contain" />
          </DialogContent>
        </Dialog>

        {nft.images.length > 1 && (
          <ul className="absolute inset-x-0 bottom-[41px] flex justify-center md:hidden">
            {nft.images.map((img, i) => (
              <li key={img.url}>
                <button
                  type="button"
                  onClick={() => {
                    setIndex(i)
                  }}
                  aria-label={`Ver imagem ${i + 1} de ${nft.images.length}`}
                  aria-pressed={i === index}
                  className="group grid size-6 cursor-pointer place-items-center"
                >
                  <span className="h-[7px] w-[7px] rounded-full bg-primary shadow-[0_0_0_2px_rgb(20_13_10/0.35)] transition-[width] duration-300 group-aria-pressed:w-7" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Share({ nft }: { nft: Nft }) {
  const url = `${window.location.origin}/nfts/${nft.id}`
  const text = `${nft.name} na Kurio`
  const enc = encodeURIComponent
  // Alvo de 24 px (WCAG 2.5.8) ocupando 18 px na linha, como no layout: a sobra invade o espaço vizinho.
  const link = '-my-[3px] grid size-6 place-items-center text-foreground transition-colors hover:text-accent-text'
  const external = { target: '_blank', rel: 'noopener noreferrer' } as const
  return (
    <div className="mt-3 flex flex-wrap items-center max-md:hidden">
      <p className="mr-[3px] text-[15px] leading-4 font-bold">Compartilhar este NFT:</p>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`} {...external} aria-label="Compartilhar no LinkedIn (abre em nova aba)" className={link}>
        <LinkedinIcon className="size-[15px]" />
      </a>
      <a href={`mailto:?subject=${enc(text)}&body=${enc(`${text}: ${url}`)}`} aria-label="Compartilhar por e-mail" className={link}>
        <MessageIcon className="size-[18px]" />
      </a>
      <a href={`https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}`} {...external} aria-label="Compartilhar no Twitter (abre em nova aba)" className={link}>
        <TwitterIcon className="h-3 w-4" />
      </a>
    </div>
  )
}

const shortAddress = (address: string) => (address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address)

function DetailTabs({ nft }: { nft: Nft }) {
  const trigger =
    'relative cursor-pointer pb-3 text-[15px] leading-4 md:pb-[11px] whitespace-nowrap text-foreground transition-colors hover:text-accent-text md:text-[17px] data-[state=active]:font-bold data-[state=active]:text-accent-text after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 data-[state=active]:after:scale-x-100'
  const item = (label: string, value: ReactNode) => (
    <div>
      <dt className="text-sm leading-6 font-bold">{label}</dt>
      <dd className="text-sm leading-6 text-muted-foreground">{value}</dd>
    </div>
  )
  return (
    <Tabs.Root defaultValue="details" className="mt-12 md:mt-24">
      <Tabs.List aria-label="Informações do NFT" className="flex gap-6 overflow-x-auto border-b border-primary/30 [scrollbar-width:none] md:gap-8">
        <Tabs.Trigger value="details" className={trigger}>
          Detalhes do NFT
        </Tabs.Trigger>
        <Tabs.Trigger value="reviews" className={trigger}>
          Avaliações de colecionadores ({nft.rating.count})
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="details" className="animate-fade pt-3">
        <p className="text-sm leading-6 whitespace-pre-line text-muted-foreground">{nft.description}</p>
        <dl className="mt-3 grid gap-3">
          {item('Rede:', `Cunhado na ${NETWORK_LABEL[nft.network]} com procedência imutável e metadados armazenados no ${nft.contract.metadataStorage}.`)}
          {item(
            'Contrato:',
            <>
              <span aria-hidden="true">{shortAddress(nft.contract.address)}</span>
              <span className="sr-only">{nft.contract.address}</span> • Contrato inteligente {nft.contract.standard}
              {nft.contract.verified ? ' verificado' : ''}.
            </>,
          )}
          {item('Direitos autorais:', `${String(nft.royaltyPercent).replace('.', ',')}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.`)}
        </dl>
      </Tabs.Content>
      <Tabs.Content value="reviews" className="animate-fade pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[28px] leading-none font-bold">{nft.rating.average.toFixed(1)}</p>
          <Stars average={nft.rating.average} />
          <p className="text-sm text-muted-foreground">
            <span className="sr-only">{ratingText(nft)}, </span>
            {nft.rating.count === 0 ? 'Ainda sem avaliações de colecionadores.' : `Média de ${plural(nft.rating.count)}.`}
          </p>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  )
}

function RelatedRail({ nft }: { nft: Nft }) {
  const related = useRelatedNfts(nft.id)
  return (
    <div className="mt-16 md:mt-24">
      <NftRail title="Mais desta coleção" items={related.items} loading={related.isPending} error={related.error} onRetry={related.retry} />
    </div>
  )
}

/** Mesmas dimensões da tela carregada (mobile e desktop), sem deslocamento. */
function DetailSkeleton() {
  return (
    <div role="status" aria-label="Carregando NFT" className="page">
      <div className="pt-8 pb-1 max-md:hidden">
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid md:gap-8 md:pt-2 lg:grid-cols-[573px_minmax(0,1fr)]">
        <div className="max-md:-mx-4 max-md:bg-linear-[135deg] max-md:from-card max-md:to-raised max-md:px-[27px]">
          <div className="flex justify-between pt-[23px] pb-2 md:hidden">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-[35px] w-[78px] rounded-full" />
          </div>
          <div className="md:grid md:max-w-[573px] md:grid-cols-[100px_minmax(0,1fr)] md:gap-7 md:pt-0">
            <div className="grid gap-4 max-md:hidden">
              <Skeleton className="size-[100px]" />
              <Skeleton className="size-[100px]" />
            </div>
            <div className="md:rounded-[6px] md:bg-card md:p-5">
              <Skeleton className="aspect-square w-full rounded-[24px] max-md:aspect-[361/356]" />
            </div>
          </div>
        </div>
        <div className="grid content-start gap-3 max-md:relative max-md:-mx-4 max-md:-mt-[30px] max-md:rounded-t-[31px] max-md:bg-card max-md:px-6 max-md:pt-8">
          <Skeleton className="h-7 w-2/3 md:h-9" />
          <Skeleton className="h-6 w-full max-md:hidden" />
          <Skeleton className="h-4 w-32 max-md:hidden" />
          <Skeleton className="h-[72px] w-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-56 rounded-full" />
          <Skeleton className="h-12 w-full max-md:hidden" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </div>
    </div>
  )
}
