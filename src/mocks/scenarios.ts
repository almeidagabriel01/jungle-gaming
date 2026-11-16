import { delay } from 'msw'

/**
 * Cenários determinísticos da simulação (§6). Combináveis por vírgula: `?scenario=slow,payment-declined`.
 * Prioridade: `?scenario=` na URL (salvo em sessionStorage para sobreviver à navegação) >
 * `VITE_MOCK_SCENARIO` > `default`.
 */
export const SCENARIOS = {
  default: 'Latência curta determinística; pagamento confirma em 2 s',
  slow: '+2,5 s em todas as leituras (skeletons)',
  'out-of-order': 'GET /nfts alterna 1500 ms e 100 ms (respostas fora de ordem)',
  empty: 'Catálogo sem resultados',
  offline: 'Toda chamada à API falha como erro de rede',
  'server-error': 'Leituras respondem 503 (falha transitória)',
  'session-expired': 'Access e refresh tokens são rejeitados (sessão expirada)',
  'register-conflict': 'Cadastro sempre responde 409 EMAIL_TAKEN',
  'favorite-fails': 'Incluir/remover favorito responde 500',
  'price-change-on-checkout': 'Preço do 1º item sobe ao enviar o pedido (cotação desatualizada)',
  'sold-out-on-checkout': 'Edição do 1º item esgota ao enviar o pedido',
  'order-timeout': 'POST /orders cria o pedido mas só responde após 30 s',
  'wallet-rejected': 'A carteira recusa a conexão',
  'payment-declined': 'Pagamento termina recusado',
  'payment-slow': 'Pagamento liquida em 15 s',
} as const

export type ScenarioName = keyof typeof SCENARIOS

const STORAGE_KEY = 'jungle-mock-scenario'

const isScenario = (value: string): value is ScenarioName => value in SCENARIOS

function parse(value: string | null | undefined): ScenarioName[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(isScenario)
}

/** Lido no boot: fixa o cenário vindo da URL na sessão da aba. */
export function initScenarioFromUrl(url: URL) {
  const fromUrl = url.searchParams.get('scenario')
  if (fromUrl !== null) setScenario(fromUrl)
}

export function setScenario(value: string) {
  sessionStorage.setItem(STORAGE_KEY, parse(value).join(','))
}

export function activeScenarios(): ScenarioName[] {
  const stored = sessionStorage.getItem(STORAGE_KEY)
  const list = parse(stored ?? (import.meta.env.VITE_MOCK_SCENARIO as string | undefined))
  return list.length > 0 ? list : ['default']
}

export const hasScenario = (name: ScenarioName) => activeScenarios().includes(name)

/** Latência determinística por rota (sem aleatoriedade): 120–300 ms. */
function baseLatency(path: string) {
  let h = 0
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0
  return 120 + (h % 181)
}

let catalogRequestCount = 0

/** Aplica a latência do cenário. Leituras sofrem `slow`; o catálogo alterna em `out-of-order`. */
export async function networkDelay(request: Request) {
  const { pathname } = new URL(request.url)
  let ms = baseLatency(pathname)
  if (request.method === 'GET' && hasScenario('slow')) ms += 2500
  if (request.method === 'GET' && pathname.endsWith('/nfts') && hasScenario('out-of-order')) {
    catalogRequestCount += 1
    ms = catalogRequestCount % 2 === 1 ? 1500 : 100
  }
  await delay(ms)
  for (const [path, gate] of held) if (pathname.endsWith(path)) await gate.promise
}

/**
 * Retenção manual (testes e demonstração): a request cujo caminho termina em `path` fica parada
 * até `release(path)`. Vale para qualquer método, ao contrário de `slow` (só leituras).
 */
const held = new Map<string, { promise: Promise<void>; release: () => void }>()

export function hold(path: string) {
  if (held.has(path)) return
  let release!: () => void
  const promise = new Promise<void>((resolve) => (release = resolve))
  held.set(path, { promise, release })
}

export function release(path: string) {
  held.get(path)?.release()
  held.delete(path)
}
