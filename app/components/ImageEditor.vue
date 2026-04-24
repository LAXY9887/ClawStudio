<script setup lang="ts">
import 'vue-advanced-cropper/dist/style.css'
import { Cropper } from 'vue-advanced-cropper'

type Tab = 'crop' | 'resize' | 'compress' | 'rotate' | 'flip'
type OutputFormat = 'jpg' | 'png' | 'webp'
interface CropCoords { left: number, top: number, width: number, height: number }

const FREE_LIMIT = 3
const MAX_BYTES = 50 * 1024 * 1024
const ACCEPTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']
const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const ACCEPT_ATTR = [...ACCEPTED_EXTS, ...ACCEPTED_MIMES].join(',')

const { t } = useI18n()
const { openDirectLink } = useMonetagDirectLink()
const localePath = useLocalePath()
const downloadCount = useCookie<number>('img_editor_count', { default: () => 0, maxAge: 86400 })
const remainingUses = computed(() => Math.max(0, FREE_LIMIT - downloadCount.value))

// Status
const status = ref<'idle' | 'editing'>('idle')
const activeTab = ref<Tab>('crop')
const errorMessage = ref('')
const isDragging = ref(false)

// File & image
const originalFile = ref<File | null>(null)
const originalImage = ref<HTMLImageElement | null>(null)
const fileInput = ref<HTMLInputElement>()
const previewCanvasEl = ref<HTMLCanvasElement>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cropperRef = ref<any>(null)

// Crop
const cropCoords = ref<CropCoords>({ left: 0, top: 0, width: 0, height: 0 })
const cropAspectRatio = ref<number | undefined>(undefined)

// Resize
const resizeWidth = ref(0)
const resizeHeight = ref(0)
const lockAspect = ref(true)
const originalAspect = ref(1)

// Compress
const quality = ref(85)
const estimatedSize = ref('')

// Rotate & Flip
const rotateDegrees = ref(0)
const flipH = ref(false)
const flipV = ref(false)

// Output format
const outputFormat = ref<OutputFormat>('jpg')
const outputMime = computed(() => {
  if (outputFormat.value === 'png') return 'image/png'
  if (outputFormat.value === 'webp') return 'image/webp'
  return 'image/jpeg'
})

// Ad modal
const showAdModal = ref(false)

function validateFile(f: File): string | null {
  const name = f.name.toLowerCase()
  const extOk = ACCEPTED_EXTS.some(ext => name.endsWith(ext))
  const mimeOk = ACCEPTED_MIMES.includes(f.type)
  if (!extOk && !mimeOk) return t('imageEditor.upload.typeError')
  if (f.size > MAX_BYTES) return t('imageEditor.upload.sizeError')
  return null
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (Math.round(bytes / 1024) < 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function loadFile(f: File) {
  const err = validateFile(f)
  if (err) { errorMessage.value = err; return }
  errorMessage.value = ''
  originalFile.value = f

  const url = URL.createObjectURL(f)
  const img = new Image()
  img.onload = () => {
    originalImage.value = img
    resizeWidth.value = img.naturalWidth
    resizeHeight.value = img.naturalHeight
    originalAspect.value = img.naturalWidth / img.naturalHeight
    cropCoords.value = { left: 0, top: 0, width: img.naturalWidth, height: img.naturalHeight }
    const ext = f.name.split('.').pop()?.toLowerCase()
    outputFormat.value = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpg'
    activeTab.value = 'crop'
    status.value = 'editing'
    nextTick(() => renderPreview())
    URL.revokeObjectURL(url)
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    originalFile.value = null
    errorMessage.value = t('imageEditor.upload.loadError')
  }
  img.src = url
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const f = target.files?.[0]
  target.value = ''
  if (f) loadFile(f)
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) loadFile(f)
}

function reset() {
  status.value = 'idle'
  originalFile.value = null
  originalImage.value = null
  errorMessage.value = ''
  cropCoords.value = { left: 0, top: 0, width: 0, height: 0 }
  cropAspectRatio.value = undefined
  resizeWidth.value = 0
  resizeHeight.value = 0
  rotateDegrees.value = 0
  flipH.value = false
  flipV.value = false
  quality.value = 85
  estimatedSize.value = ''
  activeTab.value = 'crop'
  outputFormat.value = 'jpg'
  originalAspect.value = 1
}

function renderToCanvas(canvas: HTMLCanvasElement) {
  const img = originalImage.value!
  const ctx = canvas.getContext('2d')!
  const cx = cropCoords.value.left
  const cy = cropCoords.value.top
  const cw = cropCoords.value.width || img.naturalWidth
  const ch = cropCoords.value.height || img.naturalHeight
  const rad = (rotateDegrees.value * Math.PI) / 180
  const outW = canvas.width
  const outH = canvas.height

  ctx.clearRect(0, 0, outW, outH)
  ctx.save()
  ctx.translate(outW / 2, outH / 2)
  if (flipH.value) ctx.scale(-1, 1)
  if (flipV.value) ctx.scale(1, -1)
  ctx.rotate(rad)
  ctx.drawImage(img, cx, cy, cw, ch, -outW / 2, -outH / 2, outW, outH)
  ctx.restore()
}

function renderPreview() {
  const canvas = previewCanvasEl.value
  if (!canvas || !originalImage.value) return
  canvas.width = Math.max(1, resizeWidth.value || originalImage.value.naturalWidth)
  canvas.height = Math.max(1, resizeHeight.value || originalImage.value.naturalHeight)
  renderToCanvas(canvas)
}

function buildOutputCanvas(): HTMLCanvasElement {
  const img = originalImage.value!
  const canvas = document.createElement('canvas')
  canvas.width = resizeWidth.value || img.naturalWidth
  canvas.height = resizeHeight.value || img.naturalHeight
  renderToCanvas(canvas)
  return canvas
}

function buildOutputBlob(): Promise<Blob> {
  const canvas = buildOutputCanvas()
  const mime = outputMime.value
  const q = outputFormat.value === 'png' ? undefined : quality.value / 100
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas export failed — image may be too large'))
    }, mime, q)
  )
}

