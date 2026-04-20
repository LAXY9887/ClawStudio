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
        'name': 'Free Online Spritesheet Splitter',
        'description': 'Slice a spritesheet PNG into individual frames or generate TexturePacker-compatible atlas JSON.',
        'url': 'https://clawstudiouo.com/tools/split-spritesheet',
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
  {
    type: 'text' as const,
    titleKey: 'splitSpritesheet.seo.whatIs.title',
    contentKeys: [
      'splitSpritesheet.seo.whatIs.content',
      'splitSpritesheet.seo.whatIs.content2',
      'splitSpritesheet.seo.whatIs.content3'
    ]
  },
  {
    type: 'text' as const,
    titleKey: 'splitSpritesheet.seo.outputs.title',
    contentKeys: [
      'splitSpritesheet.seo.outputs.content',
      'splitSpritesheet.seo.outputs.content2',
      'splitSpritesheet.seo.outputs.content3'
    ]
  },
  {
    type: 'text' as const,
    titleKey: 'splitSpritesheet.seo.metadataFormats.title',
    contentKeys: [
      'splitSpritesheet.seo.metadataFormats.content',
      'splitSpritesheet.seo.metadataFormats.content2',
      'splitSpritesheet.seo.metadataFormats.content3'
    ]
  },
  {
    type: 'steps' as const,
    titleKey: 'splitSpritesheet.seo.howTo.title',
    stepKeys: [
      'splitSpritesheet.seo.howTo.step1',
      'splitSpritesheet.seo.howTo.step2',
      'splitSpritesheet.seo.howTo.step3',
      'splitSpritesheet.seo.howTo.step4'
    ]
  },
  {
    type: 'features' as const,
    titleKey: 'splitSpritesheet.seo.features.title',
    itemKeys: [
      'splitSpritesheet.seo.features.items.gridAndCell',
      'splitSpritesheet.seo.features.items.allOutputModes',
      'splitSpritesheet.seo.features.items.metadataFormats',
      'splitSpritesheet.seo.features.items.rangeSelection',
      'splitSpritesheet.seo.features.items.trimAndPadding',
      'splitSpritesheet.seo.features.items.skipEmpty',
      'splitSpritesheet.seo.features.items.singleFile',
      'splitSpritesheet.seo.features.items.privacy'
    ]
  },
  {
    type: 'useCases' as const,
    titleKey: 'splitSpritesheet.seo.useCases.title',
    itemKeys: [
      'splitSpritesheet.seo.useCases.items.engineIntegration',
      'splitSpritesheet.seo.useCases.items.frameExtraction',
      'splitSpritesheet.seo.useCases.items.partialExtraction',
      'splitSpritesheet.seo.useCases.items.cssAnimations'
    ]
  },
  {
    type: 'faq' as const,
    titleKey: 'splitSpritesheet.seo.faq.title',
    itemKeys: [
      'splitSpritesheet.seo.faq.items.gridVsCell',
      'splitSpritesheet.seo.faq.items.rangeFormat',
      'splitSpritesheet.seo.faq.items.skipEmpty',
      'splitSpritesheet.seo.faq.items.padding',
      'splitSpritesheet.seo.faq.items.metadataFormat',
      'splitSpritesheet.seo.faq.items.outputFormats',
      'splitSpritesheet.seo.faq.items.maxSize',
      'splitSpritesheet.seo.faq.items.privacy'
    ]
  }
]

// State
const file = ref<File | null>(null)
const status = ref<'idle' | 'converting' | 'done' | 'error'>('idle')
const errorMessage = ref('')

// Result
const resultBlob = ref<Blob | null>(null)
const resultSize = ref('')

// File input
const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const previewUrl = ref('')

// Slicing mode
const slicingMode = ref<'grid' | 'cell'>('grid')

// Grid params
const columns = ref<number | undefined>(undefined)
const rows = ref<number | undefined>(undefined)

// Cell params
const cellWidth = ref<number | undefined>(undefined)
const cellHeight = ref<number | undefined>(undefined)

// Options
const padding = ref(0)
const trimTop = ref(0)
const trimRight = ref(0)
const trimBottom = ref(0)
const trimLeft = ref(0)
const frameCount = ref<number | undefined>(undefined)
const columnRange = ref('')
const rowRange = ref('')
const skipEmpty = ref(true)
const output = ref<'frames' | 'metadata' | 'both'>('frames')
const metadataFormat = ref<'json_array' | 'json_hash' | 'css'>('json_array')

