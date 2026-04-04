# Tool Page Architecture

This document describes the component architecture for tool pages. All tool pages share a unified layout, SEO structure, and ad placement pattern through reusable components.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  ToolPageLayout                         │
│  ┌─────────────────────────────────┐    │
│  │  RelatedTools (auto-included)   │    │
│  ├─────────────────────────────────┤    │
│  │  Title + Subtitle (from props)  │    │
│  ├─────────────────────────────────┤    │
│  │  #workspace slot                │    │
│  │  (tool-specific UI goes here)   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  SeoSections (from seoSections prop)    │
│  ┌─────────────────────────────────┐    │
│  │  API Promotion (shared)         │    │
│  │  ── AdUnit ──                   │    │
│  │  Section 1 (text/steps/etc)     │    │
│  │  ── AdUnit ──                   │    │
│  │  Section 2                      │    │
│  │  ── AdUnit ──                   │    │
│  │  ...                            │    │
│  │  FAQ (accordion)                │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `app/components/ToolPageLayout.vue` | Page skeleton: RelatedTools + title + workspace slot + SeoSections |
| `app/components/SeoSections.vue` | Data-driven SEO content renderer with ad interleaving |
| `app/components/RelatedTools.vue` | Related tools navigation bar |
| `app/components/AdUnit.vue` | Reusable AdSense ad unit |
| `app/types/seo.ts` | `SeoSection` TypeScript interface |

## Usage

### Minimal Tool Page

```vue
<script setup lang="ts">
import type { SeoSection } from '~/types/seo'

const { t } = useI18n()

const seoSections: SeoSection[] = [
  {
    type: 'text',
    titleKey: 'myTool.seo.whatIs.title',
    contentKeys: ['myTool.seo.whatIs.content'],
    adSlot: 'AD_SLOT_ID'   // optional, ad before this section
  },
  {
    type: 'faq',
    titleKey: 'myTool.seo.faq.title',
    itemKeys: ['myTool.seo.faq.items.q1', 'myTool.seo.faq.items.q2']
  }
]
</script>

<template>
  <ToolPageLayout
    title-key="myTool.title"
    subtitle-key="myTool.subtitle"
    prefix="myTool"
    :seo-sections="seoSections"
  >
    <template #workspace>
      <!-- Your tool UI here -->
    </template>
  </ToolPageLayout>
</template>
```

## ToolPageLayout Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `titleKey` | `string` | Yes | i18n key for the page H1 title |
| `subtitleKey` | `string` | Yes | i18n key for the subtitle text |
| `prefix` | `string` | Yes | i18n key prefix for SEO content (e.g., `"gifToSprite"`) |
| `seoSections` | `SeoSection[]` | Yes | Array defining SEO content sections |
| `apiHighlightKeys` | `string[]` | No | Override API highlight feature keys (default: `['endpoints', 'input', 'params', 'limit', 'formats', 'response']`) |

### Built-in Behavior

- Automatically sets `useSeoMeta()` for title and description
- Renders `<RelatedTools />` above the title
- Passes `seoSections` to `<SeoSections />` for rendering

### Slots

| Slot | Description |
|------|-------------|
| `#workspace` | The tool's interactive UI (upload area, options, results, etc.) |

## SeoSection Type

Defined in `app/types/seo.ts`:

```ts
export interface SeoSection {
  type: 'text' | 'steps' | 'features' | 'useCases' | 'faq'
  titleKey: string
  contentKeys?: string[]   // for type: 'text'
  stepKeys?: string[]      // for type: 'steps'
  itemKeys?: string[]      // for type: 'features', 'useCases', 'faq'
  adSlot?: string          // AdSense slot ID, renders AdUnit before this section
}
```

## Section Types

### `text` — Plain text section (e.g., "What Is...")

Renders a title and one or more paragraphs.

```ts
{
  type: 'text',
  titleKey: 'myTool.seo.whatIs.title',
  contentKeys: [
    'myTool.seo.whatIs.content',
    'myTool.seo.whatIs.content2'
  ],
  adSlot: 'AD_SLOT_ID'
}
```

