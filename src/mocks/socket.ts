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

/** `pending`: eventos de antes do CONNECT do cliente (o binding confirma a conexão antes de ler o `auth`). */
type Connection = { io: ReturnType<typeof toSocketIo>; close: () => void; userId: string | null; pending: RealtimeEvent[] | null }
const connections = new Set<Connection>()

/**
 * Usuário do handshake: o binding 0.2 confirma o CONNECT sozinho e não expõe o `auth`, então o
 * servidor lê o pacote CONNECT do cliente (`40{"token":...}`). Token ausente, inválido ou vencido → anônimo.
 */
function resolveUser(connectPacket: string): string | null {
  let token: unknown
  try {
    token = (JSON.parse(connectPacket.slice(2) || '{}') as { token?: unknown }).token
  } catch {
    return null
  }
  if (typeof token !== 'string') return null
  return withDb(({ db, now }) => db.sessions.find((s) => s.accessToken === token && s.accessExpiresAt > now)?.userId ?? null)
}

export const socketHandler = link.addEventListener('connection', (connection) => {
  // Sem rede: recusa a conexão; o socket.io-client segue tentando com backoff.
  if (hasScenario('offline')) {
    connection.client.close()
    return
  }
  const io = toSocketIo(connection)
  const entry: Connection = { io, close: () => { connection.client.close() }, userId: null, pending: [] }
  connections.add(entry)
  // CONNECT do namespace `/` (validado a cada conexão, inclusive reconexões). Só então a conexão
  // tem dono: o que chegou antes é entregue agora, já filtrado pelo usuário resolvido.
  connection.client.addEventListener('message', (event) => {
    if (typeof event.data !== 'string' || !event.data.startsWith('40') || !entry.pending) return
    entry.userId = resolveUser(event.data)
    const queued = entry.pending
    entry.pending = null
    for (const queuedEvent of queued) send(entry, queuedEvent)
  })

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
    if (conn.pending) conn.pending.push(event)
    else send(conn, event)
  }
}

function send(conn: Connection, event: RealtimeEvent) {
  if (event.type === 'order.updated' && conn.userId !== event.payload.userId) return
  conn.io.client.emit(event.type, event)
}

/** Derruba todas as conexões (simula queda); o cliente reconecta sozinho. */
export function dropConnections() {
  for (const conn of [...connections]) conn.close()
}
