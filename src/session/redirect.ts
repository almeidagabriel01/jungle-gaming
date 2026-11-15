import { z } from 'zod'

/**
 * Só caminhos internos (`/algo`), nunca `//host` ou URL absoluta: evita open redirect.
 * A âncora (`#mercado`) é descartada: voltar do login é navegação nova e abre a tela no topo.
 */
export const safeRedirect = z
  .string()
  .regex(/^\/(?![/\\])/)
  .transform((path) => path.split('#', 1)[0]!)
  .optional()
  .catch(undefined)

export const AuthSearch = z.object({
  redirect: safeRedirect,
  reason: z.enum(['expired']).optional().catch(undefined),
})
