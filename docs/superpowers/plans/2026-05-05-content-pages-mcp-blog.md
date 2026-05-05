# Content Pages: /mcp Landing + /blog Infrastructure + First Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new pages — a marketing-oriented `/mcp` landing page for the Spritesheet Forge MCP server, a `/blog` index page, and the first blog post — plus update navigation to expose them.

**Architecture:** Static Vue pages following the existing `about.vue` pattern (`max-w-3xl mx-auto px-4 py-10`). Blog posts share a `BlogPostLayout.vue` wrapper (breadcrumb + header + content slot). Post metadata (slug, date, reading time) lives in `useBlogPosts.ts`. All SEO strings go in i18n; blog body content is written inline in the Vue template (English only for v1 — body text is too long for i18n JSON and CI blocks HTML tags in locale strings). Footer gets two new links. No new npm packages.

**Tech Stack:** Nuxt 4, Vue 3, Nuxt UI v3, `@nuxtjs/i18n`, pnpm

**Branch:** `feat/content-pages`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `app/components/BlogPostLayout.vue` | Shared wrapper: breadcrumb, title, date, reading time, content slot |
| Create | `app/composables/useBlogPosts.ts` | Post metadata array used by `/blog` index |
| Create | `app/pages/mcp.vue` | `/mcp` marketing page |
| Create | `app/pages/blog/index.vue` | `/blog` post listing |
| Create | `app/pages/blog/gif-to-spritesheet-unity-godot.vue` | First blog post |
| Modify | `app/app.vue` | Add Blog + MCP to footer |
| Modify | `i18n/locales/en.json` | Add `mcp.*`, `blog.*`, `footer.blog`, `footer.mcp` |
| Modify | `i18n/locales/zh-TW.json` | Same keys in Traditional Chinese |

---

## Task 1: BlogPostLayout Component

**Files:**
- Create: `app/components/BlogPostLayout.vue`

- [ ] **Step 1: Create the file**

```vue
<!-- app/components/BlogPostLayout.vue -->
<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

const props = defineProps<{
  titleKey: string
  descriptionKey: string
  date: string
  readingTime: number
}>()

useSeoMeta({
  title: () => t(props.titleKey),
  description: () => t(props.descriptionKey),
  ogTitle: () => t(props.titleKey),
  ogDescription: () => t(props.descriptionKey)
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10 space-y-8">
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-1.5 text-sm text-muted flex-wrap">
      <NuxtLink :to="localePath('/')" class="hover:text-primary">
        {{ t('nav.home') }}
      </NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="text-xs shrink-0" />
      <NuxtLink :to="localePath('/blog')" class="hover:text-primary">
        {{ t('nav.blog') }}
      </NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="text-xs shrink-0" />
      <span>{{ t(titleKey) }}</span>
    </nav>

    <!-- Post header -->
    <div class="space-y-3">
      <div class="flex items-center gap-3 text-sm text-muted">
        <time>{{ date }}</time>
        <span>·</span>
        <span>{{ readingTime }} min read</span>
      </div>
      <h1 class="text-3xl font-bold leading-tight">
        {{ t(titleKey) }}
      </h1>
      <p class="text-lg text-muted leading-relaxed">
        {{ t(descriptionKey) }}
      </p>
    </div>

    <UDivider />

    <!-- Content slot -->
    <div class="space-y-8">
      <slot name="content" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/BlogPostLayout.vue
git commit -m "feat: add BlogPostLayout component"
```

---

## Task 2: useBlogPosts Composable + i18n Keys