**Required i18n keys:**
```json
{
  "myTool": {
    "seo": {
      "whatIs": {
        "title": "What Is ...?",
        "content": "First paragraph...",
        "content2": "Second paragraph..."
      }
    }
  }
}
```

### `steps` — Numbered steps (e.g., "How to...")

Renders a title with numbered sub-sections, each having its own title and content.

```ts
{
  type: 'steps',
  titleKey: 'myTool.seo.howTo.title',
  stepKeys: [
    'myTool.seo.howTo.step1',
    'myTool.seo.howTo.step2',
    'myTool.seo.howTo.step3'
  ]
}
```

**Required i18n keys:** each step needs `.title` and `.content`:
```json
{
  "howTo": {
    "title": "How to Use This Tool",
    "step1": { "title": "1. Upload", "content": "..." },
    "step2": { "title": "2. Configure", "content": "..." },
    "step3": { "title": "3. Download", "content": "..." }
  }
}
```

### `features` — Card grid (e.g., "Features")

Renders a 2-column grid of feature cards.

```ts
{
  type: 'features',
  titleKey: 'myTool.seo.features.title',
  itemKeys: [
    'myTool.seo.features.items.feature1',
    'myTool.seo.features.items.feature2'
  ]
}
```

**Required i18n keys:** each item needs `.title` and `.content`:
```json
{
  "features": {
    "title": "Features",
    "items": {
      "feature1": { "title": "Fast", "content": "..." },
      "feature2": { "title": "Secure", "content": "..." }
    }
  }
}
```

### `useCases` — Vertical list (e.g., "Use Cases")

Same structure as `features` but renders as a vertical list instead of a grid.

```ts
{
  type: 'useCases',
  titleKey: 'myTool.seo.useCases.title',
  itemKeys: [
    'myTool.seo.useCases.items.case1',
    'myTool.seo.useCases.items.case2'
  ]
}
```

### `faq` — Accordion (e.g., "FAQ")

Renders a collapsible FAQ using Nuxt UI's `<UAccordion>`.

```ts
{
  type: 'faq',
  titleKey: 'myTool.seo.faq.title',
  itemKeys: [
    'myTool.seo.faq.items.q1',
    'myTool.seo.faq.items.q2'
  ]
}
```

**Required i18n keys:** each item needs `.q` and `.a`:
```json
{
  "faq": {
    "title": "Frequently Asked Questions",
    "items": {
      "q1": { "q": "Is it free?", "a": "Yes..." },
      "q2": { "q": "What formats?", "a": "GIF only..." }
    }
  }
}
```

## API Promotion Section

The API promotion section is **automatically included** by `SeoSections` at the top, before any custom sections. It reads content from `{prefix}.seo.api.*` keys.

**Required i18n keys for every tool:**
```json
{
  "myTool": {
    "seo": {
      "api": {
        "title": "Use the API",
        "content": "First paragraph...",
        "content2": "Second paragraph...",
        "cta": "View API on RapidAPI",
        "tutorial": "Read the Full Tutorial",
        "features": {
          "title": "API Highlights",
          "endpoints": "...",
          "input": "...",
          "params": "...",
          "limit": "...",
          "formats": "...",
          "response": "..."
        }
      }
    }
  }
}
```

If a tool uses different API highlight keys, pass `apiHighlightKeys`:

```vue
<ToolPageLayout
  ...
  :api-highlight-keys="['speed', 'formats', 'security']"
/>
```

## Ad Slot Integration

Ads are inserted **before** each section that has an `adSlot` property. The `SeoSections` component renders `<AdUnit>` automatically:

```ts
// This section will have an ad rendered before it
{ type: 'text', titleKey: '...', contentKeys: [...], adSlot: '7383145112' }

// This section will NOT have an ad before it
{ type: 'faq', titleKey: '...', itemKeys: [...] }
```

## RelatedTools Component

