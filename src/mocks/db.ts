import type { Coupon, QuoteLine } from '@/contracts/cart'
import type { Network } from '@/contracts/common'
import type { RealtimeEvent } from '@/contracts/events'
import type { Edition, Nft } from '@/contracts/nft'
import type { Buyer, Order, OrderStatus } from '@/contracts/order'
import type { User, Wallet } from '@/contracts/account'
import { eth } from '@/lib/money'
import { createSeed, SEED_VERSION } from './seed'

/* ---------------------------------------------------------------------------
 * Estado do "servidor" simulado. Vive no localStorage para sobreviver a refresh,
 * é relido a cada request (abas não divergem) e toda escrita passa por `withDb`,
 * que persiste e só então publica os eventos Socket.IO gerados pela mutação.
 * ------------------------------------------------------------------------- */

export type DbUser = User & { passwordHash: string; salt: string }
export type DbNft = Omit<Nft, 'minPrice' | 'available'>

/** Taxa de rede estimada por pedido (Ethereum: 0,016 ETH, como no frame Carrinho). */
export const NETWORK_FEES: Record<Network, string> = { ethereum: '0.016', polygon: '0.0004', solana: '0.0001' }
export type DbCartItem = { id: string; nftId: string; editionId: string; quantity: number }
export type DbCart = { id: string; owner: string; items: DbCartItem[]; updatedAt: string }
export type DbQuote = {
  id: string
  owner: string
  fingerprint: string
  network: Network
  lines: QuoteLine[]
  coupon: Coupon | null
  subtotal: string
  discount: string
  networkFee: string
  total: string
  purchasable: boolean
  createdAt: string
}
export type DbOrder = Order & {
  idempotencyKey: string
  requestHash: string
  settleAt: number
  outcome: Exclude<OrderStatus, 'pending'>
}
export type DbSession = {
  userId: string
  accessToken: string
  refreshToken: string
  accessExpiresAt: number
  refreshExpiresAt: number
}

export type Db = {
  seedVersion: number
  seq: number
  users: DbUser[]
  nfts: DbNft[]
  favorites: Record<string, string[]>
  carts: DbCart[]
  quotes: DbQuote[]
  orders: DbOrder[]
  wallets: (Wallet & { userId: string })[]
  sessions: DbSession[]
  /** Conexão simulada de carteira por usuário (uma ativa por vez). */
  walletConnections: Record<string, { walletId: string; network: Network; connectedAt: string }>
  /** Gatilhos de cenário que só disparam uma vez por chave (ex.: preço muda no checkout). */
  firedTriggers: string[]
}

export type { Buyer }

const STORAGE_KEY = `jungle-mock-db:v${SEED_VERSION}`

let publish: (event: RealtimeEvent) => void = () => undefined
/** O transporte de eventos (socket mock) se registra aqui; o DB não conhece o socket. */
export const setEventSink = (sink: (event: RealtimeEvent) => void) => {
  publish = sink
}

let onOrderScheduled: (settleAt: number) => void = () => undefined
export const setOrderScheduler = (fn: (settleAt: number) => void) => {
  onOrderScheduled = fn
}

function load(): Db {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Db
      if (parsed.seedVersion === SEED_VERSION) return parsed
    } catch {
      // estado corrompido: cai no seed
    }
  }
  return createSeed()
}

export function resetDb() {
  // Remove também versões antigas do seed deixadas por deploys anteriores.
  for (const key of Object.keys(localStorage)) if (key.startsWith('jungle-mock-db:')) localStorage.removeItem(key)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createSeed()))
}

/** Contexto de uma transação: acumula eventos para publicar após o commit. */
export type Tx = { db: Db; now: number; events: RealtimeEvent[] }

/**
 * Executa uma mutação síncrona sobre o estado: carrega, liquida pedidos vencidos,
 * aplica `fn`, persiste e publica os eventos. Síncrono de propósito: não há `await`
 * entre leitura e escrita, então não existe atualização perdida dentro da aba.
 */
export function withDb<T>(fn: (tx: Tx) => T): T {
  const tx: Tx = { db: load(), now: Date.now(), events: [] }
  settleDueOrders(tx)
  const result = fn(tx)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tx.db))
  for (const event of tx.events) publish(event)
  return result
}

