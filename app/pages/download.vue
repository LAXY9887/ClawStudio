<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const store = useDownloadStore()

const returnPath = computed(() => (route.query.from as string) || localePath('/'))

// Detect which tool the user came from
const toolKey = computed(() => {
  const from = returnPath.value
  if (from.includes('heic-to-jpg')) return 'heicToJpg'
  if (from.includes('heic-to-png')) return 'heicToPng'
  if (from.includes('favicon-generator')) return 'faviconGenerator'
  if (from.includes('svg-to-png')) return 'svgToPng'
  if (from.includes('png-to-webp')) return 'pngToWebp'
  if (from.includes('webp-to-png')) return 'webpToPng'
  if (from.includes('png-to-jpg')) return 'pngToJpg'
  if (from.includes('jpg-to-png')) return 'jpgToPng'
  if (from.includes('png-to-gif') || from.includes('to-gif')) return 'toGif'
  if (from.includes('png-to-spritesheet')) return 'pngToSpritesheet'
  if (from.includes('png-trim')) return 'pngTrim'
  if (from.includes('split-spritesheet')) return 'splitSpritesheet'
  return 'gifToSprite'
})

const tipCount = computed(() => {
  const counts: Record<string, number> = {
    gifToSprite: 4, toGif: 5, pngToSpritesheet: 5, pngTrim: 4, splitSpritesheet: 5,
    heicToJpg: 4, heicToPng: 4, pngToJpg: 4, jpgToPng: 4,
    pngToWebp: 4, webpToPng: 4, svgToPng: 5, faviconGenerator: 5
  }
  return counts[toolKey.value] ?? 4
})

const apiUrl = computed(() => {
  const pngTools = ['pngToSpritesheet', 'pngTrim', 'splitSpritesheet']
  const uniimgcTools = ['heicToJpg', 'heicToPng', 'pngToJpg', 'jpgToPng', 'pngToWebp', 'webpToPng', 'svgToPng', 'faviconGenerator']
  if (uniimgcTools.includes(toolKey.value)) return 'https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter'
  if (pngTools.includes(toolKey.value)) return 'https://rapidapi.com/lxya98874322688423/api/easy-png-to-sprites'
  return 'https://rapidapi.com/lxya98874322688423/api/easy-gif-to-sprites'
})

useSeoMeta({
  title: () => t('waitingRoom.title'),
  robots: 'noindex, nofollow'
})

onMounted(() => {
  if (!store.blob.value) {
    navigateTo(returnPath.value)
  }
})
</script>

<template>
  <WaitingRoom
    :countdown="15"
    :return-path="returnPath"
  >
    <template #ad>
      <AdUnit ad-slot="1774557803" />
    </template>

    <template #content>
      <div class="space-y-8">
        <!-- Tips Section (tool-specific) -->
        <section class="space-y-4">
          <h2 class="text-xl font-bold">
            {{ t(`waitingRoom.${toolKey}.tipsTitle`) }}
          </h2>
          <ul class="space-y-3 text-sm text-muted leading-relaxed">
            <li v-for="i in tipCount" :key="i" class="flex items-start gap-2">
              <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
              <span v-html="t(`waitingRoom.${toolKey}.tips[${i - 1}]`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')" />
            </li>
          </ul>
        </section>

        <!-- API Promo Section (shared) -->
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
            :to="apiUrl"
            target="_blank"
            variant="outline"
            color="neutral"
          />
        </section>
      </div>
    </template>
  </WaitingRoom>
</template>
