import { defineCollection, z } from '@nuxt/content'

export const collections = {
  blog: defineCollection({
    type: 'page',
    source: '**/*.md',
    schema: z.object({
      title: z.string(),
      description: z.string(),
      date: z.string(),
      readingTime: z.number(),
      tag: z.enum(['tutorial', 'guide', 'news'])
    })
  })
}
