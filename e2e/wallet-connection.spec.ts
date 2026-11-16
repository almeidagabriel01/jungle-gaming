import type { Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'

const status = (page: Page) => page.getByTestId('wallet-connection')
const connectButton = (page: Page) => page.getByRole('button', { name: 'Conectar carteira' })
const connectionOf = (page: Page, userId: string) => page.evaluate((id) => window.__mock!.snapshot().walletConnections[id] ?? null, userId)
const CONNECT_FIRST = 'Conecte a carteira selecionada na rede escolhida.'

async function openCheckout(page: Page) {
  await page.goto('/cart')
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/checkout/)
  await expect(status(page)).toHaveText('Carteira desconectada.')
}

test.describe('conexão da carteira no pagamento', () => {
  test('carteira recusa a conexão: o motivo aparece, a revisão é bloqueada e a nova tentativa conecta', async ({ page, mock }) => {
    await mock.open('/', 'wallet-rejected')
    await mock.login(USERS.ana)
    await openCheckout(page)

    await connectButton(page).click()
    await expect(status(page)).toHaveText('Conexão recusada: A conexão foi recusada na carteira')
    expect(await connectionOf(page, USERS.ana.id)).toBeNull()

    // Sem conexão a revisão não abre: o erro fica ligado ao botão de conectar, que recebe o foco.
    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await expect(page.getByText(CONNECT_FIRST)).toBeVisible()
    await expect(connectButton(page)).toBeFocused()
    await expect(connectButton(page)).toHaveAccessibleDescription(CONNECT_FIRST)
    await expect(page.getByRole('heading', { name: 'Revisão do pedido' })).toHaveCount(0)

    // A carteira passa a aceitar: a nova tentativa conecta e libera a revisão.
    await mock.server((m) => m.setScenario('default'))
    await connectButton(page).click()
    await expect(status(page)).toHaveText('Carteira conectada em Ethereum.')
    await expect(page.getByText(CONNECT_FIRST)).toHaveCount(0)
    expect(await connectionOf(page, USERS.ana.id)).toMatchObject({ network: 'ethereum' })
    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await expect(page.getByRole('heading', { name: 'Revisão do pedido' })).toBeVisible()
  })

  test('desconectar encerra a conexão no servidor e volta a exigir conexão para revisar', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await openCheckout(page)

    await connectButton(page).click()
    await expect(status(page)).toHaveText('Carteira conectada em Ethereum.')
    expect(await connectionOf(page, USERS.ana.id)).toMatchObject({ network: 'ethereum' })

    await page.getByRole('button', { name: 'Desconectar carteira' }).click()
    await expect(status(page)).toHaveText('Carteira desconectada.')
    await expect(connectButton(page)).toBeVisible()
    await expect.poll(() => connectionOf(page, USERS.ana.id)).toBeNull()

    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await expect(page.getByText(CONNECT_FIRST)).toBeVisible()
    await expect(connectButton(page)).toBeFocused()
    await expect(page.getByRole('heading', { name: 'Revisão do pedido' })).toHaveCount(0)
  })
})
