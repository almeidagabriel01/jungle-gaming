import type { Category } from '@/contracts/nft'
import { eth } from '@/lib/money'
import type { Db, DbNft, DbOrder } from './db'

/**
 * Seed determinístico: sem Math.random nem Date.now. Mudou o seed → suba SEED_VERSION,
 * o que descarta o estado salvo no navegador (evita estado velho após redeploy).
 */
export const SEED_VERSION = 1

/** Credenciais fictícias (documentadas no README). Senhas guardadas só como SHA-256 com salt. */
export const SEED_USERS = {
  ana: { id: 'usr_ana', email: 'ana@jungle.test', password: 'Senha@123' },
  bruno: { id: 'usr_bruno', email: 'bruno@jungle.test', password: 'Senha@123' },
} as const

/** mulberry32: PRNG pequeno e determinístico. */
function prng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CATEGORIES: Category[] = ['art', 'gaming', 'music', 'photography', 'collectibles', 'sports']
const COLLECTIONS = [
  { id: 'col_neon', name: 'Neon Jungle' },
  { id: 'col_tides', name: 'Digital Tides' },
  { id: 'col_glyph', name: 'Glyph Society' },
  { id: 'col_arcade', name: 'Arcade Relics' },
  { id: 'col_sonic', name: 'Sonic Bloom' },
  { id: 'col_lens', name: 'Lens & Light' },
  { id: 'col_vault', name: 'The Vault' },
  { id: 'col_arena', name: 'Arena Legends' },
]
const CREATORS = ['Lia Moraes', 'Kenji Ito', 'Ravi Patel', 'Sofia Lund', 'Tomás Ribeiro', 'Amara Okafor']
const ADJECTIVES = ['Aurora', 'Crimson', 'Velvet', 'Solar', 'Lunar', 'Quantum', 'Feral', 'Silent', 'Golden', 'Hollow', 'Prism', 'Wild']
const NOUNS = ['Panther', 'Orchid', 'Circuit', 'Totem', 'Echo', 'Canopy', 'Mirage', 'Serpent', 'Monolith', 'Parrot', 'Signal', 'Ember']
const PRICES = ['0.0001', '0.000123456789', '0.005', '0.012', '0.045', '0.08', '0.15', '0.2', '0.35', '0.5', '0.75', '1', '1.25', '2.4', '3.1415', '5', '8.8', '12', '25']
const EDITION_NAMES = ['Genesis', 'Ouro', 'Prata', 'Aberta']
const ART_COUNT = 16
const BASE_TIME = Date.UTC(2026, 9, 1, 12, 0, 0)

function createNfts(): DbNft[] {
  const rand = prng(42)
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)] as T

  return Array.from({ length: 48 }, (_, i) => {
    const n = i + 1
    const id = `nft_${String(n).padStart(3, '0')}`
    const name = `${ADJECTIVES[i % ADJECTIVES.length]} ${NOUNS[(i * 5) % NOUNS.length]} #${n}`
    const collection = COLLECTIONS[i % COLLECTIONS.length]!
    const editionCount = 1 + Math.floor(rand() * 4)
    const basePrice = pick(PRICES)
    const editions = Array.from({ length: editionCount }, (_, e) => {
      const supply = [1, 5, 10, 25, 100][Math.floor(rand() * 5)]!
      // Distribuição de estoque: esgotados, últimas unidades e estoque amplo.
      const roll = rand()
      const available = roll < 0.15 ? 0 : roll < 0.3 ? Math.min(1, supply) : Math.max(1, Math.floor(supply * rand()))
      const multiplier = ['1', '0.6', '0.35', '0.1'][e]!
      const price = eth.mul(basePrice, multiplier)
      return { id: `${id}_ed${e + 1}`, name: EDITION_NAMES[e]!, price, supply, available }
    })
    // NFTs 7 e 19 completamente esgotados; NFT 3 com uma única unidade.
    if (n === 7 || n === 19) for (const ed of editions) ed.available = 0
    if (n === 3) {
      editions.splice(1)
      editions[0]!.supply = 1
      editions[0]!.available = 1
    }
    const art = (k: number) => `/art/${String(((i + k) % ART_COUNT) + 1).padStart(2, '0')}.svg`
    return {
      id,
      name,
      description: `${name} faz parte da coleção ${collection.name}. Peça digital com ${editionCount} ${editionCount > 1 ? 'edições' : 'edição'}, criada para colecionadores que acompanham o projeto desde o início.`,
      category: CATEGORIES[i % CATEGORIES.length]!,
      collection,
      creator: { name: CREATORS[i % CREATORS.length]!, avatarUrl: `/art/${String((i % ART_COUNT) + 1).padStart(2, '0')}.svg` },
      images: [0, 1, 2].map((k) => ({ url: art(k), alt: `${name}, vista ${k + 1}` })),
      editions,
      featured: n <= 4,
      createdAt: new Date(BASE_TIME - i * 3_600_000 * 7).toISOString(),
      version: 1,
    }
  })
}

