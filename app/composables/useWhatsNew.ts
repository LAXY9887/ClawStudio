// app/composables/useWhatsNew.ts
export interface WhatsNewEntry {
  key: string
  type: 'mcp' | 'blog' | 'tool'
  icon: string
  to: string
  date: string
  isNew: boolean
}

const ENTRIES: WhatsNewEntry[] = [
  {
    key: 'spritesheetForgeMcp',
    type: 'mcp',
    icon: 'i-lucide-server',
    to: '/mcp',
    date: '2026-05-05',
    isNew: true
  },
  {
    key: 'gifToSpriteBlogPost',
    type: 'blog',
    icon: 'i-lucide-book-open',
    to: '/blog/spritesheet-forge-mcp-demo',
    date: '2026-05-05',
    isNew: true
  },
  {
    key: 'buildingRemoteMcpServer',
    type: 'blog',
    icon: 'i-lucide-book-open',
    to: '/blog/building-remote-mcp-server',
    date: '2026-05-06',
    isNew: true
  }
]

export function useWhatsNew() {
  return { entries: ENTRIES }
}
