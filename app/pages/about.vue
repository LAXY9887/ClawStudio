<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('aboutUs.seoTitle'),
  description: () => t('aboutUs.hero.subtitle'),
  ogTitle: () => t('aboutUs.seoTitle'),
  ogDescription: () => t('aboutUs.hero.subtitle')
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10 space-y-10">
    <!-- Hero -->
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-bold">
        {{ t('aboutUs.hero.title') }}
      </h1>
      <p class="text-lg text-muted">
        {{ t('aboutUs.hero.subtitle') }}
      </p>
    </div>

    <!-- Story -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('aboutUs.story.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('aboutUs.story.content1') }}
      </p>
      <p class="text-muted leading-relaxed">
        {{ t('aboutUs.story.content2') }}
      </p>
      <p class="text-muted leading-relaxed">
        {{ t('aboutUs.story.content3') }}
      </p>
    </section>

    <!-- Mission -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('aboutUs.mission.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('aboutUs.mission.content1') }}
      </p>
      <p class="text-muted leading-relaxed">
        {{ t('aboutUs.mission.content2') }}
      </p>
    </section>

    <!-- Tech -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('aboutUs.tech.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('aboutUs.tech.content') }}
      </p>
      <ul class="space-y-2 text-sm text-muted">
        <li v-for="i in 4" :key="i" class="flex items-start gap-2">
          <UIcon name="i-lucide-check" class="text-primary shrink-0 mt-0.5" />
          <span>{{ t(`aboutUs.tech.items[${i - 1}]`) }}</span>
        </li>
      </ul>
    </section>

    <!-- Future -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('aboutUs.future.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('aboutUs.future.content') }}
      </p>
    </section>

    <!-- Contact -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('aboutUs.contact.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('aboutUs.contact.content') }}
      </p>
      <p class="text-muted">
        {{ t('aboutUs.contact.email') }}:
        <a href="mailto:angelcemept@gmail.com" class="text-primary hover:underline">angelcemept@gmail.com</a>
      </p>
    </section>
  </div>
</template>
