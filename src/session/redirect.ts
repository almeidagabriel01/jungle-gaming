import { z } from 'zod'

/** Só caminhos internos (`/algo`), nunca `//host` ou URL absoluta: evita open redirect. */
export const safeRedirect = z
  .string()
  .regex(/^\/(?![/\\])/)
  .optional()
  .catch(undefined)

export const AuthSearch = z.object({
  redirect: safeRedirect,
  reason: z.enum(['expired']).optional().catch(undefined),
})
