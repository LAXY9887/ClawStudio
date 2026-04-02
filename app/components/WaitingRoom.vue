<script setup lang="ts">
const { t } = useI18n()

const props = withDefaults(defineProps<{
  countdown?: number
  returnPath?: string
}>(), {
  countdown: 15,
  returnPath: '/'
})

const emit = defineEmits<{
  downloaded: []
}>()

const store = useDownloadStore()
const remaining = ref(props.countdown)
const isReady = computed(() => remaining.value <= 0)
const downloaded = ref(false)

let timer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => {
    if (remaining.value > 0) {
      remaining.value--
    } else {
      clearInterval(timer)
    }
  }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})

const progressPercent = computed(() =>
  ((props.countdown - remaining.value) / props.countdown) * 100
)

function download() {
  if (!store.blob.value) return

  const url = URL.createObjectURL(store.blob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = store.filename.value
  a.click()
  URL.revokeObjectURL(url)

  downloaded.value = true
  emit('downloaded')

  // Reset usage count
  const usageCount = useCookie<number>('usage_count', { default: () => 0 })
  usageCount.value = 0

  // Redirect back after delay
  setTimeout(() => {
    store.clear()
    navigateTo(props.returnPath)
  }, 2000)
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10 space-y-8">
    <!-- Progress Bar -->
    <div class="space-y-2">
      <p class="text-center font-medium">
        {{ isReady ? t('waitingRoom.ready') : t('waitingRoom.countdown', { seconds: remaining }) }}
      </p>
      <div class="w-full h-3 bg-muted/30 rounded-full overflow-hidden">
        <div
          class="h-full bg-primary rounded-full transition-all duration-1000"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <!-- Download Button -->
    <div class="flex justify-center">
      <UButton
        v-if="!downloaded"
        :label="t('waitingRoom.download')"
        icon="i-lucide-download"
        size="xl"
        :disabled="!isReady"
        @click="download"
      />
      <p v-else class="text-primary font-medium">
        {{ t('waitingRoom.redirecting') }}
      </p>
    </div>

    <!-- Ad Slot -->
    <div class="ad-slot w-full">
      <slot name="ad" />
    </div>

    <!-- Content Slot -->
    <div>
      <slot name="content" />
    </div>
  </div>
</template>
