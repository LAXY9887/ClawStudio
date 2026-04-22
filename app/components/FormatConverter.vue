<script setup lang="ts">
const props = defineProps<{
  toolKey: string
  acceptExt: string
  outputExt: string
  outputMime: string
  apiEndpoint: string
  extraFields?: Record<string, string>
  supportsQuality?: boolean
  defaultQuality?: number
  supportsLossless?: boolean
  downloadType?: string
  icon?: string
}>()

const { t } = useI18n()
const { openDirectLink } = useMonetagDirectLink()

const file = ref<File | null>(null)
const status = ref<'idle' | 'converting' | 'done' | 'error'>('idle')
const errorMessage = ref('')

const resultBlob = ref<Blob | null>(null)
const resultUrl = ref('')
const resultInfo = ref({ width: 0, height: 0, size: '' })

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const previewUrl = ref('')

const quality = ref(props.defaultQuality ?? 90)
const lossless = ref(false)

const FREE_LIMIT = 3
const usageCount = useCookie<number>('usage_count', { default: () => 0, maxAge: 60 * 60 * 24 })
const showAdModal = ref(false)
const remainingUses = computed(() => FREE_LIMIT - usageCount.value)
const limitExceeded = computed(() => usageCount.value >= FREE_LIMIT)

const EXT_TO_MIME: Record<string, string> = {
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.tiff': 'image/tiff',
  '.svg': 'image/svg+xml'
}

// Includes MIME types so iOS Safari doesn't auto-convert HEIC to JPEG
const acceptAttr = computed(() => {
  const exts = props.acceptExt.split(',').map(s => s.trim().toLowerCase())
  const mimes = [...new Set(exts.map(e => EXT_TO_MIME[e]).filter(Boolean))]
  return mimes.length ? `${props.acceptExt},${mimes.join(',')}` : props.acceptExt
})

