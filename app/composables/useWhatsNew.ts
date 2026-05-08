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
    key: 'deployApiOnGcpCloudRun',
    type: 'blog',
    icon: 'i-lucide-book-open',
    to: '/blog/deploy-api-on-gcp-cloud-run',
    date: '2026-05-08',
    isNew: true
  }
]

export function useWhatsNew() {
  return { entries: ENTRIES }
}
