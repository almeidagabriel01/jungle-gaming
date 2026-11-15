import { expect, type Page } from '@playwright/test'

type Credentials = { email: string; password: string }

/** Preenche e envia o login na tela já aberta (`/login`, modal no desktop, tela cheia no mobile). */
export async function submitLogin(page: Page, { email, password }: Credentials) {
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Atalho da conta: menu do header no desktop, ícone de perfil na barra inferior no mobile. */
export const accountEntry = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name.split(' ')[0]} ?: menu da conta$`) }).or(page.getByRole('link', { name: `Perfil de ${name}` }))

/** "Entrar" do header (desktop) ou da barra inferior (mobile): sinal de visitante. */
export const loginEntry = (page: Page) => page.getByRole('link', { name: 'Entrar', exact: true })

/** Badge do carrinho (header ou barra inferior). */
export const cartLink = (page: Page) => page.getByRole('link', { name: /^Carrinho, \d+ (item|itens)$/ }).first()

/** Abre uma página da área da conta navegando pela interface (sem recarregar a página). */
export async function openAccount(page: Page, name: string, section: 'Dados do perfil' | 'Carteiras' | 'Lista de interesse' = 'Dados do perfil') {
  const entry = accountEntry(page, name)
  if ((await entry.getAttribute('aria-haspopup')) === 'menu') {
    await entry.click()
    await page.getByRole('menuitem', { name: 'Meu perfil' }).click()
  } else {
    await entry.click()
  }
  await expect(page).toHaveURL(/\/profile$/)
  if (section !== 'Dados do perfil') await accountNav(page).getByRole('link', { name: section }).click()
}

export const accountNav = (page: Page) => page.getByRole('navigation', { name: 'Menu da conta' })

/** Sai pela interface: menu do header no desktop, "Sair" da área da conta no mobile. */
export async function logout(page: Page, name: string) {
  const entry = accountEntry(page, name)
  if ((await entry.getAttribute('aria-haspopup')) === 'menu') {
    await entry.click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
  } else {
    await openAccount(page, name)
    await accountNav(page).getByRole('button', { name: 'Sair' }).click()
  }
  await expect(loginEntry(page)).toBeVisible()
}
