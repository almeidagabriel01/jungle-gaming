import { defineConfig, devices } from '@playwright/test'

// PW_PORT: porta própria por worktree quando várias suítes rodam na mesma máquina.
const PORT = Number(process.env.PW_PORT ?? 4173)
// E2E roda contra o build otimizado (mesmo artefato do deploy de demonstração).
// PW_DEV=1 usa o servidor de desenvolvimento para depuração local.
const useDev = process.env.PW_DEV === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: useDev ? 'http://localhost:5173' : `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: useDev
    ? { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true }
    : { command: `pnpm build && pnpm preview --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: !process.env.CI, timeout: 180_000 },
})
