import { HttpResponse, type HttpResponseResolver, type PathParams } from 'msw'
import type { z } from 'zod'
import type { ErrorCode } from '@/contracts/errors'
import { guestOwner, userOwner, type Tx } from '../db'
import { hasScenario, networkDelay } from '../scenarios'

export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export const ACCESS_TTL_MS = 15 * 60_000
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60_000

export function apiError(status: number, code: ErrorCode, message: string, extra?: { fields?: Record<string, string>; details?: unknown }) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status })
}

/** Resultado de validação/autorização: dado ou a resposta de erro pronta. */
export type Result<T> = { ok: true; value: T } | { ok: false; response: Response }

export async function parseBody<S extends z.ZodType>(schema: S, request: Request): Promise<Result<z.infer<S>>> {
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
 * offline (erro de rede), 503 em leituras e latência determinística.
 */
export function route<P extends PathParams>(resolver: HttpResponseResolver<P>): HttpResponseResolver<P> {
  return async (info) => {
    if (hasScenario('offline')) return HttpResponse.error()
    await networkDelay(info.request)
    if (info.request.method === 'GET' && hasScenario('server-error')) {
      return apiError(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível')
    }
    return resolver(info)
  }
}
