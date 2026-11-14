import { z } from 'zod'
import { Id, IsoDate } from './common'
import { NftImage } from './nft'

/** Artigo do "Diário da Cunhagem" (conteúdo editorial do início). */
export const Article = z.object({
  id: Id,
  title: z.string(),
  excerpt: z.string(),
  publishedAt: IsoDate,
  readingMinutes: z.int().min(1),
  image: NftImage,
})
export type Article = z.infer<typeof Article>

export const ArticleList = z.object({ items: z.array(Article) })