const outputFilename = computed(() => {
  if (!file.value) return `converted.${props.outputExt}`
  const base = file.value.name.replace(/\.[^.]+$/, '')
  return `${base}.${props.outputExt}`
})

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
  const accepted = props.acceptExt.split(',').map(s => s.trim().toLowerCase())
  const name = f.name.toLowerCase()
  const acceptedMimes = [...new Set(accepted.map(e => EXT_TO_MIME[e]).filter(Boolean))]
  const extOk = accepted.some(ext => name.endsWith(ext))
  const mimeOk = acceptedMimes.includes(f.type)
  if (!extOk && !mimeOk) {
    errorMessage.value = t(`${props.toolKey}.upload.accept`)
    status.value = 'error'
    return
  }
  if (f.size > 50 * 1024 * 1024) {
    errorMessage.value = t(`${props.toolKey}.upload.tooLarge`)
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

async function convert() {
  if (!file.value) return
  status.value = 'converting'
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file.value)
    if (props.extraFields) {
      for (const [k, v] of Object.entries(props.extraFields)) {
        formData.append(k, v)
      }
    }
    if (props.supportsQuality) formData.append('quality', String(quality.value))
    if (props.supportsLossless && lossless.value) formData.append('lossless', 'true')

    const response = await $fetch.raw(props.apiEndpoint, {
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
    errorMessage.value = err.data?.message || err.data?.detail || t(`${props.toolKey}.status.error`)
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
  const slug = props.toolKey.replace(/([A-Z])/g, '-$1').toLowerCase()
  navigateTo({
    path: localePath('/download'),
    query: { type: props.downloadType || props.toolKey, from: localePath(`/tools/${slug}`) }
  })
}

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
</script>

<template>
  <div>
    <div v-if="status === 'idle' || status === 'error'">
      <!-- Preview (when file selected) -->
      <div v-if="previewUrl" class="space-y-2">
        <div class="border border-muted rounded-lg overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:10px_10px] max-h-80 flex items-center justify-center">
          <img :src="previewUrl" :alt="file?.name" class="max-h-80 max-w-full object-contain">
        </div>
        <div class="flex items-center justify-between">
          <p class="text-sm text-muted">{{ file?.name }} · {{ formatSize(file?.size || 0) }}</p>
          <UButton :label="t(`${toolKey}.upload.changeFile`)" size="xs" color="neutral" variant="ghost" @click="fileInput?.click()" />
        </div>
        <input ref="fileInput" type="file" :accept="acceptAttr" class="hidden" @change="onFileSelect">
      </div>

      <!-- Drop zone (no file) -->
      <div
        v-else
        class="relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors"
        :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
        @click="fileInput?.click()"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
      >
        <input ref="fileInput" type="file" :accept="acceptAttr" class="hidden" @change="onFileSelect">
        <UIcon name="i-lucide-upload" class="text-4xl text-muted mx-auto mb-4" />
        <p class="font-medium text-lg">{{ t(`${toolKey}.upload.title`) }}</p>
        <p class="text-sm text-muted mt-2">{{ t(`${toolKey}.upload.limit`) }}</p>
      </div>

      <!-- Options -->
      <div v-if="supportsQuality || supportsLossless" class="mt-4 space-y-4">
        <UFormField v-if="supportsQuality && !(supportsLossless && lossless)" :label="t(`${toolKey}.options.quality`)" :hint="t(`${toolKey}.options.qualityHint`)">
          <div class="flex items-center gap-3">
            <input v-model.number="quality" type="range" min="1" max="100" class="flex-1">
            <span class="text-sm font-mono w-10 text-right">{{ quality }}</span>
          </div>
        </UFormField>
        <USwitch v-if="supportsLossless" v-model="lossless" :label="t(`${toolKey}.options.lossless`)" />
        <p v-if="supportsLossless" class="text-xs text-muted -mt-2 pl-1">{{ t(`${toolKey}.options.losslessHint`) }}</p>
      </div>

      <!-- Convert Button -->
      <div class="flex justify-end mt-4">
        <UButton
          :label="t(`${toolKey}.convert`)"
          :icon="icon || 'i-lucide-sparkles'"
          :disabled="!hasInput"
          @click="submitConvert"
        />
      </div>

      <!-- Remaining uses -->
      <p v-if="remainingUses <= 3 && remainingUses > 0" class="text-xs text-muted text-center">
        {{ t(`${toolKey}.adModal.remaining`, { count: remainingUses }, remainingUses) }}
      </p>

      <!-- Error -->
      <UAlert v-if="status === 'error'" color="error" :title="errorMessage" class="mt-4">
        <template #actions>
          <UButton :label="t(`${toolKey}.status.retry`)" color="error" variant="outline" size="sm" @click="reset" />
        </template>
      </UAlert>
    </div>

    <!-- Converting -->
    <div v-if="status === 'converting'" class="text-center py-16">
      <UIcon name="i-lucide-loader-circle" class="text-5xl text-primary animate-spin mx-auto mb-4" />
      <p class="text-lg font-medium">{{ t(`${toolKey}.status.converting`) }}</p>
    </div>

    <!-- Result -->
    <div v-if="status === 'done'" class="space-y-6">
      <div v-if="resultUrl">
        <h3 class="font-semibold text-lg mb-2">{{ t(`${toolKey}.result.title`) }}</h3>
        <div class="border border-muted rounded-xl overflow-auto bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
          <img :src="resultUrl" alt="Converted preview" class="max-w-full mx-auto">
        </div>
        <p class="text-sm text-muted mt-2">{{ t(`${toolKey}.result.info`, resultInfo) }}</p>
      </div>
      <div class="flex gap-3">
        <UButton
          v-if="!limitExceeded"
          :label="t(`${toolKey}.result.download`)"
          icon="i-lucide-download"
          size="lg"
          @click="downloadResult"
        />
        <UButton
          v-if="limitExceeded"
          :label="t(`${toolKey}.adModal.watch`)"
          icon="i-lucide-arrow-right"
          size="lg"
          @click="showAdModal = true"
        />
        <UButton
          :label="t(`${toolKey}.result.reset`)"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="outline"
          size="lg"
          @click="reset"
        />
      </div>
    </div>

    <!-- Ad Modal -->
    <UModal v-model:open="showAdModal">
      <template #content>
        <div class="p-6 text-center space-y-4">
          <UIcon name="i-lucide-heart" class="text-4xl text-primary mx-auto" />
          <h3 class="text-lg font-bold">{{ t(`${toolKey}.adModal.title`) }}</h3>
          <p class="text-sm text-muted">{{ t(`${toolKey}.adModal.description`) }}</p>
          <div class="flex justify-center gap-3 pt-2">
            <UButton :label="t(`${toolKey}.adModal.watch`)" size="lg" @click="onAdConfirm" />
            <UButton :label="t(`${toolKey}.adModal.close`)" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