**Files:**
- Create: `app/composables/useBlogPosts.ts`
- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/zh-TW.json`

- [ ] **Step 1: Add i18n keys to `en.json`**

Add the following top-level block before `"error"`. Also add `"blog"` and `"mcp"` to the `"nav"` block, and `"blog"` + `"mcp"` to the `"footer"` block.

In `"nav"` (currently has `"home"` and `"tools"`), add:
```json
"blog": "Blog",
"mcp": "MCP"
```

In `"footer"` (currently has `"copyright"`, `"terms"`, `"privacy"`, `"contact"`, `"about"`), add:
```json
"blog": "Blog",
"mcp": "MCP Server"
```

Add new top-level key `"blog"` alongside existing top-level keys:
```json
"blog": {
  "seoTitle": "Blog — ClawStudiouo",
  "seoDescription": "Tutorials, guides, and workflows for game developers and designers using ClawStudiouo tools.",
  "title": "Blog",
  "subtitle": "Tutorials and guides for game developers and designers.",
  "posts": {
    "gifToSpritesheetUnityGodot": {
      "title": "GIF to Spritesheet for Unity & Godot",
      "description": "A complete workflow guide: convert animated GIFs into sprite sheets optimized for Unity and Godot game engines.",
      "date": "2026-05-05"
    }
  }
}
```

Add new top-level key `"mcp"`:
```json
"mcp": {
  "seoTitle": "Spritesheet Forge MCP Server — ClawStudiouo",
  "seoDescription": "Use Claude AI to convert GIFs, pack sprites, and generate texture atlases through natural language commands — no code required.",
  "hero": {
    "title": "Spritesheet Forge MCP Server",
    "subtitle": "Let Claude handle your spritesheet workflows. 8 tools. 100 free operations per month. GitHub authentication.",
    "ctaGitHub": "View on GitHub",
    "ctaDocs": "Full Documentation"
  },
  "quickStart": {
    "title": "Quick Start",
    "endpoint": "MCP Endpoint",
    "claudeDesktop": {
      "title": "Claude Desktop",
      "description": "Add this to your claude_desktop_config.json:"
    },
    "claudeCode": {
      "title": "Claude Code CLI",
      "description": "Run this command once in your terminal:"
    },
    "auth": "Authentication uses GitHub OAuth 2.1. Your MCP client will open a browser login on first use. Tokens last 30 days."
  },
  "tools": {
    "title": "8 Tools Available",
    "gifToSpritesheet": {
      "title": "gif_to_spritesheet",
      "description": "Convert an animated GIF into a PNG spritesheet grid. Optional background removal."
    },
    "gifToFrames": {
      "title": "gif_to_frames",
      "description": "Extract all frames from a GIF as individual PNGs, returned as a ZIP archive."
    },
    "pngToSpritesheet": {
      "title": "png_to_spritesheet",
      "description": "Pack multiple PNGs into one spritesheet. Layouts: grid, horizontal, vertical, packed (bin-pack). Supports TexturePacker-compatible atlas JSON."
    },
    "splitSpritesheet": {
      "title": "split_spritesheet",
      "description": "Split a spritesheet into individual frames. Optionally output atlas JSON or CSS metadata."
    },
    "spritesheetToAnimation": {
      "title": "spritesheet_to_animation",
      "description": "Convert a spritesheet PNG back to an animated GIF or WebP."
    },
    "framesToAnimation": {
      "title": "frames_to_animation",
      "description": "Assemble a PNG sequence into an animated GIF or WebP."
    },
    "trimPng": {
      "title": "trim_png",
      "description": "Remove transparent edges from PNG files. Supports threshold and padding control."
    },
    "serverInfo": {
      "title": "server_info",
      "description": "Returns runtime config: upload URL, file size limits, TTL, and encoding rules. Call this first in multi-step workflows."
    }
  },
  "limits": {
    "title": "Free Monthly Quota",
    "ops": "100 operations / GitHub account / month",
    "fileSize": "Max file size: 20 MB per file",
    "ttl": "Output URLs expire after 1 hour",
    "reset": "Quota resets on the 1st of each month"
  }
}
```

- [ ] **Step 2: Add i18n keys to `zh-TW.json`**

Add the same structure in Traditional Chinese. Find the same insertion points (before `"error"`, in `"nav"`, in `"footer"`).

In `"nav"`, add:
```json
"blog": "部落格",
"mcp": "MCP"
```

In `"footer"`, add:
```json
"blog": "部落格",
"mcp": "MCP 伺服器"
```

Add `"blog"` top-level key:
```json
"blog": {
  "seoTitle": "部落格 — ClawStudiouo",
  "seoDescription": "提供遊戲開發者與設計師使用 ClawStudiouo 工具的教學、指南與工作流程。",
  "title": "部落格",
  "subtitle": "遊戲開發者與設計師的教學與指南。",
  "posts": {
    "gifToSpritesheetUnityGodot": {
      "title": "GIF 轉 Spritesheet：Unity 和 Godot 完整工作流程",
      "description": "完整的工作流程指南：將 GIF 動畫轉換為適用於 Unity 和 Godot 遊戲引擎的 Sprite Sheet。",
      "date": "2026-05-05"
    }
  }
}
```

Add `"mcp"` top-level key:
```json
"mcp": {
  "seoTitle": "Spritesheet Forge MCP 伺服器 — ClawStudiouo",
  "seoDescription": "讓 Claude AI 透過自然語言指令處理 GIF 轉換、精靈圖打包和材質圖集生成，完全不需要寫程式。",
  "hero": {
    "title": "Spritesheet Forge MCP 伺服器",
    "subtitle": "讓 Claude 處理你的 Spritesheet 工作流程。8 個工具，每月 100 次免費操作，GitHub 身份驗證。",
    "ctaGitHub": "在 GitHub 上查看",
    "ctaDocs": "完整文件"
  },
  "quickStart": {
    "title": "快速開始",
    "endpoint": "MCP 端點",
    "claudeDesktop": {
      "title": "Claude Desktop",
      "description": "將以下內容加入你的 claude_desktop_config.json："
    },
    "claudeCode": {
      "title": "Claude Code CLI",
      "description": "在終端機執行以下指令："
    },
    "auth": "驗證使用 GitHub OAuth 2.1。首次使用時，MCP 客戶端會開啟瀏覽器登入頁面。Token 有效期為 30 天。"
  },
  "tools": {
    "title": "8 個可用工具",
    "gifToSpritesheet": {
      "title": "gif_to_spritesheet",
      "description": "將 GIF 動畫轉換為 PNG Spritesheet 格線。支援移除背景。"
    },
    "gifToFrames": {
      "title": "gif_to_frames",
      "description": "將 GIF 的所有幀提取為個別 PNG，以 ZIP 壓縮包回傳。"
    },
    "pngToSpritesheet": {
      "title": "png_to_spritesheet",
      "description": "將多個 PNG 打包為一張 Spritesheet。支援格線、水平、垂直、裝箱排列，以及 TexturePacker 相容的 JSON 圖集。"
    },
    "splitSpritesheet": {
      "title": "split_spritesheet",
      "description": "將 Spritesheet 分割為個別幀，可輸出 JSON 或 CSS 元數據。"
    },
    "spritesheetToAnimation": {
      "title": "spritesheet_to_animation",
      "description": "將 Spritesheet PNG 轉換回 GIF 或 WebP 動畫。"
    },
    "framesToAnimation": {
      "title": "frames_to_animation",
      "description": "將 PNG 序列組合為 GIF 或 WebP 動畫。"
    },
    "trimPng": {
      "title": "trim_png",
      "description": "移除 PNG 檔案的透明邊緣，支援閾值與邊距控制。"
    },
    "serverInfo": {
      "title": "server_info",
      "description": "回傳執行環境設定：上傳網址、檔案大小限制、TTL 和編碼規則。在多步驟工作流程中請先呼叫此工具。"
    }
  },
  "limits": {
    "title": "每月免費額度",
    "ops": "100 次操作 / GitHub 帳號 / 月",
    "fileSize": "每個檔案最大 20 MB",
    "ttl": "輸出網址 1 小時後過期",
    "reset": "額度於每月 1 日重置"
  }
}
```

- [ ] **Step 3: Create `useBlogPosts.ts`**

```ts
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
```

- [ ] **Step 4: Verify lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useBlogPosts.ts i18n/locales/en.json i18n/locales/zh-TW.json
git commit -m "feat: add useBlogPosts composable and blog/mcp i18n keys"
```

