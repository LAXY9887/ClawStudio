<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('contact.seoTitle'),
  description: () => t('contact.metaDescription'),
  ogTitle: () => t('contact.seoTitle'),
  ogDescription: () => t('contact.metaDescription')
})

const topicKeys = ['bug', 'feature', 'general', 'business'] as const
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10 space-y-10">
    <!-- Hero -->
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-bold">
        {{ t('contact.title') }}
      </h1>
      <p class="text-lg text-muted">
        {{ t('contact.subtitle') }}
      </p>
    </div>

    <!-- Intro -->
    <p class="text-muted leading-relaxed">
      {{ t('contact.intro') }}
    </p>

    <!-- Topics -->
    <section class="space-y-4">
      <h2 class="text-xl font-semibold">
        {{ t('contact.topics.title') }}
      </h2>
      <div class="grid sm:grid-cols-2 gap-4">
        <div
          v-for="key in topicKeys"
          :key="key"
          class="border border-muted rounded-lg p-4 space-y-2"
        >
          <h3 class="font-semibold">
            {{ t(`contact.topics.items.${key}.title`) }}
          </h3>
          <p class="text-sm text-muted leading-relaxed">
            {{ t(`contact.topics.items.${key}.description`) }}
          </p>
        </div>
      </div>
    </section>

    <!-- Email -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('contact.email.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('contact.email.intro') }}
      </p>
      <p class="text-muted">
        {{ t('contact.email.label') }}:
        <a href="mailto:angelcemept@gmail.com" class="text-primary hover:underline">angelcemept@gmail.com</a>
      </p>
      <p class="text-sm text-muted leading-relaxed">
        {{ t('contact.email.responseTime') }}
      </p>
    </section>

    <!-- Privacy -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('contact.privacy.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('contact.privacy.content') }}
        <NuxtLink :to="localePath('/privacy')" class="text-primary hover:underline">
          {{ t('footer.privacy') }}
        </NuxtLink>
      </p>
    </section>
  </div>
</template>
