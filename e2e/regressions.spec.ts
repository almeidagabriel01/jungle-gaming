import type { MockControl } from '../src/mocks/browser'
import type { Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'

/** Regressões de borda (tempo real, checkout, recibo, contrato REST). */

/** Muda o preço de todas as edições do NFT pelo "servidor" (cada uma emite `nft.updated`). */
const setPrice = (m: MockControl, price: string) => {
  for (const e of m.snapshot().nfts.find((n) => n.id === 'nft_002')!.editions) m.updateEdition('nft_002', e.id, { price })
}

test('reset do servidor sem reload: eventos novos voltam a ser aplicados', async ({ page, mock }) => {
  await mock.open('/nfts/nft_002')
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: conectado')
  const price = page.locator('[data-testid^="edition-price-"]')

  // Sobe a versão do NFT no cliente com alguns eventos.
  for (const value of ['7.1', '7.2', '7.3']) await mock.server(setPrice, value)
  await expect(price).toContainText('7.3')

  // Servidor reiniciado: ids e versões voltam a contar do seed.
  await mock.server((m) => m.reset())
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: conectado')
  await mock.server(setPrice, '1.23456789')
  await expect(price).toContainText('1.23456789')
})

/** Do carrinho da Ana até o pedido criado (carteira principal, dados do perfil). */
async function buyCart(page: Page) {
  await page.goto('/cart')
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-connection')).toHaveText(/Carteira conectada/)
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await page.getByRole('button', { name: /Confirmar compra/ }).click()
  await expect(page).toHaveURL(/\/orders\/ord_/)
}

test('comprar a última unidade não avisa "esgotou" para o próprio comprador', async ({ page, mock }) => {
  await mock.open('/')
  // Quantidade no carrinho igual ao disponível: a reserva do pedido zera a edição.
  await mock.server((m) => m.updateEdition('nft_001', 'nft_001_ed3', { available: 2 }))
  await mock.login(USERS.ana)
  await buyCart(page)
  // Reserva feita e evento entregue (a página do pedido já mostra o estoque reduzido no servidor).
  await expect.poll(() => mock.server((m) => m.recentEvents().some((e) => e.type === 'nft.updated' && e.resource.id === 'nft_001'))).toBe(true)
  await mock.server((m) => m.settleNow())
  await expect(page.getByTestId('order-view')).toHaveAttribute('data-status', 'confirmed')
  await expect(page.getByText(/esgotou|agora tem só/)).toHaveCount(0)
})

test('POST /orders revalida o cupom aceito na cotação', async ({ page, mock }) => {
  await mock.open('/')
  await mock.login(USERS.ana)
  const result = await page.evaluate(async () => {
    const { tokens } = JSON.parse(localStorage.getItem('jungle-session:v1')!) as { tokens: { accessToken: string } }
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` }
    const quote = (await (await fetch('/api/quotes', { method: 'POST', headers, body: JSON.stringify({ network: 'ethereum', couponCode: 'JUNGLE10' }) })).json()) as {
      id: string
      fingerprint: string
    }
    // O cupom aceito deixa de valer no "servidor" depois da cotação.
    const dbKey = Object.keys(localStorage).find((k) => k.startsWith('jungle-mock-db:'))!
    const db = JSON.parse(localStorage.getItem(dbKey)!) as { quotes: { id: string; coupon: { code: string } | null }[] }
    db.quotes.find((q) => q.id === quote.id)!.coupon!.code = 'EXPIRED5'
    localStorage.setItem(dbKey, JSON.stringify(db))

    const order = window.__mock!.snapshot().orders.find((o) => o.userId === 'usr_ana')!
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ quoteId: quote.id, fingerprint: quote.fingerprint, walletId: order.wallet.id, network: 'ethereum', buyer: order.buyer }),
    })
    return { status: res.status, body: (await res.json()) as { error: { code: string } } }
  })
  expect(result.status).toBe(422)
  expect(result.body.error.code).toBe('COUPON_EXPIRED')
})

test('recibo confirmado só aparece completo, com o ID da transação', async ({ page, mock }) => {
  await mock.open('/')
  await mock.login(USERS.ana)
  await buyCart(page)
  const view = page.getByTestId('order-view')
  await expect(view).toHaveAttribute('data-status', 'pending')

  // Leituras lentas: o refetch do recibo demora mais que o evento `order.updated`.
  await mock.server((m) => m.setScenario('slow'))
  await mock.server((m) => m.settleNow())
  await expect(view).toHaveAttribute('data-status', 'confirmed')
  // Sem espera: no instante em que vira confirmado, o hash já está lá.
  expect(await page.locator('dt:has-text("ID da transação") + dd').textContent()).not.toBe('—')
})

test('reconexão da mesma sessão não reaplica nem reanuncia evento repetido', async ({ page, mock }) => {
  await mock.open('/')
  await mock.login(USERS.ana)
  await page.goto('/nfts/nft_002')
  await page.getByRole('radio', { name: '1/50' }).check()
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  const inCart = (m: MockControl) => m.snapshot().carts.find((c) => c.owner === 'user:usr_ana')?.items.find((i) => i.nftId === 'nft_002')?.editionId ?? null
  await expect.poll(() => mock.server(inCart)).not.toBeNull()
  await page.goto('/cart')
  // Carrinho carregado: o preço base está no cache.
  await expect(page.getByTestId('quote-total')).toBeVisible()
  const status = page.getByTestId('realtime-status')
  await expect(status).toHaveText('Tempo real: conectado')
  const notices = page.getByTestId('cart-notices')
  const editionId = (await mock.server(inCart))!

  await mock.server((m, id) => m.updateEdition('nft_002', id, { price: '9.87654321' }), editionId)
  await expect(notices.getByText(/para 9\.87654321/)).toHaveCount(1)
  // O servidor confirma um pedido da Ana (o aviso sai fora da página do pedido).
  await mock.server((m) =>
    m.emitRaw({
      eventId: 'evt_order_confirmed',
      type: 'order.updated',
      resource: { type: 'order', id: 'ord_seed_ana' },
      version: 99,
      occurredAt: new Date().toISOString(),
      payload: { orderId: 'ord_seed_ana', userId: 'usr_ana', status: 'confirmed', failureReason: null },
    }),
  )
  const confirmed = page.getByText('Pagamento confirmado. Seu pedido foi concluído.')
  await expect(confirmed).toHaveCount(1)

  // Queda comum: mesma sessão, mesmo servidor.
  await mock.server((m) => m.dropSockets())
  await expect(status).not.toHaveText('Tempo real: conectado')
  await expect(status).toHaveText('Tempo real: conectado')

  // O servidor repete os eventos: idênticos, com `occurredAt` novo e com versão menor e preço diferente.
  // Um evento novo, depois deles, marca que já foram processados.
  await mock.server((m) => {
    const nft = m.recentEvents().findLast((e) => e.type === 'nft.updated' && e.payload.nftId === 'nft_002')!
    if (nft.type !== 'nft.updated') return
    const now = new Date().toISOString()
    const confirmedEvent = {
      eventId: 'evt_order_confirmed',
      type: 'order.updated' as const,
      resource: { type: 'order' as const, id: 'ord_seed_ana' },
      version: 99,
      occurredAt: now,
      payload: { orderId: 'ord_seed_ana', userId: 'usr_ana', status: 'confirmed' as const, failureReason: null },
    }
    m.emitRaw(confirmedEvent)
    m.emitRaw({ ...confirmedEvent, eventId: 'evt_replay_1', version: 98 })
    m.emitRaw(nft)
    m.emitRaw({ ...nft, eventId: 'evt_replay_2', occurredAt: now })
    const editions = nft.payload.editions.map((e) => ({ ...e, price: '3.33' }))
    m.emitRaw({ ...nft, eventId: 'evt_replay_3', occurredAt: now, version: nft.version - 1, payload: { ...nft.payload, minPrice: '3.33', editions } })
  })
  await mock.server((m, id) => m.updateEdition('nft_002', id, { price: '5.5' }), editionId)
  await expect(notices.getByText(/para 5\.5/)).toHaveCount(1)
  await expect(notices.getByText(/para 9\.87654321/)).toHaveCount(1)
  await expect(notices.getByText(/3\.33/)).toHaveCount(0)
  await expect(page.getByText(/3\.33/)).toHaveCount(0)
  await expect(confirmed).toHaveCount(1)
})

test('cupom recusado no envio: avisa uma vez, volta aos dados e não reenvia', async ({ page, mock }) => {
  await mock.open('/')
  await mock.login(USERS.ana)
  const ordersBefore = await mock.server((m) => m.snapshot().orders.length)
  await page.goto('/checkout?coupon=JUNGLE10')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-connection')).toHaveText(/Carteira conectada/)
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  const confirm = page.getByRole('button', { name: /Confirmar compra/ })
  await expect(confirm).toBeEnabled()

  // O cupom deixa de valer no "servidor" logo depois de cada cotação (antes do POST /orders).
  await page.evaluate(() => {
    const dbKey = Object.keys(localStorage).find((k) => k.startsWith('jungle-mock-db:'))!
    const expire = () => {
      const db = JSON.parse(localStorage.getItem(dbKey)!) as { quotes: { coupon: { code: string } | null }[] }
      for (const q of db.quotes) if (q.coupon) q.coupon.code = 'EXPIRED5'
      localStorage.setItem(dbKey, JSON.stringify(db))
    }
    setInterval(expire, 10)
  })
  const posts: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/orders') posts.push(r.url())
  })
  await confirm.click()

  await expect(page.getByTestId('coupon-rejected')).toHaveCount(1)
  await expect(page.getByTestId('coupon-rejected')).toContainText('A compra não foi feita')
  await expect(page.getByRole('button', { name: 'Revisar pedido' })).toBeVisible()
  expect(posts).toHaveLength(1)
  expect(await mock.server((m) => m.snapshot().orders.length)).toBe(ordersBefore)
})
