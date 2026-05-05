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
    slug: 'gif-to-spritesheet-unity-godot',
    titleKey: 'blog.posts.gifToSpritesheetUnityGodot.title',
    descriptionKey: 'blog.posts.gifToSpritesheetUnityGodot.description',
    date: '2026-05-05',
    readingTime: 8,
    tag: 'tutorial'
  }
]

export function useBlogPosts() {
  return { posts: POSTS }
}
