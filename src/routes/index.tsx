import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { QueryError } from '@/components/query-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Eth } from '@/contracts/common'
import { Category, NFT_SEARCH_DEFAULTS, NftSearch, NftSort, type Nft, type NftList } from '@/contracts/nft'
import { formValues } from '@/lib/forms'
import { formatEth } from '@/lib/money'
import { useFeaturedNfts, useNftList } from '@/queries/catalog'

export const Route = createFileRoute('/')({
  validateSearch: NftSearch,
  search: { middlewares: [stripSearchParams(NFT_SEARCH_DEFAULTS)] },
  component: CatalogPage,
})

const CATEGORY_LABEL: Record<Category, string> = {
  art: 'Arte',
  gaming: 'Games',
  music: 'Música',
  photography: 'Fotografia',
  collectibles: 'Colecionáveis',
  sports: 'Esportes',
}
const SORT_LABEL: Record<NftSort, string> = {
  recent: 'Mais recentes',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  name: 'Nome (A–Z)',
}

function CatalogPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const list = useNftList(search)

  /** Qualquer mudança de filtro reinicia a paginação; só a paginação preserva a página. */
  const update = useCallback(
    (patch: Partial<NftSearch>) => void navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }) }),
    [navigate],
  )

  // Página além do fim (link antigo ou filtro que encolheu o resultado): vai para a última.
  const lastPage = list.data && list.data.items.length === 0 && list.data.total > 0 ? list.data.totalPages : null
  useEffect(() => {
    if (lastPage) void navigate({ search: (prev) => ({ ...prev, page: lastPage }), replace: true })
  }, [lastPage, navigate])

  return (
    <div className="grid gap-8">
      <Featured />

      <section aria-labelledby="catalog-title" className="grid gap-4">
        <h1 id="catalog-title" className="text-2xl font-semibold">
          Catálogo
        </h1>
        <Filters search={search} collections={list.data?.collections ?? []} onChange={update} />

        <div aria-live="polite" className="text-sm text-muted-foreground" data-testid="catalog-summary">
          {list.data && `${list.data.total} ${list.data.total === 1 ? 'resultado' : 'resultados'}`}
          {list.isFetching && list.data ? ' · atualizando…' : ''}
        </div>

        {list.isPending ? (
          <GridSkeleton />
        ) : list.isError ? (
          <QueryError error={list.error} onRetry={() => void list.refetch()} title="Não foi possível carregar o catálogo" />
        ) : list.data.total === 0 ? (
          <div className="grid justify-items-start gap-3 rounded-lg border p-6">
            <p>Nenhum NFT encontrado com esses filtros.</p>
            <Button variant="outline" onClick={() => void navigate({ search: NFT_SEARCH_DEFAULTS })}>
              Limpar filtros
            </Button>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={list.isFetching} data-testid="catalog-grid">
              {list.data.items.map((nft) => (
                <li key={nft.id}>
                  <NftCard nft={nft} />
                </li>
              ))}
            </ul>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} onPage={(page) => update({ page })} />
          </>
        )}
      </section>
    </div>
  )
}

function Featured() {
  const featured = useFeaturedNfts()
  return (
    <section aria-labelledby="featured-title" className="grid gap-3">
      <h2 id="featured-title" className="text-xl font-semibold">
        Destaques
      </h2>
      {featured.isPending ? (
        <GridSkeleton count={4} />
      ) : featured.isError ? (
        <QueryError error={featured.error} onRetry={() => void featured.refetch()} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.data.items.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NftCard({ nft }: { nft: Nft }) {
  return (
    <article className="grid gap-2 rounded-lg border p-3">
      <img src={nft.images[0]!.url} alt={nft.images[0]!.alt} width={400} height={400} loading="lazy" decoding="async" className="aspect-square w-full rounded-md object-cover" />
      <h3 className="font-medium">
        <Link to="/nfts/$nftId" params={{ nftId: nft.id }} className="hover:underline">
          {nft.name}
        </Link>
      </h3>
      <p className="text-sm text-muted-foreground">{nft.collection.name}</p>
      <p className="tabular-nums" data-testid="nft-price">
        A partir de {formatEth(nft.minPrice)}
      </p>
      <p className="text-sm">{nft.available > 0 ? `${nft.available} disponíveis` : 'Esgotado'}</p>
    </article>
  )
}

function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Carregando NFTs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-2 rounded-lg border p-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ))}
    </div>
  )
}

