import type { Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'
import { logout, submitLogin } from './helpers/account'

const status = (page: Page) => page.getByTestId('wallet-connection')
const connectionOf = (page: Page, userId: string) => page.evaluate((id) => window.__mock!.snapshot().walletConnections[id] ?? null, userId)

async function openCheckout(page: Page) {
  await page.goto('/cart')
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/checkout/)
}

test.describe('conexão da carteira persistida por usuário', () => {
  test('continua conectada após o refresh e sai no logout, sem voltar no próximo login', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await openCheckout(page)
    await expect(status(page)).toHaveText('Carteira desconectada.')

    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(status(page)).toHaveText('Carteira conectada em Ethereum.')
    expect(await connectionOf(page, USERS.ana.id)).toMatchObject({ network: 'ethereum' })

    // Refresh: a conexão vem do servidor, não de estado em memória.
    await page.reload()
    await expect(status(page)).toHaveText('Carteira conectada em Ethereum.')
    await expect(page.getByRole('button', { name: 'Desconectar carteira' })).toBeVisible()
    // Com a carteira conectada, a revisão abre direto, sem pedir nova conexão.
    await page.getByRole('button', { name: 'Revisar pedido' }).click()
    await expect(page.getByRole('heading', { name: 'Revisão do pedido' })).toBeVisible()

    // Logout encerra a conexão no servidor junto com a sessão.
    await page.goto('/')
    await logout(page, USERS.ana.name)
    expect(await connectionOf(page, USERS.ana.id)).toBeNull()

    await page.goto('/login?redirect=/checkout')
    await submitLogin(page, USERS.ana)
    await expect(page).toHaveURL(/\/checkout/)
    await expect(status(page)).toHaveText('Carteira desconectada.')
    await expect(page.getByRole('button', { name: 'Conectar carteira' })).toBeVisible()
  })

  test('a conexão de um usuário não aparece para o outro na troca de conta', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await openCheckout(page)
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(status(page)).toHaveText('Carteira conectada em Ethereum.')

    // Outra conta entra sem passar pelo logout da Ana (a sessão é trocada no login).
    await page.goto('/login?redirect=/checkout')
    await submitLogin(page, USERS.bruno)
    await expect(page).toHaveURL(/\/checkout/)
    await expect(status(page)).toHaveText('Carteira desconectada.')
    expect(await connectionOf(page, USERS.bruno.id)).toBeNull()
    // A da Ana continua dela no servidor.
    expect(await connectionOf(page, USERS.ana.id)).toMatchObject({ network: 'ethereum' })
  })
})
