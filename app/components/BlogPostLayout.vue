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
        <time :datetime="date">{{ date }}</time>
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