---

## Task 3: /blog Index Page

**Files:**
- Create: `app/pages/blog/index.vue`

- [ ] **Step 1: Create the file**

```vue
<!-- app/pages/blog/index.vue -->
<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { posts } = useBlogPosts()

useSeoMeta({
  title: () => t('blog.seoTitle'),
  description: () => t('blog.seoDescription'),
  ogTitle: () => t('blog.seoTitle'),
  ogDescription: () => t('blog.seoDescription')
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10 space-y-8">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold">
        {{ t('blog.title') }}
      </h1>
      <p class="text-muted">
        {{ t('blog.subtitle') }}
      </p>
    </div>

    <div class="space-y-4">
      <NuxtLink
        v-for="post in posts"
        :key="post.slug"
        :to="localePath(`/blog/${post.slug}`)"
        class="group block"
      >
        <UCard class="transition-shadow group-hover:shadow-lg">
          <div class="space-y-2">
            <div class="flex items-center gap-3 text-xs text-muted">
              <UBadge :label="post.tag" size="xs" variant="soft" color="primary" />
              <time>{{ post.date }}</time>
              <span>· {{ post.readingTime }} min read</span>
            </div>
            <h2 class="text-lg font-semibold group-hover:text-primary transition-colors">
              {{ t(post.titleKey) }}
            </h2>
            <p class="text-sm text-muted leading-relaxed">
              {{ t(post.descriptionKey) }}
            </p>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/pages/blog/index.vue
git commit -m "feat: add /blog index page"
```

