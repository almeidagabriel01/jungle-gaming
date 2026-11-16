import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { AuthResponse } from '@/contracts/account'
import { ApiErrorBody, type ErrorCode } from '@/contracts/errors'
import { sessionStore } from '@/session/store'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
const TIMEOUT_MS = 10_000

/** Erro normalizado da API. `status 0` = falha de rede (`NETWORK`) ou timeout (`TIMEOUT`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED' | 'INVALID_RESPONSE',
    message: string,
    readonly fields: Record<string, string> = {},
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Falhas transitórias: vale tentar de novo (rede, timeout, 5xx). */
  get transient() {
    return this.status === 0 || this.status >= 500
  }
}

export const http = axios.create({ baseURL: API_URL })

/**
 * Timeout por `setTimeout` + `AbortController` (e não o `xhr.timeout` do Axios): é o mesmo relógio
 * da página, então `page.clock` controla o timeout nos testes. O sinal do chamador continua valendo.
 */
type TimedConfig = InternalAxiosRequestConfig & { _timer?: ReturnType<typeof setTimeout>; _timedOut?: boolean }

http.interceptors.request.use((config: TimedConfig) => {
  const timeout = new AbortController()
  config._timedOut = false
  config._timer = setTimeout(() => {
    config._timedOut = true
    timeout.abort()
  }, TIMEOUT_MS)
  const caller = config.signal as AbortSignal | undefined
  config.signal = caller ? AbortSignal.any([caller, timeout.signal]) : timeout.signal
  return config
})
const clearTimer = (config: TimedConfig | undefined) => clearTimeout(config?._timer)
http.interceptors.response.use(
  (res) => {
    clearTimer(res.config)
    return res
  },
  (error: unknown) => {
    if (error instanceof AxiosError) clearTimer(error.config)
    throw error
  },
)

http.interceptors.request.use((config) => {
  const session = sessionStore.get()
  if (session) config.headers.set('Authorization', `Bearer ${session.tokens.accessToken}`)
  else config.headers.set('X-Guest-Id', sessionStore.guestId())
  return config
})

/* ------------------------------------------------------------------
 * Refresh de sessão: uma única chamada compartilhada por todas as requests
 * que receberem 401 ao mesmo tempo. Falhou → sessão expirada.
 * ---------------------------------------------------------------- */

type RefreshResult = 'ok' | 'expired' | 'transient'
let refreshing: Promise<RefreshResult> | null = null
let onExpired: () => void = () => undefined
export const setSessionExpiredHandler = (fn: () => void) => {
  onExpired = fn
}

/**
 * Requests concorrentes que recebem 401 dividem o mesmo refresh, e a expiração é tratada uma única vez
 * (um aviso, uma navegação). Sem sessão (já expirada ou encerrada), não há o que avisar de novo.
 */
export function refreshSession(): Promise<RefreshResult> {
  const used = sessionStore.get()?.tokens.refreshToken
  if (!used) return Promise.resolve('expired')
  refreshing ??= axios
    .post(`${API_URL}/auth/refresh`, { refreshToken: used }, { timeout: TIMEOUT_MS })
    .then((res): RefreshResult => {
      // Logout ou troca de conta durante o refresh: não regrava a sessão antiga.
      if (sessionStore.get()?.tokens.refreshToken !== used) return 'transient'
      sessionStore.set(AuthResponse.parse(res.data))
      return 'ok'
    })
    // Só a recusa do servidor encerra a sessão; rede/timeout/5xx devolvem o erro original.
    .catch((e: unknown): RefreshResult => (e instanceof AxiosError && (e.response?.status === 400 || e.response?.status === 401) ? 'expired' : 'transient'))
    .then((result) => {
      if (result === 'expired') onExpired()
      return result
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

http.interceptors.response.use(undefined, async (error: unknown) => {
  if (error instanceof AxiosError && error.response?.status === 401 && error.config) {
    const config = error.config as RetriableConfig
    if (config.headers.has('Authorization') && !config._retried) {
      config._retried = true
      const result = await refreshSession()
      if (result === 'ok') return http.request(config)
    }
  }
  throw toApiError(error)
})

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) {
    return (error.config as TimedConfig | undefined)?._timedOut
      ? new ApiError(0, 'TIMEOUT', 'O servidor demorou para responder')
      : new ApiError(0, 'CANCELED', 'Requisição cancelada')
  }
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError(0, 'TIMEOUT', 'O servidor demorou para responder')
    }
    if (!error.response) return new ApiError(0, 'NETWORK', 'Sem conexão com o servidor')
    const body = ApiErrorBody.safeParse(error.response.data)
    if (body.success) {
      const { code, message, fields, details } = body.data.error
      return new ApiError(error.response.status, code, message, fields, details)
    }
    return new ApiError(error.response.status, 'SERVICE_UNAVAILABLE', 'Erro inesperado do servidor')
  }
  return new ApiError(0, 'NETWORK', error instanceof Error ? error.message : 'Erro desconhecido')
}

/** Executa a request e valida a resposta pelo contrato: o transporte nunca vaza dado sem tipo. */
export async function request<S extends z.ZodType>(schema: S, config: AxiosRequestConfig): Promise<z.infer<S>> {
  const res = await http.request<unknown>(config)
  const parsed = schema.safeParse(res.data)
  if (!parsed.success) throw new ApiError(res.status, 'INVALID_RESPONSE', 'Resposta fora do contrato', {}, parsed.error.issues)
  return parsed.data
}

/** Para respostas sem corpo (204). */
export async function send(config: AxiosRequestConfig): Promise<void> {
  await http.request(config)
}