const hasInput = computed(() => {
  if (!file.value) return false
  if (slicingMode.value === 'grid') return !!(columns.value && rows.value)
  return !!(cellWidth.value && cellHeight.value)
})

const showMetadataFormat = computed(() => output.value !== 'frames')

const downloadFilename = computed(() => {
  if (output.value === 'frames') return 'frames.zip'
  if (output.value === 'both') return 'split.zip'
  if (metadataFormat.value === 'css') return 'atlas.css'
  if (metadataFormat.value === 'json_hash') return 'atlas-hash.json'
  return 'atlas-array.json'
})

const resultTitle = computed(() => {
  if (output.value === 'frames') return t('splitSpritesheet.result.framesTitle')
  if (output.value === 'metadata') return t('splitSpritesheet.result.metadataTitle')
  return t('splitSpritesheet.result.bothTitle')
})

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
  if (target.files?.length) handleFile(target.files[0])
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const dropped = e.dataTransfer?.files?.[0]
  if (dropped) handleFile(dropped)
}

function handleFile(f: File) {
  if (!f.name.toLowerCase().endsWith('.png')) {
    errorMessage.value = t('splitSpritesheet.upload.accept')
    status.value = 'error'
    return
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = f
  previewUrl.value = URL.createObjectURL(f)
  errorMessage.value = ''
  status.value = 'idle'
}

async function convert() {
  if (!file.value) return
  status.value = 'converting'
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file.value)

    if (slicingMode.value === 'grid') {
      formData.append('columns', String(columns.value))
      formData.append('rows', String(rows.value))
    } else {
      formData.append('cell_width', String(cellWidth.value))
      formData.append('cell_height', String(cellHeight.value))
    }

    if (padding.value > 0) formData.append('padding', String(padding.value))
    if (trimTop.value > 0) formData.append('trim_top', String(trimTop.value))
    if (trimRight.value > 0) formData.append('trim_right', String(trimRight.value))
    if (trimBottom.value > 0) formData.append('trim_bottom', String(trimBottom.value))
    if (trimLeft.value > 0) formData.append('trim_left', String(trimLeft.value))
    if (frameCount.value) formData.append('frame_count', String(frameCount.value))
    if (columnRange.value) formData.append('column_range', columnRange.value)
    if (rowRange.value) formData.append('row_range', rowRange.value)
    formData.append('skip_empty', String(skipEmpty.value))
    formData.append('output', output.value)
    if (output.value !== 'frames') {
      formData.append('metadata_format', metadataFormat.value)
    }

    const response = await $fetch.raw('/api/split-spritesheet', {
      method: 'POST',
      body: formData,
      responseType: 'blob'
    })

    const blob = response._data as unknown as Blob
    resultBlob.value = blob
    resultSize.value = formatSize(blob.size)
    status.value = 'done'

    if (usageCount.value >= FREE_LIMIT) {
      useDownloadStore().setBlob(blob, downloadFilename.value)
      showAdModal.value = true
    }
  } catch (e: unknown) {
    status.value = 'error'
    const err = e as { data?: { detail?: string } }
    errorMessage.value = err.data?.detail || t('splitSpritesheet.status.error')
  }
}

function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = downloadFilename.value
  a.click()
  URL.revokeObjectURL(url)
}

function reset() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = null
  previewUrl.value = ''
  status.value = 'idle'
  errorMessage.value = ''
  resultBlob.value = null
  resultSize.value = ''
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
    query: { from: localePath('/tools/split-spritesheet') }
  })
}

