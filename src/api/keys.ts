import type { Network } from '@/contracts/common'
import type { NftSearch } from '@/contracts/nft'

/**
 * Query keys. Dados privados ficam sob `['me', userId]` e carrinho/cotação sob o dono
 * (`user:<id>` ou `guest:<id>`): a chave já isola usuários e parâmetros da consulta.
 */
export const keys = {
  nfts: ['nfts'] as const,
  nftList: (search: NftSearch) => ['nfts', 'list', search] as const,
  nftFeatured: ['nfts', 'featured'] as const,
  nft: (nftId: string) => ['nfts', 'detail', nftId] as const,
  cart: (owner: string) => ['cart', owner] as const,
  quoteAll: ['quote'] as const,
  quote: (owner: string, couponCode: string | undefined, network: Network) => ['quote', owner, couponCode ?? '', network] as const,
  favorites: (userId: string) => ['me', userId, 'favorites'] as const,
  profile: (userId: string) => ['me', userId, 'profile'] as const,
  wallets: (userId: string) => ['me', userId, 'wallets'] as const,
  orders: (userId: string) => ['me', userId, 'orders'] as const,
  order: (userId: string, orderId: string) => ['me', userId, 'orders', orderId] as const,
}