---

## Task 4: First Blog Post — GIF to Spritesheet for Unity & Godot

**Files:**
- Create: `app/pages/blog/gif-to-spritesheet-unity-godot.vue`

- [ ] **Step 1: Create the file**

```vue
<!-- app/pages/blog/gif-to-spritesheet-unity-godot.vue -->
<script setup lang="ts">
const localePath = useLocalePath()
</script>

<template>
  <BlogPostLayout
    title-key="blog.posts.gifToSpritesheetUnityGodot.title"
    description-key="blog.posts.gifToSpritesheetUnityGodot.description"
    date="2026-05-05"
    :reading-time="8"
  >
    <template #content>
      <section class="space-y-3">
        <h2 class="text-xl font-semibold">What Is a Spritesheet?</h2>
        <p class="text-muted leading-relaxed">
          A spritesheet packs multiple animation frames into a single image file. Instead of loading
          dozens of individual PNGs at runtime, your game engine reads one image and slices it into
          frames on demand. This reduces draw calls, cuts asset load time, and simplifies animation
          state management — especially as your character roster grows.
        </p>
        <p class="text-muted leading-relaxed">
          Both Unity and Godot have first-class support for spritesheets. Unity's <strong>Sprite Editor</strong>
          handles slicing, while Godot's <strong>SpriteFrames</strong> resource imports them directly.
          The catch: neither engine accepts animated GIFs as input. You need the spritesheet first.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 1: Prepare Your GIF</h2>
        <p class="text-muted leading-relaxed">
          Before converting, a few things to check:
        </p>
        <ul class="space-y-2 text-sm text-muted">
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-check" class="text-primary shrink-0 mt-0.5" />
            <span><strong>Consistent canvas size</strong> — all frames should be the same dimensions. If your GIF
            was exported from Aseprite or Pyxel Edit, this is already guaranteed.</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-check" class="text-primary shrink-0 mt-0.5" />
            <span><strong>Transparent background</strong> — game engines composite sprites over a game background.
            A solid white or black GIF background will create a visible box around your character.</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-check" class="text-primary shrink-0 mt-0.5" />
            <span><strong>File size under 20 MB</strong> — the converter handles files up to 20 MB. Most pixel-art
            animations are well under 1 MB.</span>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 2: Convert Using the Web Tool</h2>
        <p class="text-muted leading-relaxed">
          The fastest path is the
          <NuxtLink :to="localePath('/tools/gif-to-sprite')" class="text-primary hover:underline">
            GIF to Spritesheet
          </NuxtLink>
          tool — no account needed, no installation, processes entirely in the browser.
        </p>
        <ol class="space-y-3 text-sm text-muted">
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">1.</span>
            <span>Upload your GIF. A preview of the first frame appears immediately.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">2.</span>
            <span>
              Choose the <strong>output mode</strong>: <em>Spritesheet</em> for a grid image (recommended for Unity/Godot),
              or <em>Frames</em> if you need each frame as a separate file.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">3.</span>
            <span>
              Set <strong>columns</strong>. A 12-frame walk cycle works well as 4 columns × 3 rows or 6 × 2.
              Unity and Godot both slice by rows and columns, so any layout works — just note the values.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">4.</span>
            <span>
              Enable <strong>Trim transparent borders</strong> if your frames have large empty margins.
              This reduces the spritesheet size and matches what TexturePacker does automatically.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">5.</span>
            <span>Click <strong>Convert</strong> and download the PNG.</span>
          </li>
        </ol>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 3: Convert Using the MCP Server (Claude Users)</h2>
        <p class="text-muted leading-relaxed">
          If you work with Claude Desktop or Claude Code, the
          <NuxtLink :to="localePath('/mcp')" class="text-primary hover:underline">Spritesheet Forge MCP server</NuxtLink>
          lets you run the same conversion through a natural language prompt — no browser needed.
        </p>
        <p class="text-muted leading-relaxed">
          Once connected, you can tell Claude:
        </p>
        <pre class="bg-muted/20 rounded-lg p-4 text-sm overflow-x-auto"><code>Convert character_walk.gif into a spritesheet with 4 columns.
Trim the transparent borders before packing.</code></pre>
        <p class="text-muted leading-relaxed">
          Claude calls <code class="bg-muted/20 px-1.5 py-0.5 rounded text-sm">gif_to_spritesheet</code> (and
          optionally <code class="bg-muted/20 px-1.5 py-0.5 rounded text-sm">trim_png</code> first), then
          returns a download URL. The result is identical to the web tool.
        </p>
        <p class="text-muted leading-relaxed">
          This is particularly useful inside a game-dev session where you're already asking Claude to
          help write animation controller code — you can convert assets and write the importer logic
          in the same conversation.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 4: Import into Unity</h2>
        <p class="text-muted leading-relaxed">
          Drop the PNG into your Unity <strong>Assets</strong> folder. Then:
        </p>
        <ol class="space-y-2 text-sm text-muted">
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">1.</span>
            <span>Select the PNG in the Project window.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">2.</span>
            <span>
              In the <strong>Inspector</strong>, set <em>Texture Type</em> to <strong>Sprite (2D and UI)</strong>
              and <em>Sprite Mode</em> to <strong>Multiple</strong>.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">3.</span>
            <span>Click <strong>Sprite Editor</strong> → <strong>Slice</strong> → choose <em>Grid By Cell Count</em>.
            Enter the column and row counts you used during conversion.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">4.</span>
            <span>Click <strong>Apply</strong>. Unity generates the individual sprite slices.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">5.</span>
            <span>
              Select all slices in the Project window, drag them into the <strong>Hierarchy</strong>,
              and Unity will prompt you to create an <strong>Animation Clip</strong> automatically.
            </span>
          </li>
        </ol>
        <p class="text-muted leading-relaxed">
          Set the clip's <strong>Sample Rate</strong> to match your original GIF frame rate. GIFs store
          delay in centiseconds — a 100ms delay per frame equals 10 fps.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 5: Import into Godot</h2>
        <p class="text-muted leading-relaxed">
          Godot's <strong>AnimatedSprite2D</strong> node uses a <strong>SpriteFrames</strong> resource,
          which reads spritesheets natively.
        </p>
        <ol class="space-y-2 text-sm text-muted">
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">1.</span>
            <span>Add an <strong>AnimatedSprite2D</strong> node to your scene.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">2.</span>
            <span>
              In the Inspector, create a new <strong>SpriteFrames</strong> resource and open the
              <strong>SpriteFrames</strong> panel at the bottom of the editor.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">3.</span>
            <span>
              In the panel, click <strong>Add frames from sprite sheet</strong> (grid icon).
              Select your PNG, then set the grid dimensions (columns × rows) to match your spritesheet layout.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">4.</span>
            <span>
              Select all frames (or a subset for a specific action), click <strong>Add N frame(s)</strong>.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">5.</span>
            <span>
              Set the <strong>FPS</strong> in the SpriteFrames panel. Use
              <code class="bg-muted/20 px-1 rounded">1000 ÷ frame_delay_ms</code> — for a 100ms GIF, that's 10 FPS.
            </span>
          </li>
        </ol>
        <p class="text-muted leading-relaxed">
          Call <code class="bg-muted/20 px-1.5 py-0.5 rounded text-sm">$AnimatedSprite2D.play("animation_name")</code>
          from GDScript to start the animation.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Tips &amp; Common Pitfalls</h2>
        <ul class="space-y-3 text-sm text-muted">
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Power-of-2 dimensions</strong> — some older mobile GPUs require textures with dimensions
              that are powers of 2 (64, 128, 256, 512…). If you're targeting mobile, enable the
              <em>Power of 2</em> option in the PNG to Spritesheet tool to auto-pad the canvas.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Pre-trim for tight atlases</strong> — if your source art has large transparent margins,
              trim them before packing. The
              <NuxtLink :to="localePath('/tools/png-trim')" class="text-primary hover:underline">PNG Trim</NuxtLink>
              tool strips transparent edges individually; then
              <NuxtLink :to="localePath('/tools/png-to-spritesheet')" class="text-primary hover:underline">PNG to Spritesheet</NuxtLink>
              packs the tight frames into the atlas.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Multiple animations in one sheet</strong> — arrange different actions as rows
              (idle = row 0, walk = row 1, attack = row 2). Both Unity and Godot let you specify
              row ranges when slicing, so you can map each row to a named animation clip.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>GIF frame delays are not uniform</strong> — if your GIF uses variable frame delays,
              the converter uses the delay of the first frame as the uniform interval. Check the
              resulting animation speed and adjust the FPS setting in your engine if needed.
            </span>
          </li>
        </ul>
      </section>

      <section class="space-y-4">
        <h2 class="text-xl font-semibold">Related Tools</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NuxtLink :to="localePath('/tools/gif-to-sprite')" class="group block">
            <UCard class="transition-shadow group-hover:shadow-md">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-grid-3x3" class="text-xl text-primary shrink-0" />
                <div>
                  <p class="font-medium text-sm">GIF to Spritesheet</p>
                  <p class="text-xs text-muted">Web tool used in this guide</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
          <NuxtLink :to="localePath('/tools/png-trim')" class="group block">
            <UCard class="transition-shadow group-hover:shadow-md">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-scissors" class="text-xl text-primary shrink-0" />
                <div>
                  <p class="font-medium text-sm">PNG Trim</p>
                  <p class="text-xs text-muted">Remove transparent borders before packing</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
          <NuxtLink :to="localePath('/tools/png-to-spritesheet')" class="group block">
            <UCard class="transition-shadow group-hover:shadow-md">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-layout-grid" class="text-xl text-primary shrink-0" />
                <div>
                  <p class="font-medium text-sm">PNG to Spritesheet</p>
                  <p class="text-xs text-muted">Pack individual frames into an atlas</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
          <NuxtLink :to="localePath('/mcp')" class="group block">
            <UCard class="transition-shadow group-hover:shadow-md">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-cpu" class="text-xl text-primary shrink-0" />
                <div>
                  <p class="font-medium text-sm">Spritesheet Forge MCP</p>
                  <p class="text-xs text-muted">Do all of this from Claude</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>
    </template>
  </BlogPostLayout>
</template>
```