function Filters({ search, collections, onChange }: { search: NftSearch; collections: NftList['collections']; onChange: (patch: Partial<NftSearch>) => void }) {
  const [term, setTerm] = useState(search.q)
  const [syncedQ, setSyncedQ] = useState(search.q)
  const [priceError, setPriceError] = useState<string | null>(null)

  // URL → campo: voltar/avançar no histórico atualiza o texto (ajuste durante o render, sem efeito).
  if (search.q !== syncedQ) {
    setSyncedQ(search.q)
    setTerm(search.q)
  }
  // Campo → URL com debounce.
  useEffect(() => {
    if (term.trim() === search.q) return
    const id = setTimeout(() => {
      onChange({ q: term.trim() })
    }, 300)
    return () => {
      clearTimeout(id)
    }
  }, [term, search.q, onChange])

  const applyPrice = (form: HTMLFormElement) => {
    const data = formValues(form)
    const read = (name: string) => {
      const value = (data[name] ?? '').trim().replace(',', '.')
      return value === '' ? undefined : value
    }
    const minPrice = read('minPrice')
    const maxPrice = read('maxPrice')
    if ((minPrice && !Eth.safeParse(minPrice).success) || (maxPrice && !Eth.safeParse(maxPrice).success)) {
      setPriceError('Use valores em ETH, ex.: 0.5')
      return
    }
    setPriceError(null)
    onChange({ minPrice, maxPrice })
  }

  return (
    <div className="grid gap-4 rounded-lg border p-4" role="search">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Buscar</span>
        <input
          type="search"
          name="q"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
          }}
          placeholder="Nome, coleção ou criador"
          className="h-9 rounded-md border px-3"
        />
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Categorias</legend>
        <div className="flex flex-wrap gap-3">
          {Category.options.map((category) => (
            <label key={category} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={search.categories.includes(category)}
                onChange={(e) => {
                  onChange({
                    categories: e.target.checked ? [...search.categories, category] : search.categories.filter((c) => c !== category),
                  })
                }}
              />
              {CATEGORY_LABEL[category]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Disponibilidade</span>
          <select
            value={search.availability}
            onChange={(e) => {
              onChange({ availability: e.target.value as NftSearch['availability'] })
            }}
            className="h-9 rounded-md border px-2"
          >
            <option value="all">Todos</option>
            <option value="available">Disponíveis</option>
            <option value="sold-out">Esgotados</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Ordenar por</span>
          <select
            value={search.sort}
            onChange={(e) => {
              onChange({ sort: e.target.value as NftSort })
            }}
            className="h-9 rounded-md border px-2"
          >
            {NftSort.options.map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABEL[sort]}
              </option>
            ))}
          </select>
        </label>
        <CollectionFilter value={search.collection} collections={collections} onChange={(collection) => onChange({ collection })} />
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        aria-describedby={priceError ? 'price-error' : undefined}
        onSubmit={(e) => {
          e.preventDefault()
          applyPrice(e.currentTarget)
        }}
        key={`${search.minPrice ?? ''}-${search.maxPrice ?? ''}`}
      >
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Preço mínimo (ETH)</span>
          <input name="minPrice" inputMode="decimal" defaultValue={search.minPrice ?? ''} aria-invalid={priceError ? true : undefined} className="h-9 w-32 rounded-md border px-2" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Preço máximo (ETH)</span>
          <input name="maxPrice" inputMode="decimal" defaultValue={search.maxPrice ?? ''} aria-invalid={priceError ? true : undefined} className="h-9 w-32 rounded-md border px-2" />
        </label>
        <Button type="submit" variant="outline">
          Aplicar preço
        </Button>
        {priceError && (
          <p id="price-error" className="w-full text-sm text-destructive">
            {priceError}
          </p>
        )}
      </form>
    </div>
  )
}

/** As coleções vêm da própria resposta do catálogo (sem lista fixa no cliente). */
function CollectionFilter({ value, collections, onChange }: { value: string; collections: NftList['collections']; onChange: (collection: string) => void }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">Coleção</span>
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        className="h-9 rounded-md border px-2"
      >
        <option value="">Todas</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação" className="flex items-center gap-3">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span aria-current="page" className="text-sm tabular-nums">
        Página {page} de {totalPages}
      </span>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Próxima
      </Button>
    </nav>
  )
}