`RelatedTools.vue` renders a horizontal bar of tool links. The current page is automatically highlighted.

### Adding a new tool link

Edit `app/components/RelatedTools.vue`:

```ts
const tools = [
  { key: 'gifToSprite', icon: 'i-lucide-grid-3x3', to: '/tools/gif-to-sprite' },
  { key: 'framesToGif', icon: 'i-lucide-film', to: '/tools/frames-to-gif' },
  // Add new tool here:
  { key: 'newTool', icon: 'i-lucide-some-icon', to: '/tools/new-tool' }
]
```

And add the i18n key in both locale files under `relatedTools`:

```json
{
  "relatedTools": {
    "newTool": "New Tool Label"
  }
}
```

## Complete Example: gif-to-sprite

The reference implementation in `app/pages/tools/gif-to-sprite.vue`:

```vue
<script setup lang="ts">
const { t } = useI18n()

const seoSections = [
  {
    type: 'text' as const,
    titleKey: 'gifToSprite.seo.whatIs.title',
    contentKeys: ['gifToSprite.seo.whatIs.content', 'gifToSprite.seo.whatIs.content2'],
    adSlot: '7383145112'
  },
  {
    type: 'text' as const,
    titleKey: 'gifToSprite.seo.whatIsFrames.title',
    contentKeys: ['gifToSprite.seo.whatIsFrames.content', 'gifToSprite.seo.whatIsFrames.content2'],
    adSlot: '3210094258'
  },
  {
    type: 'steps' as const,
    titleKey: 'gifToSprite.seo.howTo.title',
    stepKeys: [
      'gifToSprite.seo.howTo.step1', 'gifToSprite.seo.howTo.step2',
      'gifToSprite.seo.howTo.step3', 'gifToSprite.seo.howTo.step4'
    ],
    adSlot: '8504655099'
  },
  {
    type: 'features' as const,
    titleKey: 'gifToSprite.seo.features.title',
    itemKeys: [
      'gifToSprite.seo.features.items.spritesheet',
      'gifToSprite.seo.features.items.frames',
      // ... more feature keys
    ],
    adSlot: '5316113927'
  },
  {
    type: 'useCases' as const,
    titleKey: 'gifToSprite.seo.useCases.title',
    itemKeys: [
      'gifToSprite.seo.useCases.items.gamedev',
      'gifToSprite.seo.useCases.items.css',
      // ... more use case keys
    ],
    adSlot: '3438159116'
  },
  {
    type: 'faq' as const,
    titleKey: 'gifToSprite.seo.faq.title',
    itemKeys: [
      'gifToSprite.seo.faq.items.formats',
      'gifToSprite.seo.faq.items.maxSize',
      // ... more FAQ keys
    ],
    adSlot: '7191573428'
  }
]

// ... tool-specific logic (state, convert, download, etc.)
</script>

<template>
  <ToolPageLayout
    title-key="gifToSprite.title"
    subtitle-key="gifToSprite.subtitle"
    prefix="gifToSprite"
    :seo-sections="seoSections"
  >
    <template #workspace>
      <!-- Mode selector, upload zone, options, results, etc. -->
    </template>
  </ToolPageLayout>

  <!-- Usage limiter modal (tool-specific) -->
  <UModal v-model:open="showAdModal">
    ...
  </UModal>
</template>
```

## Checklist for New Tool Pages

1. **Create tool page** at `app/pages/tools/my-tool.vue`
2. **Define `seoSections`** array with section configs
3. **Wrap in `<ToolPageLayout>`** with correct props
4. **Put tool UI** in `#workspace` slot
5. **Add i18n keys** in all locale files:
   - `myTool.title`, `myTool.subtitle`
   - `myTool.seo.api.*` (API promotion)
   - `myTool.seo.*` (all section content)
6. **Add to `RelatedTools.vue`** tools array
7. **Add to homepage** `app/pages/index.vue` tool cards
8. **Create server API proxy** in `server/api/`
9. **Create AdSense ad slots** and add slot IDs to `seoSections[].adSlot`
