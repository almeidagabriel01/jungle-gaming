import { http, HttpResponse } from 'msw'
import { LoginBody, RefreshBody, RegisterBody, type User } from '@/contracts/account'
import { nextId, withDb, type DbUser, type Tx } from '../db'
import { hasScenario } from '../scenarios'
import { ACCESS_TTL_MS, API, apiError, authenticate, parseBody, REFRESH_TTL_MS, route } from './http'

export async function hashPassword(salt: string, password: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const toUser = ({ passwordHash: _h, salt: _s, ...user }: DbUser): User => user

function createSession(tx: Tx, userId: string) {
  tx.db.sessions = tx.db.sessions.filter((s) => s.refreshExpiresAt > tx.now)
  const session = {
    userId,
    accessToken: `at_${crypto.randomUUID()}`,
    refreshToken: `rt_${crypto.randomUUID()}`,
    accessExpiresAt: tx.now + ACCESS_TTL_MS,
    refreshExpiresAt: tx.now + REFRESH_TTL_MS,
  }
  tx.db.sessions.push(session)
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: new Date(session.accessExpiresAt).toISOString(),
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const authHandlers = [
  http.post(
    `${API}/auth/register`,
    route(async ({ request }) => {
      const body = await parseBody(RegisterBody, request, 'public')
      if (!body.ok) return body.response
      const email = normalizeEmail(body.value.email)
      const salt = crypto.randomUUID()
      const passwordHash = await hashPassword(salt, body.value.password)

      return withDb((tx) => {
        const { username } = body.value
        const fields: Record<string, string> = {}
        if (hasScenario('register-conflict') || tx.db.users.some((u) => u.email === email)) fields.email = 'Este e-mail já está em uso'
        if (tx.db.users.some((u) => u.username === username)) fields.username = 'Este nome de usuário já está em uso'
        if (fields.email) return apiError(409, 'EMAIL_TAKEN', 'E-mail já cadastrado', { fields })
        if (fields.username) return apiError(409, 'USERNAME_TAKEN', 'Nome de usuário em uso', { fields })
        const user: DbUser = {
          id: nextId(tx, 'usr'),
          name: username,
          email,
          username,
          bio: '',
          ensName: '',
          walletLabel: '',
          avatarUrl: null,
          salt,
          passwordHash,
        }
        tx.db.users.push(user)
        return HttpResponse.json({ user: toUser(user), tokens: createSession(tx, user.id) }, { status: 201 })
      })
    }),
  ),

  http.post(
    `${API}/auth/login`,
    route(async ({ request }) => {
      const body = await parseBody(LoginBody, request, 'public')
      if (!body.ok) return body.response
      const email = normalizeEmail(body.value.email)
      const user = withDb(({ db }) => db.users.find((u) => u.email === email))
      const valid = user !== undefined && (await hashPassword(user.salt, body.value.password)) === user.passwordHash
      if (!valid) return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos')
      return withDb((tx) => HttpResponse.json({ user: toUser(user), tokens: createSession(tx, user.id) }))
    }),
  ),

  http.post(
    `${API}/auth/refresh`,
    route(async ({ request }) => {
      const body = await parseBody(RefreshBody, request, 'public')
      if (!body.ok) return body.response
      return withDb((tx) => {
        const session = tx.db.sessions.find((s) => s.refreshToken === body.value.refreshToken)
        const user = session && tx.db.users.find((u) => u.id === session.userId)
        if (!session || !user || session.refreshExpiresAt <= tx.now || hasScenario('session-expired')) {
          return apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
        }
        // Rotação: o refresh token usado deixa de valer.
        tx.db.sessions = tx.db.sessions.filter((s) => s !== session)
        return HttpResponse.json({ user: toUser(user), tokens: createSession(tx, user.id) })
      })
    }),
  ),

  http.get(
    `${API}/session`,
    route(({ request }) =>
      withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        const user = tx.db.users.find((u) => u.id === auth.value)
        if (!user) return apiError(401, 'UNAUTHENTICATED', 'Usuário inexistente')
        return HttpResponse.json({ user: toUser(user) })
      }),
    ),
  ),

  http.post(
    `${API}/auth/logout`,
    route(async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { refreshToken?: unknown }
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      withDb((tx) => {
        const ended = tx.db.sessions.filter((s) => s.accessToken === token || s.refreshToken === body.refreshToken)
        tx.db.sessions = tx.db.sessions.filter((s) => !ended.includes(s))
        // A conexão da carteira pertence à sessão do usuário: sair também desconecta.
        const userIds = new Set(ended.map((s) => s.userId))
        tx.db.walletConnections = Object.fromEntries(Object.entries(tx.db.walletConnections).filter(([userId]) => !userIds.has(userId)))
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
