import { expect, test } from './fixtures'

/** §9 (1): resultado vazio e respostas fora de ordem do catálogo (cenários `empty` e `out-of-order`). */
test.describe('catálogo: vazio e fora de ordem', () => {
  test('catálogo vazio na API mostra o estado vazio', async ({ page, mock }) => {
    await mock.open('/', 'empty')
    await expect(page.getByTestId('catalog-summary')).toHaveText('0 resultados')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Paginação' })).toBeHidden()
  })

  test('busca sem resultado mostra o vazio e "Limpar filtros" restaura o catálogo', async ({ page, mock }) => {
    await mock.open('/?q=nenhum-nft-com-este-nome&categories=%5B%22music%22%5D')
    await expect(page.getByTestId('catalog-summary')).toHaveText('0 resultados')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()

    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page).not.toHaveURL(/[?&](q|categories)=/)
    await expect(page.getByTestId('catalog-summary')).toHaveText('239 resultados')
  })

  test('resposta antiga e lenta não sobrescreve a página escolhida por último', async ({ page, mock }) => {
    // O cenário alterna GET /nfts em 1500 ms e 100 ms (atraso do MSW, que roda sob o relógio da página).
    await page.clock.install()
    await mock.open('/', 'out-of-order')
    const grid = page.getByTestId('catalog-grid')
    const summary = page.getByTestId('catalog-summary')
    await expect(summary).toHaveText('239 resultados')
    // A conexão do socket invalida o catálogo ao conectar: espera assentar antes de medir.
    await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: conectado')
    await expect(grid).toHaveAttribute('aria-busy', 'false')

    // Página 4 segundo o servidor (ordenação padrão: mais recentes primeiro).
    const expected = await mock.server((m) =>
      m
        .snapshot()
        .nfts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(27, 36)
        .map((n) => n.name),
    )

    // Três trocas seguidas: com a alternância lenta/rápida, ao menos uma resposta mais antiga
    // é lenta e chega depois de uma mais nova.
    const pages = page.getByRole('navigation', { name: 'Paginação' })
    for (const n of [2, 3, 4]) await pages.getByRole('button', { name: `Página ${n}`, exact: true }).click()

    await expect(page).toHaveURL(/page=4/)
    await expect(grid).toHaveAttribute('aria-busy', 'false')
    await expect(grid.getByRole('heading', { level: 3 })).toHaveText(expected)

    // Vence o atraso de todas as respostas em voo: nenhuma delas pode trocar a página exibida.
    await page.clock.runFor(2_000)
    await expect(grid).toHaveAttribute('aria-busy', 'false')
    await expect(page).toHaveURL(/page=4/)
    await expect(pages.getByRole('button', { name: 'Página 4', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(grid.getByRole('heading', { level: 3 })).toHaveText(expected)
  })
})
