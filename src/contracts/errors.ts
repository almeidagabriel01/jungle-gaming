import { z } from 'zod'

export const ErrorCode = z.enum([
  'VALIDATION',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'NFT_NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'WRONG_PASSWORD',
  'INSUFFICIENT_AVAILABILITY',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'QUOTE_STALE',
  'QUOTE_NOT_PURCHASABLE',
  'IDEMPOTENCY_CONFLICT',
  'WALLET_LIMIT',
  'WALLET_REJECTED',
  'WALLET_NOT_CONNECTED',
  'SERVICE_UNAVAILABLE',
])
export type ErrorCode = z.infer<typeof ErrorCode>

export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    /** Erros por campo (nome do campo → mensagem). */
    fields: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBody>
