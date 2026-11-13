import { http, HttpResponse } from 'msw'
import { Network } from '@/contracts/common'
import { Category, NftSearch, PAGE_SIZE, type Nft, type NftList } from '@/contracts/nft'
import { eth } from '@/lib/money'
import { findNft, toNft, withDb, type Tx } from '../db'
import { hasScenario } from '../scenarios'
import { API, apiError, authenticate, route } from './http'

/** Converte a query string da API (listas separadas por vírgula) no schema compartilhado. */
export function parseSearch(url: URL) {
  const p = url.searchParams
  return NftSearch.parse({
    q: p.get('q') ?? undefined,
    tab: p.get('tab') ?? undefined,
    categories: p.get('categories')?.split(',').filter(Boolean),
    networks: p.get('networks')?.split(',').filter(Boolean),
    collection: p.get('collection') ?? undefined,
    minPrice: p.get('minPrice') ?? undefined,
    maxPrice: p.get('maxPrice') ?? undefined,
    sort: p.get('sort') ?? undefined,
    page: p.get('page') ?? undefined,
  })
}

const sorters: Record<NftSearch['sort'], (a: Nft, b: Nft) => number> = {
  recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
  'price-asc': (a, b) => eth.cmp(a.minPrice, b.minPrice) || a.id.localeCompare(b.id),
  'price-desc': (a, b) => eth.cmp(b.minPrice, a.minPrice) || a.id.localeCompare(b.id),
  name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
}

type Filter = 'category' | 'network' | 'price' | 'other'

/** Cada filtro separado, para as facetas poderem ignorar o próprio grupo. */
function matchers(s: NftSearch): Record<Filter, (n: Nft) => boolean> {
  const term = s.q.toLowerCase()
  return {
    category: (n) => s.categories.length === 0 || s.categories.includes(n.category),
    network: (n) => s.networks.length === 0 || s.networks.includes(n.network),
    price: (n) => (s.minPrice === undefined || eth.cmp(n.minPrice, s.minPrice) >= 0) && (s.maxPrice === undefined || eth.cmp(n.minPrice, s.maxPrice) <= 0),
    other: (n) =>
      (!term || `${n.name} ${n.collection.name} ${n.creator.name}`.toLowerCase().includes(term)) &&
      (s.tab === 'all' || (s.tab === 'new' ? n.isNew : n.trending)) &&
      (!s.collection || n.collection.id === s.collection),
  }
}

function search(tx: Tx, s: NftSearch): NftList {
  const all = hasScenario('empty') ? [] : tx.db.nfts.map(toNft)
  const match = matchers(s)
  const except = (skip: Filter | null) => all.filter((n) => (Object.keys(match) as Filter[]).every((f) => f === skip || match[f](n)))
  const countBy = <K extends string>(keys: readonly K[], items: Nft[], key: (n: Nft) => K) =>
    Object.fromEntries(keys.map((k) => [k, items.filter((n) => key(n) === k).length])) as Record<K, number>

  const filtered = except(null)
  filtered.sort(sorters[s.sort])
  const priced = except('price')
  return {
    items: filtered.slice((s.page - 1) * PAGE_SIZE, s.page * PAGE_SIZE),
    page: s.page,
    pageSize: PAGE_SIZE,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / PAGE_SIZE),
    facets: {
      categories: countBy(Category.options, except('category'), (n) => n.category),
      networks: countBy(Network.options, except('network'), (n) => n.network),
      price: priced.length === 0 ? null : { min: eth.min(...priced.map((n) => n.minPrice)), max: eth.max(...priced.map((n) => n.minPrice)) },
    },
  }
}

const favoritesOf = (tx: Tx, userId: string) => ({
  items: (tx.db.favorites[userId] ?? []).flatMap((id) => {
    const nft = findNft(tx.db, id)
    return nft ? [toNft(nft)] : []
  }),
})

export const catalogHandlers = [
  http.get(
    `${API}/nfts`,
    route(({ request }) => withDb((tx) => HttpResponse.json(search(tx, parseSearch(new URL(request.url)))))),
  ),

  http.get(
    `${API}/nfts/featured`,
    route(() => withDb(({ db }) => HttpResponse.json({ items: hasScenario('empty') ? [] : db.nfts.filter((n) => n.featured).map(toNft) }))),
  ),

  http.get<{ id: string }>(
    `${API}/nfts/:id`,
    route(({ params }) =>
      withDb(({ db }) => {
        const nft = findNft(db, params.id)
        return nft ? HttpResponse.json(toNft(nft)) : apiError(404, 'NFT_NOT_FOUND', 'NFT não encontrado')
      }),
    ),
  ),

  http.get(
    `${API}/me/favorites`,
    route(({ request }) =>
      withDb((tx) => {
        const auth = authenticate(tx, request)
        return auth.ok ? HttpResponse.json(favoritesOf(tx, auth.value)) : auth.response
      }),
    ),
  ),

  ...(['put', 'delete'] as const).map((method) =>
    http[method]<{ nftId: string }>(
      `${API}/me/favorites/:nftId`,
      route(({ request, params }) =>
        withDb((tx) => {
          const auth = authenticate(tx, request)
          if (!auth.ok) return auth.response
          if (hasScenario('favorite-fails')) return apiError(500, 'SERVICE_UNAVAILABLE', 'Não foi possível atualizar os favoritos')
          if (!findNft(tx.db, params.nftId)) return apiError(404, 'NFT_NOT_FOUND', 'NFT não encontrado')
          const current = new Set(tx.db.favorites[auth.value] ?? [])
          if (method === 'put') current.add(params.nftId)
          else current.delete(params.nftId)
          tx.db.favorites[auth.value] = [...current]
          return HttpResponse.json(favoritesOf(tx, auth.value))
        }),
      ),
    ),
  ),
]
