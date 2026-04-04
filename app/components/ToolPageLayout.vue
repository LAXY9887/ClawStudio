<script setup lang="ts">
import type { SeoSection } from '~/types/seo'

const { t } = useI18n()

const props = defineProps<{
  titleKey: string
  subtitleKey: string
  prefix: string
  seoSections: SeoSection[]
  apiHighlightKeys?: string[]
}>()

useSeoMeta({
  title: () => t(props.titleKey),
  description: () => t(props.subtitleKey)
})
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 pt-6 space-y-4">
    <!-- Related Tools -->
    <RelatedTools />

    <!-- Title -->
    <div class="text-center">
      <h1 class="text-2xl font-bold">
        {{ t(titleKey) }}
      </h1>
      <p class="text-sm text-muted mt-1">
        {{ t(subtitleKey) }}
      </p>
    </div>

    <!-- Workspace (tool-specific content) -->
    <slot name="workspace" />
  </div>

  <!-- SEO Content -->
  <SeoSections
    :prefix="prefix"
    :sections="seoSections"
    :api-highlight-keys="apiHighlightKeys"
  />
</template>
