import type { WalletProvider } from '@/contracts/account'
import type { Network } from '@/contracts/common'
import type { Category, NftSort, NftTab, Rarity } from '@/contracts/nft'

/** Rótulos do layout (frame Início). */
export const CATEGORY_LABEL: Record<Category, string> = {
  'digital-art': 'Arte digital',
  photography: 'Fotografia',
  music: 'Música',
  '3d': 'Arte 3D',
  collectibles: 'Colecionáveis',
  generative: 'Generativa',
  gaming: 'Jogos',
  subscriptions: 'Assinaturas',
  utility: 'Utilidade',
}

export const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

export const TAB_LABEL: Record<NftTab, string> = { all: 'Todos os NFTs', new: 'Novos lançamentos', trending: 'Em alta' }

export const SORT_LABEL: Record<NftSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  name: 'Nome (A–Z)',
}

export const RARITY_LABEL: Record<Rarity, string> = { common: 'Comum', rare: 'Raro', legendary: 'Lendário' }

/** "Tipo de carteira" (frames Pagamento e Carteiras). */
export const PROVIDER_LABEL: Record<WalletProvider, string> = { metamask: 'MetaMask', coinbase: 'Coinbase Wallet', walletconnect: 'WalletConnect' }
