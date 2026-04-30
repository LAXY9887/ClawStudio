<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

const { t } = useI18n()
const { openDirectLink } = useMonetagDirectLink()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online PNG to Spritesheet Generator',
        'description': 'Merge multiple PNG files into a single spritesheet with grid, strip, or bin-packed layouts.',
        'url': 'https://clawstudiouo.com/tools/png-to-spritesheet',
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
    titleKey: 'pngToSpritesheet.seo.whatIs.title',
    contentKeys: [
      'pngToSpritesheet.seo.whatIs.content',
      'pngToSpritesheet.seo.whatIs.content2',
      'pngToSpritesheet.seo.whatIs.content3'
    ]
  },
  {
    type: 'text' as const,
    titleKey: 'pngToSpritesheet.seo.layouts.title',
    contentKeys: [
      'pngToSpritesheet.seo.layouts.content',
      'pngToSpritesheet.seo.layouts.content2',
      'pngToSpritesheet.seo.layouts.content3'
    ]
  },
  {
    type: 'text' as const,
    titleKey: 'pngToSpritesheet.seo.formats.title',
    contentKeys: [
      'pngToSpritesheet.seo.formats.content',
      'pngToSpritesheet.seo.formats.content2',
      'pngToSpritesheet.seo.formats.content3'
    ]
  },
  {
    type: 'steps' as const,
    titleKey: 'pngToSpritesheet.seo.howTo.title',
    stepKeys: [
      'pngToSpritesheet.seo.howTo.step1',
      'pngToSpritesheet.seo.howTo.step2',
      'pngToSpritesheet.seo.howTo.step3',
      'pngToSpritesheet.seo.howTo.step4'
    ]
  },
  {
    type: 'features' as const,
    titleKey: 'pngToSpritesheet.seo.features.title',
    itemKeys: [
      'pngToSpritesheet.seo.features.items.layouts',
      'pngToSpritesheet.seo.features.items.cellModes',
      'pngToSpritesheet.seo.features.items.metadata',
      'pngToSpritesheet.seo.features.items.powerOf2',
      'pngToSpritesheet.seo.features.items.reorder',
      'pngToSpritesheet.seo.features.items.alignPadding',
      'pngToSpritesheet.seo.features.items.privacy'
    ]
  },
  {
    type: 'useCases' as const,
    titleKey: 'pngToSpritesheet.seo.useCases.title',
    itemKeys: [
      'pngToSpritesheet.seo.useCases.items.gameSprites',
      'pngToSpritesheet.seo.useCases.items.uiAtlas',
      'pngToSpritesheet.seo.useCases.items.animationAssembly',
      'pngToSpritesheet.seo.useCases.items.tilesets'
    ]
  },
  {
    type: 'faq' as const,
    titleKey: 'pngToSpritesheet.seo.faq.title',
    itemKeys: [
      'pngToSpritesheet.seo.faq.items.whatIsSheet',
      'pngToSpritesheet.seo.faq.items.whichLayout',
      'pngToSpritesheet.seo.faq.items.maxFiles',
      'pngToSpritesheet.seo.faq.items.metadata',
      'pngToSpritesheet.seo.faq.items.engines',
      'pngToSpritesheet.seo.faq.items.powerOf2',
      'pngToSpritesheet.seo.faq.items.transparency',
      'pngToSpritesheet.seo.faq.items.privacy'
    ]
  }
]

// State
const files = ref<File[]>([])
const status = ref<'idle' | 'converting' | 'done' | 'error'>('idle')
const errorMessage = ref('')

// Result
const resultBlob = ref<Blob | null>(null)
const resultUrl = ref('')
const resultInfo = ref({ width: 0, height: 0, size: '' })
const resultIsZip = ref(false)

// File input ref
const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)

