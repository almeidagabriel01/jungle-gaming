import { expect, test } from './fixtures'

test.describe('busca no desktop', () => {
  test('busca ativa mostra o termo sobre a lista e "Limpar busca" volta ao catálogo inteiro', async ({ page, mock }, info) => {
    test.skip(info.project.name === 'mobile', 'No mobile o campo do catálogo já mostra o termo e o limpa.')
    await mock.open('/')
    const summary = page.getByTestId('catalog-summary')
    await expect(summary).toHaveText(/^\d+ resultados$/)
    const all = await summary.innerText()
    await expect(page.getByTestId('active-search')).toHaveCount(0)

    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    await page.getByRole('searchbox', { name: 'Termo de busca' }).fill('Emerald')
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()

    await expect(page).toHaveURL((url) => url.searchParams.get('q') === 'Emerald')
    const active = page.getByTestId('active-search')
    await expect(active).toHaveText(/Resultados para “Emerald”/)
    await expect(summary).not.toHaveText(all)
    await expect(page.getByTestId('catalog-grid').getByRole('listitem').first()).toContainText(/Emerald/i)

    await active.getByRole('button', { name: 'Limpar busca' }).click()
    await expect(page).toHaveURL((url) => !url.searchParams.has('q'))
    await expect(active).toHaveCount(0)
    await expect(summary).toHaveText(all)
    await expect(page.getByRole('tab', { selected: true })).toBeFocused()
  })
})
