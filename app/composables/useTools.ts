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
      { key: 'heicToWebp', icon: 'i-lucide-smartphone', to: '/tools/heic-to-webp' },
      { key: 'jpgToHeic', icon: 'i-lucide-smartphone', to: '/tools/jpg-to-heic' },
      { key: 'pngToHeic', icon: 'i-lucide-smartphone', to: '/tools/png-to-heic' },
      { key: 'webpToHeic', icon: 'i-lucide-smartphone', to: '/tools/webp-to-heic' },
      { key: 'pngToJpg', icon: 'i-lucide-image', to: '/tools/png-to-jpg' },
      { key: 'jpgToPng', icon: 'i-lucide-image', to: '/tools/jpg-to-png' },
      { key: 'pngToWebp', icon: 'i-lucide-image', to: '/tools/png-to-webp' },
      { key: 'webpToPng', icon: 'i-lucide-image', to: '/tools/webp-to-png' },
      { key: 'jpgToWebp', icon: 'i-lucide-image', to: '/tools/jpg-to-webp' },
      { key: 'webpToJpg', icon: 'i-lucide-image', to: '/tools/webp-to-jpg' }
    ]
  },
  {
    key: 'avif',
    icon: 'i-lucide-zap',
    tools: [
      { key: 'pngToAvif', icon: 'i-lucide-zap', to: '/tools/png-to-avif' },
      { key: 'jpgToAvif', icon: 'i-lucide-zap', to: '/tools/jpg-to-avif' },
      { key: 'webpToAvif', icon: 'i-lucide-zap', to: '/tools/webp-to-avif' },
      { key: 'avifToPng', icon: 'i-lucide-zap', to: '/tools/avif-to-png' },
      { key: 'avifToJpg', icon: 'i-lucide-zap', to: '/tools/avif-to-jpg' },
      { key: 'avifToWebp', icon: 'i-lucide-zap', to: '/tools/avif-to-webp' }
    ]
  },
  {
    key: 'vector',
    icon: 'i-lucide-palette',
    tools: [
      { key: 'svgToPng', icon: 'i-lucide-palette', to: '/tools/svg-to-png' },
      { key: 'faviconGenerator', icon: 'i-lucide-package', to: '/tools/favicon-generator' }
    ]
  },
  {
    key: 'privacy',
    icon: 'i-lucide-shield-check',
    tools: [
      { key: 'exifRemover', icon: 'i-lucide-shield-check', to: '/tools/exif-remover' }
    ]
  },
  {
    key: 'imageEditing',
    icon: 'i-lucide-wand-sparkles',
    tools: [
      { key: 'imageEditor', icon: 'i-lucide-wand-sparkles', to: '/tools/image-editor' }
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
