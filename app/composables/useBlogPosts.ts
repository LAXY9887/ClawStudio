// app/composables/useBlogPosts.ts
export interface BlogPost {
  slug: string
  titleKey: string
  descriptionKey: string
  date: string
  readingTime: number
  tag: 'tutorial' | 'guide' | 'news'
}

const POSTS: BlogPost[] = [
  {
    slug: 'spritesheet-forge-mcp-demo',
    titleKey: 'blog.posts.spritesheetForgeMcpDemo.title',
    descriptionKey: 'blog.posts.spritesheetForgeMcpDemo.description',
    date: '2026-05-05',
    readingTime: 6,
    tag: 'tutorial'
  }
]

export function useBlogPosts() {
  return { posts: POSTS }
}
