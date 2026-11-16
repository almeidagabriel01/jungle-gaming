import type { Page, TestInfo } from '@playwright/test'
import { expect, test, USERS, waitForApp } from './fixtures'

/**
 * Rolagem entre navegações (desktop 1440 e mobile 390) e o login/cadastro sobre a página inicial.
 * Movimento reduzido: `scroll-behavior` instantâneo, então cada posição é final assim que o router rola.
 */
test.use({ reducedMotion: 'reduce' })

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY))

/** Primeira página do catálogo carregada: a tela já renderizou e o router já aplicou a rolagem. */
const catalogReady = (page: Page) => expect(page.getByTestId('catalog-grid').getByRole('listitem').first()).toBeVisible()

/** "Mercado" no cabeçalho (desktop); no mobile o atalho para o catálogo é o EXPLORAR do herói. */
function marketLink(page: Page, info: TestInfo) {
  return info.project.name === 'mobile'
    ? page.getByRole('region', { name: /Seja dono/ }).getByRole('link', { name: 'EXPLORAR' })
    : page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Mercado' })
}

/** Clica em Mercado e espera o catálogo no topo da tela, sem a âncora no endereço. */
async function goToMarket(page: Page, info: TestInfo) {
  await marketLink(page, info).click()
  await expect(page.locator('#mercado')).toBeInViewport()
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0)
  await expect(page).toHaveURL((url) => url.pathname === '/' && url.hash === '')
}

test.describe('rolagem entre navegações', () => {
  test('Mercado rola até o catálogo só no clique; recarregar não volta à âncora', async ({ page, mock }, info) => {
    await mock.open('/')
    await catalogReady(page)
    expect(await scrollY(page)).toBe(0)

    await goToMarket(page, info)

    // Sem o hash, recarregar no topo continua no topo.
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.reload()
    await waitForApp(page)
    await catalogReady(page)
    expect(await scrollY(page)).toBe(0)
  })

  test('Início e logo abrem no topo depois do Mercado', async ({ page, mock }, info) => {
    await mock.open('/')
    await goToMarket(page, info)
    // Desktop: item do cabeçalho; mobile: ícone da barra inferior (as duas navegações se chamam "Principal").
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Início' }).click()
    await catalogReady(page)
    await expect.poll(() => scrollY(page)).toBe(0)

    // Já no início (mesma URL), rolado até o catálogo: Início volta ao topo.
    await page.evaluate(() => window.scrollTo(0, 600))
    await expect.poll(() => scrollY(page)).toBeGreaterThan(0)
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Início' }).click()
    await expect.poll(() => scrollY(page)).toBe(0)

    if (info.project.name === 'mobile') return // o logo só existe no cabeçalho desktop
    await goToMarket(page, info)
    await page.getByRole('link', { name: 'Kurio, página inicial' }).click()
    await catalogReady(page)
    await expect.poll(() => scrollY(page)).toBe(0)
  })

  test('link interno abre no topo; voltar e avançar restauram a posição', async ({ page, mock }, info) => {
    await mock.open('/')
    await catalogReady(page)
    await goToMarket(page, info)
    const market = await scrollY(page)

    await page.getByTestId('catalog-grid').getByRole('listitem').first().getByRole('link').first().click()
    await expect(page).toHaveURL(/\/nfts\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await scrollY(page)).toBe(0)

    await page.goBack()
    await catalogReady(page)
    await expect.poll(() => scrollY(page)).toBe(market)

    await page.goBack()
    await catalogReady(page)
    await expect.poll(() => scrollY(page)).toBe(0)

    await page.goForward()
    await catalogReady(page)
    await expect.poll(() => scrollY(page)).toBe(market)
  })

  test('card aberto assim que o hash sai do endereço: voltar restaura o catálogo', async ({ page, mock }) => {
    await mock.open('/')
    const cards = page.getByTestId('catalog-grid').getByRole('article')
    await expect(cards.first()).toBeVisible()
    // EXPLORAR leva a /#mercado; o card é aberto pelo usuário logo que o endereço perde o hash.
    await page.getByRole('link', { name: 'EXPLORAR' }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.hash === '')
    const market = await scrollY(page)
    expect(market).toBeGreaterThan(0)
    await cards.first().getByRole('link').click()
    await expect(page).toHaveURL(/\/nfts\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.hash === '')
    await expect(cards.first()).toBeVisible()
    await expect(page.getByRole('list', { name: 'Carregando NFTs' })).toHaveCount(0)
    await expect.poll(() => scrollY(page)).toBe(market)
  })

  test('login com redirect saído de /#mercado volta ao início no topo', async ({ page, mock }) => {
    await mock.open('/login?redirect=%2F%23mercado')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    await expect(page).toHaveURL((url) => url.pathname === '/' && url.hash === '')
    await catalogReady(page)
    expect(await scrollY(page)).toBe(0)
  })
})

test.describe('login e cadastro sobre a página inicial', () => {
  for (const { path, title } of [
    { path: '/login', title: 'Entrar' },
    { path: '/register', title: 'Criar perfil de colecionador' },
  ]) {
    test(`${path}: catálogo atrás do modal, fundo inerte e foco preso no diálogo`, async ({ page, mock }, info) => {
      test.skip(info.project.name === 'mobile', 'No mobile o login e o cadastro são tela cheia, sem fundo.')
      await mock.open(path)
      const dialog = page.getByRole('dialog', { name: title })
      await expect(dialog).toBeVisible()

      // A página inicial real (com o catálogo e os filtros) fica atrás do modal, inerte e fora da árvore acessível.
      const backdrop = page.getByTestId('auth-backdrop')
      await expect(backdrop).toHaveAttribute('inert', '')
      await expect(backdrop).toHaveAttribute('aria-hidden', 'true')
      await expect(backdrop.getByTestId('catalog-grid').getByRole('listitem', { includeHidden: true }).first()).toBeVisible()
      await expect(backdrop.getByText('Coleções', { exact: true })).toBeVisible()
      await expect(backdrop.getByText('Faixa de preço', { exact: true })).toBeVisible()

      // Tab e Shift+Tab circulam dentro do diálogo.
      await expect(dialog.getByRole('textbox').first()).toBeFocused()
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab')
        expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
      }
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Shift+Tab')
        expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
      }
    })
  }
})