export function createSeed(): Db {
  const nfts = createNfts()
  const ana = SEED_USERS.ana
  const bruno = SEED_USERS.bruno

  const pastOrder = (id: string, userId: string, nft: DbNft): DbOrder => {
    const ed = nft.editions[0]!
    return {
      id,
      userId,
      status: 'confirmed',
      version: 2,
      network: 'ethereum',
      wallet: { id: userId === ana.id ? 'wal_ana_1' : 'wal_bruno_1', label: 'Principal', address: '0x' + 'a1'.repeat(20) },
      buyer: { fullName: userId === ana.id ? 'Ana Souza' : 'Bruno Lima', email: userId === ana.id ? ana.email : bruno.email, country: 'Brasil' },
      lines: [
        {
          itemId: 'itm_seed',
          nftId: nft.id,
          editionId: ed.id,
          name: nft.name,
          editionName: ed.name,
          quantity: 1,
          unitPrice: ed.price,
          lineTotal: ed.price,
          available: ed.available,
          status: 'ok',
        },
      ],
      coupon: null,
      subtotal: ed.price,
      discount: '0',
      networkFee: '0.0021',
      total: eth.add(ed.price, '0.0021'),
      txHash: '0x' + 'b2'.repeat(32),
      explorerUrl: `https://explorer.example/ethereum/tx/0x${'b2'.repeat(32)}`,
      failureReason: null,
      createdAt: new Date(BASE_TIME - 86_400_000 * 3).toISOString(),
      updatedAt: new Date(BASE_TIME - 86_400_000 * 3).toISOString(),
      idempotencyKey: `seed-${id}`,
      requestHash: 'seed',
      settleAt: 0,
      outcome: 'confirmed',
    }
  }

  return {
    seedVersion: SEED_VERSION,
    seq: 1000,
    users: [
      {
        id: ana.id,
        name: 'Ana Souza',
        email: ana.email,
        username: 'ana_souza',
        bio: 'Coleciono arte generativa desde 2021.',
        avatarUrl: null,
        salt: 'salt-ana-7f3a',
        passwordHash: 'c31289cafe495a107b32c78c05dc193bae28a9408891ac575827912121c54e11',
      },
      {
        id: bruno.id,
        name: 'Bruno Lima',
        email: bruno.email,
        username: 'bruno_lima',
        bio: '',
        avatarUrl: null,
        salt: 'salt-bruno-91c2',
        passwordHash: '88c93accd1728fa682e867eda004a3a389ed988fcb2540221333df2b297eee7b',
      },
    ],
    nfts,
    favorites: { [ana.id]: ['nft_002', 'nft_005', 'nft_011'], [bruno.id]: ['nft_020'] },
    carts: [{ id: 'cart_ana', owner: `user:${ana.id}`, items: [{ id: 'itm_ana_1', nftId: 'nft_010', editionId: 'nft_010_ed1', quantity: 1 }], updatedAt: new Date(BASE_TIME).toISOString() }],
    quotes: [],
    orders: [pastOrder('ord_seed_ana', ana.id, nfts[1]!), pastOrder('ord_seed_bruno', bruno.id, nfts[5]!)],
    wallets: [
      { id: 'wal_ana_1', userId: ana.id, label: 'Principal', address: '0x' + 'a1'.repeat(20), network: 'ethereum', role: 'primary', createdAt: new Date(BASE_TIME).toISOString() },
      { id: 'wal_ana_2', userId: ana.id, label: 'Reserva', address: '0x' + 'c3'.repeat(20), network: 'polygon', role: 'secondary', createdAt: new Date(BASE_TIME).toISOString() },
      { id: 'wal_bruno_1', userId: bruno.id, label: 'Principal', address: '0x' + 'd4'.repeat(20), network: 'arbitrum', role: 'primary', createdAt: new Date(BASE_TIME).toISOString() },
    ],
    sessions: [],
    walletConnections: {},
    firedTriggers: [],
  }
}
