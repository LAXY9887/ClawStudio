<!-- app/pages/blog/index.vue -->
<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

const { data: posts } = await useAsyncData('blog-index', () =>
  queryCollection('blog').where('path', 'LIKE', '/en/blog/%').order('date', 'DESC').all()
)

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
        :key="post.stem"
        :to="localePath(`/blog/${post.stem?.split('/').pop()}`)"
        class="group block"
      >
        <UCard class="transition-shadow group-hover:shadow-lg">
          <div class="space-y-2">
            <div class="flex items-center gap-3 text-xs text-muted">
              <UBadge :label="post.tag" size="xs" variant="soft" color="primary" />
              <time :datetime="post.date">{{ post.date }}</time>
              <span>· {{ post.readingTime }} min read</span>
            </div>
            <h2 class="text-lg font-semibold group-hover:text-primary transition-colors">
              {{ post.title }}
            </h2>
            <p class="text-sm text-muted leading-relaxed">
              {{ post.description }}
            </p>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