export const nextId = (tx: Tx, prefix: string) => `${prefix}_${String(++tx.db.seq).padStart(5, '0')}`
const iso = (ms: number) => new Date(ms).toISOString()

/* ----------------------------- NFTs ----------------------------- */

export function toNft(n: DbNft): Nft {
  const inStock = n.editions.filter((e) => e.available > 0)
  const pool = inStock.length > 0 ? inStock : n.editions
  return {
    ...n,
    minPrice: eth.min(...pool.map((e) => e.price)),
    available: n.editions.reduce((sum, e) => sum + e.available, 0),
  }
}

export const findNft = (db: Db, id: string) => db.nfts.find((n) => n.id === id)

/** Única porta de escrita em NFT: incrementa a versão e emite `nft.updated`. */
export function updateEdition(tx: Tx, nftId: string, editionId: string, patch: Partial<Pick<Edition, 'price' | 'available'>>) {
  const nft = findNft(tx.db, nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !edition) throw new Error(`edição inexistente: ${nftId}/${editionId}`)
  if (patch.price !== undefined) edition.price = patch.price
  if (patch.available !== undefined) edition.available = Math.max(0, Math.min(patch.available, edition.supply))
  nft.version += 1
  const view = toNft(nft)
  tx.events.push({
    eventId: nextId(tx, 'evt'),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: iso(tx.now),
    payload: {
      nftId: nft.id,
      minPrice: view.minPrice,
      available: view.available,
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
    },
  })
}

/* ----------------------------- Pedidos ----------------------------- */

/** Única porta de transição de pedido: terminal é definitivo, versão sobe e emite `order.updated`. */
export function transitionOrder(tx: Tx, order: DbOrder, status: Exclude<OrderStatus, 'pending'>, failureReason: string | null) {
  if (order.status !== 'pending') return
  order.status = status
  order.failureReason = failureReason
  order.version += 1
  order.updatedAt = iso(tx.now)
  if (status === 'confirmed') {
    order.txHash = fakeTxHash(order.id)
    order.explorerUrl = `https://explorer.example/${order.network}/tx/${order.txHash}`
    removePurchasedFromCart(tx.db, order)
  } else {
    // Devolve o estoque reservado na criação.
    for (const line of order.lines) {
      const edition = findNft(tx.db, line.nftId)?.editions.find((e) => e.id === line.editionId)
      if (edition) updateEdition(tx, line.nftId, line.editionId, { available: edition.available + line.quantity })
    }
  }
  tx.events.push({
    eventId: nextId(tx, 'evt'),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: iso(tx.now),
    payload: { orderId: order.id, userId: order.userId, status: order.status, failureReason },
  })
}

export function settleDueOrders(tx: Tx) {
  for (const order of tx.db.orders) {
    if (order.status === 'pending' && order.settleAt <= tx.now) {
      transitionOrder(tx, order, order.outcome, order.outcome === 'declined' ? 'Pagamento recusado pela carteira' : null)
    }
  }
}

export const scheduleSettlement = (settleAt: number) => {
  onOrderScheduled(settleAt)
}

/** Remove do carrinho do comprador só as quantidades efetivamente compradas. */
function removePurchasedFromCart(db: Db, order: DbOrder) {
  const cart = db.carts.find((c) => c.owner === userOwner(order.userId))
  if (!cart) return
  for (const line of order.lines) {
    const item = cart.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
    if (item) item.quantity -= line.quantity
  }
  cart.items = cart.items.filter((i) => i.quantity > 0)
}

function fakeTxHash(seed: string) {
  let h = ''
  for (let i = 0; h.length < 64; i++) h += hash(`${seed}:${i}`)
  return `0x${h.slice(0, 64)}`
}

/* ----------------------------- Utilidades ----------------------------- */

export const userOwner = (userId: string) => `user:${userId}`
export const guestOwner = (guestId: string) => `guest:${guestId}`

/** FNV-1a 32 bits em hex: suficiente para fingerprint de cotação e hash de corpo no mock. */
export function hash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function getCart(tx: Tx, owner: string): DbCart {
  let cart = tx.db.carts.find((c) => c.owner === owner)
  if (!cart) {
    cart = { id: nextId(tx, 'cart'), owner, items: [], updatedAt: iso(tx.now) }
    tx.db.carts.push(cart)
  }
  return cart
}

export { iso }
