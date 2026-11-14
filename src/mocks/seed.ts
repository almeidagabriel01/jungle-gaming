import type { Network } from '@/contracts/common'
import type { Article } from '@/contracts/content'
import type { Category } from '@/contracts/nft'
import { eth } from '@/lib/money'
import type { Db, DbNft, DbOrder } from './db'

/**
 * Seed determinístico: sem Math.random nem Date.now. Mudou o seed → suba SEED_VERSION,
 * o que descarta o estado salvo no navegador (evita estado velho após redeploy).
 */
export const SEED_VERSION = 4

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

type Family = 'emerald' | 'sage' | 'golden' | 'ivory'

/** As 4 artes do Figma (exportadas para public/nfts); cada uma com vista inteira e aproximada. */
const FAMILY: Record<Family, { names: string[]; traits: string[] }> = {
  emerald: { names: ['Emerald Ape', 'Jade Monarch', 'Forest Regent'], traits: ['Óculos', 'Jaqueta'] },
  sage: { names: ['Sage Nomad', 'Violet Nomad', 'Cosmic Bloom', 'Dusk Wanderer'], traits: ['Chapéu', 'Moletom'] },
  golden: { names: ['Golden Beat', 'Golden Signal', 'Golden Frequency', 'Amber Echo'], traits: ['Fones', 'Jaqueta'] },
  ivory: { names: ['Neon Vessel', 'Ivory Baron', 'Onyx Envoy', 'Velvet Consul'], traits: ['Blazer', 'Gola alta'] },
}
const FAMILIES = Object.keys(FAMILY) as Family[]

const COLLECTIONS = [
  { id: 'col_kurio_apes', name: 'Kurio Apes' },
  { id: 'col_kurio_editions', name: 'Kurio Editions' },
  { id: 'col_nomad_club', name: 'Nomad Club' },
  { id: 'col_golden_freq', name: 'Golden Frequencies' },
  { id: 'col_ivory_society', name: 'Ivory Society' },
]
const CREATORS = ['Nova Sato', 'Iris Okafor', 'Theo Lindqvist', 'Maya Ferraz', 'Kai Moreno']

/** Contagens do frame Início (lateral "Coleções"): o seed reproduz exatamente esses números. */
const CATEGORY_COUNTS: Record<Category, number> = {
  'digital-art': 33,
  photography: 12,
  music: 65,
  '3d': 39,
  collectibles: 23,
  generative: 17,
  gaming: 19,
  subscriptions: 13,
  utility: 18,
}
const NFT_COUNT = Object.values(CATEGORY_COUNTS).reduce((a, b) => a + b, 0) // 239
/** O Figma mostra 119/78/86 (soma diferente do total); mantida a proporção sobre os 239. */
const NETWORK_COUNTS: Record<Network, number> = { ethereum: 100, polygon: 66, solana: 73 }

/** Os 9 primeiros (ordem "Listados recentemente") são os cards do Figma, com os mesmos preços. */
/** `collection`: índice em COLLECTIONS (padrão Kurio Apes); "Mais desta coleção" do frame não inclui Sage, Neon e Golden Frequency. */
const FIGMA_NFTS: { name: string; family: Family; price: string; compareAt?: string; category: Category; network: Network; collection?: number }[] = [
  { name: 'Emerald Ape #042', family: 'emerald', price: '1.19', category: 'digital-art', network: 'ethereum' },
  { name: 'Sage Nomad #009', family: 'sage', price: '1.69', category: 'digital-art', network: 'polygon', collection: 2 },
  { name: 'Neon Vessel #552', family: 'ivory', price: '1.99', compareAt: '2.29', category: '3d', network: 'solana', collection: 1 },
  { name: 'Cosmic Bloom #118', family: 'sage', price: '1.29', category: 'generative', network: 'ethereum' },
  { name: 'Violet Nomad #314', family: 'sage', price: '1.39', category: 'digital-art', network: 'polygon' },
  { name: 'Ivory Baron #088', family: 'ivory', price: '1.79', category: 'collectibles', network: 'ethereum' },
  { name: 'Golden Beat #207', family: 'golden', price: '0.99', category: 'music', network: 'solana' },
  { name: 'Golden Frequency #071', family: 'golden', price: '0.59', category: 'music', network: 'polygon', collection: 3 },
  { name: 'Golden Signal #160', family: 'golden', price: '0.39', category: 'music', network: 'ethereum' },
]

