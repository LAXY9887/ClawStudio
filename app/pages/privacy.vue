<script setup lang="ts">
const { t } = useI18n()

useHead({
  title: () => t('privacy.seoTitle'),
  meta: [
    { name: 'robots', content: 'noindex, follow' }
  ]
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10 space-y-8">
    <div>
      <h1 class="text-3xl font-bold">
        {{ t('privacy.title') }}
      </h1>
      <p class="text-sm text-muted mt-2">
        {{ t('privacy.lastUpdated') }}
      </p>
    </div>

    <p class="text-muted leading-relaxed">
      {{ t('privacy.intro') }}
    </p>

    <!-- Section 1 -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('privacy.section1.title') }}
      </h2>
      <ul class="space-y-2 text-muted leading-relaxed list-disc pl-5">
        <li><strong>{{ t('privacy.section1.item1Title') }}</strong> {{ t('privacy.section1.item1') }}</li>
        <li><strong>{{ t('privacy.section1.item2Title') }}</strong> {{ t('privacy.section1.item2') }}</li>
      </ul>
    </section>

    <!-- Section 2 -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('privacy.section2.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('privacy.section2.intro') }}
      </p>
      <ul class="space-y-2 text-muted leading-relaxed list-disc pl-5">
        <li><strong>{{ t('privacy.section2.item1Title') }}</strong> {{ t('privacy.section2.item1') }}</li>
        <li><strong>{{ t('privacy.section2.item2Title') }}</strong> {{ t('privacy.section2.item2') }}</li>
      </ul>
    </section>

    <!-- Section 3 -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('privacy.section3.title') }}
      </h2>
      <ul class="space-y-2 text-muted leading-relaxed list-disc pl-5">
        <li>{{ t('privacy.section3.item1') }}</li>
        <li>{{ t('privacy.section3.item2') }}</li>
        <li>
          {{ t('privacy.section3.item3') }}
          <a href="https://www.google.com/settings/ads" target="_blank" class="text-primary hover:underline">{{ t('privacy.section3.item3Link') }}</a>
          {{ t('privacy.section3.item3After') }}
        </li>
      </ul>
    </section>

    <!-- Section 4 -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('privacy.section4.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('privacy.section4.content') }}
      </p>
    </section>

    <!-- Section 5 -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('privacy.section5.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('privacy.section5.content') }}
      </p>
    </section>

    <!-- Section 6 -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('privacy.section6.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('privacy.section6.content') }}
      </p>
    </section>

    <!-- Section 7 -->
    <section class="space-y-3">
      <h2 class="text-xl font-semibold">
        {{ t('privacy.section7.title') }}
      </h2>
      <p class="text-muted leading-relaxed">
        {{ t('privacy.section7.content') }}
        <a href="mailto:angelcemept@gmail.com" class="text-primary hover:underline">angelcemept@gmail.com</a>
      </p>
    </section>
  </div>
</template>