function getOutputFilename(): string {
  const base = originalFile.value?.name.replace(/\.[^.]+$/, '') || 'edited'
  const ext = outputFormat.value === 'jpg' ? 'jpg' : outputFormat.value
  return `${base}_edited.${ext}`
}

function tabIcon(tab: Tab): string {
  const icons: Record<Tab, string> = {
    crop: 'i-lucide-crop',
    resize: 'i-lucide-expand',
    compress: 'i-lucide-minimize-2',
    rotate: 'i-lucide-rotate-cw',
    flip: 'i-lucide-flip-horizontal-2'
  }
  return icons[tab]
}

function onTabChange(tab: Tab) {
  if (activeTab.value === 'crop' && cropperRef.value) {
    const result = cropperRef.value.getResult()
    if (result?.coordinates && result.coordinates.width > 0 && result.coordinates.height > 0) {
      cropCoords.value = {
        left: Math.round(result.coordinates.left),
        top: Math.round(result.coordinates.top),
        width: Math.round(result.coordinates.width),
        height: Math.round(result.coordinates.height)
      }
    }
  }
  activeTab.value = tab
  if (tab !== 'crop') nextTick(() => renderPreview())
}

function onCropChange({ coordinates }: { coordinates: CropCoords }) {
  cropCoords.value = {
    left: Math.round(coordinates.left),
    top: Math.round(coordinates.top),
    width: Math.round(coordinates.width),
    height: Math.round(coordinates.height)
  }
}

function setAspectRatio(ratio: number | undefined) {
  cropAspectRatio.value = ratio
}

function resetCrop() {
  cropAspectRatio.value = undefined
  cropCoords.value = { left: 0, top: 0, width: originalImage.value?.naturalWidth ?? 0, height: originalImage.value?.naturalHeight ?? 0 }
  cropperRef.value?.reset()
}

const imageSrc = ref('')

watch(originalFile, (f, oldF) => {
  if (oldF && imageSrc.value) URL.revokeObjectURL(imageSrc.value)
  imageSrc.value = f ? URL.createObjectURL(f) : ''
})

onBeforeUnmount(() => { if (imageSrc.value) URL.revokeObjectURL(imageSrc.value) })

function handleDownload() {
  // implemented in Task 10
}
</script>

