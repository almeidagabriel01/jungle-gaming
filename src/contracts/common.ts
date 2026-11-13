import { z } from 'zod'

/** ETH sempre trafega como string decimal (até 18 casas), nunca como number. */
export const Eth = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Valor ETH inválido')
export type Eth = z.infer<typeof Eth>

export const Id = z.string().min(1)

export const Network = z.enum(['ethereum', 'polygon', 'solana'])
export type Network = z.infer<typeof Network>

export const IsoDate = z.iso.datetime()

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.int().min(1),
    pageSize: z.int().min(1),
    total: z.int().min(0),
    totalPages: z.int().min(0),
  })
