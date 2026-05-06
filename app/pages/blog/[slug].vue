<!-- app/pages/blog/[slug].vue -->
<script setup lang="ts">
const { locale } = useI18n()
const route = useRoute()
const slug = route.params.slug as string

const { data: post } = await useAsyncData(route.fullPath, async () => {
  const localePost = await queryCollection('blog').path(`/${locale.value.toLowerCase()}/blog/${slug}`).first()
  if (localePost) return localePost
  return queryCollection('blog').path(`/en/blog/${slug}`).first()
})

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found' })
}
</script>

<template>
  <BlogPostLayout
    :title="post!.title"
    :description="post!.description"
    :date="post!.date"
    :reading-time="post!.readingTime"
  >
    <template #content>
      <ContentRenderer
        :value="post!"
        class="prose prose-neutral dark:prose-invert max-w-none
               prose-headings:font-semibold prose-h2:text-xl
               prose-img:rounded-lg prose-img:border prose-img:border-muted prose-img:w-full
               prose-pre:bg-muted/30 prose-code:text-primary prose-code:before:content-none prose-code:after:content-none
               prose-a:text-primary prose-a:underline prose-a:underline-offset-2"
      />
    </template>
  </BlogPostLayout>
</template>