- [ ] **Step 2: Verify lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/pages/blog/gif-to-spritesheet-unity-godot.vue
git commit -m "feat: add first blog post — GIF to Spritesheet for Unity & Godot"
```

---

## Task 5: /mcp Landing Page

**Files:**
- Create: `app/pages/mcp.vue`

- [ ] **Step 1: Create the file**

```vue
<!-- app/pages/mcp.vue -->
<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('mcp.seoTitle'),
  description: () => t('mcp.seoDescription'),
  ogTitle: () => t('mcp.seoTitle'),
  ogDescription: () => t('mcp.seoDescription')
})

const MCP_ENDPOINT = 'https://mcp.clawstudiouo.com/mcp'
const GITHUB_URL = 'https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge'
const DOCS_URL = 'https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge/'

const claudeDesktopConfig = `{
  "mcpServers": {
    "spritesheet-forge": {
      "type": "http",
      "url": "${MCP_ENDPOINT}"
    }
  }
}`

const claudeCodeCommand = `claude mcp add spritesheet-forge --transport http ${MCP_ENDPOINT}`

const toolKeys = [
  'gifToSpritesheet',
  'gifToFrames',
  'pngToSpritesheet',
  'splitSpritesheet',
  'spritesheetToAnimation',
  'framesToAnimation',
  'trimPng',
  'serverInfo'
] as const

