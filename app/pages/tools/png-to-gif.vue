<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

const { t } = useI18n()

const seoSections: import('~/types/seo').SeoSection[] = [
  {
    type: 'text' as const,
    titleKey: 'toGif.seo.whatIsFramesToGif.title',
    contentKeys: ['toGif.seo.whatIsFramesToGif.content', 'toGif.seo.whatIsFramesToGif.content2', 'toGif.seo.whatIsFramesToGif.content3'],
    adSlot: '3522192663'
  },
  {
    type: 'text' as const,
    titleKey: 'toGif.seo.whatIsSpritesheetToGif.title',
    contentKeys: ['toGif.seo.whatIsSpritesheetToGif.content', 'toGif.seo.whatIsSpritesheetToGif.content2', 'toGif.seo.whatIsSpritesheetToGif.content3'],
    adSlot: '6692010437'
  },
  {
    type: 'text' as const,
    titleKey: 'toGif.seo.whyConvert.title',
    contentKeys: ['toGif.seo.whyConvert.content', 'toGif.seo.whyConvert.content2', 'toGif.seo.whyConvert.content3'],
    adSlot: '7697241396'
  },
  {
    type: 'text' as const,
    titleKey: 'toGif.seo.formatsExplained.title',
    contentKeys: ['toGif.seo.formatsExplained.content', 'toGif.seo.formatsExplained.content2', 'toGif.seo.formatsExplained.content3'],
    adSlot: '5071078051'
  },
  {
    type: 'steps' as const,
    titleKey: 'toGif.seo.howTo.title',
    stepKeys: ['toGif.seo.howTo.step1', 'toGif.seo.howTo.step2', 'toGif.seo.howTo.step3', 'toGif.seo.howTo.step4'],
    adSlot: '8885162572'
  },
  {
    type: 'features' as const,
    titleKey: 'toGif.seo.features.title',
    itemKeys: [
      'toGif.seo.features.items.frames', 'toGif.seo.features.items.spritesheet',
      'toGif.seo.features.items.duration', 'toGif.seo.features.items.fileOrder',
      'toGif.seo.features.items.resize', 'toGif.seo.features.items.rangeSelect',
      'toGif.seo.features.items.privacy'
    ],
    adSlot: '7572080900'
  },
  {
    type: 'useCases' as const,
    titleKey: 'toGif.seo.useCases.title',
    itemKeys: [
      'toGif.seo.useCases.items.gamePreview', 'toGif.seo.useCases.items.socialMedia',
      'toGif.seo.useCases.items.documentation', 'toGif.seo.useCases.items.prototyping'
    ],
    adSlot: '1718885356'
  },
  {
    type: 'faq' as const,
    titleKey: 'toGif.seo.faq.title',
    itemKeys: [
      'toGif.seo.faq.items.formats', 'toGif.seo.faq.items.maxFiles',
      'toGif.seo.faq.items.frameOrder', 'toGif.seo.faq.items.differentSizes',
      'toGif.seo.faq.items.gridVsCell', 'toGif.seo.faq.items.transparency',
      'toGif.seo.faq.items.free', 'toGif.seo.faq.items.api'
    ],
    adSlot: '9864239738'
  }
]

// Mode: frames or spritesheet
const mode = ref<'frames' | 'spritesheet'>('frames')

// State
const frameFiles = ref<File[]>([])
const spritesheetFile = ref<File | null>(null)
const pngUrl = ref('')
const status = ref<'idle' | 'converting' | 'done' | 'error'>('idle')
const errorMessage = ref('')

// Result
const resultBlob = ref<Blob | null>(null)
const resultUrl = ref('')
const resultInfo = ref({ width: 0, height: 0, size: '' })

// Preview (spritesheet mode)
const previewUrl = ref('')
const previewWidth = ref(0)
const previewHeight = ref(0)

// File input refs
const framesInput = ref<HTMLInputElement>()
const spritesheetInput = ref<HTMLInputElement>()
const isDragging = ref(false)