/** Faixa do Figma: 0,02 a 12,30 ETH. Inclui valores com muitas casas para exercitar a precisão. */
const PRICES = ['0.039', '0.045', '0.08', '0.123456789', '0.15', '0.2', '0.25', '0.33', '0.45', '0.5', '0.69', '0.75', '0.85', '1.05', '1.49', '2.4', '2.75', '3.1415', '3.5', '4.2', '5', '6.25', '7.77', '8.8', '9.99', '11.5']
const MIN_PRICE = { index: 50, price: '0.02' }
const MAX_PRICE = { index: 51, price: '12.3' }

/** Tiragens na ordem de exibição; o preço base é o da edição mais barata. */
const EDITION_SETS: [name: string, multiplier: string, supply: number][][] = [
  [['1/1', '1', 1]],
  [['1/1', '2', 1], ['1/10', '1', 10]],
  [['1/1', '3', 1], ['1/10', '1.5', 10], ['1/50', '1', 50]],
  [['1/1', '3', 1], ['1/10', '1.5', 10], ['1/50', '1', 50], ['Aberta', '1', 1000]],
]
const BASE_TIME = Date.UTC(2026, 9, 1, 12, 0, 0)

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Distribui as contagens exatas, reservando as posições já fixadas pelos itens do Figma. */
function distribute<K extends string>(counts: Record<K, number>, fixed: K[], rand: () => number): K[] {
  const left = { ...counts }
  for (const k of fixed) left[k]--
  const pool = (Object.keys(left) as K[]).flatMap((k) => Array<K>(left[k]).fill(k))
  return [...fixed, ...shuffled(pool, rand)]
}

const hex = (rand: () => number, length: number) => Array.from({ length }, () => '0123456789abcdef'[Math.floor(rand() * 16)]).join('')
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const base58 = (rand: () => number, length: number) => Array.from({ length }, () => BASE58[Math.floor(rand() * 58)]).join('')

