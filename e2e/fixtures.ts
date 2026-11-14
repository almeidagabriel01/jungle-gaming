import { expect, test as base, type Page } from '@playwright/test'
import type { MockControl } from '../src/mocks/browser'

/** Credenciais fictícias do seed (README). */
export const USERS = {
  ana: { id: 'usr_ana', email: 'ana@jungle.test', password: 'Senha@123', name: 'Ana Souza' },
  bruno: { id: 'usr_bruno', email: 'bruno@jungle.test', password: 'Senha@123', name: 'Bruno Lima' },
} as const

type Mock = {
  /** Abre a rota com o cenário pedido. Cada teste já começa num contexto limpo (seed). */
  open: (path: string, scenario?: string) => Promise<void>
  /** Executa uma ação no "servidor" simulado (mock DB). A UI só vê o efeito via REST/Socket.IO. */
  server: <T, A = undefined>(fn: (mock: MockControl, arg: A) => T | Promise<T>, arg?: A) => Promise<T>
  login: (user: (typeof USERS)[keyof typeof USERS]) => Promise<void>
}

export const test = base.extend<{ mock: Mock }>({
  mock: async ({ page }, use) => {
    const mock: Mock = {
      open: async (path, scenario) => {
        const url = new URL(path, 'http://app.local')
        if (scenario) url.searchParams.set('scenario', scenario)
        await page.goto(url.pathname + url.search)
        await waitForApp(page)
      },
      server: (fn, arg) =>
        page.evaluate(
          // A função é serializada e executada na página contra `window.__mock`.
          ([source, value]) => {
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            const run = new Function('mock', 'arg', `return (${source})(mock, arg)`) as (mock: unknown, arg: unknown) => never
            return run(window.__mock, value)
          },
          [fn.toString(), arg] as const,
        ),
      login: async (user) => {
        await page.goto('/login')
        await page.getByLabel('E-mail', { exact: true }).fill(user.email)
        await page.getByLabel('Senha', { exact: true }).fill(user.password)
        await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        // Desktop: menu da conta no header; mobile: atalho do perfil na barra inferior.
        await expect(
          page.getByRole('button', { name: new RegExp(`^${user.name.split(' ')[0]} ?: menu da conta$`) }).or(page.getByRole('link', { name: `Perfil de ${user.name}` })),
        ).toBeVisible()
      },
    }
    await use(mock)
  },
})

/** O app só monta depois do worker do MSW; o `<main>` é o sinal de app pronto (existe em todas as rotas). */
export async function waitForApp(page: Page) {
  await expect(page.locator('main#conteudo')).toBeVisible()
}

export { expect }
