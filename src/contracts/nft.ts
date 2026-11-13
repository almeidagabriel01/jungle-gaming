import { z } from 'zod'
import { Eth, Id, IsoDate, Network, paginated } from './common'

/** As "Coleções" da lateral do catálogo (Arte digital, Fotografia…). */
export const Category = z.enum(['digital-art', 'photography', 'music', '3d', 'collectibles', 'generative', 'gaming', 'subscriptions', 'utility'])
export type Category = z.infer<typeof Category>

export const Rarity = z.enum(['common', 'rare', 'legendary'])
export type Rarity = z.infer<typeof Rarity>

export const Edition = z.object({
  id: Id,
  /** Tiragem exibida: "1/1", "1/10", "1/50" ou "Aberta". */
  name: z.string(),
  price: Eth,
  /** Preço anterior (riscado no card); null quando não há desconto. */
  compareAtPrice: Eth.nullable(),
  supply: z.int().min(1),
  available: z.int().min(0),
})
export type Edition = z.infer<typeof Edition>

export const NftImage = z.object({ url: z.string(), thumbnailUrl: z.string(), alt: z.string() })

export const Nft = z.object({
  id: Id,
  name: z.string(),
  /** Número do token, como exibido: "0042". */
  tokenId: z.string(),
  description: z.string(),
  category: Category,
  /** Coleção do projeto (ex.: "Kurio Apes"); não confundir com `category`. */
  collection: z.object({ id: Id, name: z.string() }),
  creator: z.object({ name: z.string() }),
  network: Network,
  contract: z.object({ address: z.string(), standard: z.string() }),
  royaltyPercent: z.number().min(0).max(100),
  attributes: z.array(z.string()),
  rarity: Rarity,
  rating: z.object({ average: z.number().min(0).max(5), count: z.int().min(0) }),
  images: z.array(NftImage).min(1),
  editions: z.array(Edition).min(1),
  /** Menor preço entre as edições com disponibilidade (ou entre todas, se esgotado). */
  minPrice: Eth,
  available: z.int().min(0),
  featured: z.boolean(),
  /** Abas "Novos lançamentos" e "Em alta": marcadas no catálogo, não derivadas do relógio. */
  isNew: z.boolean(),
  trending: z.boolean(),
  createdAt: IsoDate,
  /** Versão monotônica do recurso; a mesma que viaja em `nft.updated`. */
  version: z.int().min(1),
})
export type Nft = z.infer<typeof Nft>

export const NftSort = z.enum(['recent', 'price-asc', 'price-desc', 'name'])
export type NftSort = z.infer<typeof NftSort>

export const NftTab = z.enum(['all', 'new', 'trending'])
export type NftTab = z.infer<typeof NftTab>

export const PAGE_SIZE = 9

/**
 * Parâmetros do catálogo. O mesmo schema valida a URL (TanStack Router) e a query da API (MSW),
 * com fallback para o default em qualquer valor inválido.
 */
export const NftSearch = z.object({
  q: z.string().trim().max(80).default('').catch(''),
  tab: NftTab.default('all').catch('all'),
  categories: z.array(Category).default([]).catch([]),
  networks: z.array(Network).default([]).catch([]),
  /** Filtro por coleção do projeto (usado em "Mais desta coleção"). */
  collection: z.string().default('').catch(''),
  minPrice: Eth.optional().catch(undefined),
  maxPrice: Eth.optional().catch(undefined),
  sort: NftSort.default('recent').catch('recent'),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type NftSearch = z.infer<typeof NftSearch>

export const NFT_SEARCH_DEFAULTS: NftSearch = {
  q: '',
  tab: 'all',
  categories: [],
  networks: [],
  collection: '',
  minPrice: undefined,
  maxPrice: undefined,
  sort: 'recent',
  page: 1,
}

/**
 * Contagens por opção consideram todos os outros filtros, menos o próprio grupo
 * (marcar "Música" não zera as demais categorias). A faixa de preço ignora o filtro de preço.
 */
export const NftFacets = z.object({
  categories: z.record(Category, z.int().min(0)),
  networks: z.record(Network, z.int().min(0)),
  price: z.object({ min: Eth, max: Eth }).nullable(),
})
export type NftFacets = z.infer<typeof NftFacets>

export const NftList = paginated(Nft).extend({ facets: NftFacets })
export type NftList = z.infer<typeof NftList>

export const Favorites = z.object({ items: z.array(Nft) })
export type Favorites = z.infer<typeof Favorites>
