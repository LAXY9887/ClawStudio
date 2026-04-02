<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const store = useDownloadStore()

const returnPath = computed(() => (route.query.from as string) || localePath('/'))

useSeoMeta({
  title: () => t('waitingRoom.title'),
  robots: 'noindex, nofollow'
})

onMounted(() => {
  // Redirect if no blob data
  if (!store.blob.value) {
    navigateTo(returnPath.value)
    return
  }
  // Initialize ad
  try {
    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
  } catch {}
})
</script>

<template>
  <WaitingRoom
    :countdown="15"
    :return-path="returnPath"
  >
    <template #ad>
      <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="ca-pub-6385934484512467"
        data-ad-slot="1774557803"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </template>

    <template #content>
      <div class="space-y-8">
        <!-- Tips Section -->
        <section class="space-y-4">
          <h2 class="text-xl font-bold">
            {{ t('waitingRoom.tipsTitle') }}
          </h2>
          <ul class="space-y-3 text-sm text-muted leading-relaxed">
            <li v-for="i in 4" :key="i" class="flex items-start gap-2">
              <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
              <span v-html="t(`waitingRoom.tips[${i - 1}]`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')" />
            </li>
          </ul>
        </section>

        <!-- API Promo Section -->
        <section class="border border-muted rounded-lg p-5 space-y-3">
          <h2 class="text-lg font-bold">
            {{ t('waitingRoom.apiTitle') }}
          </h2>
          <p class="text-muted leading-relaxed">
            {{ t('waitingRoom.apiPromo') }}
          </p>
          <UButton
            :label="t('waitingRoom.apiCta')"
            icon="i-lucide-external-link"
            to="https://rapidapi.com/lxya98874322688423/api/easy-gif-to-sprites"
            target="_blank"
            variant="outline"
            color="neutral"
          />
        </section>
      </div>
    </template>
  </WaitingRoom>
</template>
