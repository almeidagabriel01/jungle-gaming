import type { Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'

/**
 * Reflow (§8 e WCAG 1.4.10): nenhuma rota pode ter overflow horizontal nem esconder o conteúdo principal.
 * - 320 px: o mesmo que 1280 px com zoom de 400% (critério do WCAG), no projeto mobile.
 * - 720 px: 1440 px com zoom de 200%, no projeto desktop.
 * - 390 e 1440 px: os frames mobile e desktop do layout (§8).
 * - 768 px: tablet, no projeto desktop.
 */
test.use({ reducedMotion: 'reduce' })

const WIDTHS = [
  { label: '320 (zoom 400%)', width: 320, height: 640, project: 'mobile' },
  { label: '390', width: 390, height: 844, project: 'mobile' },
  { label: '768', width: 768, height: 1024, project: 'desktop' },
  { label: '1440', width: 1440, height: 900, project: 'desktop' },
  { label: '1440 com zoom 200%', width: 720, height: 450, project: 'desktop' },
] as const

const ROUTES = [
  { name: 'início', path: '/', ready: 'catalog-grid' },
  { name: 'detalhe', path: '/nfts/nft_001' },
  { name: 'carrinho', path: '/cart', ready: 'quote-total', login: true },
  { name: 'pagamento', path: '/checkout', ready: /^(quote|mobile)-total$/, login: true },
  { name: 'recibo', path: '/orders/ord_seed_ana', ready: 'receipt-total', login: true },
  { name: 'perfil', path: '/profile', login: true },
  { name: 'carteiras', path: '/wallets', login: true },
  { name: 'favoritos', path: '/favorites', login: true },
  { name: 'login', path: '/login' },
  { name: 'cadastro', path: '/register' },
  { name: '404', path: '/rota-que-nao-existe' },
] as const

/** Elementos cuja borda direita passa da viewport: aparecem na mensagem quando o teste falha. */
const overflowReport = (page: Page, width: number) =>
  page.evaluate((width) => {
    const doc = document.documentElement
    const culprits = [...document.body.querySelectorAll('*')]
      .filter((el) => el.getBoundingClientRect().right > width + 0.5 && el.getClientRects().length > 0)
      .slice(0, 8)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').slice(0, 80)} → ${Math.round(el.getBoundingClientRect().right)}px`)
    return { scrollWidth: doc.scrollWidth, innerWidth, culprits }
  }, width)

for (const size of WIDTHS) {
  test.describe(`reflow a ${size.label} px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } })

    for (const route of ROUTES) {
      test(`${route.name} sem overflow horizontal`, async ({ page, mock }, testInfo) => {
        test.skip(testInfo.project.name !== size.project, `largura avaliada no projeto ${size.project}`)
        if ('login' in route) {
          await mock.open('/')
          await mock.login(USERS.ana)
        }
        await mock.open(route.path)
        if ('ready' in route) await expect(page.getByTestId(route.ready).filter({ visible: true }).first()).toBeVisible()
        // Algumas telas têm o h1 só para leitor de tela: o conteúdo visível é o <main> na viewport.
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
        await expect(page.locator('main#conteudo')).toBeInViewport()

        // Em isMobile o Chrome alarga a viewport de layout para caber o que estoura: compara com a largura pedida.
        const report = await overflowReport(page, size.width)
        const message = `overflow em ${route.path}:\n${report.culprits.join('\n')}`
        expect(report.innerWidth, message).toBe(size.width)
        expect(report.scrollWidth, message).toBeLessThanOrEqual(report.innerWidth)
      })
    }
  })
}

test.describe('ações simuladas não aparentam sucesso (§3)', () => {
  test('recibo: explorador rotulado como simulado e sem link para explorador real', async ({ page, mock }) => {
    await mock.open('/')
    await mock.login(USERS.ana)
    await mock.open('/orders/ord_seed_ana')
    await expect(page.getByTestId('receipt-total')).toBeVisible()

    const explorer = page.getByRole('button', { name: 'Explorador (simulado)' })
    await expect(explorer).toBeVisible()
    await explorer.click()
    await expect(page.getByText('O explorador de blocos não está disponível nesta demonstração.')).toBeVisible()
    await expect(page.locator('a[href*="etherscan" i], a[href*="explorer" i]')).toHaveCount(0)
  })

  test('rodapé: contatos fictícios, sem mailto/tel', async ({ page, mock }) => {
    await mock.open('/')
    const footer = page.locator('footer')
    await expect(footer.getByText('contato@kurio.test')).toBeVisible()
    await expect(footer.getByText('+55 11 0000 0000')).toBeVisible()
    await expect(page.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0)
  })

  test('detalhe: nenhum link para explorador real nem mailto com destinatário', async ({ page, mock }) => {
    await mock.open('/nfts/nft_001')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('a[href*="etherscan" i]')).toHaveCount(0)
    // O "Compartilhar por e-mail" abre o cliente do usuário sem destinatário: não finge um contato real.
    for (const href of await page.locator('a[href^="mailto:"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
      expect(href).toMatch(/^mailto:\?/)
    }
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
  })
})