<template>
  <div>
    <!-- IDLE: drop zone -->
    <div v-if="status === 'idle'">
      <div
        role="button"
        tabindex="0"
        class="relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors"
        :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
        @click="fileInput?.click()"
        @keydown.enter.prevent="fileInput?.click()"
        @keydown.space.prevent="fileInput?.click()"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
      >
        <input ref="fileInput" type="file" :accept="ACCEPT_ATTR" class="hidden" @change="onFileSelect">
        <UIcon name="i-lucide-image-plus" class="text-4xl text-muted mx-auto mb-4" />
        <p class="font-medium text-lg">{{ t('imageEditor.upload.title') }}</p>
        <p class="text-sm text-muted mt-2">{{ t('imageEditor.upload.limit') }}</p>
        <p class="text-xs text-muted mt-1">{{ t('imageEditor.upload.formats') }}</p>
      </div>
      <UAlert v-if="errorMessage" color="error" :title="errorMessage" class="mt-4" />
    </div>

    <!-- EDITING state -->
    <div v-else class="border border-muted rounded-xl bg-default overflow-hidden">
      <div class="flex flex-col md:flex-row">

        <!-- LEFT: preview -->
        <div class="flex-1 flex flex-col gap-3 p-4 md:border-r border-muted min-w-0">
          <!-- Crop tab: vue-advanced-cropper -->
          <div v-if="activeTab === 'crop' && status === 'editing'" class="flex-1 min-h-64 overflow-hidden rounded-lg bg-muted/10">
            <ClientOnly>
              <Cropper
                ref="cropperRef"
                :src="imageSrc"
                :stencil-props="cropAspectRatio ? { aspectRatio: cropAspectRatio } : {}"
                class="w-full h-full min-h-64"
                @change="onCropChange"
              />
              <template #fallback>
                <div class="w-full h-full min-h-64 bg-muted/20 animate-pulse rounded-lg" />
              </template>
            </ClientOnly>
          </div>

          <!-- Other tabs: canvas preview -->
          <div v-else class="flex-1 bg-muted/10 rounded-lg min-h-64 flex items-center justify-center relative overflow-hidden">
            <canvas ref="previewCanvasEl" class="max-w-full max-h-80 object-contain" />
          </div>
          <!-- File info bar -->
          <div class="flex items-center justify-between text-sm text-muted">
            <span class="truncate">{{ originalFile?.name }} · {{ formatSize(originalFile?.size || 0) }}</span>
            <UButton :label="t('imageEditor.actions.changeFile')" size="xs" color="neutral" variant="ghost" @click="fileInput?.click()" />
            <input ref="fileInput" type="file" :accept="ACCEPT_ATTR" class="hidden" @change="onFileSelect">
          </div>
        </div>

        <!-- RIGHT: tool panel -->
        <div class="w-full md:w-52 flex flex-col">

          <!-- Tab list -->
          <div role="tablist" class="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-x-visible">
            <button
              v-for="tab in (['crop', 'resize', 'compress', 'rotate', 'flip'] as Tab[])"
              :key="tab"
              role="tab"
              :aria-selected="activeTab === tab"
              class="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors shrink-0"
              :class="activeTab === tab
                ? 'bg-primary/10 text-primary border-l-2 border-primary'
                : 'text-muted hover:text-default hover:bg-muted/20'"
              @click="onTabChange(tab)"
            >
              <UIcon :name="tabIcon(tab)" class="text-base" />
              {{ t(`imageEditor.tabs.${tab}`) }}
            </button>
          </div>

          <!-- Tab content (Tasks 5, 7, 8, 9) -->
          <div class="flex-1 p-3 border-t border-muted space-y-3">
            <!-- Crop tab controls -->
            <template v-if="activeTab === 'crop'">
              <p class="text-xs text-muted font-medium uppercase tracking-wide">{{ t('imageEditor.crop.aspectRatio') }}</p>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="preset in [
                    { label: t('imageEditor.crop.free'), value: undefined },
                    { label: '1:1', value: 1 },
                    { label: '16:9', value: 16/9 },
                    { label: '4:3', value: 4/3 },
                    { label: '3:2', value: 3/2 }
                  ]"
                  :key="preset.label"
                  class="px-2 py-1 rounded text-xs transition-colors"
                  :class="cropAspectRatio === preset.value ? 'bg-primary text-white' : 'bg-muted/20 text-muted hover:bg-muted/40'"
                  @click="setAspectRatio(preset.value)"
                >{{ preset.label }}</button>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs text-muted">
                <div class="bg-muted/10 rounded p-2">
                  <div class="text-[10px] uppercase tracking-wide mb-1">{{ t('imageEditor.crop.width') }}</div>
                  <div class="font-mono text-sm text-default">{{ cropCoords.width || (originalImage?.naturalWidth ?? 0) }}px</div>
                </div>
                <div class="bg-muted/10 rounded p-2">
                  <div class="text-[10px] uppercase tracking-wide mb-1">{{ t('imageEditor.crop.height') }}</div>
                  <div class="font-mono text-sm text-default">{{ cropCoords.height || (originalImage?.naturalHeight ?? 0) }}px</div>
                </div>
              </div>
              <UButton
                :label="t('imageEditor.crop.reset')"
                size="xs"
                color="neutral"
                variant="outline"
                class="w-full justify-center"
                @click="resetCrop"
              />
            </template>

            <!-- Other tabs placeholder -->
            <template v-else>
              <p class="text-xs text-muted">{{ activeTab }} — next tasks</p>
            </template>
          </div>

          <!-- Format + Download (Task 10) -->
          <div class="p-3 border-t border-muted space-y-2">
            <p class="text-xs text-muted font-medium uppercase tracking-wide">{{ t('imageEditor.format.label') }}</p>
            <div role="radiogroup" :aria-label="t('imageEditor.format.label')" class="flex gap-1">
              <button
                v-for="fmt in (['jpg', 'png', 'webp'] as OutputFormat[])"
                :key="fmt"
                role="radio"
                :aria-checked="outputFormat === fmt"
                class="flex-1 rounded py-1 text-xs font-semibold uppercase transition-colors"
                :class="outputFormat === fmt ? 'bg-primary text-white' : 'bg-muted/20 text-muted hover:bg-muted/40'"
                @click="outputFormat = fmt"
              >{{ fmt }}</button>
            </div>
            <UButton
              :label="t('imageEditor.actions.download')"
              icon="i-lucide-download"
              size="sm"
              class="w-full justify-center"
              @click="handleDownload"
            />
            <p v-if="remainingUses > 0" class="text-xs text-muted text-center">
              {{ t('imageEditor.adModal.remaining', { count: remainingUses }, remainingUses) }}
            </p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
