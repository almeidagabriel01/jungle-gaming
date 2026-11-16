import { delay, http, HttpResponse } from 'msw'
import { CreateOrderBody, type Order } from '@/contracts/order'
import { eth } from '@/lib/money'
import { findNft, hash, iso, nextId, scheduleSettlement, updateEdition, userOwner, withDb, type DbOrder, type Tx } from '../db'
import { hasScenario, type ScenarioName } from '../scenarios'
import { buildQuote, toQuote } from './cart'
import { API, apiError, authenticate, parseBody, route } from './http'

const SETTLE_MS = 2_000
const SLOW_SETTLE_MS = 15_000
const TIMEOUT_RESPONSE_MS = 30_000

export const toOrder = ({ idempotencyKey: _k, requestHash: _h, settleAt: _s, outcome: _o, ...order }: DbOrder): Order => order

/**
 * Gatilhos de checkout (preço muda / edição esgota) disparam uma vez por comprador até o reset,
 * pela mesma porta de escrita do catálogo: REST e evento `nft.updated` ficam coerentes. Por chave
 * de idempotência não serviria: a recusa (409) encerra a tentativa e a reconfirmação abre outra
 * chave, então o preço subiria de novo a cada envio e a compra nunca passaria.
 */
function fireCheckoutTrigger(tx: Tx, owner: string) {
  const cart = tx.db.carts.find((c) => c.owner === owner)
  const first = cart?.items[0]
  const edition = first && findNft(tx.db, first.nftId)?.editions.find((e) => e.id === first.editionId)
  if (!first || !edition) return
  const fire = (name: ScenarioName, apply: () => void) => {
    const id = `${name}:${owner}`
    if (!hasScenario(name) || tx.db.firedTriggers.includes(id)) return
    tx.db.firedTriggers.push(id)
    apply()
  }
  fire('price-change-on-checkout', () => {
    updateEdition(tx, first.nftId, first.editionId, { price: eth.add(edition.price, eth.percent(edition.price, 10)) })
  })
  fire('sold-out-on-checkout', () => {
    updateEdition(tx, first.nftId, first.editionId, { available: 0 })
  })
}

type CreateResult = { response: Response; delayResponse: boolean }

export const orderHandlers = [
  http.post(
    `${API}/orders`,
    route(async ({ request }) => {
      const body = await parseBody(CreateOrderBody, request, authenticate)
      if (!body.ok) return body.response
      const key = request.headers.get('idempotency-key')?.trim()
      if (!key || key.length < 8 || key.length > 100) {
        return apiError(422, 'VALIDATION', 'Header Idempotency-Key obrigatório', { fields: { idempotencyKey: 'Obrigatório' } })
      }
      const requestHash = hash(JSON.stringify(body.value))

      const result = withDb((tx): CreateResult => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return { response: auth.response, delayResponse: false }
        const userId = auth.value
        const owner = userOwner(userId)

        // Idempotência: mesma chave + mesmo corpo → mesmo pedido; corpo diferente → conflito.
        const existing = tx.db.orders.find((o) => o.userId === userId && o.idempotencyKey === key)
        if (existing) {
          return existing.requestHash === requestHash
            ? { response: HttpResponse.json(toOrder(existing), { status: 200 }), delayResponse: false }
            : { response: apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta tentativa já foi usada com outro conteúdo'), delayResponse: false }
        }

        fireCheckoutTrigger(tx, owner)

        // Revalida a cotação contra o estado atual: qualquer diferença exige nova confirmação.
        const accepted = tx.db.quotes.find((q) => q.id === body.value.quoteId && q.owner === owner)
        const current = buildQuote(tx, owner, body.value.network, accepted?.coupon ?? null)
        if (!accepted || current.fingerprint !== body.value.fingerprint) {
          return {
            response: apiError(409, 'QUOTE_STALE', 'Preço, disponibilidade ou taxas mudaram. Revise o pedido.', { details: { quote: toQuote(current) } }),
            delayResponse: false,
          }
        }
        if (!current.purchasable) {
          return {
            response: apiError(409, 'QUOTE_NOT_PURCHASABLE', 'Há itens indisponíveis no carrinho', { details: { quote: toQuote(current) } }),
            delayResponse: false,
          }
        }
        const wallet = tx.db.wallets.find((w) => w.id === body.value.walletId && w.userId === userId)
        if (!wallet) return { response: apiError(422, 'VALIDATION', 'Carteira inválida', { fields: { walletId: 'Selecione uma carteira cadastrada' } }), delayResponse: false }
        if (wallet.address.toLowerCase() !== body.value.buyer.address.toLowerCase()) {
          return {
            response: apiError(422, 'VALIDATION', 'Endereço diferente da carteira escolhida', {
              fields: { 'buyer.address': 'Use o endereço da carteira selecionada' },
            }),
            delayResponse: false,
          }
        }
        const connection = tx.db.walletConnections[userId]
        if (connection?.walletId !== wallet.id || connection.network !== body.value.network) {
          return { response: apiError(409, 'WALLET_NOT_CONNECTED', 'Conecte a carteira na rede escolhida antes de confirmar'), delayResponse: false }
        }

        // Reserva o estoque na criação; recusa devolve.
        for (const line of current.lines) updateEdition(tx, line.nftId, line.editionId, { available: line.available - line.quantity })

        const order: DbOrder = {
          id: nextId(tx, 'ord'),
          userId,
          status: 'pending',
          version: 1,
          network: body.value.network,
          wallet: { id: wallet.id, label: wallet.label, address: wallet.address },
          buyer: body.value.buyer,
          lines: current.lines,
          coupon: current.coupon,
          subtotal: current.subtotal,
          discount: current.discount,
          networkFee: current.networkFee,
          total: current.total,
          txHash: null,
          explorerUrl: null,
          failureReason: null,
          createdAt: iso(tx.now),
          updatedAt: iso(tx.now),
          idempotencyKey: key,
          requestHash,
          settleAt: tx.now + (hasScenario('payment-slow') ? SLOW_SETTLE_MS : SETTLE_MS),
          outcome: hasScenario('payment-declined') ? 'declined' : 'confirmed',
        }
        tx.db.orders.push(order)
        scheduleSettlement(order.settleAt)
        return { response: HttpResponse.json(toOrder(order), { status: 201 }), delayResponse: hasScenario('order-timeout') }
      })

      // Pedido já criado e persistido; a resposta "se perde" além do timeout do cliente.
      if (result.delayResponse) await delay(TIMEOUT_RESPONSE_MS)
      return result.response
    }),
  ),

  http.get(
    `${API}/orders`,
    route(({ request }) =>
      withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        const status = new URL(request.url).searchParams.get('status')
        const items = tx.db.orders
          .filter((o) => o.userId === auth.value && (!status || o.status === status))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(toOrder)
        return HttpResponse.json({ items })
      }),
    ),
  ),

  http.get<{ id: string }>(
    `${API}/orders/:id`,
    route(({ request, params }) =>
      withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        const order = tx.db.orders.find((o) => o.id === params.id)
        if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado')
        if (order.userId !== auth.value) return apiError(403, 'FORBIDDEN', 'Este pedido pertence a outra conta')
        return HttpResponse.json(toOrder(order))
      }),
    ),
  ),
]
