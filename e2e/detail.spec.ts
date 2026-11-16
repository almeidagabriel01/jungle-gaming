import { expect, test } from './fixtures'

/** §9 (2): acesso direto ao detalhe, recurso inexistente e limites da edição (§3 Catálogo e detalhe). */
test.describe('detalhe do NFT', () => {
  test('acesso direto carrega o NFT da API e sobrevive ao refresh', async ({ page, mock }) => {
    await mock.open('/nfts/nft_001')
    // Fonte da verdade: o "servidor" (mock DB).
    const nft = await mock.server((m) => {
      const n = m.snapshot().nfts.find((x) => x.id === 'nft_001')!
      return { name: n.name, editions: n.editions.map((e) => e.name) }
    })
    const title = page.getByRole('heading', { level: 1, name: nft.name })
    await expect(title).toBeVisible()
    const editions = page.getByRole('radiogroup', { name: 'Edição:' })
    for (const name of nft.editions) await expect(editions.getByRole('radio', { name, exact: true })).toBeAttached()

    await page.reload()
    await expect(title).toBeVisible()
    await expect(page).toHaveURL(/\/nfts\/nft_001$/)
  })

  test('id inexistente mostra o 404 do NFT e volta ao catálogo', async ({ page, mock }) => {
    await mock.open('/nfts/nft_inexistente')
    await expect(page.getByRole('heading', { level: 1, name: 'NFT não encontrado' })).toBeVisible()
    await expect(page.getByText('ERRO 404')).toBeVisible()
    // Refresh no endereço inválido continua no 404 (não cai em skeleton nem em tela vazia).
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'NFT não encontrado' })).toBeVisible()

    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
    await expect(page).toHaveURL(/\/#mercado$/)
    await expect(page.getByTestId('catalog-summary')).toHaveText('239 resultados')
  })

  test('rota inexistente mostra o 404 da aplicação', async ({ page, mock }) => {
    await mock.open('/rota/que-nao-existe')
    await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('catalog-summary')).toHaveText('239 resultados')
  })

  test('edição esgotada fica indisponível e a quantidade respeita o estoque', async ({ page, mock }) => {
    // Estado do servidor antes de abrir a página: 1/1 esgotada e 1/10 com 2 unidades.
    await mock.open('/')
    const editions = await mock.server((m) => {
      const n = m.snapshot().nfts.find((x) => x.id === 'nft_001')!
      const byName = (name: string) => n.editions.find((e) => e.name === name)!
      const soldOut = byName('1/1')
      const limited = byName('1/10')
      m.updateEdition('nft_001', soldOut.id, { available: 0 })
      m.updateEdition('nft_001', limited.id, { available: 2 })
      return { soldOut: soldOut.name, limited: limited.name }
    })
    await mock.open('/nfts/nft_001')

    const group = page.getByRole('radiogroup', { name: 'Edição:' })
    const soldOut = group.getByRole('radio', { name: editions.soldOut, exact: true })
    await expect(soldOut).toBeDisabled()
    await expect(soldOut).toHaveAccessibleDescription('esgotada')

    await group.getByRole('radio', { name: editions.limited, exact: true }).check()
    const stepper = page.getByRole('group', { name: /^Quantidade de / }).filter({ visible: true })
    const more = stepper.getByRole('button', { name: 'Aumentar quantidade' })
    await more.click()
    await expect(stepper.locator('output')).toHaveText('2')
    // Limite = disponibilidade da edição.
    await expect(more).toBeDisabled()

    const add = page.getByRole('button', { name: 'Adicionar ao carrinho' }).filter({ visible: true })
    await add.click()
    await expect(page.getByRole('link', { name: /Carrinho, 2 itens/ }).filter({ visible: true })).toBeVisible()
    // Tudo o que há em estoque já está no carrinho: não dá para adicionar mais.
    await expect(page.getByText('Você já tem todas as 2 unidades disponíveis no carrinho.')).toBeVisible()
    await expect(add).toBeDisabled()
  })
})
