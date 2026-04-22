<script setup lang="ts">
const { t } = useI18n()
const { openDirectLink } = useMonetagDirectLink()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online SVG to PNG Converter',
        'description': 'Rasterize SVG vector graphics to PNG at any size, with scale multiplier or exact pixel dimensions.',
        'url': 'https://clawstudiouo.com/tools/svg-to-png',
        'applicationCategory': 'DesignApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires a modern web browser',
        'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
        'author': { '@type': 'Organization', 'name': 'ClawStudiouo', 'url': 'https://clawstudiouo.com' }
      })
    }
  ]
})

const seoSections: import('~/types/seo').SeoSection[] = [
  { type: 'text', titleKey: 'svgToPng.seo.whatIs.title', contentKeys: ['svgToPng.seo.whatIs.content', 'svgToPng.seo.whatIs.content2', 'svgToPng.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'svgToPng.seo.sizing.title', contentKeys: ['svgToPng.seo.sizing.content', 'svgToPng.seo.sizing.content2', 'svgToPng.seo.sizing.content3'] },
  { type: 'steps', titleKey: 'svgToPng.seo.howTo.title', stepKeys: ['svgToPng.seo.howTo.step1', 'svgToPng.seo.howTo.step2', 'svgToPng.seo.howTo.step3', 'svgToPng.seo.howTo.step4'] },
  { type: 'features', titleKey: 'svgToPng.seo.features.title', itemKeys: ['svgToPng.seo.features.items.sizing', 'svgToPng.seo.features.items.retina', 'svgToPng.seo.features.items.transparency', 'svgToPng.seo.features.items.fonts', 'svgToPng.seo.features.items.privacy', 'svgToPng.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'svgToPng.seo.useCases.title', itemKeys: ['svgToPng.seo.useCases.items.ogImages', 'svgToPng.seo.useCases.items.appIcons', 'svgToPng.seo.useCases.items.print', 'svgToPng.seo.useCases.items.presentations'] },
  { type: 'faq', titleKey: 'svgToPng.seo.faq.title', itemKeys: ['svgToPng.seo.faq.items.sizeModes', 'svgToPng.seo.faq.items.fonts', 'svgToPng.seo.faq.items.transparency', 'svgToPng.seo.faq.items.maxSize', 'svgToPng.seo.faq.items.privacy', 'svgToPng.seo.faq.items.free'] }
]

const file = ref<File | null>(null)
const status = ref<'idle' | 'converting' | 'done' | 'error'>('idle')
const errorMessage = ref('')

const resultBlob = ref<Blob | null>(null)
const resultUrl = ref('')
const resultInfo = ref({ width: 0, height: 0, size: '' })

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const previewUrl = ref('')

const sizeMode = ref<'scale' | 'width' | 'height' | 'exact'>('scale')
const scale = ref(2)
const widthPx = ref<number | undefined>(512)
const heightPx = ref<number | undefined>(512)

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
  if (target.files?.[0]) handleFile(target.files[0])
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0])
}

function handleFile(f: File) {
  if (!f.name.toLowerCase().endsWith('.svg')) {
    errorMessage.value = t('svgToPng.upload.accept')
    status.value = 'error'
    return
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = f
  previewUrl.value = URL.createObjectURL(f)
  errorMessage.value = ''
  status.value = 'idle'
}

const hasInput = computed(() => !!file.value)

const outputFilename = computed(() => {
  if (!file.value) return 'converted.png'
  const base = file.value.name.replace(/\.[^.]+$/, '')
  return `${base}.png`
})

async function convert() {
  if (!file.value) return
  status.value = 'converting'
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file.value)
    if (sizeMode.value === 'scale') {
      formData.append('scale', String(scale.value))
    } else if (sizeMode.value === 'width' && widthPx.value) {
      formData.append('width', String(widthPx.value))
    } else if (sizeMode.value === 'height' && heightPx.value) {
      formData.append('height', String(heightPx.value))
    } else if (sizeMode.value === 'exact' && widthPx.value && heightPx.value) {
      formData.append('width', String(widthPx.value))
      formData.append('height', String(heightPx.value))
    }

    const response = await $fetch.raw('/api/uniimgc/svg-to-png', {
      method: 'POST',
      body: formData,
      responseType: 'blob'
    })

    const blob = response._data as unknown as Blob
    resultBlob.value = blob
    resultUrl.value = URL.createObjectURL(blob)
    resultInfo.value.size = formatSize(blob.size)

    const img = new Image()
    img.onload = () => {
      resultInfo.value.width = img.naturalWidth
      resultInfo.value.height = img.naturalHeight
    }
    img.src = resultUrl.value

    status.value = 'done'

    if (usageCount.value >= FREE_LIMIT) {
      useDownloadStore().setBlob(blob, outputFilename.value)
      showAdModal.value = true
    }
  } catch (e: unknown) {
    status.value = 'error'
    const err = e as { data?: { message?: string, detail?: string } }
    errorMessage.value = err.data?.message || err.data?.detail || t('svgToPng.status.error')
  }
}

