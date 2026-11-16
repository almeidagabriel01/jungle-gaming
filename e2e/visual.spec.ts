import type { Page } from '@playwright/test'
import { expect, test, USERS, type Mock } from './fixtures'

/**
 * Regressão visual das telas principais (projetos desktop 1440 e mobile 390, mais tablet 768). As baselines são
 * geradas no Linux (mesmo ambiente do CI): `pnpm test:e2e visual --update-snapshots`.
 * Dados vêm do seed determinístico do mock; animações e carrossel ficam parados (reduced motion).
 */
test.use({ reducedMotion: 'reduce' })

const screens = [
  { name: 'inicio', path: '/', ready: 'catalog-grid' },
  { name: 'detalhe', path: '/nfts/nft_001', ready: null },
  { name: 'carrinho', path: '/cart', ready: 'quote-total', login: true },
  { name: 'pagamento', path: '/checkout', ready: /^(quote|mobile)-total$/, login: true },
  // Desktop: o modal sobre a página inicial (o catálogo de fundo entra na espera de rede ociosa abaixo).
  { name: 'login', path: '/login', ready: null },
  { name: 'cadastro', path: '/register', ready: null },
  { name: 'perfil', path: '/profile', ready: null, login: true },
  { name: 'carteiras', path: '/wallets', ready: null, login: true },
  // Recibo do pedido confirmado do seed (data e hash fixos).
  { name: 'confirmacao', path: '/orders/ord_seed_ana', ready: 'receipt-total', login: true },
] as const

type Screen = (typeof screens)[number]

for (const screen of screens) {
  test(`tela ${screen.name}`, ({ page, mock }) => capture(page, mock, screen, `${screen.name}.png`))
}

// Tablet: o layout de 768 é o mesmo nos dois projetos; roda só no desktop para não duplicar a baseline.
test.describe('tablet 768', () => {
  test.use({ viewport: { width: 768, height: 1024 } })
  for (const screen of screens) {
    test(`tela ${screen.name}`, ({ page, mock }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'tablet capturado no projeto desktop')
      return capture(page, mock, screen, `${screen.name}-tablet.png`)
    })
  }
})

async function capture(page: Page, mock: Mock, screen: Screen, name: string) {
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
  await expect(page).toHaveScreenshot(name, { fullPage: true })
}
