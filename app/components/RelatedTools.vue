<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const tools = [
  { key: 'gifToSprite', icon: 'i-lucide-grid-3x3', to: '/tools/gif-to-sprite' },
  { key: 'framesToGif', icon: 'i-lucide-film', to: '/tools/frames-to-gif' },
  { key: 'spritesheetToGif', icon: 'i-lucide-play-circle', to: '/tools/spritesheet-to-gif' }
]

const currentPath = computed(() => route.path)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span class="text-xs text-muted mr-1">{{ t('relatedTools.label') }}:</span>
    <NuxtLink
      v-for="tool in tools"
      :key="tool.key"
      :to="localePath(tool.to)"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors"
      :class="currentPath.includes(tool.to)
        ? 'border-primary bg-primary/10 text-primary font-medium'
        : 'border-muted text-muted hover:border-primary/50 hover:text-primary'"
    >
      <UIcon :name="tool.icon" class="text-sm" />
      {{ t(`relatedTools.${tool.key}`) }}
    </NuxtLink>
  </div>
</template>
