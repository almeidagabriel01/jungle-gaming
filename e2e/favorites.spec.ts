import type { Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'

const NFT_ID = 'nft_003'

/**
 * Congela o relógio da página para observar a janela otimista: a resposta do handler MSW (latência
 * de 120–300 ms) e as notificações do React Query rodam em timers, então nada assenta até `resume`.
 */
async function freezeClock(page: Page) {
  const now = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(now + 1_000)
}

const favoritesOf = (page: Page) => page.evaluate((id) => window.__mock!.snapshot().favorites[id] ?? [], USERS.ana.id)

test.describe('favoritos com falha da API', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install()
  })

  test('favoritar e desfavoritar: a mudança otimista volta atrás na falha e a nova tentativa grava', async ({ page, mock }) => {
    await mock.open('/', 'favorite-fails')
    await mock.login(USERS.ana)
    const name = await mock.server((m, id) => m.snapshot().nfts.find((n) => n.id === id)!.name, NFT_ID)
    await page.goto(`/nfts/${NFT_ID}`)
    const favorite = page.getByRole('button', { name: `Favoritar ${name}` })
    const unfavorite = page.getByRole('button', { name: `Remover ${name} dos favoritos` })
    await expect(favorite).toHaveAttribute('aria-pressed', 'false')
    const before = await favoritesOf(page)

    // Favoritar: aplica na hora; a API responde 500 e o estado volta.
    await freezeClock(page)
    await favorite.click()
    await page.clock.runFor(50)
    await expect(unfavorite).toHaveAttribute('aria-pressed', 'true')
    await page.clock.resume()
    await expect(page.getByText(`Não foi possível favoritar ${name}. Tente novamente.`)).toBeVisible()
    await expect(favorite).toHaveAttribute('aria-pressed', 'false')
    expect(await favoritesOf(page)).toEqual(before)

    // O servidor se recupera: a nova tentativa grava.
    await mock.server((m) => m.setScenario('default'))
    await favorite.click()
    await expect(page.getByText(`${name} adicionado aos favoritos.`)).toBeVisible()
    await expect(unfavorite).toHaveAttribute('aria-pressed', 'true')
    expect(await favoritesOf(page)).toEqual([...before, NFT_ID])

    // Desfavoritar com falha: some na hora e volta a aparecer marcado.
    await mock.server((m) => m.setScenario('favorite-fails'))
    await freezeClock(page)
    await unfavorite.click()
    await page.clock.runFor(50)
    await expect(favorite).toHaveAttribute('aria-pressed', 'false')
    await page.clock.resume()
    await expect(page.getByText(`Não foi possível remover dos favoritos ${name}. Tente novamente.`)).toBeVisible()
    await expect(unfavorite).toHaveAttribute('aria-pressed', 'true')
    expect(await favoritesOf(page)).toEqual([...before, NFT_ID])

    await mock.server((m) => m.setScenario('default'))
    await unfavorite.click()
    await expect(page.getByText(`${name} removido dos favoritos.`)).toBeVisible()
    await expect(favorite).toHaveAttribute('aria-pressed', 'false')
    expect(await favoritesOf(page)).toEqual(before)

    // O estado final é o do servidor, também depois do refresh.
    await page.reload()
    await expect(favorite).toHaveAttribute('aria-pressed', 'false')
  })

  test('remover da lista de interesse com falha devolve o card; a nova tentativa o tira da lista', async ({ page, mock }) => {
    await mock.open('/', 'favorite-fails')
    await mock.login(USERS.ana)
    const [first, ...rest] = await mock.server((m, id) => {
      const db = m.snapshot()
      return db.favorites[id].map((nftId) => db.nfts.find((n) => n.id === nftId)!.name)
    }, USERS.ana.id)
    await page.goto('/favorites')
    const list = page.getByTestId('favorites-list')
    await expect(list.getByRole('listitem')).toHaveCount(rest.length + 1)

    await freezeClock(page)
    await list.getByRole('button', { name: `Remover ${first} dos favoritos` }).click()
    await page.clock.runFor(50)
    await expect(list.getByRole('listitem')).toHaveCount(rest.length)
    await page.clock.resume()
    await expect(page.getByText(`Não foi possível remover dos favoritos ${first}. Tente novamente.`)).toBeVisible()
    await expect(list.getByRole('listitem')).toHaveCount(rest.length + 1)
    await expect(list.getByRole('button', { name: `Remover ${first} dos favoritos` })).toBeVisible()

    await mock.server((m) => m.setScenario('default'))
    await list.getByRole('button', { name: `Remover ${first} dos favoritos` }).click()
    await expect(page.getByText(`${first} removido dos favoritos.`)).toBeVisible()
    await expect(list.getByRole('listitem')).toHaveCount(rest.length)
    await page.reload()
    await expect(page.getByTestId('favorites-list').getByRole('listitem')).toHaveCount(rest.length)
    for (const name of rest) await expect(page.getByTestId('favorites-list').getByText(name, { exact: true })).toBeVisible()
  })
})