// Frames options
const duration = ref(100)
const loop = ref(0)
const fileNameOrder = ref(false)
const resizeMode = ref<'transparent' | 'fill' | 'error'>('transparent')
const bgFillColor = ref('#000000')

// Spritesheet slicing
const slicingMode = ref<'grid' | 'cell'>('grid')
const columns = ref<number | undefined>(undefined)
const rows = ref<number | undefined>(undefined)
const cellWidth = ref<number | undefined>(undefined)
const cellHeight = ref<number | undefined>(undefined)

// Spritesheet options
const frameCount = ref<number | undefined>(undefined)
const ssPadding = ref(0)
const columnRange = ref('')
const rowRange = ref('')
const skipEmpty = ref(true)
const ssDuration = ref(100)
const ssLoop = ref(0)

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

// --- Frames mode handlers ---
function onFramesSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.length) handleFrames(Array.from(target.files))
}

function onFramesDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) handleFrames(Array.from(e.dataTransfer.files))
}

function handleFrames(newFiles: File[]) {
  const pngs = newFiles.filter(f => f.name.toLowerCase().endsWith('.png'))
  if (pngs.length === 0) {
    errorMessage.value = t('toGif.framesUpload.accept')
    status.value = 'error'
    return
  }
  frameFiles.value = [...frameFiles.value, ...pngs]
  errorMessage.value = ''
  status.value = 'idle'
}

// Frame thumbnail URLs
const frameThumbs = ref<Map<File, string>>(new Map())

function getThumbUrl(file: File): string {
  if (!frameThumbs.value.has(file)) {
    frameThumbs.value.set(file, URL.createObjectURL(file))
  }
  return frameThumbs.value.get(file)!
}

function removeFrame(index: number) {
  const file = frameFiles.value[index]
  if (file) {
    const url = frameThumbs.value.get(file)
    if (url) {
      URL.revokeObjectURL(url)
      frameThumbs.value.delete(file)
    }
  }
  frameFiles.value.splice(index, 1)
}

function clearThumbs() {
  frameThumbs.value.forEach(url => URL.revokeObjectURL(url))
  frameThumbs.value.clear()
}

// --- Spritesheet mode handlers ---
function onSpritesheetSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) handleSpritesheet(target.files[0])
}

function onSpritesheetDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files[0]) handleSpritesheet(e.dataTransfer.files[0])
}

function handleSpritesheet(f: File) {
  if (!f.name.toLowerCase().endsWith('.png')) {
    errorMessage.value = t('toGif.spritesheetUpload.accept')
    status.value = 'error'
    return
  }
  if (f.size > 20 * 1024 * 1024) {
    errorMessage.value = t('toGif.spritesheetUpload.limit')
    status.value = 'error'
    return
  }
  spritesheetFile.value = f
  pngUrl.value = ''
  errorMessage.value = ''
  status.value = 'idle'
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(f)

  // Get image dimensions for preview overlay
  const img = new Image()
  img.onload = () => {
    previewWidth.value = img.naturalWidth
    previewHeight.value = img.naturalHeight
  }
  img.src = previewUrl.value
}

// --- Shared ---
const hasInput = computed(() => {
  if (mode.value === 'frames') return frameFiles.value.length >= 2
  return !!spritesheetFile.value || !!pngUrl.value.trim()
})

