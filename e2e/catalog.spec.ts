import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * No desktop os filtros ficam na lateral e a busca no diálogo do header; no mobile os filtros e a
 * ordenação ficam na gaveta "Filtros e ordenação" e a busca no campo "Explorar coleções".
 */
function catalog(page: Page, mobile: boolean) {
  const summary = page.getByTestId('catalog-summary')
  const grid = page.getByTestId('catalog-grid')
  const drawer = page.getByRole('dialog', { name: 'Filtros' })
  return {
    summary,
    grid,
    /** Lê só depois que a lista assenta: durante o refetch o resumo ganha " · atualizando…". */
    settled: async () => {
      await expect(grid).toHaveAttribute('aria-busy', 'false')
      return summary.innerText()
    },
    /** Garante a lateral/gaveta de filtros visível e devolve o contêiner. */
    filters: async () => {
      if (!mobile) return page.getByRole('complementary', { name: 'Filtros' })
      if (!(await drawer.isVisible())) await page.getByRole('button', { name: 'Filtros e ordenação' }).click()
      await expect(drawer).toBeVisible()
      return drawer
    },
    /** Ordenação: na barra do catálogo no desktop, na gaveta no mobile. */
    sort: () => (mobile ? drawer : page.getByTestId('catalog-toolbar')).getByLabel('Ordenar por'),
    closeFilters: async () => {
      if (mobile && (await drawer.isVisible())) {
        await page.keyboard.press('Escape')
        await expect(drawer).toBeHidden()
      }
    },
    search: async (term: string) => {
      if (mobile) {
        await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill(term)
        return
      }
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await page.getByRole('searchbox', { name: 'Termo de busca' }).fill(term)
      await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    },
  }
}

const results = (n: number) => `${n} ${n === 1 ? 'resultado' : 'resultados'}`

test.describe('catálogo com estado na URL', () => {
  test('busca, filtros combinados, ordenação e paginação sobrevivem a histórico e refresh', async ({ page, mock }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile'
    const c = catalog(page, mobile)
    await mock.open('/')
    await expect(c.summary).toHaveText('239 resultados')

    // Paginação entra na URL.
    await page.getByRole('navigation', { name: 'Paginação' }).getByRole('button', { name: 'Próxima' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText('Página 2 de 27')).toBeAttached()

    // Filtro reinicia a paginação e combina com outro do mesmo grupo, outro grupo e ordenação.
    let filters = await c.filters()
    // Contagem exibida ao lado da opção (faceta da API): o mesmo número que o filtro deve produzir.
    const facet = async (group: string, option: string) => {
      const text = await filters.getByRole('group', { name: group }).getByText(option).locator('..').innerText()
      return Number(/\((\d+)\)/.exec(text)?.[1])
    }
    await filters.getByLabel('Música').check()
    await expect(page).not.toHaveURL(/page=/)
    await expect(c.summary).toHaveText(results(65))
    await filters.getByLabel('Arte digital').check()
    await expect(c.summary).toHaveText(results(65 + 33))
    await c.settled()
    const polygon = await facet('Rede', 'Polygon')
    await filters.getByLabel('Polygon').check()
    await expect(page).toHaveURL((url) => url.searchParams.get('networks') === '["polygon"]')
    await expect(c.summary).toHaveText(results(polygon))
    await c.sort().selectOption('price-asc')
    await expect(page).toHaveURL(/sort=price-asc/)
    await c.closeFilters()

    // Busca também compõe a URL (no mobile, com debounce).
    const beforeSearch = await c.settled()
    await c.search('golden')
    await expect(page).toHaveURL(/q=golden/)
    await expect(page).toHaveURL(/categories=/)
    await expect(c.summary).not.toHaveText(beforeSearch)
    const searched = await c.settled()
    const filtered = (await c.grid.textContent())!

    // Voltar no histórico restaura o estado anterior (sem a busca), avançar recupera.
    await page.goBack()
    await expect(page).not.toHaveURL(/q=golden/)
    if (mobile) await expect(page.getByRole('searchbox', { name: 'Buscar NFTs' })).toHaveValue('')
    await expect(c.summary).toHaveText(beforeSearch)
    await page.goForward()
    await expect(page).toHaveURL(/q=golden/)
    if (mobile) await expect(page.getByRole('searchbox', { name: 'Buscar NFTs' })).toHaveValue('golden')
    await expect(c.summary).toHaveText(searched)

    // Refresh mantém exatamente os mesmos resultados e controles.
    await page.reload()
    await expect(c.summary).toHaveText(searched)
    await expect(c.grid).toHaveText(filtered)
    filters = await c.filters()
    await expect(filters.getByLabel('Música')).toBeChecked()
    await expect(filters.getByLabel('Arte digital')).toBeChecked()
    await expect(filters.getByLabel('Polygon')).toBeChecked()
    await expect(c.sort()).toHaveValue('price-asc')
  })
})

test.describe('abas do catálogo', () => {
  for (const { tab, label, flag } of [
    { tab: 'new', label: 'Novos lançamentos', flag: 'isNew' },
    { tab: 'trending', label: 'Em alta', flag: 'trending' },
  ] as const) {
    test(`"${label}" lista só os NFTs marcados pela API e fica na URL`, async ({ page, mock }, testInfo) => {
      const c = catalog(page, testInfo.project.name === 'mobile')
      await mock.open('/?page=2')
      const tabs = page.getByRole('tablist', { name: 'Lista do catálogo' })
      await expect(tabs.getByRole('tab', { name: 'Todos os NFTs' })).toHaveAttribute('aria-selected', 'true')

      // Fonte da verdade: o "servidor" (mock DB), não a UI.
      const expected = await mock.server(
        (m, key) =>
          m
            .snapshot()
            .nfts.filter((n) => n[key])
            .map((n) => n.name),
        flag,
      )
      expect(expected.length).toBeGreaterThan(0)

      await tabs.getByRole('tab', { name: label }).click()
      await expect(page).toHaveURL((url) => url.searchParams.get('tab') === tab && !url.searchParams.has('page'))
      await expect(tabs.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByRole('tabpanel', { name: label })).toBeVisible()
      await expect(c.summary).toHaveText(results(expected.length))
      await c.settled()
      const shown = await c.grid.getByRole('heading', { level: 3 }).allInnerTexts()
      expect(shown.length).toBe(Math.min(9, expected.length))
      for (const name of shown) expect(expected).toContain(name)

      // A aba sobrevive ao refresh e combina com filtros.
      await page.reload()
      await expect(tabs.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
      await expect(c.summary).toHaveText(results(expected.length))
    })
  }

  test('teclado: setas, Home e End trocam a aba com foco móvel (roving tabindex)', async ({ page, mock }) => {
    await mock.open('/')
    const tabs = page.getByRole('tablist', { name: 'Lista do catálogo' })
    await tabs.getByRole('tab', { name: 'Todos os NFTs' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'Novos lançamentos' })).toBeFocused()
    await expect(page).toHaveURL(/tab=new/)
    await page.keyboard.press('End')
    await expect(tabs.getByRole('tab', { name: 'Em alta' })).toBeFocused()
    await expect(page).toHaveURL(/tab=trending/)
    await page.keyboard.press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'Todos os NFTs' })).toBeFocused()
    await expect(page).not.toHaveURL(/tab=/)
    // Só a aba ativa fica na ordem de Tab.
    await expect(tabs.getByRole('tab', { name: 'Em alta' })).toHaveAttribute('tabindex', '-1')
  })
})
