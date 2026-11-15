import type { Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'
import { accountEntry, accountNav, cartLink, loginEntry, logout, openAccount, submitLogin } from './helpers/account'

const MINUTE = 60_000
const refreshToken = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('jungle-session:v1')!) as { tokens: { refreshToken: string } }).tokens.refreshToken)
const DAY = 24 * 60 * MINUTE


async function fillRegister(page: Page, values: { username: string; email: string; password: string; confirm?: string }) {
  await page.getByLabel('Nome de usuário').fill(values.username)
  await page.getByLabel('E-mail', { exact: true }).fill(values.email)
  await page.getByLabel('Senha', { exact: true }).fill(values.password)
  await page.getByLabel('Confirmar senha').fill(values.confirm ?? values.password)
  await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
}

test.describe('cadastro e login', () => {
  test('cadastro recusa e-mail em uso, cria a conta e o novo usuário entra de novo após sair', async ({ page, mock }) => {
    await mock.open('/register')
    await fillRegister(page, { username: 'nova_conta', email: USERS.ana.email, password: 'Segredo123' })
    const email = page.getByLabel('E-mail', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Este e-mail já está em uso')
    await expect(email).toBeFocused()
    await expect(page).toHaveURL(/\/register/)

    await email.fill('nova@jungle.test')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(accountEntry(page, 'nova_conta')).toBeVisible()
    expect(await mock.server((m) => m.snapshot().users.some((u) => u.email === 'nova@jungle.test'))).toBe(true)

    await logout(page, 'nova_conta')
    await page.goto('/login')
    await submitLogin(page, { email: 'nova@jungle.test', password: 'Segredo123' })
    await expect(accountEntry(page, 'nova_conta')).toBeVisible()
  })

  test('credenciais erradas mostram o erro da API e não abrem sessão', async ({ page, mock }) => {
    await mock.open('/login')
    await submitLogin(page, { email: USERS.ana.email, password: 'errada123' })
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos')
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate(() => localStorage.getItem('jungle-session:v1'))).toBeNull()
  })

  test('login volta para a página que pediu autenticação e sobrevive ao refresh', async ({ page, mock }) => {
    await mock.open('/favorites')
    await expect(page).toHaveURL(/\/login\?redirect=%2Ffavorites/)
    await submitLogin(page, USERS.ana)
    await expect(page).toHaveURL(/\/favorites$/)
    await expect(page.getByRole('heading', { name: 'Lista de interesse', level: 1 })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Lista de interesse', level: 1 })).toBeVisible()
    await expect(accountEntry(page, USERS.ana.name)).toBeVisible()
  })
})

test.describe('expiração de sessão (relógio controlado)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install()
  })

  test('access token vencido é renovado em silêncio e a navegação continua', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await openAccount(page, USERS.ana.name)
    const before = await refreshToken(page)

    await page.clock.fastForward(16 * MINUTE)
    await accountNav(page).getByRole('link', { name: 'Carteiras' }).click()
    await expect(page).toHaveURL(/\/wallets$/)
    await expect(page.getByRole('heading', { name: 'Carteiras', level: 1 })).toBeVisible()
    await expect(accountEntry(page, USERS.ana.name)).toBeVisible()
    // O refresh token foi rotacionado: a sessão foi renovada, não reaproveitada.
    expect(await refreshToken(page)).not.toBe(before)
  })

  test('sessão vencida numa página privada leva ao login com aviso e volta para ela', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await openAccount(page, USERS.ana.name)

    // 8 dias depois o socket reconecta e revalida os dados privados: o 401 sem refresh possível encerra a sessão.
    await page.clock.fastForward(8 * DAY)
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile&reason=expired/)
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('jungle-session:v1'))).toBeNull()

    await submitLogin(page, USERS.ana)
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveValue(USERS.ana.email)
  })

  test('sessão vencida ao recarregar uma página privada também avisa no login', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await openAccount(page, USERS.ana.name)

    await page.clock.fastForward(8 * DAY)
    await page.reload()
    await expect(page).toHaveURL(/\/login\?.*reason=expired/)
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()
    await submitLogin(page, USERS.ana)
    await expect(page).toHaveURL(/\/profile$/)
  })

  test('sessão vencida numa página pública avisa, vira visitante e esconde o carrinho do usuário', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await cartLink(page).click()
    await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('article')).toHaveCount(3)

    await page.clock.fastForward(8 * DAY)
    await expect(page.getByText('Sua sessão expirou. Entre novamente para acessar sua conta.')).toBeVisible()
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
    await page.getByRole('link', { name: 'Continuar explorando' }).click()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens')
    await expect(loginEntry(page)).toBeVisible()
    // O carrinho da Ana continua intacto no servidor, só deixou de ser exibido.
    expect(await mock.server((m) => m.snapshot().carts.find((c) => c.owner === 'user:usr_ana')!.items.map((i) => i.quantity))).toEqual([2, 6, 9])
  })
})

test.describe('logout e troca de usuário', () => {
  test('nada da Ana (carrinho, favoritos, perfil) aparece depois que ela sai e o Bruno entra', async ({ page, mock }) => {
    await mock.open('/')
    // Nomes dos favoritos de cada usuário no seed, lidos do "servidor".
    const favoriteNames = (userId: string) =>
      mock.server((m, id) => {
        const db = m.snapshot()
        return (db.favorites[id] ?? []).map((nftId) => db.nfts.find((n) => n.id === nftId)!.name)
      }, userId)
    const anaFavorites = await favoriteNames(USERS.ana.id)
    const brunoFavorites = await favoriteNames(USERS.bruno.id)

    await mock.login(USERS.ana)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 17 itens')
    await openAccount(page, USERS.ana.name, 'Lista de interesse')
    for (const name of anaFavorites) await expect(page.getByTestId('favorites-list').getByText(name, { exact: true })).toBeVisible()

    await logout(page, USERS.ana.name)
    await expect(page).toHaveURL(/\/$/)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens')
    expect(await page.evaluate(() => localStorage.getItem('jungle-session:v1'))).toBeNull()

    // Voltar no histórico ou abrir direto uma página privada não mostra dado da Ana.
    await page.goBack()
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
    await expect(page.getByText(USERS.ana.email)).toHaveCount(0)

    await submitLogin(page, USERS.bruno)
    await expect(page).toHaveURL(/\/profile$/)
    const assertBruno = async () => {
      await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.bruno.name)
      await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveValue(USERS.bruno.email)
      await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens')
      await expect(page.getByText(USERS.ana.name)).toHaveCount(0)
      await accountNav(page).getByRole('link', { name: 'Lista de interesse' }).click()
      const list = page.getByTestId('favorites-list')
      for (const name of brunoFavorites) await expect(list.getByText(name, { exact: true })).toBeVisible()
      await expect(list.getByRole('listitem')).toHaveCount(brunoFavorites.length)
      for (const name of anaFavorites) await expect(list.getByText(name, { exact: true })).toHaveCount(0)
      await cartLink(page).click()
      await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
    }
    await assertBruno()
    await page.goto('/profile')
    await assertBruno()
  })
})
