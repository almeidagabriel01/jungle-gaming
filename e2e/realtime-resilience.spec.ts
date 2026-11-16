import type { Page } from '@playwright/test'
import { expect, test, USERS, type Mock } from './fixtures'
import { firstCartLine, orders, orderView, reviewFromCart, SLOW_SETTLE } from './helpers/checkout'

const status = (page: Page) => page.getByTestId('realtime-status')
const notices = (page: Page) => page.getByRole('list', { name: 'Alterações no carrinho' }).getByRole('listitem')
/**
 * Pior caso da reconexão do socket.io-client: uma tentativa feita ainda sem rede pode esperar o
 * timeout de conexão do Manager (20 s) antes do próximo backoff (`reconnectionDelayMax` 4 s).
 */
const RECONNECT = '00:25'

async function openCart(page: Page, mock: Mock, scenario?: string) {
  await mock.open('/', scenario)
  await mock.login(USERS.ana)
  await page.goto('/cart')
  await expect(page.getByTestId('quote-total')).toBeVisible()
  await expect(status(page)).toHaveText('Tempo real: conectado')
}

test.describe('robustez do tempo real', () => {
  test('eventos duplicados e antigos (fora de ordem) são ignorados, sem regredir preço nem repetir aviso', async ({ page, mock }) => {
    await openCart(page, mock)
    const line = await firstCartLine(mock.server, USERS.ana.id)
    const price = page.getByTestId('cart-price-itm_ana_1')
    const update = async (value: string) => {
      await mock.server((m, a) => m.updateEdition(a.nftId, a.editionId, { price: a.value }), { ...line, value })
    }

    await update('2.5')
    await expect(price).toHaveText('2.50 ETH')
    await update('3.5')
    await expect(price).toHaveText('3.50 ETH')
    await expect(notices(page)).toHaveCount(2)

    // Reenvio pelo socket real: o mesmo evento (duplicado), o anterior (antigo) e um antigo com id novo.
    await mock.server((m, nftId) => {
      const events = m.recentEvents().filter((e) => e.type === 'nft.updated' && e.resource.id === nftId)
      const [older, latest] = events.slice(-2)
      m.emitRaw(latest)
      m.emitRaw(older)
      m.emitRaw({ ...older, eventId: 'evt_forjado_antigo' })
    }, line.nftId)

    // Eventos chegam em ordem: quando o próximo evento real aparece, os reenviados já foram processados.
    await update('4.5')
    await expect(price).toHaveText('4.50 ETH')
    await expect(notices(page)).toHaveCount(3)
    await expect(notices(page).last()).toContainText('mudou de 3.50 ETH para 4.50 ETH')
    await expect(page.getByText('para 2.50 ETH')).toHaveCount(1)
  })

  test('queda de conexão: evento perdido enquanto desconectado é reconciliado pela API ao reconectar', async ({ page, mock }) => {
    await page.clock.install()
    await openCart(page, mock)
    const line = await firstCartLine(mock.server, USERS.ana.id)
    const price = page.getByTestId('cart-price-itm_ana_1')
    const before = await price.innerText()

    // Rede cai: socket derrubado e reconexões recusadas. A mudança no servidor não chega a ninguém.
    await mock.server((m) => {
      m.setScenario('offline')
      m.dropSockets()
    })
    await expect(status(page)).not.toHaveText('Tempo real: conectado')
    await mock.server((m, a) => m.updateEdition(a.nftId, a.editionId, { price: '6' }), line)
    await expect(price).toHaveText(before)

    // Rede volta: o socket.io-client reconecta sozinho e o app reconcilia carrinho e cotação via REST.
    await mock.server((m) => m.setScenario('default'))
    await page.clock.fastForward(RECONNECT)
    await expect(status(page)).toHaveText('Tempo real: conectado')
    await expect(price).toHaveText('6.00 ETH')
  })

  test('pedido pendente: refresh retoma o mesmo pedido e a liquidação chega depois', async ({ page, mock }) => {
    await page.clock.install()
    await mock.open('/', 'payment-slow')
    await mock.login(USERS.ana)
    const before = (await orders(mock.server)).length
    await (await reviewFromCart(page)).click()
    await expect(orderView(page)).toHaveAttribute('data-status', 'pending')
    const url = page.url()

    await page.reload()
    await expect(page).toHaveURL(url)
    await expect(orderView(page)).toHaveAttribute('data-status', 'pending')
    await page.clock.fastForward(SLOW_SETTLE)
    await expect(orderView(page)).toHaveAttribute('data-status', 'confirmed')
    expect(await orders(mock.server)).toHaveLength(before + 1)
  })

  test('pedido pendente: desconexão durante a liquidação é recuperada ao reconectar, sem nova compra', async ({ page, mock }) => {
    await page.clock.install()
    await mock.open('/', 'payment-slow')
    await mock.login(USERS.ana)
    const before = (await orders(mock.server)).length
    await (await reviewFromCart(page)).click()
    await expect(orderView(page)).toHaveAttribute('data-status', 'pending')

    // Sem conexão, o order.updated da liquidação se perde (e o polling de fallback também falha).
    await mock.server((m) => {
      m.setScenario('offline')
      m.dropSockets()
    })
    await expect(page.getByTestId('realtime-status')).not.toHaveText('Tempo real: conectado')
    await page.clock.fastForward(SLOW_SETTLE)
    expect((await orders(mock.server)).at(-1)!.status).toBe('confirmed')
    await expect(orderView(page)).toHaveAttribute('data-status', 'pending')

    await mock.server((m) => m.setScenario('payment-slow'))
    await page.clock.fastForward(RECONNECT)
    await expect(status(page)).toHaveText('Tempo real: conectado')
    await expect(orderView(page)).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByTestId('receipt')).toBeVisible()
    expect(await orders(mock.server)).toHaveLength(before + 1)
  })

  test('refresh com o envio sem resposta: o checkout reenvia a mesma tentativa e recupera o pedido criado', async ({ page, mock }) => {
    await page.clock.install()
    // O servidor cria o pedido, mas a resposta só sairia após 30 s.
    await mock.open('/', 'order-timeout')
    await mock.login(USERS.ana)
    const before = (await orders(mock.server)).length
    await (await reviewFromCart(page)).click()
    await expect(page.getByRole('status').filter({ hasText: 'Enviando seu pedido…' })).toBeVisible()
    await expect.poll(async () => (await orders(mock.server)).length).toBe(before + 1)
    // Sem resposta, a revisão segue travada em "Confirmando…" (nenhuma nova chave pode ser aberta).
    await expect(page.getByRole('button', { name: 'Confirmando…' })).toBeDisabled()

    await page.reload()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const created = await orders(mock.server)
    expect(created).toHaveLength(before + 1)
    expect(page.url()).toContain(created.at(-1)!.id)
    await page.clock.fastForward('00:03')
    await expect(orderView(page)).toHaveAttribute('data-status', 'confirmed')
    expect(await orders(mock.server)).toHaveLength(before + 1)
  })
})