function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = outputFilename.value
  a.click()
  URL.revokeObjectURL(url)
}

function reset() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  file.value = null
  previewUrl.value = ''
  status.value = 'idle'
  errorMessage.value = ''
  resultBlob.value = null
  resultUrl.value = ''
  resultInfo.value = { width: 0, height: 0, size: '' }
  if (fileInput.value) fileInput.value.value = ''
}

function submitConvert() {
  if (!hasInput.value) return
  usageCount.value++
  convert()
}

function onAdConfirm() {
  showAdModal.value = false
  openDirectLink()
  const localePath = useLocalePath()
  navigateTo({
    path: localePath('/download'),
    query: { type: 'svgToPng', from: localePath('/tools/svg-to-png') }
  })
}

useSeoMeta({
  title: () => t('svgToPng.title'),
  description: () => t('svgToPng.subtitle')
})

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
</script>

<template>
  <ToolPageLayout
    title-key="svgToPng.title"
    subtitle-key="svgToPng.subtitle"
    prefix="svgToPng"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <div v-if="status === 'idle' || status === 'error'">
        <!-- Preview (when file selected) -->
        <div v-if="previewUrl" class="space-y-2">
          <div class="border border-muted rounded-lg overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:10px_10px] max-h-80 flex items-center justify-center p-4">
            <img :src="previewUrl" :alt="file?.name" class="max-h-72 max-w-full object-contain">
          </div>
          <div class="flex items-center justify-between">
            <p class="text-sm text-muted">{{ file?.name }} · {{ formatSize(file?.size || 0) }}</p>
            <UButton :label="t('svgToPng.upload.changeFile')" size="xs" color="neutral" variant="ghost" @click="fileInput?.click()" />
          </div>
          <input ref="fileInput" type="file" accept=".svg" class="hidden" @change="onFileSelect">
        </div>

        <!-- Drop zone -->
        <div
          v-else
          class="relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors"
          :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
          @click="fileInput?.click()"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" accept=".svg" class="hidden" @change="onFileSelect">
          <UIcon name="i-lucide-upload" class="text-4xl text-muted mx-auto mb-4" />
          <p class="font-medium text-lg">{{ t('svgToPng.upload.title') }}</p>
          <p class="text-sm text-muted mt-2">{{ t('svgToPng.upload.limit') }}</p>
        </div>

        <!-- Size mode selector -->
        <UFormField :label="t('svgToPng.options.sizeMode')" class="mt-4">
          <div class="flex gap-2 flex-wrap">
            <UButton
              v-for="m in ['scale', 'width', 'height', 'exact'] as const"
              :key="m"
              :variant="sizeMode === m ? 'solid' : 'outline'"
              color="neutral"
              size="sm"
              @click="sizeMode = m"
            >
              {{ t(`svgToPng.options.sizeMode_${m}`) }}
            </UButton>
          </div>
        </UFormField>

        <!-- Size inputs -->
        <div class="mt-3">
          <UFormField v-if="sizeMode === 'scale'" :label="t('svgToPng.options.scale')" :hint="t('svgToPng.options.scaleHint')">
            <div class="flex items-center gap-3">
              <input v-model.number="scale" type="range" min="0.1" max="10" step="0.1" class="flex-1">
              <span class="text-sm font-mono w-12 text-right">{{ scale.toFixed(1) }}×</span>
            </div>
          </UFormField>
          <UFormField v-if="sizeMode === 'width'" :label="t('svgToPng.options.width')" :hint="t('svgToPng.options.widthHint')">
            <UInput v-model.number="widthPx" type="number" :min="1" :max="8192" />
          </UFormField>
          <UFormField v-if="sizeMode === 'height'" :label="t('svgToPng.options.height')" :hint="t('svgToPng.options.heightHint')">
            <UInput v-model.number="heightPx" type="number" :min="1" :max="8192" />
          </UFormField>
          <div v-if="sizeMode === 'exact'" class="grid grid-cols-2 gap-4">
            <UFormField :label="t('svgToPng.options.width')">
              <UInput v-model.number="widthPx" type="number" :min="1" :max="8192" />
            </UFormField>
            <UFormField :label="t('svgToPng.options.height')">
              <UInput v-model.number="heightPx" type="number" :min="1" :max="8192" />
            </UFormField>
          </div>
        </div>

        <!-- Convert -->
        <div class="flex justify-end mt-4">
          <UButton
            :label="t('svgToPng.convert')"
            icon="i-lucide-image"
            :disabled="!hasInput"
            @click="submitConvert"
          />
        </div>

        <p v-if="remainingUses <= 3 && remainingUses > 0" class="text-xs text-muted text-center">
          {{ t('svgToPng.adModal.remaining', { count: remainingUses }, remainingUses) }}
        </p>

        <UAlert v-if="status === 'error'" color="error" :title="errorMessage" class="mt-4">
          <template #actions>
            <UButton :label="t('svgToPng.status.retry')" color="error" variant="outline" size="sm" @click="reset" />
          </template>
        </UAlert>
      </div>

      <div v-if="status === 'converting'" class="text-center py-16">
        <UIcon name="i-lucide-loader-circle" class="text-5xl text-primary animate-spin mx-auto mb-4" />
        <p class="text-lg font-medium">{{ t('svgToPng.status.converting') }}</p>
      </div>

      <div v-if="status === 'done'" class="space-y-6">
        <div v-if="resultUrl">
          <h3 class="font-semibold text-lg mb-2">{{ t('svgToPng.result.title') }}</h3>
          <div class="border border-muted rounded-xl overflow-auto bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
            <img :src="resultUrl" alt="Rasterized preview" class="max-w-full mx-auto">
          </div>
          <p class="text-sm text-muted mt-2">{{ t('svgToPng.result.info', resultInfo) }}</p>
        </div>
        <div class="flex gap-3">
          <UButton v-if="!limitExceeded" :label="t('svgToPng.result.download')" icon="i-lucide-download" size="lg" @click="downloadResult" />
          <UButton v-if="limitExceeded" :label="t('svgToPng.adModal.watch')" icon="i-lucide-arrow-right" size="lg" @click="showAdModal = true" />
          <UButton :label="t('svgToPng.result.reset')" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" size="lg" @click="reset" />
        </div>
      </div>
    </template>
  </ToolPageLayout>

  <UModal v-model:open="showAdModal">
    <template #content>
      <div class="p-6 text-center space-y-4">
        <UIcon name="i-lucide-heart" class="text-4xl text-primary mx-auto" />
        <h3 class="text-lg font-bold">{{ t('svgToPng.adModal.title') }}</h3>
        <p class="text-sm text-muted">{{ t('svgToPng.adModal.description') }}</p>
        <div class="flex justify-center gap-3 pt-2">
          <UButton :label="t('svgToPng.adModal.watch')" size="lg" @click="onAdConfirm" />
          <UButton :label="t('svgToPng.adModal.close')" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
        </div>
      </div>
    </template>
  </UModal>
</template>
