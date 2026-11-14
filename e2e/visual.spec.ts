import { expect, test, USERS } from './fixtures'

/**
 * Regressão visual das telas principais (projetos desktop 1440 e mobile 390). As baselines são
 * geradas no Linux (mesmo ambiente do CI): `pnpm test:e2e visual --update-snapshots`.
 * Dados vêm do seed determinístico do mock; animações e carrossel ficam parados (reduced motion).
 */
test.use({ reducedMotion: 'reduce' })

const screens = [
  { name: 'inicio', path: '/', ready: 'catalog-grid' },
  { name: 'detalhe', path: '/nfts/nft_001', ready: null },
  { name: 'carrinho', path: '/cart', ready: 'quote-total', login: true },
  { name: 'pagamento', path: '/checkout', ready: /^(quote|mobile)-total$/, login: true },
  { name: 'login', path: '/login', ready: null },
  { name: 'perfil', path: '/profile', ready: null, login: true },
] as const

for (const screen of screens) {
  test(`tela ${screen.name}`, async ({ page, mock }) => {
    if ('login' in screen) {
      await mock.open('/')
      await mock.login(USERS.ana)
    }
    await mock.open(screen.path)
    // O total do pagamento mobile fica no rodapé fixo (mobile-total); o resumo completo, recolhido.
    if (screen.ready) await expect(page.getByTestId(screen.ready).filter({ visible: true }).first()).toBeVisible()
    else await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    // Todas as imagens decodificadas (inclusive as lazy de fora da dobra) antes da captura.
    await page.evaluate(async () => {
      for (const img of document.images) img.loading = 'eager'
      await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)))
    })
    await expect(page).toHaveScreenshot(`${screen.name}.png`, { fullPage: true })
  })
}
