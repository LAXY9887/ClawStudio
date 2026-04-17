<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online PNG Trim — Crop Transparent Edges',
        'description': 'Remove transparent borders from PNG images, single or batch.',
        'url': 'https://clawstudiouo.com/tools/png-trim',
        'applicationCategory': 'DesignApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires a modern web browser',
        'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
        'author': { '@type': 'Organization', 'name': 'ClawStudiouo', 'url': 'https://clawstudiouo.com' }
      })
    }
  ]
})

const seoSections: import('~/types/seo').SeoSection[] = [] // TODO: add SEO content later

// State
const files = ref<File[]>([])
const status = ref<'idle' | 'converting' | 'done' | 'error'>('idle')
const errorMessage = ref('')

// Result
const resultBlob = ref<Blob | null>(null)
const resultUrl = ref('')
const resultInfo = ref({ width: 0, height: 0, size: '', count: 0 })
const resultIsZip = ref(false)

// File input ref
const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)

// Options
const threshold = ref(0)
const padding = ref(0)

// Usage limiter
const FREE_LIMIT = 3
const usageCount = useCookie<number>('usage_count', { default: () => 0, maxAge: 60 * 60 * 24 })
const showAdModal = ref(false)
const remainingUses = computed(() => FREE_LIMIT - usageCount.value)
const limitExceeded = computed(() => usageCount.value >= FREE_LIMIT)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.length) handleFiles(Array.from(target.files))
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) handleFiles(Array.from(e.dataTransfer.files))
}

function handleFiles(newFiles: File[]) {
  const pngs = newFiles.filter(f => f.name.toLowerCase().endsWith('.png'))
  if (pngs.length === 0) {
    errorMessage.value = t('pngTrim.upload.accept')
    status.value = 'error'
    return
  }
  files.value = [...files.value, ...pngs]
  errorMessage.value = ''
  status.value = 'idle'
}

// Thumbnails
const thumbs = ref<Map<File, string>>(new Map())

function getThumbUrl(file: File): string {
  if (!thumbs.value.has(file)) {
    thumbs.value.set(file, URL.createObjectURL(file))
  }
  return thumbs.value.get(file)!
}

function removeFile(index: number) {
  const file = files.value[index]
  if (file) {
    const url = thumbs.value.get(file)
    if (url) {
      URL.revokeObjectURL(url)
      thumbs.value.delete(file)
    }
  }
  files.value.splice(index, 1)
}

function clearThumbs() {
  thumbs.value.forEach(url => URL.revokeObjectURL(url))
  thumbs.value.clear()
}

const hasInput = computed(() => files.value.length >= 1)

async function convert() {
  status.value = 'converting'
  errorMessage.value = ''

  try {
    const formData = new FormData()
    files.value.forEach(f => formData.append('files', f))
    if (threshold.value > 0) formData.append('threshold', String(threshold.value))
    if (padding.value > 0) formData.append('padding', String(padding.value))

    const response = await $fetch.raw('/api/png-trim', {
      method: 'POST',
      body: formData,
      responseType: 'blob'
    })

    const blob = response._data as unknown as Blob
    const contentType = response.headers.get('content-type') || ''
    resultIsZip.value = contentType.includes('zip')
    resultBlob.value = blob
    resultInfo.value.size = formatSize(blob.size)
    resultInfo.value.count = files.value.length

    if (!resultIsZip.value) {
      resultUrl.value = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        resultInfo.value.width = img.naturalWidth
        resultInfo.value.height = img.naturalHeight
      }
      img.src = resultUrl.value
    }

    status.value = 'done'

    if (usageCount.value >= FREE_LIMIT) {
      useDownloadStore().setBlob(blob, resultIsZip.value ? 'trimmed.zip' : 'trimmed.png')
      showAdModal.value = true
    }
  } catch (e: unknown) {
    status.value = 'error'
    const err = e as { data?: { detail?: string } }
    errorMessage.value = err.data?.detail || t('pngTrim.status.error')
  }
}

function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = resultIsZip.value ? 'trimmed.zip' : 'trimmed.png'
  a.click()
  URL.revokeObjectURL(url)
}