useSeoMeta({
  title: () => t('splitSpritesheet.title'),
  description: () => t('splitSpritesheet.subtitle')
})

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <ToolPageLayout
    title-key="splitSpritesheet.title"
    subtitle-key="splitSpritesheet.subtitle"
    prefix="splitSpritesheet"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-png-to-sprites"
  >
    <template #workspace>
      <div v-if="status === 'idle' || status === 'error'">
        <!-- Upload Zone -->
        <div
          class="relative border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors"
          :class="[
            isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50',
            file ? 'p-4' : 'p-16'
          ]"
          @click="fileInput?.click()"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" accept=".png" class="hidden" @change="onFileSelect">
          <template v-if="file && previewUrl">
            <div class="border border-muted rounded-lg overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:10px_10px] max-h-48 flex items-center justify-center mb-3">
              <img :src="previewUrl" :alt="file.name" class="max-h-48 max-w-full object-contain pointer-events-none">
            </div>
            <p class="text-sm font-medium">{{ file.name }}</p>
            <p class="text-xs text-muted mt-1">{{ t('splitSpritesheet.upload.changeFile') }}</p>
          </template>
          <template v-else>
            <UIcon name="i-lucide-upload" class="text-4xl text-muted mx-auto mb-4" />
            <p class="font-medium text-lg">{{ t('splitSpritesheet.upload.title') }}</p>
            <p class="text-sm text-muted mt-2">{{ t('splitSpritesheet.upload.limit') }}</p>
          </template>
        </div>

        <!-- Slicing Mode Toggle -->
        <div class="flex gap-2 mt-4">
          <UButton
            v-for="m in ['grid', 'cell'] as const"
            :key="m"
            :variant="slicingMode === m ? 'solid' : 'outline'"
            color="neutral"
            size="sm"
            @click="slicingMode = m"
          >
            {{ t(`splitSpritesheet.slicingMode.${m}`) }}
          </UButton>
        </div>

        <!-- Grid params -->
        <div v-if="slicingMode === 'grid'" class="grid grid-cols-2 gap-4 mt-4">
          <UFormField :label="t('splitSpritesheet.options.columns')">
            <UInput v-model.number="columns" type="number" :min="1" placeholder="e.g. 4" />
          </UFormField>
          <UFormField :label="t('splitSpritesheet.options.rows')">
            <UInput v-model.number="rows" type="number" :min="1" placeholder="e.g. 3" />
          </UFormField>
        </div>

        <!-- Cell params -->
        <div v-else class="grid grid-cols-2 gap-4 mt-4">
          <UFormField :label="t('splitSpritesheet.options.cellWidth')">
            <UInput v-model.number="cellWidth" type="number" :min="1" placeholder="e.g. 64" />
          </UFormField>
          <UFormField :label="t('splitSpritesheet.options.cellHeight')">
            <UInput v-model.number="cellHeight" type="number" :min="1" placeholder="e.g. 64" />
          </UFormField>
        </div>

        <!-- Convert Button -->
        <div class="flex justify-end mt-4">
          <UButton
            :label="t('splitSpritesheet.convert')"
            icon="i-lucide-split"
            :disabled="!hasInput"
            @click="submitConvert"
          />
        </div>

        <!-- Remaining uses -->
        <p v-if="remainingUses <= 3 && remainingUses > 0" class="text-xs text-muted text-center">
          {{ t('splitSpritesheet.adModal.remaining', { count: remainingUses }, remainingUses) }}
        </p>

        <!-- Error -->
        <UAlert v-if="status === 'error'" color="error" :title="errorMessage" class="mt-4">
          <template #actions>
            <UButton :label="t('splitSpritesheet.status.retry')" color="error" variant="outline" size="sm" @click="reset" />
          </template>
        </UAlert>

        <!-- Options Accordion -->
        <UAccordion
          :items="[{ label: t('splitSpritesheet.options.title'), value: 'options' }]"
          class="mt-4"
        >
          <template #body>
            <div class="space-y-4 pt-2">

              <!-- Cell Padding -->
              <UFormField :label="t('splitSpritesheet.options.padding')" :hint="t('splitSpritesheet.options.paddingHint')">
                <UInput v-model.number="padding" type="number" :min="0" />
              </UFormField>

              <!-- Trim Margins -->
              <UFormField :label="t('splitSpritesheet.options.trimTitle')" :hint="t('splitSpritesheet.options.trimHint')">
                <div class="grid grid-cols-2 gap-3 mt-1">
                  <UFormField :label="t('splitSpritesheet.options.trimTop')">
                    <UInput v-model.number="trimTop" type="number" :min="0" />
                  </UFormField>
                  <UFormField :label="t('splitSpritesheet.options.trimRight')">
                    <UInput v-model.number="trimRight" type="number" :min="0" />
                  </UFormField>
                  <UFormField :label="t('splitSpritesheet.options.trimBottom')">
                    <UInput v-model.number="trimBottom" type="number" :min="0" />
                  </UFormField>
                  <UFormField :label="t('splitSpritesheet.options.trimLeft')">
                    <UInput v-model.number="trimLeft" type="number" :min="0" />
                  </UFormField>
                </div>
              </UFormField>

              <!-- Frame Count -->
              <UFormField :label="t('splitSpritesheet.options.frameCount')" :hint="t('splitSpritesheet.options.frameCountHint')">
                <UInput v-model.number="frameCount" type="number" :min="1" placeholder="Auto" />
              </UFormField>

              <!-- Column / Row Range -->
              <div class="grid grid-cols-2 gap-4">
                <UFormField :label="t('splitSpritesheet.options.columnRange')" :hint="t('splitSpritesheet.options.columnRangeHint')">
                  <UInput v-model="columnRange" placeholder='e.g. "0-3"' />
                </UFormField>
                <UFormField :label="t('splitSpritesheet.options.rowRange')" :hint="t('splitSpritesheet.options.rowRangeHint')">
                  <UInput v-model="rowRange" placeholder='e.g. "1-2"' />
                </UFormField>
              </div>

              <!-- Skip Empty -->
              <USwitch v-model="skipEmpty" :label="t('splitSpritesheet.options.skipEmpty')" />
              <p class="text-xs text-muted -mt-2 pl-1">{{ t('splitSpritesheet.options.skipEmptyHint') }}</p>

              <!-- Output mode -->
              <UFormField :label="t('splitSpritesheet.options.output')">
                <URadioGroup
                  v-model="output"
                  :items="[
                    { label: t('splitSpritesheet.options.outputFrames'), value: 'frames' },
                    { label: t('splitSpritesheet.options.outputMetadata'), value: 'metadata' },
                    { label: t('splitSpritesheet.options.outputBoth'), value: 'both' }
                  ]"
                />
              </UFormField>

              <!-- Metadata format (only when output includes metadata) -->
              <UFormField v-if="showMetadataFormat" :label="t('splitSpritesheet.options.metadataFormat')">
                <URadioGroup
                  v-model="metadataFormat"
                  :items="[
                    { label: t('splitSpritesheet.options.metadataFormatJsonArray'), value: 'json_array' },
                    { label: t('splitSpritesheet.options.metadataFormatJsonHash'), value: 'json_hash' },
                    { label: t('splitSpritesheet.options.metadataFormatCss'), value: 'css' }
                  ]"
                />
              </UFormField>

            </div>
          </template>
        </UAccordion>
      </div>

      <!-- Converting -->
      <div v-if="status === 'converting'" class="text-center py-16">
        <UIcon name="i-lucide-loader-circle" class="text-5xl text-primary animate-spin mx-auto mb-4" />
        <p class="text-lg font-medium">{{ t('splitSpritesheet.status.converting') }}</p>
      </div>

      <!-- Result -->
      <div v-if="status === 'done'" class="space-y-6">
        <UAlert
          color="success"
          icon="i-lucide-check-circle"
          :title="resultTitle"
          :description="resultSize"
        />

        <div class="flex gap-3">
          <UButton
            v-if="!limitExceeded"
            :label="t('splitSpritesheet.result.download')"
            icon="i-lucide-download"
            size="lg"
            @click="downloadResult"
          />
          <UButton
            v-if="limitExceeded"
            :label="t('splitSpritesheet.adModal.watch')"
            icon="i-lucide-arrow-right"
            size="lg"
            @click="showAdModal = true"
          />
          <UButton
            :label="t('splitSpritesheet.result.reset')"
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
        <h3 class="text-lg font-bold">{{ t('splitSpritesheet.adModal.title') }}</h3>
        <p class="text-sm text-muted">{{ t('splitSpritesheet.adModal.description') }}</p>
        <div class="flex justify-center gap-3 pt-2">
          <UButton :label="t('splitSpritesheet.adModal.watch')" size="lg" @click="onAdConfirm" />
          <UButton :label="t('splitSpritesheet.adModal.close')" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
        </div>
      </div>
    </template>
  </UModal>
</template>