async function convert() {
  status.value = 'converting'
  errorMessage.value = ''

  try {
    const formData = new FormData()
    let endpoint: string

    if (mode.value === 'frames') {
      endpoint = '/api/from-frames'
      frameFiles.value.forEach(f => formData.append('files', f))
      formData.append('duration', String(duration.value))
      formData.append('loop', String(loop.value))
      if (fileNameOrder.value) formData.append('file_name_order', 'true')
      formData.append('resize', resizeMode.value)
      if (resizeMode.value === 'fill') formData.append('bg_fill_color', bgFillColor.value)
    } else {
      endpoint = '/api/from-spritesheet'
      if (spritesheetFile.value) {
        formData.append('file', spritesheetFile.value)
      } else if (pngUrl.value) {
        formData.append('url', pngUrl.value)
      } else {
        return
      }
      if (slicingMode.value === 'grid') {
        if (columns.value) formData.append('columns', String(columns.value))
        if (rows.value) formData.append('rows', String(rows.value))
      } else {
        if (cellWidth.value) formData.append('cell_width', String(cellWidth.value))
        if (cellHeight.value) formData.append('cell_height', String(cellHeight.value))
      }
      if (frameCount.value) formData.append('frame_count', String(frameCount.value))
      if (ssPadding.value > 0) formData.append('padding', String(ssPadding.value))
      if (columnRange.value.trim()) formData.append('column_range', columnRange.value.trim())
      if (rowRange.value.trim()) formData.append('row_range', rowRange.value.trim())
      formData.append('skip_empty', String(skipEmpty.value))
      formData.append('duration', String(ssDuration.value))
      formData.append('loop', String(ssLoop.value))
    }

    const response = await $fetch.raw(endpoint, {
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
      useDownloadStore().setBlob(blob, 'animation.gif')
      showAdModal.value = true
    }
  } catch (e: unknown) {
    status.value = 'error'
    const err = e as { data?: { detail?: string } }
    errorMessage.value = err.data?.detail || t('toGif.status.error')
  }
}

function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = 'animation.gif'
  a.click()
  URL.revokeObjectURL(url)
}

function reset() {
  clearThumbs()
  frameFiles.value = []
  spritesheetFile.value = null
  pngUrl.value = ''
  status.value = 'idle'
  errorMessage.value = ''
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewWidth.value = 0
  previewHeight.value = 0
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultBlob.value = null
  resultUrl.value = ''
  resultInfo.value = { width: 0, height: 0, size: '' }
  if (framesInput.value) framesInput.value.value = ''
  if (spritesheetInput.value) spritesheetInput.value.value = ''
}

function submitConvert() {
  if (!hasInput.value) return
  if (mode.value === 'spritesheet' && pngUrl.value.trim()) spritesheetFile.value = null
  usageCount.value++
  convert()
}

function onAdConfirm() {
  showAdModal.value = false
  const localePath = useLocalePath()
  navigateTo({
    path: localePath('/download'),
    query: { type: 'gif', from: localePath('/tools/png-to-gif') }
  })
}