function reset() {
  clearThumbs()
  files.value = []
  status.value = 'idle'
  errorMessage.value = ''
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultBlob.value = null
  resultUrl.value = ''
  resultInfo.value = { width: 0, height: 0, size: '', count: 0 }
  resultIsZip.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function submitConvert() {
  if (!hasInput.value) return
  usageCount.value++
  convert()
}

function onAdConfirm() {
  showAdModal.value = false
  const localePath = useLocalePath()
  navigateTo({
    path: localePath('/download'),
    query: { type: 'trim', from: localePath('/tools/png-trim') }
  })
}

onUnmounted(() => {
  clearThumbs()
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
</script>

<template>
  <ToolPageLayout
    title-key="pngTrim.title"
    subtitle-key="pngTrim.subtitle"
    prefix="pngTrim"
    :seo-sections="seoSections"
  >
    <template #workspace>
      <div v-if="status === 'idle' || status === 'error'">
        <!-- Upload Zone -->
        <div
          class="relative border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors"
          :class="[
            isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50',
            files.length > 0 ? 'p-4' : 'p-16'
          ]"
          @click="fileInput?.click()"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" accept=".png" multiple class="hidden" @change="onFileSelect">
          <template v-if="files.length > 0">
            <p class="text-sm font-medium mb-3">{{ files.length }} files selected</p>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
              <div v-for="(f, i) in files" :key="f.name + f.size" class="relative group border border-muted rounded-lg overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:10px_10px]">
                <img :src="getThumbUrl(f)" :alt="f.name" class="w-full aspect-square object-contain pointer-events-none">
                <div class="absolute top-0 left-0 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br">{{ i + 1 }}</div>
                <button class="absolute top-0 right-0 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity" @click.stop="removeFile(i)">×</button>
                <p class="text-[10px] text-muted truncate px-1 py-0.5">{{ f.name }}</p>
              </div>
            </div>
            <p class="text-xs text-muted">{{ t('pngTrim.upload.changeFiles') }}</p>
          </template>
          <template v-else>
            <UIcon name="i-lucide-upload" class="text-4xl text-muted mx-auto mb-4" />
            <p class="font-medium text-lg">{{ t('pngTrim.upload.title') }}</p>
            <p class="text-sm text-muted mt-2">{{ t('pngTrim.upload.limit') }}</p>
          </template>
        </div>

        <!-- Convert Button -->
        <div class="flex justify-end mt-4">
          <UButton
            :label="t('pngTrim.convert')"
            icon="i-lucide-scissors"
            :disabled="!hasInput"
            @click="submitConvert"
          />
        </div>

        <!-- Remaining uses -->
        <p v-if="remainingUses <= 3 && remainingUses > 0" class="text-xs text-muted text-center">
          {{ t('pngTrim.adModal.remaining', { count: remainingUses }, remainingUses) }}
        </p>

        <!-- Error -->
        <UAlert v-if="status === 'error'" color="error" :title="errorMessage" class="mt-4">
          <template #actions>
            <UButton :label="t('pngTrim.status.retry')" color="error" variant="outline" size="sm" @click="reset" />
          </template>
        </UAlert>

        <!-- Options -->
        <UAccordion
          :items="[{ label: t('pngTrim.options.title'), value: 'options' }]"
          :default-value="['options']"
          class="mt-4"
        >
          <template #body>
            <div class="space-y-4 pt-2">
              <div class="grid grid-cols-2 gap-4">
                <UFormField :label="t('pngTrim.options.threshold')" :hint="t('pngTrim.options.thresholdHint')">
                  <UInput v-model.number="threshold" type="number" :min="0" :max="255" />
                </UFormField>
                <UFormField :label="t('pngTrim.options.padding')" :hint="t('pngTrim.options.paddingHint')">
                  <UInput v-model.number="padding" type="number" :min="0" />
                </UFormField>
              </div>
            </div>
          </template>
        </UAccordion>
      </div>

      <!-- Converting -->
      <div v-if="status === 'converting'" class="text-center py-16">
        <UIcon name="i-lucide-loader-circle" class="text-5xl text-primary animate-spin mx-auto mb-4" />
        <p class="text-lg font-medium">{{ t('pngTrim.status.converting') }}</p>
      </div>

      <!-- Result -->
      <div v-if="status === 'done'" class="space-y-6">
        <!-- Single PNG preview -->
        <div v-if="!resultIsZip && resultUrl">
          <h3 class="font-semibold text-lg mb-2">{{ t('pngTrim.result.singleTitle') }}</h3>
          <div class="border border-muted rounded-xl overflow-auto bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
            <img :src="resultUrl" alt="Trimmed preview" class="max-w-full mx-auto">
          </div>
          <p class="text-sm text-muted mt-2">{{ t('pngTrim.result.singleInfo', resultInfo) }}</p>
        </div>

        <!-- Batch ZIP info -->
        <div v-if="resultIsZip">
          <UAlert
            color="success"
            icon="i-lucide-check-circle"
            :title="t('pngTrim.result.batchTitle')"
            :description="t('pngTrim.result.batchInfo', resultInfo, resultInfo.count)"
          />
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3">
          <UButton
            v-if="!limitExceeded"
            :label="resultIsZip ? t('pngTrim.result.downloadZip') : t('pngTrim.result.download')"
            icon="i-lucide-download"
            size="lg"
            @click="downloadResult"
          />
          <UButton
            v-if="limitExceeded"
            :label="t('pngTrim.adModal.watch')"
            icon="i-lucide-arrow-right"
            size="lg"
            @click="showAdModal = true"
          />
          <UButton
            :label="t('pngTrim.result.reset')"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="outline"
            size="lg"
            @click="reset"
          />
        </div>
      </div>
    </template>
  </ToolPageLayout>

  <!-- Ad Modal -->
  <UModal v-model:open="showAdModal">
    <template #content>
      <div class="p-6 text-center space-y-4">
        <UIcon name="i-lucide-heart" class="text-4xl text-primary mx-auto" />
        <h3 class="text-lg font-bold">{{ t('pngTrim.adModal.title') }}</h3>
        <p class="text-sm text-muted">{{ t('pngTrim.adModal.description') }}</p>
        <div class="flex justify-center gap-3 pt-2">
          <UButton :label="t('pngTrim.adModal.watch')" size="lg" @click="onAdConfirm" />
          <UButton :label="t('pngTrim.adModal.close')" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
        </div>
      </div>
    </template>
  </UModal>
</template>
