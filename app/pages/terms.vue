<script setup lang="ts">
const { t } = useI18n()

const termsItems = computed(() => {
  const items: string[] = []
  for (let i = 0; i < 6; i++) {
    items.push(t(`footer.termsContent.items[${i}]`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'))
  }
  return items
})

useHead({
  title: () => `${t('footer.terms')} - ClawStudiouo`,
  meta: [
    { name: 'robots', content: 'noindex, follow' }
  ]
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10 space-y-6">
    <h1 class="text-3xl font-bold">
      {{ t('footer.terms') }}
    </h1>
    <p class="text-muted leading-relaxed">
      {{ t('footer.termsContent.intro') }}
    </p>
    <ol class="space-y-4 text-muted leading-relaxed list-decimal pl-5">
      <li v-for="(item, i) in termsItems" :key="i" v-html="item" />
    </ol>
  </div>
</template>