onUnmounted(() => {
  clearThumbs()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
</script>

<template>
  <ToolPageLayout
    title-key="toGif.title"
    subtitle-key="toGif.subtitle"
    prefix="toGif"
    :seo-sections="seoSections"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-gif-to-sprites/tutorials/how-to-use-easy-png-to-gif-1"
  >
    <template #workspace>
      <!-- Mode Selector -->
      <UTabs
        :items="[
          { label: t('toGif.mode.frames'), value: 'frames' },
          { label: t('toGif.mode.spritesheet'), value: 'spritesheet' }
        ]"
        :model-value="mode"
        @update:model-value="mode = ($event as 'frames' | 'spritesheet'); reset()"
      />

      <!-- Upload & Options (idle/error) -->
      <div v-if="status === 'idle' || status === 'error'">

        <!-- ========== FRAMES MODE ========== -->
        <template v-if="mode === 'frames'">
          <div
            class="relative border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors"
            :class="[
              isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50',
              frameFiles.length > 0 ? 'p-4' : 'p-16'
            ]"
            @click="framesInput?.click()"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onFramesDrop"
          >
            <input ref="framesInput" type="file" accept=".png" multiple class="hidden" @change="onFramesSelect">
            <template v-if="frameFiles.length > 0">
              <p class="text-sm font-medium mb-3">{{ frameFiles.length }} files selected</p>
              <VueDraggable v-model="frameFiles" :animation="200" ghost-class="opacity-30" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
                <div v-for="(f, i) in frameFiles" :key="f.name + f.size" class="relative group border border-muted rounded-lg overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:10px_10px] cursor-grab active:cursor-grabbing">
                  <img :src="getThumbUrl(f)" :alt="f.name" class="w-full aspect-square object-contain pointer-events-none">
                  <div class="absolute top-0 left-0 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br">{{ i + 1 }}</div>
                  <button class="absolute top-0 right-0 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity" @click.stop="removeFrame(i)">×</button>
                  <p class="text-[10px] text-muted truncate px-1 py-0.5">{{ f.name }}</p>
                </div>
              </VueDraggable>
              <p class="text-xs text-muted">{{ t('toGif.framesUpload.changeFiles') }}</p>
            </template>
            <template v-else>
              <UIcon name="i-lucide-upload" class="text-4xl text-muted mx-auto mb-4" />
              <p class="font-medium text-lg">{{ t('toGif.framesUpload.title') }}</p>
              <p class="text-sm text-muted mt-2">{{ t('toGif.framesUpload.limit') }}</p>
            </template>
          </div>

          <!-- Convert button -->
          <div class="flex justify-end mt-4">
            <UButton :label="t('toGif.convert')" icon="i-lucide-sparkles" :disabled="!hasInput" @click="submitConvert" />
          </div>

          <!-- Frames Options -->
          <UAccordion :items="[{ label: t('toGif.framesOptions.title'), value: 'opts' }]" :default-value="['opts']" class="mt-4">
            <template #body>
              <div class="space-y-4 pt-2">
                <div class="grid grid-cols-2 gap-4">
                  <UFormField :label="t('toGif.framesOptions.duration')" :hint="t('toGif.framesOptions.durationHint')">
                    <UInput v-model.number="duration" type="number" :min="10" :max="10000" />
                  </UFormField>
                  <UFormField :label="t('toGif.framesOptions.loop')" :hint="t('toGif.framesOptions.loopHint')">
                    <UInput v-model.number="loop" type="number" :min="0" />
                  </UFormField>
                </div>
                <USwitch v-model="fileNameOrder" :label="t('toGif.framesOptions.fileNameOrder')" />
                <p v-if="fileNameOrder" class="text-xs text-muted -mt-2 pl-1">{{ t('toGif.framesOptions.fileNameOrderHint') }}</p>
                <UFormField :label="t('toGif.framesOptions.resize')" :hint="t('toGif.framesOptions.resizeHint')">
                  <URadioGroup v-model="resizeMode" :items="[
                    { label: t('toGif.framesOptions.resizeTransparent'), value: 'transparent' },
                    { label: t('toGif.framesOptions.resizeFill'), value: 'fill' },
                    { label: t('toGif.framesOptions.resizeError'), value: 'error' }
                  ]" />
                </UFormField>
                <div v-if="resizeMode === 'fill'" class="flex items-center gap-2">
                  <UFormField :label="t('toGif.framesOptions.bgFillColor')">
                    <div class="flex items-center gap-2">
                      <input type="color" :value="bgFillColor" class="w-10 h-10 rounded cursor-pointer border border-muted bg-transparent p-0.5" @input="bgFillColor = ($event.target as HTMLInputElement).value.toUpperCase()">
                      <UInput v-model="bgFillColor" placeholder="#000000" class="flex-1" />
                    </div>
                  </UFormField>
                </div>
              </div>
            </template>
          </UAccordion>
        </template>

        <!-- ========== SPRITESHEET MODE ========== -->
        <template v-if="mode === 'spritesheet'">
          <!-- Preview with grid overlay (when file selected) -->
          <div v-if="previewUrl && previewWidth > 0" class="space-y-2">
            <SpritesheetPreview
              :src="previewUrl"
              :image-width="previewWidth"
              :image-height="previewHeight"
              :mode="slicingMode"
              :columns="columns"
              :rows="rows"
              :cell-width="cellWidth"
              :cell-height="cellHeight"
              :padding="ssPadding"
              :column-range="columnRange || undefined"
              :row-range="rowRange || undefined"
              :frame-count="frameCount"
            />
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted">{{ spritesheetFile?.name }} · {{ formatSize(spritesheetFile?.size || 0) }} · {{ previewWidth }}×{{ previewHeight }}px</p>
              <UButton :label="t('toGif.spritesheetUpload.changeFile')" size="xs" color="neutral" variant="ghost" @click="spritesheetInput?.click()" />
            </div>
            <input ref="spritesheetInput" type="file" accept=".png" class="hidden" @change="onSpritesheetSelect">
          </div>

          <!-- Drop zone (no file yet) -->
          <div
            v-else
            class="relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors"
            :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
            @click="spritesheetInput?.click()"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onSpritesheetDrop"
          >
            <input ref="spritesheetInput" type="file" accept=".png" class="hidden" @change="onSpritesheetSelect">
            <UIcon name="i-lucide-upload" class="text-4xl text-muted mx-auto mb-4" />
            <p class="font-medium text-lg">{{ t('toGif.spritesheetUpload.title') }}</p>
            <p class="text-sm text-muted mt-2">{{ t('toGif.spritesheetUpload.limit') }}</p>
          </div>

          <!-- URL + Convert -->
          <div class="flex gap-2 mt-4">
            <UInput v-model="pngUrl" :placeholder="t('toGif.url.placeholder')" :disabled="!!spritesheetFile" class="flex-1" @keyup.enter="submitConvert" />
            <UButton :label="t('toGif.convert')" icon="i-lucide-sparkles" :disabled="!hasInput" @click="submitConvert" />
          </div>

          <!-- Slicing Mode -->
          <div class="mt-4 space-y-4">
            <h3 class="font-medium">{{ t('toGif.slicingMode.title') }}</h3>
            <UTabs
              :items="[
                { label: t('toGif.slicingMode.grid'), value: 'grid' },
                { label: t('toGif.slicingMode.cell'), value: 'cell' }
              ]"
              :model-value="slicingMode"
              @update:model-value="slicingMode = ($event as 'grid' | 'cell')"
            />
            <div v-if="slicingMode === 'grid'" class="grid grid-cols-2 gap-4">
              <UFormField :label="t('toGif.spritesheetOptions.columns')">
                <UInput v-model.number="columns" type="number" :min="1" />
              </UFormField>
              <UFormField :label="t('toGif.spritesheetOptions.rows')">
                <UInput v-model.number="rows" type="number" :min="1" />
              </UFormField>
            </div>
            <div v-if="slicingMode === 'cell'" class="grid grid-cols-2 gap-4">
              <UFormField :label="t('toGif.spritesheetOptions.cellWidth')">
                <UInput v-model.number="cellWidth" type="number" :min="1" />
              </UFormField>
              <UFormField :label="t('toGif.spritesheetOptions.cellHeight')">
                <UInput v-model.number="cellHeight" type="number" :min="1" />
              </UFormField>
            </div>
          </div>

          <!-- More Options -->
          <UAccordion :items="[{ label: t('toGif.spritesheetOptions.title'), value: 'opts' }]" class="mt-4">
            <template #body>
              <div class="space-y-4 pt-2">
                <div class="grid grid-cols-2 gap-4">
                  <UFormField :label="t('toGif.spritesheetOptions.duration')" :hint="t('toGif.spritesheetOptions.durationHint')">
                    <UInput v-model.number="ssDuration" type="number" :min="10" :max="10000" />
                  </UFormField>
                  <UFormField :label="t('toGif.spritesheetOptions.loop')" :hint="t('toGif.spritesheetOptions.loopHint')">
                    <UInput v-model.number="ssLoop" type="number" :min="0" />
                  </UFormField>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <UFormField :label="t('toGif.spritesheetOptions.frameCount')" :hint="t('toGif.spritesheetOptions.frameCountHint')">
                    <UInput v-model.number="frameCount" type="number" :min="1" placeholder="Auto" />
                  </UFormField>
                  <UFormField :label="t('toGif.spritesheetOptions.padding')" :hint="t('toGif.spritesheetOptions.paddingHint')">
                    <UInput v-model.number="ssPadding" type="number" :min="0" />
                  </UFormField>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <UFormField :label="t('toGif.spritesheetOptions.columnRange')" :hint="t('toGif.spritesheetOptions.columnRangeHint')">
                    <UInput v-model="columnRange" placeholder="e.g. 0-5" />
                  </UFormField>
                  <UFormField :label="t('toGif.spritesheetOptions.rowRange')" :hint="t('toGif.spritesheetOptions.rowRangeHint')">
                    <UInput v-model="rowRange" placeholder="e.g. 0-3" />
                  </UFormField>
                </div>
                <USwitch v-model="skipEmpty" :label="t('toGif.spritesheetOptions.skipEmpty')" />
                <p class="text-xs text-muted -mt-2 pl-1">{{ t('toGif.spritesheetOptions.skipEmptyHint') }}</p>
              </div>
            </template>
          </UAccordion>
        </template>

        <!-- Remaining uses -->
        <p v-if="remainingUses <= 3 && remainingUses > 0" class="text-xs text-muted text-center mt-2">
          {{ t('toGif.adModal.remaining', { count: remainingUses }, remainingUses) }}
        </p>

        <!-- Error -->
        <UAlert v-if="status === 'error'" color="error" :title="errorMessage" class="mt-4">
          <template #actions>
            <UButton :label="t('toGif.status.retry')" color="error" variant="outline" size="sm" @click="reset" />
          </template>
        </UAlert>
      </div>

      <!-- Converting -->
      <div v-if="status === 'converting'" class="text-center py-16">
        <UIcon name="i-lucide-loader-circle" class="text-5xl text-primary animate-spin mx-auto mb-4" />
        <p class="text-lg font-medium">{{ t('toGif.status.converting') }}</p>
      </div>

      <!-- Result -->
      <div v-if="status === 'done'" class="space-y-6">
        <div v-if="resultUrl">
          <h3 class="font-semibold text-lg mb-2">{{ t('toGif.result.title') }}</h3>
          <div class="border border-muted rounded-xl overflow-auto bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
            <img :src="resultUrl" alt="GIF preview" class="max-w-full mx-auto">
          </div>
          <p class="text-sm text-muted mt-2">{{ t('toGif.result.info', resultInfo) }}</p>
        </div>
        <div class="flex gap-3">
          <UButton v-if="!limitExceeded" :label="t('toGif.result.download')" icon="i-lucide-download" size="lg" @click="downloadResult" />
          <UButton v-if="limitExceeded" :label="t('toGif.adModal.watch')" icon="i-lucide-arrow-right" size="lg" @click="showAdModal = true" />
          <UButton :label="t('toGif.result.reset')" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" size="lg" @click="reset" />
        </div>
      </div>
    </template>
  </ToolPageLayout>

  <!-- Ad Modal -->
  <UModal v-model:open="showAdModal">
    <template #content>
      <div class="p-6 text-center space-y-4">
        <UIcon name="i-lucide-heart" class="text-4xl text-primary mx-auto" />
        <h3 class="text-lg font-bold">{{ t('toGif.adModal.title') }}</h3>
        <p class="text-sm text-muted">{{ t('toGif.adModal.description') }}</p>
        <div class="flex justify-center gap-3 pt-2">
          <UButton :label="t('toGif.adModal.watch')" size="lg" @click="onAdConfirm" />
          <UButton :label="t('toGif.adModal.close')" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
        </div>
      </div>
    </template>
  </UModal>
</template>