function createNfts(): DbNft[] {
  const rand = prng(42)
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)] as T
  const categories = distribute(CATEGORY_COUNTS, FIGMA_NFTS.map((f) => f.category), rand)
  const networks = distribute(NETWORK_COUNTS, FIGMA_NFTS.map((f) => f.network), rand)
  const usedNames = new Set(FIGMA_NFTS.map((f) => f.name))

  return Array.from({ length: NFT_COUNT }, (_, i) => {
    const n = i + 1
    const id = `nft_${String(n).padStart(3, '0')}`
    const figma = FIGMA_NFTS[i]
    const family = figma?.family ?? FAMILIES[i % FAMILIES.length]!
    let name = figma?.name
    while (!name || (!figma && usedNames.has(name))) name = `${pick(FAMILY[family].names)} #${String(1 + Math.floor(rand() * 999)).padStart(3, '0')}`
    usedNames.add(name)
    const tokenId = name.split('#')[1]!.padStart(4, '0')
    const network = networks[i]!
    const category = categories[i]!

    const base = figma?.price ?? (i === MIN_PRICE.index ? MIN_PRICE.price : i === MAX_PRICE.index ? MAX_PRICE.price : pick(PRICES))
    const compareAt = figma?.compareAt ?? (!figma && rand() < 0.12 ? eth.mul(base, '1.15') : null)
    // Os itens do Figma (e do carrinho da Ana) têm todas as tiragens, com 1/50 e Aberta em estoque.
    const set = figma ? EDITION_SETS[3]! : pick(EDITION_SETS)
    const editions = set.map(([editionName, multiplier, supply], e) => {
      const roll = rand()
      // A edição mais barata (último índice) sempre tem estoque: o preço mínimo fica igual ao base.
      const cheapest = e === set.length - 1 || multiplier === '1'
      const available = figma
        ? editionName === '1/1' ? 1 : Math.max(10, Math.floor(supply * 0.6))
        : cheapest ? Math.max(1, Math.floor(supply * rand())) : roll < 0.2 ? 0 : roll < 0.35 ? 1 : Math.max(1, Math.floor(supply * rand()))
      return {
        id: `${id}_ed${e + 1}`,
        name: editionName,
        price: eth.mul(base, multiplier),
        compareAtPrice: compareAt && multiplier === '1' ? compareAt : null,
        supply,
        available: Math.min(available, supply),
      }
    })
    // NFTs 19 e 27 completamente esgotados; NFT 11 com uma única unidade (1/1).
    if (n === 19 || n === 27) for (const ed of editions) ed.available = 0
    if (n === 11) {
      editions.splice(0, editions.length, { ...editions[0]!, name: '1/1', price: base, supply: 1, available: 1 })
    }

    const collection = figma ? COLLECTIONS[figma.collection ?? 0]! : pick(COLLECTIONS)
    const creator = figma ? CREATORS[0]! : pick(CREATORS)
    const rarityRoll = rand()
    const rarity = n === 1 ? 'rare' : rarityRoll < 0.08 ? 'legendary' : rarityRoll < 0.3 ? 'rare' : 'common'
    const royaltyPercent = n === 1 ? 5 : pick([2.5, 5, 7.5, 10])
    const networkName = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }[network]
    const contract =
      network === 'solana'
        ? { address: base58(rand, 44), standard: 'Metaplex' }
        : { address: n === 1 ? '0x7A42c9d1e5f03b8a6c2d4e7f9a1b3c5d7e8f19E8' : `0x${hex(rand, 40)}`, standard: 'ERC-721' }
    // Maior tiragem numerada ("obra digital 1/50"); a edição Aberta não tem número.
    const firstEdition = editions.findLast((e) => e.name !== 'Aberta')!.name
    return {
      id,
      name,
      tokenId,
      // Textos do layout (frame "Detalhes do NFT"), preenchidos com os dados de cada obra.
      summary: `Um colecionável digital finalizado à mão da coleção ${collection.name}, verificado na ${networkName}, com arte desbloqueável e acesso para colecionadores.`,
      description: `${name} é uma obra digital ${firstEdition} finalizada à mão da coleção ${collection.name}. Cada atributo fica armazenado nos metadados do token e verificado na ${networkName}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.\n\nA propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. ${creator} recebe ${String(royaltyPercent).replace('.', ',')}% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
      category,
      collection,
      creator: { name: creator },
      network,
      contract,
      royaltyPercent,
      attributes: n === 1 ? ['Óculos', 'Esmeralda'] : FAMILY[family].traits,
      rarity,
      rating: n === 1 ? { average: 4.8, count: 19 } : { average: Math.round((3.6 + rand() * 1.4) * 10) / 10, count: Math.floor(rand() * 48) },
      // Quatro vistas da arte, como a galeria do layout: completa, dois enquadramentos e o rosto.
      images: [
        { url: `/nfts/${family}-960.webp`, thumbnailUrl: `/nfts/${family}-480.webp`, alt: `${name}, obra completa` },
        { url: `/nfts/${family}-bust-960.webp`, thumbnailUrl: `/nfts/${family}-bust-480.webp`, alt: `${name}, busto` },
        { url: `/nfts/${family}-mid-960.webp`, thumbnailUrl: `/nfts/${family}-mid-480.webp`, alt: `${name}, enquadramento próximo` },
        { url: `/nfts/${family}-close-960.webp`, thumbnailUrl: `/nfts/${family}-close-480.webp`, alt: `${name}, detalhe do rosto` },
      ],
      editions,
      featured: [1, 2, 6, 7].includes(n),
      isNew: n <= 3 || (n > 9 && rand() < 0.2),
      trending: [1, 3, 6, 9].includes(n) || (n > 9 && rand() < 0.18),
      createdAt: new Date(BASE_TIME - i * 3 * 3_600_000).toISOString(),
      version: 1,
    }
  })
}

/** "Diário da Cunhagem" do layout: conteúdo editorial estático da API simulada. */
export const ARTICLES: Article[] = [
  {
    id: 'art_001',
    title: 'Como funciona a propriedade de NFTs',
    excerpt: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    publishedAt: '2026-09-12T12:00:00.000Z',
    readingMinutes: 6,
    image: { url: '/nfts/ivory-960.webp', thumbnailUrl: '/nfts/ivory-480.webp', alt: 'Retrato de Ivory Baron, primata de terno claro' },
  },
  {
    id: 'art_002',
    title: '10 artistas digitais para acompanhar',
    excerpt: 'Conheça criadores que moldam a cultura digital.',
    publishedAt: '2026-09-13T12:00:00.000Z',
    readingMinutes: 2,
    image: { url: '/nfts/emerald-960.webp', thumbnailUrl: '/nfts/emerald-480.webp', alt: 'Retrato de Emerald Ape, primata de óculos redondos' },
  },
  {
    id: 'art_003',
    title: 'Raridade, atributos e procedência',
    excerpt: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    publishedAt: '2026-09-15T12:00:00.000Z',
    readingMinutes: 3,
    image: { url: '/nfts/sage-960.webp', thumbnailUrl: '/nfts/sage-480.webp', alt: 'Retrato de Sage Nomad, primata de chapéu e moletom' },
  },
  {
    id: 'art_004',
    title: 'Como proteger sua carteira',
    excerpt: 'Proteja sua carteira, seus ativos e sua identidade.',
    publishedAt: '2026-09-15T15:00:00.000Z',
    readingMinutes: 2,
    image: { url: '/nfts/golden-960.webp', thumbnailUrl: '/nfts/golden-480.webp', alt: 'Retrato de Golden Beat, primata de fones de ouvido' },
  },
]

export function createSeed(): Db {
  const nfts = createNfts()
  const ana = SEED_USERS.ana
  const bruno = SEED_USERS.bruno

  const createdAt = new Date(BASE_TIME).toISOString()
  /** Carteiras do frame mobile Pagamento: "Reserva" (nova.kurio.eth, Polygon) e "Principal" (0xA91F…E82C, Ethereum). */
  const wallets: Db['wallets'] = [
    {
      id: 'wal_ana_1',
      userId: ana.id,
      role: 'primary',
      createdAt,
      displayName: 'Ana Souza',
      label: 'Principal',
      network: 'ethereum',
      profileName: 'Ana Colecionadora',
      address: '0xA91F3c5d7e9b1a2c4d6e8f0a1b3c5d7e9f0bE82C',
      secondaryAddress: '',
      provider: 'metamask',
      referralCode: 'KURIO-ANA',
      email: ana.email,
      ensName: 'ana.kurio.eth',
    },
    {
      id: 'wal_ana_2',
      userId: ana.id,
      role: 'secondary',
      createdAt,
      displayName: 'Ana Souza',
      label: 'Reserva',
      network: 'polygon',
      profileName: 'Ana Colecionadora',
      address: '0x' + 'c3'.repeat(20),
      secondaryAddress: 'nova.kurio.eth',
      provider: 'coinbase',
      referralCode: 'KURIO-ANA',
      email: ana.email,
      ensName: 'nova.kurio.eth',
    },
    {
      id: 'wal_bruno_1',
      userId: bruno.id,
      role: 'primary',
      createdAt,
      displayName: 'Bruno Lima',
      label: 'Principal',
      network: 'polygon',
      profileName: 'Bruno Lima',
      address: '0x' + 'd4'.repeat(20),
      secondaryAddress: '',
      provider: 'walletconnect',
      referralCode: 'KURIO-BRUNO',
      email: bruno.email,
      ensName: 'bruno.kurio.eth',
    },
  ]

  const pastOrder = (id: string, userId: string, nft: DbNft): DbOrder => {
    const ed = nft.editions[0]!
    const w = wallets.find((x) => x.userId === userId && x.role === 'primary')!
    return {
      id,
      userId,
      status: 'confirmed',
      version: 2,
      network: 'ethereum',
      wallet: { id: w.id, label: w.label, address: w.address },
      buyer: {
        displayName: w.displayName,
        username: userId === ana.id ? 'ana_souza' : 'bruno_lima',
        profileName: w.profileName,
        email: w.email,
        ensName: w.ensName,
        referralCode: w.referralCode,
        address: w.address,
        secondaryAddress: w.secondaryAddress,
        provider: w.provider,
        note: '',
      },
      lines: [
        {
          itemId: 'itm_seed',
          nftId: nft.id,
          editionId: ed.id,
          name: nft.name,
          tokenId: nft.tokenId,
          editionName: ed.name,
          image: nft.images[0]!,
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
      networkFee: '0.016',
      total: eth.add(ed.price, '0.016'),
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
        ensName: 'ana.kurio.eth',
        walletLabel: 'Principal',
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
        ensName: 'bruno.kurio.eth',
        walletLabel: 'Principal',
        avatarUrl: null,
        salt: 'salt-bruno-91c2',
        passwordHash: '88c93accd1728fa682e867eda004a3a389ed988fcb2540221333df2b297eee7b',
      },
    ],
    nfts,
    favorites: { [ana.id]: ['nft_002', 'nft_005', 'nft_011'], [bruno.id]: ['nft_020'] },
    // O mesmo carrinho do frame Carrinho: 2 + 6 + 9 edições 1/50, subtotal 26.83 ETH.
    carts: [
      {
        id: 'cart_ana',
        owner: `user:${ana.id}`,
        items: [
          { id: 'itm_ana_1', nftId: 'nft_001', editionId: 'nft_001_ed3', quantity: 2 },
          { id: 'itm_ana_2', nftId: 'nft_005', editionId: 'nft_005_ed3', quantity: 6 },
          { id: 'itm_ana_3', nftId: 'nft_006', editionId: 'nft_006_ed3', quantity: 9 },
        ],
        updatedAt: new Date(BASE_TIME).toISOString(),
      },
    ],
    quotes: [],
    orders: [pastOrder('ord_seed_ana', ana.id, nfts[1]!), pastOrder('ord_seed_bruno', bruno.id, nfts[5]!)],
    wallets,
    sessions: [],
    walletConnections: {},
    firedTriggers: [],
  }
}
