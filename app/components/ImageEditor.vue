<script setup lang="ts">
import 'vue-advanced-cropper/dist/style.css'

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

function renderPreview() {}
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

    <!-- EDITING: placeholder until Task 4 -->
    <div v-else>
      <p>Editing: {{ originalFile?.name }}</p>
      <UButton label="Reset" @click="reset" />
    </div>
  </div>
</template>
