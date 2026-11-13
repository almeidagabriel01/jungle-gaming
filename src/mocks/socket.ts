import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { RealtimeEvent } from '@/contracts/events'
import { withDb } from './db'
import { hasScenario } from './scenarios'

/**
 * Servidor Socket.IO simulado via MSW + @mswjs/socket.io-binding.
 * O MSW remove o prefixo `/socket.io/` do pathname antes de casar a URL, por isso o
 * link aponta para a origem. Limitações do binding 0.2: só namespace `/`, eventos de
 * texto, sem acks, rooms ou binários; transporte apenas WebSocket.
 */
const link = ws.link(location.origin.replace(/^http/, 'ws'))

/** O handshake fixo do binding anuncia pingInterval 25 s; sem ping o cliente cai em ~30 s. */
const PING_INTERVAL_MS = 20_000

type Connection = { io: ReturnType<typeof toSocketIo>; close: () => void; userId: string | null }
const connections = new Set<Connection>()

function resolveUser(url: URL): string | null {
  const token = url.searchParams.get('token')
  if (!token) return null
  return withDb(({ db, now }) => db.sessions.find((s) => s.accessToken === token && s.accessExpiresAt > now)?.userId ?? null)
}

export const socketHandler = link.addEventListener('connection', (connection) => {
  // Sem rede: recusa a conexão; o socket.io-client segue tentando com backoff.
  if (hasScenario('offline')) {
    connection.client.close()
    return
  }
  const io = toSocketIo(connection)
  const entry: Connection = { io, close: () => { connection.client.close() }, userId: resolveUser(connection.client.url) }
  connections.add(entry)

  const ping = setInterval(() => { connection.client.send('2') }, PING_INTERVAL_MS)
  connection.client.addEventListener('close', () => {
    clearInterval(ping)
    connections.delete(entry)
  })
})

/**
 * Entrega um evento às conexões elegíveis: `nft.updated` é público;
 * `order.updated` vai só para conexões autenticadas como o dono do pedido.
 */
export function deliver(event: RealtimeEvent) {
  for (const conn of connections) {
    if (event.type === 'order.updated' && conn.userId !== event.payload.userId) continue
    conn.io.client.emit(event.type, event)
  }
}

/** Derruba todas as conexões (simula queda); o cliente reconecta sozinho. */
export function dropConnections() {
  for (const conn of [...connections]) conn.close()
}
