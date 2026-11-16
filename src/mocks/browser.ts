import { http, type RequestHandler, type WebSocketHandler } from 'msw'
import { setupWorker } from 'msw/browser'
import type { RealtimeEvent } from '@/contracts/events'
import { resetDb, scheduleSettlement, settleDueOrders, setEventSink, setOrderScheduler, updateEdition, withDb, type Db } from './db'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { contentHandlers } from './handlers/content'
import { API, apiError } from './handlers/http'
import { orderHandlers } from './handlers/orders'
import { activeScenarios, hold, initScenarioFromUrl, release, releaseAll, setScenario } from './scenarios'
import { deliver, dropConnections, socketHandler } from './socket'

const handlers: (RequestHandler | WebSocketHandler)[] = [
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  ...contentHandlers,
  socketHandler,
  // Qualquer rota da API não prevista responde 404 do contrato, nunca o index.html da SPA.
  http.all(`${API}/*`, () => apiError(404, 'NOT_FOUND', 'Rota inexistente')),
]

const recent: RealtimeEvent[] = []

/**
 * Controle da simulação para demonstração e testes. Atua só no "servidor": muta o mock DB
 * (REST passa a responder o novo estado) e o evento sai pelo socket mock até o socket.io-client.
 * Nada aqui toca cache, hooks ou componentes.
 */
const control = {
  /** Reinicia o "servidor": volta ao seed e derruba os sockets (o cliente reconecta e reconcilia). */
  reset: () => {
    releaseAll()
    resetDb()
    dropConnections()
  },
  scenarios: activeScenarios,
  setScenario,
  /** Segura as requests cujo caminho termina em `path` (latência controlada) até `release(path)`. */
  hold,
  release,
  updateEdition: (nftId: string, editionId: string, patch: { price?: string; available?: number }) =>
    withDb((tx) => {
      updateEdition(tx, nftId, editionId, patch)
    }),
  /** Reenvia um evento arbitrário (duplicado ou antigo) pelo socket. */
  emitRaw: (event: RealtimeEvent) => {
    deliver(event)
  },
  /** Eventos emitidos recentemente, para reenviar duplicados/antigos em testes. */
  recentEvents: (): RealtimeEvent[] => [...recent],
  dropSockets: dropConnections,
  settleNow: () =>
    withDb((tx) => {
      for (const order of tx.db.orders) if (order.status === 'pending') order.settleAt = tx.now
      settleDueOrders(tx)
    }),
  snapshot: (): Db => withDb(({ db }) => structuredClone(db)),
}

export type MockControl = typeof control

declare global {
  interface Window {
    __mock?: MockControl
  }
}

export async function startMocks() {
  const url = new URL(location.href)
  initScenarioFromUrl(url)
  if (url.searchParams.has('mockReset')) {
    resetDb()
    // Reset é uma ação única: sem isso, um refresh resetaria o estado de novo.
    url.searchParams.delete('mockReset')
    history.replaceState(history.state, '', url)
  }

  setEventSink((event) => {
    recent.push(event)
    if (recent.length > 50) recent.shift()
    deliver(event)
  })
  // Liquidação de pedidos: timer para o momento exato + liquidação preguiçosa em toda leitura.
  setOrderScheduler((settleAt) => {
    setTimeout(() => withDb(() => undefined), Math.max(0, settleAt - Date.now()) + 5)
  })
  for (const settleAt of withDb(({ db }) => db.orders.filter((o) => o.status === 'pending').map((o) => o.settleAt))) {
    scheduleSettlement(settleAt)
  }

  window.__mock = control

  await setupWorker(...handlers).start({
    onUnhandledRequest: 'bypass',
    quiet: !import.meta.env.DEV,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
}
