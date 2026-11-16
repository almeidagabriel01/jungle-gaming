import { Link, type LinkProps } from '@tanstack/react-router'
import { ArrowRightIcon } from '@/components/icons/shell-icons'
import type { CSSProperties } from 'react'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { unavailable } from '@/lib/unavailable'
import { useJournal } from '@/queries/content'

type Promo = { title: string; text: string; image: string; alt: string; link: Pick<LinkProps, 'to' | 'search' | 'hash'> }

/** Banners do layout: cada "Explorar" abre o catálogo já filtrado (aba ou coleção). */
const PROMOS: Promo[] = [
  {
    title: 'Lançamentos gênesis\nde edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/nfts/emerald-480.webp',
    alt: '',
    link: { to: '/', search: { tab: 'new' }, hash: 'mercado' },
  },
  {
    title: 'Arte digital selecionada\ne muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/nfts/ivory-480.webp',
    alt: '',
    link: { to: '/', search: { categories: ['digital-art'] }, hash: 'mercado' },
  },
]

/** Frame "Promos": 2 cartões 586×250 r8, arte 287 r18 à esquerda, texto alinhado à direita (gap 28). */
export function PromoBanners() {
  return (
    <section aria-label="Coleções em destaque" className="grid gap-7 lg:grid-cols-2">
      {PROMOS.map((promo) => (
        <article key={promo.title} className="group grid min-h-[250px] lg:h-[250px] grid-cols-[minmax(0,287fr)_minmax(0,299fr)] overflow-hidden rounded-[8px] bg-card">
          <div className="overflow-hidden rounded-[18px]">
            <img
              src={promo.image}
              alt={promo.alt}
              width={480}
              height={480}
              loading="lazy"
              className="size-full object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-105"
            />
          </div>
          <div className="flex flex-col items-end pt-[37px] pr-[30px] pb-[46px] pl-2 text-right">
            <h2 className="text-lg leading-6 font-bold whitespace-pre-line">{promo.title}</h2>
            <p className="mt-[9px] mb-[25px] max-w-[263px] lg:mb-0 text-sm leading-6 text-muted-foreground">{promo.text}</p>
            <Button asChild className="mt-auto h-10 w-[140px] gap-0 text-sm leading-5 font-medium">
              <Link {...promo.link}>
                Explorar <ArrowRightIcon className="size-[18px] transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })

/** "Diário da Cunhagem": artigos vêm da API; leitura completa está fora do escopo (§3). */
export function Journal() {
  const journal = useJournal()
  return (
    <section id="diario" aria-labelledby="journal-title" className="grid scroll-mt-8 gap-10">
      <header className="grid gap-3 text-center">
        <h2 id="journal-title" className="text-[28px] leading-[37px] font-bold">
          Diário da Cunhagem
        </h2>
        <p className="text-sm leading-[18px] text-muted-foreground">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </header>
      {journal.isError && !journal.data ? (
        <QueryError error={journal.error} onRetry={() => void journal.refetch()} title="Não foi possível carregar o diário" />
      ) : (
        <ul className="stagger grid gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[repeat(4,268px)]">
          {!journal.data
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="overflow-hidden rounded-[8px] bg-card">
                  <Skeleton className="aspect-[268/195] w-full rounded-none" />
                  <div className="grid gap-2 px-4 pt-3 pb-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </li>
              ))
            : journal.data.items.map((article, i) => (
                <li key={article.id} style={{ '--i': i } as CSSProperties}>
                  <article className="group grid h-full content-start overflow-hidden rounded-[8px] bg-card">
                    <div className="overflow-hidden">
                      <img
                        src={article.image.thumbnailUrl}
                        alt={article.image.alt}
                        width={480}
                        height={349}
                        loading="lazy"
                        className="aspect-[268/195] w-full object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-105"
                      />
                    </div>
                    <div className="grid content-start gap-2 px-4 pt-3 pb-4">
                      <p className="text-xs leading-4 font-medium text-muted-foreground">
                        <time dateTime={article.publishedAt}>{dateFormatter.format(new Date(article.publishedAt))}</time>
                        <span aria-hidden="true" className="whitespace-pre">{'  |  '}</span>
                        <span className="sr-only">, </span>
                        Leitura de {article.readingMinutes} min
                      </p>
                      <h3 className="text-base leading-[21px] font-bold">{article.title}</h3>
                      <p className="text-xs leading-4 font-medium text-muted-foreground">{article.excerpt}</p>
                      <button
                        type="button"
                        onClick={() => unavailable('A leitura completa dos artigos')}
                        className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs leading-[14px] font-bold text-accent-text hover:underline"
                      >
                        Ler mais <span className="sr-only">sobre {article.title}</span>
                        <span aria-hidden="true" className="leading-4 font-normal">→</span>
                      </button>
                    </div>
                  </article>
                </li>
              ))}
        </ul>
      )}
    </section>
  )
}
