import { http, HttpResponse } from 'msw'
import { AddCartItemBody, MergeCartBody, QuoteRequest, UpdateCartItemBody, type Cart, type Quote, type QuoteLine } from '@/contracts/cart'
import type { Network } from '@/contracts/common'
import { eth } from '@/lib/money'
import { NETWORK_FEES, findNft, getCart, guestOwner, hash, iso, nextId, userOwner, withDb, type DbCart, type DbQuote, type Tx } from '../db'
import { API, apiError, authenticate, parseBody, resolveOwner, route } from './http'

/** Cupons fictícios documentados no README. */
const COUPONS: Record<string, { percentOff: number; expiresAt: string }> = {
  JUNGLE10: { percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  WELCOME25: { percentOff: 25, expiresAt: '2099-12-31T23:59:59.000Z' },
  EXPIRED5: { percentOff: 5, expiresAt: '2025-01-01T00:00:00.000Z' },
}


export function toCart(tx: Tx, cart: DbCart): Cart {
  return {
    id: cart.id,
    updatedAt: cart.updatedAt,
    items: cart.items.flatMap((item) => {
      const nft = findNft(tx.db, item.nftId)
      const edition = nft?.editions.find((e) => e.id === item.editionId)
      if (!nft || !edition) return []
      return [
        {
          id: item.id,
          nftId: nft.id,
          editionId: edition.id,
          name: nft.name,
          tokenId: nft.tokenId,
          editionName: edition.name,
          image: nft.images[0]!,
          quantity: item.quantity,
          unitPrice: edition.price,
          available: edition.available,
        },
      ]
    }),
  }
}

const insufficient = (available: number) =>
  apiError(409, 'INSUFFICIENT_AVAILABILITY', available === 0 ? 'Edição esgotada' : `Só restam ${available} unidade(s)`, {
    fields: { quantity: available === 0 ? 'Edição esgotada' : `Máximo disponível: ${available}` },
    details: { available },
  })

type CouponCheck = { ok: true; coupon: { code: string; percentOff: number } | null } | { ok: false; response: Response }

export function checkCoupon(code: string | undefined, now: number): CouponCheck {
  if (!code) return { ok: true, coupon: null }
  const coupon = COUPONS[code]
  if (!coupon) return { ok: false, response: apiError(422, 'COUPON_INVALID', 'Cupom inválido', { fields: { couponCode: 'Cupom não encontrado' } }) }
  if (Date.parse(coupon.expiresAt) <= now) {
    return { ok: false, response: apiError(422, 'COUPON_EXPIRED', 'Cupom expirado', { fields: { couponCode: 'Este cupom expirou' } }) }
  }
  return { ok: true, coupon: { code, percentOff: coupon.percentOff } }
}

/** Calcula a cotação a partir do estado atual (preço, estoque, cupom e taxa) e a registra. */
export function buildQuote(tx: Tx, owner: string, network: Network, coupon: { code: string; percentOff: number } | null): DbQuote {
  const cart = toCart(tx, getCart(tx, owner))
  const lines: QuoteLine[] = cart.items.map((item) => ({
    itemId: item.id,
    nftId: item.nftId,
    editionId: item.editionId,
    name: item.name,
    tokenId: item.tokenId,
    editionName: item.editionName,
    image: item.image,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: eth.mul(item.unitPrice, item.quantity),
    available: item.available,
    status: item.available === 0 ? 'sold-out' : item.quantity > item.available ? 'insufficient' : 'ok',
  }))
  const subtotal = eth.add(eth.zero, ...lines.map((l) => l.lineTotal))
  const discount = coupon ? eth.percent(subtotal, coupon.percentOff) : eth.zero
  const networkFee = lines.length > 0 ? NETWORK_FEES[network] : eth.zero
  const total = eth.add(eth.sub(subtotal, discount), networkFee)
  const fingerprint = hash(
    JSON.stringify([network, coupon?.code ?? null, networkFee, lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice, l.status])]),
  )
  const quote: DbQuote = {
    id: nextId(tx, 'qte'),
    owner,
    fingerprint,
    network,
    lines,
    coupon,
    subtotal,
    discount,
    networkFee,
    total,
    purchasable: lines.length > 0 && lines.every((l) => l.status === 'ok'),
    createdAt: iso(tx.now),
  }
  // Mantém só as cotações recentes de cada dono.
  tx.db.quotes = [...tx.db.quotes.filter((q) => q.owner !== owner).concat(tx.db.quotes.filter((q) => q.owner === owner).slice(-9)), quote]
  return quote
}

export const toQuote = ({ owner: _owner, ...quote }: DbQuote): Quote => quote

