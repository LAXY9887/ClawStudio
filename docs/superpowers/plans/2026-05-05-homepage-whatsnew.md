# Homepage "What's New" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-bleed `UPageHero` on the homepage with a compact H1 + subtitle, and add a "What's New" card section above the existing tool groups.

**Architecture:** New `useWhatsNew.ts` composable holds static entry data (same pattern as `useTools.ts`). `index.vue` is rewritten to remove `UPageHero`, add the compact header and What's New grid, and keep the tool groups unchanged. i18n keys for the new section go in `en.json` + `zh-TW.json` only.

**Tech Stack:** Nuxt 4, Vue 3, Nuxt UI v3, `@nuxtjs/i18n`, pnpm

**Branch:** `feat/content-pages`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `app/composables/useWhatsNew.ts` | Static What's New entry array |
| Modify | `app/pages/index.vue` | Remove `UPageHero`, add compact H1 + What's New grid |
| Modify | `i18n/locales/en.json` | Add `home.subtitle` + `home.whatsNew.*` keys |
| Modify | `i18n/locales/zh-TW.json` | Same keys in Traditional Chinese |

---

## Task 1: useWhatsNew Composable

**Files:**
- Create: `app/composables/useWhatsNew.ts`

- [ ] **Step 1: Create the file**

```ts
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
    to: '/blog/gif-to-spritesheet-unity-godot',
    date: '2026-05-05',
    isNew: true
  }
]

export function useWhatsNew() {
  return { entries: ENTRIES }
}
```

- [ ] **Step 2: Run typecheck to verify no type errors**

Run: `pnpm typecheck`
Expected: exits 0 with no errors

- [ ] **Step 3: Commit**

```bash
git add app/composables/useWhatsNew.ts
git commit -m "feat: add useWhatsNew composable with MCP + blog entries"
```

---

## Task 2: Add i18n Keys

**Files:**
- Modify: `i18n/locales/en.json` — add `home.subtitle` and `home.whatsNew.*`
- Modify: `i18n/locales/zh-TW.json` — same keys in Traditional Chinese

- [ ] **Step 1: Add keys to `i18n/locales/en.json`**

In `en.json`, find the `"home"` object. It currently starts with:
```json
"home": {
  "title": "Free Online Dev Tools",
  "tools": {
```

Replace that opening with:
```json
"home": {
  "title": "Free Online Dev Tools",
  "subtitle": "A growing collection of free browser-based tools for game developers and designers.",
  "whatsNew": {
    "heading": "What's New",
    "items": {
      "spritesheetForgeMcp": {
        "title": "Spritesheet Forge MCP Server",
        "description": "All 8 Spritesheet Forge tools are now available as an MCP server for AI coding agents — use them from Claude Desktop, VS Code, and more."
      },
      "gifToSpriteBlogPost": {
        "title": "Blog: Import GIF Spritesheet into Unity and Godot",
        "description": "Step-by-step guide to importing your generated sprite sheets into both Unity and Godot Engine."
      }
    }
  },
  "tools": {
```

- [ ] **Step 2: Add keys to `i18n/locales/zh-TW.json`**

In `zh-TW.json`, find the `"home"` object. It currently starts with:
```json
"home": {
  "title": "免費線上開發工具",
  "tools": {
```

Replace that opening with:
```json
"home": {
  "title": "免費線上開發工具",
  "subtitle": "持續增長的免費瀏覽器工具集，專為遊戲開發者與設計師打造。",
  "whatsNew": {
    "heading": "最新消息",
    "items": {
      "spritesheetForgeMcp": {
        "title": "Spritesheet Forge MCP 伺服器",
        "description": "8 個 Spritesheet Forge 工具現已可透過 MCP 伺服器供 AI 編碼代理使用，支援 Claude Desktop、VS Code 等。"
      },
      "gifToSpriteBlogPost": {
        "title": "部落格：將 GIF Spritesheet 匯入 Unity 與 Godot",
        "description": "逐步指南，教你將生成的 Sprite Sheet 匯入 Unity 和 Godot Engine。"
      }
    }
  },
  "tools": {
```

- [ ] **Step 3: Run lint to verify no i18n violations**

Run: `pnpm lint`
Expected: exits 0 (no angle-bracket tags in new strings, no trailing commas)

