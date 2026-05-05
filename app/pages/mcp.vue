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