const touch = (tx: Tx, cart: DbCart) => {
  cart.updatedAt = iso(tx.now)
}

export const cartHandlers = [
  http.get(
    `${API}/cart`,
    route(({ request }) =>
      withDb((tx) => {
        const owner = resolveOwner(tx, request)
        return owner.ok ? HttpResponse.json(toCart(tx, getCart(tx, owner.value))) : owner.response
      }),
    ),
  ),

  http.post(
    `${API}/cart/items`,
    route(async ({ request }) => {
      const body = await parseBody(AddCartItemBody, request, resolveOwner)
      if (!body.ok) return body.response
      return withDb((tx) => {
        const owner = resolveOwner(tx, request)
        if (!owner.ok) return owner.response
        const edition = findNft(tx.db, body.value.nftId)?.editions.find((e) => e.id === body.value.editionId)
        if (!edition) return apiError(404, 'NOT_FOUND', 'Edição não encontrada')
        const cart = getCart(tx, owner.value)
        const existing = cart.items.find((i) => i.editionId === edition.id && i.nftId === body.value.nftId)
        const quantity = (existing?.quantity ?? 0) + body.value.quantity
        if (quantity > edition.available) return insufficient(edition.available)
        if (existing) existing.quantity = quantity
        else cart.items.push({ id: nextId(tx, 'itm'), nftId: body.value.nftId, editionId: edition.id, quantity })
        touch(tx, cart)
        return HttpResponse.json(toCart(tx, cart), { status: existing ? 200 : 201 })
      })
    }),
  ),

  http.patch<{ itemId: string }>(
    `${API}/cart/items/:itemId`,
    route(async ({ request, params }) => {
      const body = await parseBody(UpdateCartItemBody, request, resolveOwner)
      if (!body.ok) return body.response
      return withDb((tx) => {
        const owner = resolveOwner(tx, request)
        if (!owner.ok) return owner.response
        const cart = getCart(tx, owner.value)
        const item = cart.items.find((i) => i.id === params.itemId)
        if (!item) return apiError(404, 'NOT_FOUND', 'Item não está no carrinho')
        const available = findNft(tx.db, item.nftId)?.editions.find((e) => e.id === item.editionId)?.available ?? 0
        if (body.value.quantity > available) return insufficient(available)
        item.quantity = body.value.quantity
        touch(tx, cart)
        return HttpResponse.json(toCart(tx, cart))
      })
    }),
  ),

  http.delete<{ itemId: string }>(
    `${API}/cart/items/:itemId`,
    route(({ request, params }) =>
      withDb((tx) => {
        const owner = resolveOwner(tx, request)
        if (!owner.ok) return owner.response
        const cart = getCart(tx, owner.value)
        // Idempotente: remover item já removido devolve o carrinho atual.
        cart.items = cart.items.filter((i) => i.id !== params.itemId)
        touch(tx, cart)
        return HttpResponse.json(toCart(tx, cart))
      }),
    ),
  ),

  http.post(
    `${API}/cart/merge`,
    route(async ({ request }) => {
      const body = await parseBody(MergeCartBody, request, authenticate)
      if (!body.ok) return body.response
      return withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        const guestCart = tx.db.carts.find((c) => c.owner === guestOwner(body.value.guestId))
        const cart = getCart(tx, userOwner(auth.value))
        for (const guestItem of guestCart?.items ?? []) {
          const available = findNft(tx.db, guestItem.nftId)?.editions.find((e) => e.id === guestItem.editionId)?.available ?? 0
          const existing = cart.items.find((i) => i.nftId === guestItem.nftId && i.editionId === guestItem.editionId)
          // Soma as quantidades, limitada à disponibilidade atual.
          const quantity = Math.min((existing?.quantity ?? 0) + guestItem.quantity, available)
          if (existing) existing.quantity = Math.max(existing.quantity, quantity)
          else if (quantity > 0) cart.items.push({ ...guestItem, id: nextId(tx, 'itm'), quantity })
        }
        tx.db.carts = tx.db.carts.filter((c) => c !== guestCart)
        touch(tx, cart)
        return HttpResponse.json(toCart(tx, cart))
      })
    }),
  ),

  http.post(
    `${API}/quotes`,
    route(async ({ request }) => {
      const body = await parseBody(QuoteRequest, request, resolveOwner)
      if (!body.ok) return body.response
      return withDb((tx) => {
        const owner = resolveOwner(tx, request)
        if (!owner.ok) return owner.response
        const coupon = checkCoupon(body.value.couponCode, tx.now)
        if (!coupon.ok) return coupon.response
        return HttpResponse.json(toQuote(buildQuote(tx, owner.value, body.value.network, coupon.coupon)))
      })
    }),
  ),
]
