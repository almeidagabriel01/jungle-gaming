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
