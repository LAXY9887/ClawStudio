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
</script>

<template>
  <div>ImageEditor placeholder</div>
</template>
