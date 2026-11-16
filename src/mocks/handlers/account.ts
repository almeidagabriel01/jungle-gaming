import { http, HttpResponse } from 'msw'
import { AvatarBody, ChangePasswordBody, UpdateProfileBody, WalletBody, WalletConnectBody, type Wallet } from '@/contracts/account'
import { iso, nextId, withDb, type Db } from '../db'
import { hasScenario } from '../scenarios'
import { hashPassword, toUser } from './auth'
import { API, apiError, authenticate, parseBody, route } from './http'

const MAX_WALLETS = 2

const walletsOf = (db: Db, userId: string): Wallet[] =>
  db.wallets
    .filter((w) => w.userId === userId)
    .sort((a, b) => (a.role === b.role ? a.createdAt.localeCompare(b.createdAt) : a.role === 'primary' ? -1 : 1))
    .map(({ userId: _u, ...w }) => w)

/** Garante exatamente uma principal: promover uma rebaixa a anterior. */
function applyRole(db: Db, userId: string, walletId: string, role: Wallet['role']) {
  const mine = db.wallets.filter((w) => w.userId === userId)
  const target = mine.find((w) => w.id === walletId)!
  if (role === 'primary') {
    for (const w of mine) w.role = w.id === walletId ? 'primary' : 'secondary'
    return
  }
  target.role = 'secondary'
  if (!mine.some((w) => w.role === 'primary')) {
    const other = mine.find((w) => w.id !== walletId)
    if (other) other.role = 'primary'
    else target.role = 'primary'
  }
}

const duplicateAddress = (db: Db, userId: string, address: string, exceptId?: string) =>
  db.wallets.some((w) => w.userId === userId && w.id !== exceptId && w.address.toLowerCase() === address.toLowerCase())

export const accountHandlers = [
  http.get(
    `${API}/me/profile`,
    route(({ request }) =>
      withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        return HttpResponse.json(toUser(tx.db.users.find((u) => u.id === auth.value)!))
      }),
    ),
  ),

  http.patch(
    `${API}/me/profile`,
    route(async ({ request }) => {
      const body = await parseBody(UpdateProfileBody, request, authenticate)
      if (!body.ok) return body.response
      return withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        if (tx.db.users.some((u) => u.id !== auth.value && u.username === body.value.username)) {
          return apiError(409, 'USERNAME_TAKEN', 'Nome de usuário em uso', { fields: { username: 'Este nome de usuário já está em uso' } })
        }
        if (tx.db.users.some((u) => u.id !== auth.value && u.email === body.value.email)) {
          return apiError(409, 'EMAIL_TAKEN', 'E-mail já cadastrado', { fields: { email: 'Este e-mail já está em uso' } })
        }
        const user = tx.db.users.find((u) => u.id === auth.value)!
        Object.assign(user, body.value)
        return HttpResponse.json(toUser(user))
      })
    }),
  ),

  http.put(
    `${API}/me/avatar`,
    route(async ({ request }) => {
      const body = await parseBody(AvatarBody, request, authenticate)
      if (!body.ok) return body.response
      return withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        const user = tx.db.users.find((u) => u.id === auth.value)!
        user.avatarUrl = body.value.dataUrl
        return HttpResponse.json(toUser(user))
      })
    }),
  ),

  http.post(
    `${API}/me/password`,
    route(async ({ request }) => {
      const body = await parseBody(ChangePasswordBody, request, authenticate)
      if (!body.ok) return body.response
      const user = withDb((tx) => {
        const auth = authenticate(tx, request)
        return auth.ok ? tx.db.users.find((u) => u.id === auth.value) : auth.response
      })
      if (user instanceof Response) return user
      if (!user || (await hashPassword(user.salt, body.value.currentPassword)) !== user.passwordHash) {
        return apiError(422, 'WRONG_PASSWORD', 'Senha atual incorreta', { fields: { currentPassword: 'Senha atual incorreta' } })
      }
      const salt = crypto.randomUUID()
      const passwordHash = await hashPassword(salt, body.value.newPassword)
      withDb((tx) => {
        const target = tx.db.users.find((u) => u.id === user.id)
        if (target) Object.assign(target, { salt, passwordHash })
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    `${API}/me/wallets`,
    route(({ request }) =>
      withDb((tx) => {
        const auth = authenticate(tx, request)
        return auth.ok ? HttpResponse.json({ items: walletsOf(tx.db, auth.value) }) : auth.response
      }),
    ),
  ),

  http.post(
    `${API}/me/wallets`,
    route(async ({ request }) => {
      const body = await parseBody(WalletBody, request, authenticate)
      if (!body.ok) return body.response
      return withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        const userId = auth.value
        if (walletsOf(tx.db, userId).length >= MAX_WALLETS) {
          return apiError(409, 'WALLET_LIMIT', 'Limite de carteiras atingido (principal e secundária)')
        }
        if (duplicateAddress(tx.db, userId, body.value.address)) {
          return apiError(422, 'VALIDATION', 'Carteira já cadastrada', { fields: { address: 'Este endereço já está cadastrado' } })
        }
        const id = nextId(tx, 'wal')
        tx.db.wallets.push({ ...body.value, id, userId, createdAt: iso(tx.now) })
        applyRole(tx.db, userId, id, body.value.role)
        return HttpResponse.json({ items: walletsOf(tx.db, userId) }, { status: 201 })
      })
    }),
  ),

  http.patch<{ id: string }>(
    `${API}/me/wallets/:id`,
    route(async ({ request, params }) => {
      const body = await parseBody(WalletBody, request, authenticate)
      if (!body.ok) return body.response
      return withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        const userId = auth.value
        const wallet = tx.db.wallets.find((w) => w.id === params.id)
        if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada')
        if (wallet.userId !== userId) return apiError(403, 'FORBIDDEN', 'Carteira de outra conta')
        if (duplicateAddress(tx.db, userId, body.value.address, wallet.id)) {
          return apiError(422, 'VALIDATION', 'Carteira já cadastrada', { fields: { address: 'Este endereço já está cadastrado' } })
        }
        const { role, ...details } = body.value
        Object.assign(wallet, details)
        applyRole(tx.db, userId, wallet.id, role)
        return HttpResponse.json({ items: walletsOf(tx.db, userId) })
      })
    }),
  ),

  http.post<{ id: string }>(
    `${API}/me/wallets/:id/connection`,
    route(async ({ request, params }) => {
      const body = await parseBody(WalletConnectBody, request, authenticate)
      if (!body.ok) return body.response
      return withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        const wallet = tx.db.wallets.find((w) => w.id === params.id && w.userId === auth.value)
        if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada')
        if (hasScenario('wallet-rejected')) return apiError(409, 'WALLET_REJECTED', 'A conexão foi recusada na carteira')
        const connection = { walletId: wallet.id, network: body.value.network, connectedAt: iso(tx.now) }
        tx.db.walletConnections[auth.value] = connection
        return HttpResponse.json(connection)
      })
    }),
  ),

  http.delete<{ id: string }>(
    `${API}/me/wallets/:id/connection`,
    route(({ request, params }) =>
      withDb((tx) => {
        const auth = authenticate(tx, request)
        if (!auth.ok) return auth.response
        if (tx.db.walletConnections[auth.value]?.walletId === params.id) {
          tx.db.walletConnections = Object.fromEntries(Object.entries(tx.db.walletConnections).filter(([userId]) => userId !== auth.value))
        }
        return new HttpResponse(null, { status: 204 })
      }),
    ),
  ),
]
