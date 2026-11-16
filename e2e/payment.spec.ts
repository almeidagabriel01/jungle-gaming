import { expect, test, USERS } from './fixtures'
import { firstCartLine, orders, orderView, reviewFromCart, SLOW_SETTLE } from './helpers/checkout'

/*
 * Timeout após criar o pedido com recuperação pela mesma chave: coberto em `foundation.spec.ts`
 * ("pedido idempotente"), não duplicado aqui.
 */

test.describe('pagamento', () => {
  test('recusado: mostra o motivo, devolve o estoque, preserva o carrinho e oferece o caminho de volta', async ({ page, mock }) => {
    await page.clock.install()
    await mock.open('/', 'payment-slow,payment-declined')
    await mock.login(USERS.ana)
    const cartBefore = await mock.server((m) => m.snapshot().carts.find((c) => c.owner === 'user:usr_ana')!.items)
    const line = await firstCartLine(mock.server, USERS.ana.id)

    const confirm = await reviewFromCart(page)
    await confirm.click()
    await expect(orderView(page)).toHaveAttribute('data-status', 'pending')
    // Estoque reservado enquanto pendente.
    expect((await firstCartLine(mock.server, USERS.ana.id)).available).toBe(line.available - line.quantity)

    await page.clock.fastForward(SLOW_SETTLE)
    await expect(orderView(page)).toHaveAttribute('data-status', 'declined')
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(orderView(page)).toContainText('Pagamento recusado pela carteira. Seus itens continuam no carrinho.')
    await expect(page.getByTestId('receipt')).toHaveCount(0)

    // Recusa devolve a reserva e não toca no carrinho.
    expect((await firstCartLine(mock.server, USERS.ana.id)).available).toBe(line.available)
    expect(await mock.server((m) => m.snapshot().carts.find((c) => c.owner === 'user:usr_ana')!.items)).toEqual(cartBefore)

    // Terminal: refresh e mais tempo não mudam o estado.
    await page.reload()
    await page.clock.fastForward(SLOW_SETTLE)
    await expect(orderView(page)).toHaveAttribute('data-status', 'declined')

    // Caminhos de volta: carrinho intacto e pagamento disponível para nova tentativa.
    await page.getByRole('link', { name: 'Ver carrinho' }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(cartBefore.length)
    await page.goBack()
    await page.getByRole('link', { name: 'Voltar ao pagamento' }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByRole('button', { name: 'Revisar pedido' })).toBeVisible()
  })

  test('cliques repetidos em "Confirmar compra" criam um único pedido', async ({ page, mock }) => {
    await page.clock.install()
    await mock.open('/', 'payment-slow')
    await mock.login(USERS.ana)
    const before = (await orders(mock.server)).length

    const confirm = await reviewFromCart(page)
    // Três cliques no mesmo tick, antes de qualquer re-render: o pior caso de um clique repetido.
    await confirm.evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
      button.click()
    })

    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(orderView(page)).toHaveAttribute('data-status', 'pending')
    await page.clock.fastForward(SLOW_SETTLE)
    await expect(orderView(page)).toHaveAttribute('data-status', 'confirmed')
    expect(await orders(mock.server)).toHaveLength(before + 1)
  })
  test('pedido sem resposta: outra aba do mesmo usuário retoma a mesma tentativa sem criar um segundo pedido', async ({ page, mock, context }) => {
    // Na aba 1 o servidor cria o pedido, mas a resposta só sairia após 30 s.
    await mock.open('/', 'order-timeout')
    await mock.login(USERS.ana)
    const before = (await orders(mock.server)).length
    await (await reviewFromCart(page)).click()
    await expect(page.getByRole('status').filter({ hasText: 'Enviando seu pedido…' })).toBeVisible()
    await expect.poll(async () => (await orders(mock.server)).length).toBe(before + 1)
    const created = (await orders(mock.server)).at(-1)!

    // Aba 2 (cenário padrão): o checkout reenvia a tentativa guardada e cai no pedido já criado.
    const other = await context.newPage()
    await other.goto('/checkout')
    await expect(other).toHaveURL(new RegExp(`/orders/${created.id}`))
    await expect(orderView(other)).toBeVisible()
    expect(await orders(mock.server)).toHaveLength(before + 1)
  })
  test('logout apaga a tentativa de pedido guardada no navegador', async ({ page, mock }) => {
    const attempt = () => page.evaluate((id) => localStorage.getItem(`jungle-order-attempt:${id}`), USERS.ana.id)
    await mock.open('/', 'order-timeout')
    await mock.login(USERS.ana)
    const before = (await orders(mock.server)).length
    await (await reviewFromCart(page)).click()
    await expect.poll(async () => (await orders(mock.server)).length).toBe(before + 1)
    expect(await attempt()).not.toBeNull()

    await page.goto('/profile')
    await page.getByRole('navigation', { name: 'Menu da conta' }).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    expect(await attempt()).toBeNull()
  })
})