const toolIcons: Record<string, string> = {
  gifToSpritesheet: 'i-lucide-grid-3x3',
  gifToFrames: 'i-lucide-film',
  pngToSpritesheet: 'i-lucide-layout-grid',
  splitSpritesheet: 'i-lucide-split',
  spritesheetToAnimation: 'i-lucide-play-circle',
  framesToAnimation: 'i-lucide-clapperboard',
  trimPng: 'i-lucide-scissors',
  serverInfo: 'i-lucide-info'
}

const limitItems = ['ops', 'fileSize', 'ttl', 'reset'] as const
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10 space-y-12">
    <!-- Hero -->
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-cpu" class="text-3xl text-primary" />
        <UBadge label="MCP Server" variant="soft" color="primary" />
      </div>
      <h1 class="text-3xl font-bold leading-tight">
        {{ t('mcp.hero.title') }}
      </h1>
      <p class="text-lg text-muted leading-relaxed">
        {{ t('mcp.hero.subtitle') }}
      </p>
      <div class="flex flex-wrap gap-3">
        <UButton
          :label="t('mcp.hero.ctaGitHub')"
          icon="i-simple-icons-github"
          :to="GITHUB_URL"
          target="_blank"
          variant="outline"
          color="neutral"
        />
        <UButton
          :label="t('mcp.hero.ctaDocs')"
          icon="i-lucide-book-open"
          :to="DOCS_URL"
          target="_blank"
          variant="ghost"
          color="neutral"
        />
      </div>
    </div>

    <!-- Quick Start -->
    <section class="space-y-5">
      <h2 class="text-2xl font-semibold">
        {{ t('mcp.quickStart.title') }}
      </h2>

      <div class="space-y-1">
        <p class="text-sm font-medium text-muted">
          {{ t('mcp.quickStart.endpoint') }}
        </p>
        <pre class="bg-muted/20 rounded-lg px-4 py-3 text-sm font-mono overflow-x-auto">{{ MCP_ENDPOINT }}</pre>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-2">
          <p class="font-semibold">
            {{ t('mcp.quickStart.claudeDesktop.title') }}
          </p>
          <p class="text-sm text-muted">
            {{ t('mcp.quickStart.claudeDesktop.description') }}
          </p>
          <pre class="bg-muted/20 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto">{{ claudeDesktopConfig }}</pre>
        </div>
        <div class="space-y-2">
          <p class="font-semibold">
            {{ t('mcp.quickStart.claudeCode.title') }}
          </p>
          <p class="text-sm text-muted">
            {{ t('mcp.quickStart.claudeCode.description') }}
          </p>
          <pre class="bg-muted/20 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto">{{ claudeCodeCommand }}</pre>
        </div>
      </div>

      <p class="text-sm text-muted">
        {{ t('mcp.quickStart.auth') }}
      </p>
    </section>

    <!-- Tools -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        {{ t('mcp.tools.title') }}
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <UCard v-for="key in toolKeys" :key="key">
          <div class="flex items-start gap-3">
            <UIcon :name="toolIcons[key]" class="text-xl text-primary shrink-0 mt-0.5" />
            <div>
              <p class="font-mono text-sm font-semibold">
                {{ t(`mcp.tools.${key}.title`) }}
              </p>
              <p class="text-xs text-muted mt-0.5 leading-relaxed">
                {{ t(`mcp.tools.${key}.description`) }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <!-- Limits -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        {{ t('mcp.limits.title') }}
      </h2>
      <ul class="space-y-2">
        <li
          v-for="key in limitItems"
          :key="key"
          class="flex items-center gap-2 text-sm text-muted"
        >
          <UIcon name="i-lucide-check" class="text-primary shrink-0" />
          {{ t(`mcp.limits.${key}`) }}
        </li>
      </ul>
    </section>
  </div>
</template>
```

- [ ] **Step 2: Verify lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/pages/mcp.vue
git commit -m "feat: add /mcp landing page"
```

---

## Task 6: Footer Links

**Files:**
- Modify: `app/app.vue`

- [ ] **Step 1: Add Blog and MCP to footer**

In `app/app.vue`, find the footer nav div and add two new links. Current:

```html
<div class="flex justify-center gap-4 text-sm">
  <NuxtLink to="/privacy" ...>{{ t('footer.privacy') }}</NuxtLink>
  <NuxtLink to="/terms" ...>{{ t('footer.terms') }}</NuxtLink>
  <NuxtLink to="/about" ...>{{ t('footer.about') }}</NuxtLink>
  <NuxtLink to="/contact" ...>{{ t('footer.contact') }}</NuxtLink>
</div>
```

Replace with:

```html
<div class="flex justify-center gap-4 text-sm flex-wrap">
  <NuxtLink to="/blog" class="text-muted hover:text-primary">
    {{ t('footer.blog') }}
  </NuxtLink>
  <NuxtLink to="/mcp" class="text-muted hover:text-primary">
    {{ t('footer.mcp') }}
  </NuxtLink>
  <NuxtLink to="/privacy" class="text-muted hover:text-primary">
    {{ t('footer.privacy') }}
  </NuxtLink>
  <NuxtLink to="/terms" class="text-muted hover:text-primary">
    {{ t('footer.terms') }}
  </NuxtLink>
  <NuxtLink to="/about" class="text-muted hover:text-primary">
    {{ t('footer.about') }}
  </NuxtLink>
  <NuxtLink to="/contact" class="text-muted hover:text-primary">
    {{ t('footer.contact') }}
  </NuxtLink>
</div>
```

- [ ] **Step 2: Run lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/app.vue
git commit -m "feat: add Blog and MCP links to footer"
```

---

## Self-Review

**Spec coverage:**
- ✅ BlogPostLayout component (breadcrumb, header, content slot)
- ✅ useBlogPosts composable (metadata for index)
- ✅ /blog index page (post listing)
- ✅ First blog post with full content
- ✅ /mcp marketing page (hero, quick start, 8 tools, limits)
- ✅ Footer updated with Blog + MCP links
- ✅ i18n: en + zh-TW for all new pages

**Placeholder scan:** No TBDs found. All code blocks contain complete implementations.

**Type consistency:** `BlogPost.titleKey`, `BlogPost.descriptionKey` match usage in `blog/index.vue` and `BlogPostLayout` props. `toolKeys` in `mcp.vue` matches i18n key path `mcp.tools.${key}.*`.
