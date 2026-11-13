import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'

/**
 * Política de cache (documentada no ARCHITECTURE.md):
 * - retry só para falhas transitórias (rede, timeout, 5xx), até 2 vezes com backoff;
 * - mutations nunca repetem sozinhas (pedido usa idempotência explícita);
 * - staleTime curto por padrão; catálogo sobrescreve com 30 s nos próprios hooks.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => error instanceof ApiError && error.transient && error.code !== 'CANCELED' && failureCount < 2,
      retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3_000),
    },
    mutations: { retry: false },
  },
})
