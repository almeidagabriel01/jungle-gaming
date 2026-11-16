import type { Page } from '@playwright/test'
import { expect, test, USERS, type Mock } from './fixtures'
import { confirmButton, firstCartLine, orders, reviewFromCart } from './helpers/checkout'

/** O aviso de reconfirmação da revisão e o bloqueio de itens indisponíveis. */
const quoteChanged = (page: Page) => page.getByTestId('quote-changed')
const unavailable = (page: Page) => page.getByText('Há itens indisponíveis. Volte ao carrinho para ajustar.')
const summary = (page: Page) => page.getByRole('complementary', { name: 'Resumo do pedido' })

async function toReview(page: Page, mock: Mock, scenario?: string) {
  await mock.open('/', scenario)
  await mock.login(USERS.ana)
  const confirm = await reviewFromCart(page)
  // O evento só chega se o socket.io-client estiver conectado.
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: conectado')
  return { confirm, line: await firstCartLine(mock.server, USERS.ana.id), before: (await orders(mock.server)).length }
}

test.describe('socket no checkout', () => {
  test('preço muda via nft.updated na revisão: alerta, bloqueio e nova confirmação com o valor novo', async ({ page, mock }) => {
    const { confirm, line, before } = await toReview(page, mock)
    const oldButton = await confirm.innerText()

    // Mudança no "servidor": REST passa a responder o preço novo e o evento sai pelo socket.
    await mock.server((m, l) => m.updateEdition(l.nftId, l.editionId, { price: '3' }), line)

    await expect(quoteChanged(page)).toContainText('Os valores mudaram desde a sua revisão')
    await expect(confirmButton(page)).toBeDisabled()
    await quoteChanged(page).getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(quoteChanged(page)).toHaveCount(0)
    await expect(confirmButton(page)).toBeEnabled()
    await expect(confirmButton(page)).not.toHaveText(oldButton)

    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const created = await orders(mock.server)
    expect(created).toHaveLength(before + 1)
    expect(created.at(-1)!.lines[0]).toMatchObject({ nftId: line.nftId, unitPrice: '3' })
  })

  test('edição esgota via nft.updated na revisão: item marcado e compra bloqueada', async ({ page, mock }) => {
    const { line, before } = await toReview(page, mock)

    await mock.server((m, l) => m.updateEdition(l.nftId, l.editionId, { available: 0 }), line)

    await expect(summary(page).getByText(`${line.name}: esgotado`)).toBeVisible()
    await expect(unavailable(page)).toBeVisible()
    await expect(confirmButton(page)).toBeDisabled()
    await expect(quoteChanged(page).getByRole('button', { name: 'Aceitar novos valores' })).toBeDisabled()
    expect(await orders(mock.server)).toHaveLength(before)

    // O carrinho também bloqueia a finalização.
    await page.goto('/cart')
    await expect(page.getByText('Há itens indisponíveis. Ajuste as quantidades para continuar.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Conectar e finalizar' })).toHaveCount(0)
  })

  test('preço muda no envio (cotação desatualizada): servidor recusa, revisão pede reconfirmação e a nova compra passa', async ({ page, mock }) => {
    const { confirm, line, before } = await toReview(page, mock, 'price-change-on-checkout')

    await confirm.click()
    // 409 QUOTE_STALE + nft.updated pelo socket: nenhum pedido criado, revisão exige aceitar os valores.
    await expect(quoteChanged(page)).toContainText('Os valores mudaram desde a sua revisão')
    await expect(confirmButton(page)).toBeDisabled()
    expect(await orders(mock.server)).toHaveLength(before)
    const raised = (await firstCartLine(mock.server, USERS.ana.id)).price
    expect(raised).not.toBe(line.price)

    await quoteChanged(page).getByRole('button', { name: 'Aceitar novos valores' }).click()
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const created = await orders(mock.server)
    expect(created).toHaveLength(before + 1)
    expect(created.at(-1)!.lines[0]).toMatchObject({ nftId: line.nftId, unitPrice: raised })
  })

  test('edição esgota no envio: servidor recusa e a revisão bloqueia a compra', async ({ page, mock }) => {
    const { confirm, line, before } = await toReview(page, mock, 'sold-out-on-checkout')

    await confirm.click()
    await expect(summary(page).getByText(`${line.name}: esgotado`)).toBeVisible()
    await expect(unavailable(page)).toBeVisible()
    await expect(confirmButton(page)).toBeDisabled()
    expect(await orders(mock.server)).toHaveLength(before)
    expect((await firstCartLine(mock.server, USERS.ana.id)).available).toBe(0)
  })
})