// Options
const layout = ref<'grid' | 'horizontal' | 'vertical' | 'packed'>('grid')
const columns = ref<number | undefined>(undefined)
const cellMode = ref<'auto_max' | 'auto_uniform' | 'fixed'>('auto_max')
const cellWidth = ref<number | undefined>(undefined)
const cellHeight = ref<number | undefined>(undefined)
const fitMode = ref<'scale_fit' | 'scale_fill' | 'error'>('scale_fit')
const align = ref<'center' | 'top_left'>('center')
const padding = ref(0)
const bgColorMode = ref<'transparent' | 'custom'>('transparent')
const bgColorHex = ref('#000000')
const powerOf2 = ref(false)
const fileNameOrder = ref(false)
const trimInput = ref(false)
const extrude = ref(0)
const metadataFormat = ref<'none' | 'json_array' | 'json_hash' | 'css'>('none')

// When layout=packed, JSON Array metadata is required
watch(layout, (v) => {
  if (v === 'packed') metadataFormat.value = 'json_array'
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
  if (target.files?.length) handleFiles(Array.from(target.files))
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) handleFiles(Array.from(e.dataTransfer.files))
}

function handleFiles(newFiles: File[]) {
  const pngs = newFiles.filter(f => f.name.toLowerCase().endsWith('.png'))
  if (pngs.length === 0) {
    errorMessage.value = t('pngToSpritesheet.upload.accept')
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

const hasInput = computed(() => files.value.length >= 2)

async function convert() {
  status.value = 'converting'
  errorMessage.value = ''

  try {
    const formData = new FormData()
    files.value.forEach(f => formData.append('files', f))
    formData.append('layout', layout.value)
    if (layout.value === 'grid' && columns.value) {
      formData.append('columns', String(columns.value))
    }
    if (layout.value !== 'packed') {
      formData.append('cell_mode', cellMode.value)
      if (cellMode.value === 'fixed') {
        if (cellWidth.value) formData.append('cell_width', String(cellWidth.value))
        if (cellHeight.value) formData.append('cell_height', String(cellHeight.value))
        formData.append('fit_mode', fitMode.value)
      }
      formData.append('align', align.value)
    }
    if (padding.value > 0) formData.append('padding', String(padding.value))
    formData.append('bg_color', bgColorMode.value === 'transparent' ? 'transparent' : bgColorHex.value)
    if (powerOf2.value) formData.append('power_of_2', 'true')
    if (fileNameOrder.value) formData.append('file_name_order', 'true')
    if (trimInput.value) formData.append('trim_input', 'true')
    if (extrude.value > 0) formData.append('extrude', String(extrude.value))
    if (metadataFormat.value !== 'none') {
      formData.append('metadata_format', metadataFormat.value)
    }

    const response = await $fetch.raw('/api/png-to-spritesheet', {
      method: 'POST',
      body: formData,
      responseType: 'blob'
    })

    const blob = response._data as unknown as Blob
    const contentType = response.headers.get('content-type') || ''
    resultIsZip.value = contentType.includes('zip')
    resultBlob.value = blob

    if (resultIsZip.value) {
      resultInfo.value.size = formatSize(blob.size)
    } else {
      resultUrl.value = URL.createObjectURL(blob)
      resultInfo.value.size = formatSize(blob.size)
      const img = new Image()
      img.onload = () => {
        resultInfo.value.width = img.naturalWidth
        resultInfo.value.height = img.naturalHeight
      }
      img.src = resultUrl.value
    }

    status.value = 'done'

    if (usageCount.value >= FREE_LIMIT) {
      useDownloadStore().setBlob(blob, resultIsZip.value ? 'spritesheet.zip' : 'spritesheet.png')
      showAdModal.value = true
    }
  } catch (e: unknown) {
    status.value = 'error'
    const err = e as { data?: { detail?: string } }
    errorMessage.value = err.data?.detail || t('pngToSpritesheet.status.error')
  }
}

function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = resultIsZip.value ? 'spritesheet.zip' : 'spritesheet.png'
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
  resultInfo.value = { width: 0, height: 0, size: '' }
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
  openDirectLink()

  const localePath = useLocalePath()
  navigateTo({
    path: localePath('/download'),
    query: { type: 'spritesheet', from: localePath('/tools/png-to-spritesheet') }
  })
}

onUnmounted(() => {
  clearThumbs()
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
</script>

<template>
  <ToolPageLayout
    title-key="pngToSpritesheet.title"
    subtitle-key="pngToSpritesheet.subtitle"
    prefix="pngToSpritesheet"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-png-to-sprites"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-png-to-sprites/tutorials/merge-png-into-sprite-sheet-by-easy-png2ss"
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
            <VueDraggable v-model="files" :animation="200" ghost-class="opacity-30" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
              <div v-for="(f, i) in files" :key="f.name + f.size" class="relative group border border-muted rounded-lg overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:10px_10px] cursor-grab active:cursor-grabbing">
                <img :src="getThumbUrl(f)" :alt="f.name" class="w-full aspect-square object-contain pointer-events-none">
                <div class="absolute top-0 left-0 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br">{{ i + 1 }}</div>
                <button class="absolute top-0 right-0 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity" @click.stop="removeFile(i)">×</button>
                <p class="text-[10px] text-muted truncate px-1 py-0.5">{{ f.name }}</p>
              </div>
            </VueDraggable>
            <p class="text-xs text-muted">{{ t('pngToSpritesheet.upload.changeFiles') }}</p>
          </template>
          <template v-else>
            <UIcon name="i-lucide-upload" class="text-4xl text-muted mx-auto mb-4" />
            <p class="font-medium text-lg">{{ t('pngToSpritesheet.upload.title') }}</p>
            <p class="text-sm text-muted mt-2">{{ t('pngToSpritesheet.upload.limit') }}</p>
          </template>
        </div>

        <!-- Convert Button -->
        <div class="flex justify-end mt-4">
          <UButton
            :label="t('pngToSpritesheet.convert')"
            icon="i-lucide-sparkles"
            :disabled="!hasInput"
            @click="submitConvert"
          />
        </div>

        <!-- Remaining uses -->
        <p v-if="remainingUses <= 3 && remainingUses > 0" class="text-xs text-muted text-center">
          {{ t('pngToSpritesheet.adModal.remaining', { count: remainingUses }, remainingUses) }}
        </p>

        <!-- Error -->
        <UAlert v-if="status === 'error'" color="error" :title="errorMessage" class="mt-4">
          <template #actions>
            <UButton :label="t('pngToSpritesheet.status.retry')" color="error" variant="outline" size="sm" @click="reset" />
          </template>
        </UAlert>

        <!-- Options -->
        <UAccordion
          :items="[{ label: t('pngToSpritesheet.options.title'), value: 'options' }]"
          :default-value="['options']"
          class="mt-4"
        >
          <template #body>
            <div class="space-y-4 pt-2">
              <!-- Layout -->
              <UFormField :label="t('pngToSpritesheet.options.layout')" :hint="t('pngToSpritesheet.options.layoutHint')">
                <URadioGroup
                  v-model="layout"
                  :items="[
                    { label: t('pngToSpritesheet.options.layoutGrid'), value: 'grid' },
                    { label: t('pngToSpritesheet.options.layoutHorizontal'), value: 'horizontal' },
                    { label: t('pngToSpritesheet.options.layoutVertical'), value: 'vertical' },
                    { label: t('pngToSpritesheet.options.layoutPacked'), value: 'packed' }
                  ]"
                />
              </UFormField>

              <!-- Grid columns -->
              <UFormField v-if="layout === 'grid'" :label="t('pngToSpritesheet.options.columns')" :hint="t('pngToSpritesheet.options.columnsHint')">
                <UInput v-model.number="columns" type="number" :min="1" placeholder="Auto" />
              </UFormField>

              <!-- Cell mode (not for packed) -->
              <template v-if="layout !== 'packed'">
                <UFormField :label="t('pngToSpritesheet.options.cellMode')" :hint="t('pngToSpritesheet.options.cellModeHint')">
                  <URadioGroup
                    v-model="cellMode"
                    :items="[
                      { label: t('pngToSpritesheet.options.cellModeAutoMax'), value: 'auto_max' },
                      { label: t('pngToSpritesheet.options.cellModeAutoUniform'), value: 'auto_uniform' },
                      { label: t('pngToSpritesheet.options.cellModeFixed'), value: 'fixed' }
                    ]"
                  />
                </UFormField>

                <!-- Fixed cell size -->
                <div v-if="cellMode === 'fixed'" class="grid grid-cols-2 gap-4">
                  <UFormField :label="t('pngToSpritesheet.options.cellWidth')">
                    <UInput v-model.number="cellWidth" type="number" :min="1" />
                  </UFormField>
                  <UFormField :label="t('pngToSpritesheet.options.cellHeight')">
                    <UInput v-model.number="cellHeight" type="number" :min="1" />
                  </UFormField>
                </div>

                <!-- Fit mode -->
                <UFormField v-if="cellMode === 'fixed'" :label="t('pngToSpritesheet.options.fitMode')" :hint="t('pngToSpritesheet.options.fitModeHint')">
                  <URadioGroup
                    v-model="fitMode"
                    :items="[
                      { label: t('pngToSpritesheet.options.fitModeScaleFit'), value: 'scale_fit' },
                      { label: t('pngToSpritesheet.options.fitModeScaleFill'), value: 'scale_fill' },
                      { label: t('pngToSpritesheet.options.fitModeError'), value: 'error' }
                    ]"
                  />
                </UFormField>

                <!-- Align -->
                <UFormField :label="t('pngToSpritesheet.options.align')" :hint="t('pngToSpritesheet.options.alignHint')">
                  <URadioGroup
                    v-model="align"
                    :items="[
                      { label: t('pngToSpritesheet.options.alignCenter'), value: 'center' },
                      { label: t('pngToSpritesheet.options.alignTopLeft'), value: 'top_left' }
                    ]"
                  />
                </UFormField>
              </template>

              <!-- Padding -->
              <UFormField :label="t('pngToSpritesheet.options.padding')" :hint="t('pngToSpritesheet.options.paddingHint')">
                <UInput v-model.number="padding" type="number" :min="0" />
              </UFormField>

              <!-- Background color -->
              <UFormField :label="t('pngToSpritesheet.options.bgColor')" :hint="t('pngToSpritesheet.options.bgColorHint')">
                <URadioGroup
                  v-model="bgColorMode"
                  :items="[
                    { label: t('pngToSpritesheet.options.bgColorTransparent'), value: 'transparent' },
                    { label: t('pngToSpritesheet.options.bgColorCustom'), value: 'custom' }
                  ]"
                />
                <div v-if="bgColorMode === 'custom'" class="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    :value="bgColorHex"
                    class="w-10 h-10 rounded cursor-pointer border border-muted bg-transparent p-0.5"
                    @input="bgColorHex = ($event.target as HTMLInputElement).value.toUpperCase()"
                  >
                  <UInput v-model="bgColorHex" placeholder="#000000" class="flex-1" />
                </div>
              </UFormField>

              <!-- Power of 2 -->
              <USwitch v-model="powerOf2" :label="t('pngToSpritesheet.options.powerOf2')" />
              <p v-if="powerOf2" class="text-xs text-muted -mt-2 pl-1">{{ t('pngToSpritesheet.options.powerOf2Hint') }}</p>

              <!-- File name order -->
              <USwitch v-model="fileNameOrder" :label="t('pngToSpritesheet.options.fileNameOrder')" />
              <p v-if="fileNameOrder" class="text-xs text-muted -mt-2 pl-1">{{ t('pngToSpritesheet.options.fileNameOrderHint') }}</p>

              <!-- Auto-trim input -->
              <USwitch v-model="trimInput" :label="t('pngToSpritesheet.options.trimInput')" />
              <p v-if="trimInput" class="text-xs text-muted -mt-2 pl-1">{{ t('pngToSpritesheet.options.trimInputHint') }}</p>

              <!-- Extrude -->
              <UFormField :label="t('pngToSpritesheet.options.extrude')" :hint="t('pngToSpritesheet.options.extrudeHint')">
                <UInput v-model.number="extrude" type="number" :min="0" />
              </UFormField>

              <!-- Metadata format -->
              <UFormField :label="t('pngToSpritesheet.options.metadataFormat')" :hint="t('pngToSpritesheet.options.metadataFormatHint')">
                <URadioGroup
                  v-model="metadataFormat"
                  :disabled="layout === 'packed'"
                  :items="[
                    { label: t('pngToSpritesheet.options.metadataFormatNone'), value: 'none' },
                    { label: t('pngToSpritesheet.options.metadataFormatJsonArray'), value: 'json_array' },
                    { label: t('pngToSpritesheet.options.metadataFormatJsonHash'), value: 'json_hash' },
                    { label: t('pngToSpritesheet.options.metadataFormatCss'), value: 'css' }
                  ]"
                />
              </UFormField>
            </div>
          </template>
        </UAccordion>

        <!-- Adsterra Native（工作區廣告位，置於 Options 之後） -->
        <WorkspaceNativeAd />
      </div>

      <!-- Converting -->
      <div v-if="status === 'converting'" class="text-center py-16">
        <UIcon name="i-lucide-loader-circle" class="text-5xl text-primary animate-spin mx-auto mb-4" />
        <p class="text-lg font-medium">{{ t('pngToSpritesheet.status.converting') }}</p>
      </div>

      <!-- Result -->
      <div v-if="status === 'done'" class="space-y-6">
        <!-- PNG preview -->
        <div v-if="!resultIsZip && resultUrl">
          <h3 class="font-semibold text-lg mb-2">{{ t('pngToSpritesheet.result.title') }}</h3>
          <div class="border border-muted rounded-xl overflow-auto bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
            <img :src="resultUrl" alt="Spritesheet preview" class="max-w-full mx-auto">
          </div>
          <p class="text-sm text-muted mt-2">{{ t('pngToSpritesheet.result.info', resultInfo) }}</p>
        </div>

        <!-- ZIP info -->
        <div v-if="resultIsZip">
          <UAlert
            color="success"
            icon="i-lucide-check-circle"
            :title="t('pngToSpritesheet.result.title')"
            :description="`ZIP • ${resultInfo.size}`"
          />
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3">
          <UButton
            v-if="!limitExceeded"
            :label="resultIsZip ? t('pngToSpritesheet.result.downloadZip') : t('pngToSpritesheet.result.download')"
            icon="i-lucide-download"
            size="lg"
            @click="downloadResult"
          />
          <UButton
            v-if="limitExceeded"
            :label="t('pngToSpritesheet.adModal.watch')"
            icon="i-lucide-arrow-right"
            size="lg"
            @click="showAdModal = true"
          />
          <UButton
            :label="t('pngToSpritesheet.result.reset')"
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
        <h3 class="text-lg font-bold">{{ t('pngToSpritesheet.adModal.title') }}</h3>
        <p class="text-sm text-muted">{{ t('pngToSpritesheet.adModal.description') }}</p>
        <div class="flex justify-center gap-3 pt-2">
          <UButton :label="t('pngToSpritesheet.adModal.watch')" size="lg" @click="onAdConfirm" />
          <UButton :label="t('pngToSpritesheet.adModal.close')" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
        </div>
      </div>
    </template>
  </UModal>
</template>