- [ ] **Step 4: Commit**

```bash
git add i18n/locales/en.json i18n/locales/zh-TW.json
git commit -m "feat: add home.subtitle and home.whatsNew i18n keys (en + zh-TW)"
```

---

## Task 3: Redesign index.vue

**Files:**
- Modify: `app/pages/index.vue`

The current file is 47 lines. Replace it entirely.

- [ ] **Step 1: Rewrite `app/pages/index.vue`**

```vue
<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { groups } = useTools()
const { entries } = useWhatsNew()

const TYPE_LABELS: Record<string, string> = {
  mcp: 'MCP',
  blog: 'Blog',
  tool: 'Tool'
}

const TYPE_COLORS: Record<string, 'primary' | 'info' | 'success'> = {
  mcp: 'primary',
  blog: 'info',
  tool: 'success'
}
</script>

<template>
  <UPageSection>
    <div class="space-y-12">
      <!-- Compact page header -->
      <div class="text-center space-y-2 pt-2">
        <h1 class="text-4xl font-bold tracking-tight">
          {{ t('home.title') }}
        </h1>
        <p class="text-muted text-lg">
          {{ t('home.subtitle') }}
        </p>
      </div>

      <!-- What's New -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-lucide-sparkles" class="text-xl text-primary" />
          <h2 class="text-xl font-semibold">
            {{ t('home.whatsNew.heading') }}
          </h2>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <NuxtLink
            v-for="entry in entries"
            :key="entry.key"
            :to="localePath(entry.to)"
            class="group block"
          >
            <UCard class="h-full transition-shadow group-hover:shadow-lg">
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <UBadge
                    :label="TYPE_LABELS[entry.type]"
                    :color="TYPE_COLORS[entry.type]"
                    variant="subtle"
                  />
                  <UBadge
                    v-if="entry.isNew"
                    label="New"
                    color="success"
                    variant="solid"
                    size="xs"
                  />
                </div>
                <div class="flex items-start gap-3">
                  <UIcon :name="entry.icon" class="text-2xl text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 class="font-semibold">
                      {{ t(`home.whatsNew.items.${entry.key}.title`) }}
                    </h3>
                    <p class="text-sm text-muted mt-1">
                      {{ t(`home.whatsNew.items.${entry.key}.description`) }}
                    </p>
                  </div>
                </div>
                <p class="text-xs text-muted">
                  {{ entry.date }}
                </p>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>

      <!-- Tool groups (unchanged) -->
      <section v-for="group in groups" :key="group.key">
        <div class="flex items-center gap-2 mb-4">
          <UIcon :name="group.icon" class="text-xl text-primary" />
          <h2 class="text-xl font-semibold">
            {{ t(`relatedTools.groups.${group.key}`) }}
          </h2>
          <span class="text-sm text-muted">· {{ group.tools.length }}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="tool in group.tools"
            :key="tool.key"
            :to="localePath(tool.to)"
            class="group block"
          >
            <UCard class="h-full transition-shadow group-hover:shadow-lg">
              <div class="flex items-start gap-4">
                <UIcon :name="tool.icon" class="text-3xl text-primary shrink-0 mt-1" />
                <div>
                  <h3 class="font-semibold text-lg">
                    {{ t(`home.tools.${tool.key}.title`) }}
                  </h3>
                  <p class="text-sm text-muted mt-1">
                    {{ t(`home.tools.${tool.key}.description`) }}
                  </p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>
    </div>
  </UPageSection>
</template>
```

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both exit 0

- [ ] **Step 3: Manually verify in browser**

Run: `pnpm dev`

Check:
- `/` loads without errors
- Compact H1 "Free Online Dev Tools" + subtitle visible at top
- "What's New" section shows 2 cards (MCP Server + Blog post)
- Each card has a type badge + "New" green badge
- Clicking MCP card navigates to `/mcp` (404 is fine until content-pages task executes)
- Clicking Blog card navigates to `/blog/gif-to-spritesheet-unity-godot` (404 is fine)
- All existing tool group cards still visible below

- [ ] **Step 4: Commit**

```bash
git add app/pages/index.vue
git commit -m "feat: replace UPageHero with compact header + What's New section on homepage"
```
