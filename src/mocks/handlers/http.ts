import { delay, HttpResponse, type HttpResponseResolver, type PathParams } from 'msw'
import type { z } from 'zod'
import type { ErrorCode } from '@/contracts/errors'
import { guestOwner, userOwner, withDb, type Tx } from '../db'
import { hasScenario, networkDelay } from '../scenarios'

export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export const ACCESS_TTL_MS = 15 * 60_000
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60_000

export function apiError(status: number, code: ErrorCode, message: string, extra?: { fields?: Record<string, string>; details?: unknown }) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status })
}

/** Resultado de validação/autorização: dado ou a resposta de erro pronta. */
export type Result<T> = { ok: true; value: T } | { ok: false; response: Response }

/** Checagem de identidade de uma rota: `authenticate` (conta) ou `resolveOwner` (conta ou visitante). */
export type Guard = (tx: Tx, request: Request) => Result<string>

/**
 * Lê e valida o corpo. A identidade vem antes (§5): sessão inválida com corpo inválido responde 401, não 422.
 * O `guard` é obrigatório para que nenhuma rota protegida valide o corpo sem autenticar; rotas abertas passam `'public'`.
 */
export async function parseBody<S extends z.ZodType>(schema: S, request: Request, guard: Guard | 'public'): Promise<Result<z.infer<S>>> {
  if (guard !== 'public') {
    const identity = withDb((tx) => guard(tx, request))
    if (!identity.ok) return identity
  }
  const raw: unknown = await request.json().catch(() => null)
  const parsed = schema.safeParse(raw)
  if (parsed.success) return { ok: true, value: parsed.data }
  const fields: Record<string, string> = {}
  for (const issue of parsed.error.issues) fields[issue.path.join('.') || '_'] ??= issue.message
  return { ok: false, response: apiError(422, 'VALIDATION', 'Dados inválidos', { fields }) }
}

const bearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null

/** Exige sessão válida. Token presente mas vencido → 401 SESSION_EXPIRED (o cliente tenta refresh). */
export function authenticate(tx: Tx, request: Request): Result<string> {
  const token = bearer(request)
  if (!token) return { ok: false, response: apiError(401, 'UNAUTHENTICATED', 'Faça login para continuar') }
  const session = tx.db.sessions.find((s) => s.accessToken === token)
  if (!session || session.accessExpiresAt <= tx.now || hasScenario('session-expired')) {
    return { ok: false, response: apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou') }
  }
  return { ok: true, value: session.userId }
}

/**
 * Dono do carrinho/cotação: o usuário autenticado ou o visitante (`X-Guest-Id`).
 * Se há token, ele manda: nunca cai para o carrinho de visitante com sessão vencida.
 */
export function resolveOwner(tx: Tx, request: Request): Result<string> {
  if (bearer(request)) {
    const auth = authenticate(tx, request)
    return auth.ok ? { ok: true, value: userOwner(auth.value) } : auth
  }
  const guestId = request.headers.get('x-guest-id')
  if (guestId && /^[\w-]{8,64}$/.test(guestId)) return { ok: true, value: guestOwner(guestId) }
  return { ok: false, response: apiError(401, 'UNAUTHENTICATED', 'Identificação do visitante ausente') }
}

/**
 * Envolve um resolver com as condições de rede do cenário ativo:
 * offline (erro de rede), 503 em leituras, leitura sem resposta, falha nas escritas e latência determinística.
 */
export function route<P extends PathParams>(resolver: HttpResponseResolver<P>): HttpResponseResolver<P> {
  return async (info) => {
    if (hasScenario('offline')) return HttpResponse.error()
    await networkDelay(info.request)
    const read = info.request.method === 'GET'
    if (read && hasScenario('server-error')) {
      return apiError(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível')
    }
    if (read && hasScenario('read-timeout')) await delay('infinite')
    // Refresh e logout são manutenção da sessão, não escritas do usuário.
    if (!read && !/\/auth\/(refresh|logout)$/.test(new URL(info.request.url).pathname)) {
      if (hasScenario('write-server-error')) return apiError(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível')
      if (hasScenario('write-client-error')) return apiError(403, 'FORBIDDEN', 'O servidor recusou a operação')
    }
    return resolver(info)
  }
}
