export interface Tool {
  key: string
  icon: string
  to: string
}

export interface ToolGroup {
  key: string
  icon: string
  tools: Tool[]
}

const GROUPS: ToolGroup[] = [
  {
    key: 'sprite',
    icon: 'i-lucide-layers',
    tools: [
      { key: 'gifToSprite', icon: 'i-lucide-grid-3x3', to: '/tools/gif-to-sprite' },
      { key: 'toGif', icon: 'i-lucide-film', to: '/tools/png-to-gif' },
      { key: 'pngToSpritesheet', icon: 'i-lucide-layout-grid', to: '/tools/png-to-spritesheet' },
      { key: 'pngTrim', icon: 'i-lucide-scissors', to: '/tools/png-trim' },
      { key: 'splitSpritesheet', icon: 'i-lucide-split', to: '/tools/split-spritesheet' }
    ]
  },
  {
    key: 'imageFormat',
    icon: 'i-lucide-image',
    tools: [
      { key: 'heicToJpg', icon: 'i-lucide-smartphone', to: '/tools/heic-to-jpg' },
      { key: 'heicToPng', icon: 'i-lucide-smartphone', to: '/tools/heic-to-png' },
      { key: 'pngToJpg', icon: 'i-lucide-image', to: '/tools/png-to-jpg' },
      { key: 'jpgToPng', icon: 'i-lucide-image', to: '/tools/jpg-to-png' },
      { key: 'pngToWebp', icon: 'i-lucide-image', to: '/tools/png-to-webp' },
      { key: 'webpToPng', icon: 'i-lucide-image', to: '/tools/webp-to-png' }
    ]
  },
  {
    key: 'vector',
    icon: 'i-lucide-palette',
    tools: [
      { key: 'svgToPng', icon: 'i-lucide-palette', to: '/tools/svg-to-png' },
      { key: 'faviconGenerator', icon: 'i-lucide-package', to: '/tools/favicon-generator' }
    ]
  }
]

export function useTools() {
  return {
    groups: GROUPS,
    allTools: GROUPS.flatMap(g => g.tools),
    totalCount: GROUPS.reduce((n, g) => n + g.tools.length, 0),
    findByPath: (path: string) => {
      for (const g of GROUPS) {
        const tool = g.tools.find(t => path.includes(t.to))
        if (tool) return { group: g, tool }
      }
      return null
    }
  }
}
