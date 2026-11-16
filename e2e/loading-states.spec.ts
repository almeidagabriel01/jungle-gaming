import type { Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'

/**
 * §9.12: skeletons enquanto a request está retida no mock (`hold`/`release`, latência controlada
 * sem espera real) e falha do servidor (`server-error`, 503 em leituras) com "Tentar novamente".
 * A retenção vive na memória da página: depois de ligá-la, a navegação é sempre por links.
 */


/** Atalho do rodapé (existe no desktop e no mobile) para o catálogo filtrado: consulta nova, sem cache. */
const openCategory = (page: Page, name: string) => page.getByRole('contentinfo').getByRole('link', { name, exact: true }).click()


test.describe('estados de carga', () => {
  test('catálogo: skeleton enquanto carrega, falha com mensagem e nova tentativa', async ({ page, mock }) => {
    const grid = page.getByTestId('catalog-grid')
    const loading = page.getByRole('list', { name: 'Carregando NFTs' })

    await mock.open('/cart')
    await mock.server((m) => m.hold('/nfts'))
    await openCategory(page, 'Arte digital')
    await expect(loading).toBeVisible()
    await expect(grid).toHaveAttribute('aria-busy', 'true')
    await mock.server((m) => m.release('/nfts'))
    await expect(loading).toHaveCount(0)
    await expect(grid.getByRole('article').first()).toBeVisible()

    // Falha: outra consulta (categoria nova, sem cache) com o servidor em 503.
    await mock.server((m, name) => m.setScenario(name), 'server-error')
    await openCategory(page, 'Música')
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo' })
    await expect(error).toBeVisible()
    await expect(error).toContainText('Serviço temporariamente indisponível')
    await mock.server((m, name) => m.setScenario(name), 'default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(error).toHaveCount(0)
    await expect(page.getByTestId('catalog-summary')).toHaveText(/^\d+ resultados?$/)
  })

  test('início: falha dos destaques do herói mostra aviso e nova tentativa, sem skeleton eterno', async ({ page, mock }) => {
    await mock.open('/', 'server-error')
    const hero = page.getByRole('region', { name: /^Seja dono d/ })
    const error = hero.getByRole('alert')
    await expect(error).toHaveText(/Destaques indisponíveis/)
    await expect(hero.getByRole('img')).toHaveCount(0)

    await mock.server((m, name) => m.setScenario(name), 'default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(hero.getByRole('img').first()).toBeVisible()
    await expect(error).toHaveCount(0)
  })

  test('detalhe: skeleton enquanto carrega, falha com mensagem e nova tentativa', async ({ page, mock }) => {
    await mock.open('/')
    const cards = page.getByTestId('catalog-grid').getByRole('article')
    await expect(cards.first()).toBeVisible()

    const first = cards.nth(0).getByRole('link')
    const firstName = (await first.innerText()).trim()
    const firstPath = (await first.getAttribute('href'))!
    await mock.server((m, path) => m.hold(path), firstPath)
    await first.click()
    await expect(page.getByRole('status', { name: 'Carregando NFT' })).toBeVisible()
    await mock.server((m, path) => m.release(path), firstPath)
    await expect(page.getByRole('heading', { level: 1, name: firstName })).toBeVisible()
    await expect(page.getByRole('status', { name: 'Carregando NFT' })).toHaveCount(0)

    // Falha: outro NFT (sem cache) com o servidor em 503.
    await page.goBack()
    const second = cards.nth(1).getByRole('link')
    const secondName = (await second.innerText()).trim()
    await mock.server((m, name) => m.setScenario(name), 'server-error')
    await second.click()
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o NFT' })
    await expect(error).toBeVisible()
    await mock.server((m, name) => m.setScenario(name), 'default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: secondName })).toBeVisible()
    await expect(error).toHaveCount(0)
  })

  test('carrinho: skeleton dos itens e do resumo enquanto carregam', async ({ page, mock }) => {
    // O login já devolve o carrinho (merge); o skeleton aparece na carga direta da página.
    await mock.open('/')
    await mock.login(USERS.ana)
    await mock.open('/cart', 'slow')
    await expect(page.getByRole('status', { name: 'Carregando carrinho' })).toBeVisible()
    // A cotação (POST) não sofre o `slow`: fica retida para o skeleton do resumo aparecer.
    await mock.server((m) => m.hold('/quotes'))
    await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(3)
    await expect(page.getByRole('status', { name: 'Carregando carrinho' })).toHaveCount(0)
    await expect(page.getByRole('status', { name: 'Calculando resumo' }).filter({ visible: true })).toBeVisible()

    await mock.server((m) => m.release('/quotes'))
    await expect(page.getByTestId('quote-total').filter({ visible: true }).first()).toHaveText(/ETH/)
    await expect(page.getByRole('status', { name: 'Calculando resumo' })).toHaveCount(0)
  })

  test('carrinho: falha do servidor com mensagem e nova tentativa', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await mock.open('/cart', 'server-error')
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' })
    await expect(error).toBeVisible()
    await expect(error).toContainText('Serviço temporariamente indisponível')
    await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toHaveCount(0)

    await mock.server((m, name) => m.setScenario(name), 'default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(3)
    await expect(page.getByTestId('quote-total').filter({ visible: true }).first()).toHaveText(/ETH/)
  })

  test('perfil: skeleton enquanto carrega, falha com mensagem e nova tentativa', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    // Abre /wallets direto: a sessão é validada uma vez e fica em cache para o resto do teste.
    await mock.open('/wallets')
    const menu = page.getByRole('navigation', { name: 'Menu da conta' })
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()

    await mock.server((m) => m.hold('/me/profile'))
    await menu.getByRole('link', { name: 'Dados do perfil' }).click()
    await expect(page.getByRole('status', { name: 'Carregando perfil' })).toBeVisible()
    await mock.server((m) => m.release('/me/profile'))
    await expect(page.getByRole('form', { name: 'Perfil do colecionador' })).toBeVisible()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
  })

  test('perfil: falha do servidor com mensagem e nova tentativa', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await mock.open('/wallets')
    const menu = page.getByRole('navigation', { name: 'Menu da conta' })
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()

    await mock.server((m, name) => m.setScenario(name), 'server-error')
    await menu.getByRole('link', { name: 'Dados do perfil' }).click()
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' })
    await expect(error).toBeVisible()
    await expect(error).toContainText('Serviço temporariamente indisponível')

    await mock.server((m, name) => m.setScenario(name), 'default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.ana.name)
    await expect(error).toHaveCount(0)
  })
})
