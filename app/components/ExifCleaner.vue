<script setup lang="ts">
const FREE_LIMIT = 3
const cleanCount = useCookie<number>('exif_clean_count', { default: () => 0, maxAge: 60 * 60 * 24 })
const remainingUses = computed(() => Math.max(0, FREE_LIMIT - cleanCount.value))
const showAdModal = ref(false)
const pendingAction = ref<(() => void) | null>(null)

interface GpsSummary {
  lat: number
  lng: number
  altitude?: number
  direction?: number
}

interface ScanSummary {
  gps?: GpsSummary
  device?: string
  software?: string
  timestamp?: string
}

interface ScanReport {
  hasPrivacyRisk: boolean
  summary: ScanSummary
  raw?: Record<string, unknown>
}

interface BatchScanItem extends ScanReport {
  filename: string
}

type Status = 'idle' | 'scanning' | 'reportSingle' | 'reportBatch' | 'cleaning' | 'done' | 'error'

const { t } = useI18n()

const SINGLE_MAX_BYTES = 50 * 1024 * 1024
const BATCH_MAX_BYTES = 10 * 1024 * 1024
const BATCH_MAX_COUNT = 10
const ACCEPTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.tif', '.heic', '.heif']
const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff', 'image/heic', 'image/heif']
const ACCEPT_ATTR = [...ACCEPTED_EXTS, ...ACCEPTED_MIMES].join(',')

const files = ref<File[]>([])
const previewUrls = ref<string[]>([])
const status = ref<Status>('idle')
const errorMessage = ref('')

const singleReport = ref<ScanReport | null>(null)
const batchReports = ref<BatchScanItem[]>([])

const cleanedBlob = ref<Blob | null>(null)
const cleanedFilename = ref('')
const cleanedUrl = ref('')

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)

const isBatch = computed(() => files.value.length > 1)

function isHeicFile(f: File): boolean {
  const name = f.name.toLowerCase()
  return name.endsWith('.heic') || name.endsWith('.heif') || f.type === 'image/heic' || f.type === 'image/heif'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFiles(list: File[]): string | null {
  if (list.length === 0) return null
  if (list.length > BATCH_MAX_COUNT) {
    return t('exifRemover.upload.tooMany', { max: BATCH_MAX_COUNT })
  }
  for (const f of list) {
    const name = f.name.toLowerCase()
    const extOk = ACCEPTED_EXTS.some(ext => name.endsWith(ext))
    const mimeOk = ACCEPTED_MIMES.includes(f.type)
    if (!extOk && !mimeOk) {
      return t('exifRemover.upload.accept')
    }
  }
  const perFileLimit = list.length > 1 ? BATCH_MAX_BYTES : SINGLE_MAX_BYTES
  const tooLarge = list.find(f => f.size > perFileLimit)
  if (tooLarge) {
    return list.length > 1
      ? t('exifRemover.upload.tooLargeBatch', { size: formatSize(BATCH_MAX_BYTES) })
      : t('exifRemover.upload.tooLargeSingle', { size: formatSize(SINGLE_MAX_BYTES) })
  }
  return null
}

function clearPreviews() {
  previewUrls.value.forEach((url) => {
    if (url) URL.revokeObjectURL(url)
  })
  previewUrls.value = []
}

function buildPreviews(list: File[]) {
  clearPreviews()
  previewUrls.value = list.map(f => isHeicFile(f) ? '' : URL.createObjectURL(f))
}

async function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    await handleFiles(Array.from(target.files))
    target.value = ''
  }
}

async function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    await handleFiles(Array.from(e.dataTransfer.files))
  }
}

async function handleFiles(list: File[]) {
  const err = validateFiles(list)
  if (err) {
    errorMessage.value = err
    status.value = 'error'
    return
  }
  files.value = list
  buildPreviews(list)
  errorMessage.value = ''
  await runScan()
}

async function runScan() {
  status.value = 'scanning'
  try {
    const formData = new FormData()
    if (isBatch.value) {
      files.value.forEach(f => formData.append('files', f))
      const data = await $fetch<BatchScanItem[]>('/api/exifrm/batch/scan', {
        method: 'POST',
        body: formData
      })
      batchReports.value = data
      status.value = 'reportBatch'
    } else {
      formData.append('file', files.value[0]!)
      const data = await $fetch<ScanReport>('/api/exifrm/scan', {
        method: 'POST',
        body: formData
      })
      singleReport.value = data
      status.value = 'reportSingle'
    }
  } catch (e) {
    console.error(e)
    errorMessage.value = t('exifRemover.status.scanFailed')
    status.value = 'error'
  }
}

async function runClean() {
  if (cleanCount.value >= FREE_LIMIT) {
    pendingAction.value = () => runClean()
    showAdModal.value = true
    return
  }
  status.value = 'cleaning'
  try {
    const formData = new FormData()
    let endpoint: string
    if (isBatch.value) {
      files.value.forEach(f => formData.append('files', f))
      endpoint = '/api/exifrm/batch/clean'
    } else {
      formData.append('file', files.value[0]!)
      endpoint = '/api/exifrm/clean'
    }
    const response = await $fetch.raw(endpoint, {
      method: 'POST',
      body: formData,
      responseType: 'arrayBuffer'
    })
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    cleanedBlob.value = new Blob([response._data as ArrayBuffer], { type: contentType })

    const disposition = response.headers.get('content-disposition') || ''
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
    if (match && match[1]) {
      cleanedFilename.value = decodeURIComponent(match[1])
    } else if (isBatch.value) {
      cleanedFilename.value = 'cleaned.zip'
    } else {
      const original = files.value[0]!.name
      const dot = original.lastIndexOf('.')
      const base = dot >= 0 ? original.slice(0, dot) : original
      const ext = dot >= 0 ? original.slice(dot) : ''
      cleanedFilename.value = `${base}_clean${ext}`
    }

    if (cleanedUrl.value) URL.revokeObjectURL(cleanedUrl.value)
    cleanedUrl.value = URL.createObjectURL(cleanedBlob.value)

    cleanCount.value++
    status.value = 'done'
    if (cleanCount.value >= FREE_LIMIT) {
      useDownloadStore().setBlob(cleanedBlob.value!, cleanedFilename.value)
      showAdModal.value = true
    }
  } catch (e) {
    console.error(e)
    errorMessage.value = t('exifRemover.status.cleanFailed')
    status.value = 'error'
  }
}

function downloadCleaned() {
  if (!cleanedUrl.value) return
  const a = document.createElement('a')
  a.href = cleanedUrl.value
  a.download = cleanedFilename.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function _executeDownloadMetadata() {
  const isSingle = !!singleReport.value
  let data: unknown
  let filename: string
  if (isSingle) {
    data = singleReport.value
    const orig = files.value[0]?.name || 'photo'
    const base = orig.replace(/\.[^.]+$/, '')
    filename = `${base}_metadata.json`
  } else {
    data = batchReports.value.map(item =>
      item.hasPrivacyRisk
        ? item
        : { filename: item.filename, hasPrivacyRisk: false }
    )
    filename = 'scan_metadata.json'
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  cleanCount.value++
  if (cleanCount.value >= FREE_LIMIT) {
    showAdModal.value = true
  }
}

function downloadMetadata() {
  const isSingle = !!singleReport.value
  const isBatchData = batchReports.value.length > 0
  if (!isSingle && !isBatchData) return

  if (cleanCount.value >= FREE_LIMIT) {
    pendingAction.value = () => _executeDownloadMetadata()
    showAdModal.value = true
    return
  }
  _executeDownloadMetadata()
}

function onAdConfirm() {
  showAdModal.value = false
  cleanCount.value = 0
  if (pendingAction.value) {
    const action = pendingAction.value
    pendingAction.value = null
    action()
  } else {
    const localePath = useLocalePath()
    navigateTo({
      path: localePath('/download'),
      query: { from: localePath('/tools/exif-remover') }
    })
  }
}

function reset() {
  clearPreviews()
  if (cleanedUrl.value) URL.revokeObjectURL(cleanedUrl.value)
  files.value = []
  singleReport.value = null
  batchReports.value = []
  cleanedBlob.value = null
  cleanedUrl.value = ''
  cleanedFilename.value = ''
  errorMessage.value = ''
  status.value = 'idle'
}

const safetyScore = computed(() => {
  if (!singleReport.value) return 100
  if (!singleReport.value.hasPrivacyRisk) return 100
  const s = singleReport.value.summary
  let deduction = 0
  if (s.gps) deduction += 40
  if (s.device) deduction += 20
  if (s.timestamp) deduction += 20
  if (s.software) deduction += 20
  return Math.max(0, 100 - deduction)
})

const safetyTone = computed<'ok' | 'warn' | 'alert' | 'danger'>(() => {
  const v = safetyScore.value
  if (v === 100) return 'ok'
  if (v >= 70) return 'warn'
  if (v >= 40) return 'alert'
  return 'danger'
})

const mapEmbedUrl = computed(() => {
  const gps = singleReport.value?.summary.gps
  if (!gps) return ''
  const d = 0.005
  const bbox = `${gps.lng - d},${gps.lat - d},${gps.lng + d},${gps.lat + d}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${gps.lat},${gps.lng}`
})

const gpsCoordText = computed(() => {
  const gps = singleReport.value?.summary.gps
  if (!gps) return ''
  const latDir = gps.lat >= 0 ? 'N' : 'S'
  const lngDir = gps.lng >= 0 ? 'E' : 'W'
  return `${Math.abs(gps.lat).toFixed(5)}°${latDir}, ${Math.abs(gps.lng).toFixed(5)}°${lngDir}`
})

const formattedTimestamp = computed(() => {
  const ts = singleReport.value?.summary.timestamp
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
})

const batchStats = computed(() => {
  const total = batchReports.value.length
  const risky = batchReports.value.filter(r => r.hasPrivacyRisk).length
  return { total, risky, clean: total - risky }
})

function riskTagsFor(item: BatchScanItem): string[] {
  const tags: string[] = []
  if (item.summary.gps) tags.push(t('exifRemover.tags.gps'))
  if (item.summary.device) tags.push(t('exifRemover.tags.device'))
  if (item.summary.timestamp) tags.push(t('exifRemover.tags.time'))
  if (item.summary.software) tags.push(t('exifRemover.tags.software'))
  return tags
}

onBeforeUnmount(() => {
  clearPreviews()
  if (cleanedUrl.value) URL.revokeObjectURL(cleanedUrl.value)
})
</script>

<template>
  <div class="space-y-3">
    <div class="border border-muted rounded-xl bg-default p-4 md:p-6">
    <!-- IDLE: Drop zone -->
    <div
      v-if="status === 'idle'"
      class="relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors"
      :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
      @click="fileInput?.click()"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="ACCEPT_ATTR"
        multiple
        class="hidden"
        @change="onFileSelect"
      >
      <UIcon name="i-lucide-shield-upload" class="text-4xl text-muted mx-auto mb-4" />
      <p class="font-medium text-lg">
        {{ t('exifRemover.upload.title') }}
      </p>
      <p class="text-sm text-muted mt-2">
        {{ t('exifRemover.upload.limit') }}
      </p>
      <p class="text-xs text-muted mt-1">
        {{ t('exifRemover.upload.formats') }}
      </p>
    </div>

    <!-- SCANNING -->
    <div v-if="status === 'scanning'" class="text-center py-16">
      <div class="relative w-20 h-20 mx-auto mb-6">
        <div class="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        <UIcon name="i-lucide-radar" class="absolute inset-0 m-auto text-3xl text-primary" />
      </div>
      <p class="text-lg font-medium">
        {{ t('exifRemover.status.scanning') }}
      </p>
    </div>

    <!-- SINGLE REPORT: No risk -->
    <div v-if="status === 'reportSingle' && singleReport && !singleReport.hasPrivacyRisk" class="space-y-4">
      <div class="flex items-center justify-between">
        <p class="text-sm text-muted">
          {{ files[0]?.name }} · {{ formatSize(files[0]?.size || 0) }}
        </p>
        <UButton :label="t('exifRemover.actions.chooseAgain')" size="xs" color="neutral" variant="ghost" @click="reset" />
      </div>
      <div class="border border-success/40 bg-success/5 rounded-xl p-6 text-center">
        <UIcon name="i-lucide-shield-check" class="text-5xl text-success mx-auto mb-3" />
        <h3 class="text-lg font-semibold">
          {{ t('exifRemover.noRisk.title') }}
        </h3>
        <p class="text-sm text-muted mt-2">
          {{ t('exifRemover.noRisk.description') }}
        </p>
      </div>
    </div>

    <!-- SINGLE REPORT: Risky -->
    <div v-if="status === 'reportSingle' && singleReport && singleReport.hasPrivacyRisk" class="space-y-4">
      <!-- Preview header -->
      <div class="flex items-center gap-3">
        <div class="w-14 h-14 rounded-lg bg-muted/20 flex items-center justify-center shrink-0 overflow-hidden">
          <img v-if="previewUrls[0]" :src="previewUrls[0]" class="w-full h-full object-cover" :alt="files[0]?.name">
          <UIcon v-else name="i-lucide-file-image" class="text-2xl text-muted" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">
            {{ files[0]?.name }}
          </p>
          <p class="text-xs text-muted">
            {{ formatSize(files[0]?.size || 0) }}
          </p>
          <p v-if="!previewUrls[0]" class="text-xs text-success flex items-center gap-1 mt-0.5">
            <UIcon name="i-lucide-check-circle" class="text-sm shrink-0" />
            {{ t('exifRemover.upload.heicUploaded') }}
          </p>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <UButton
              :label="t('exifRemover.actions.clean')"
              icon="i-lucide-eraser"
              size="xs"
              @click="runClean"
            />
            <UButton
              :label="t('exifRemover.actions.downloadMeta')"
              icon="i-lucide-file-json"
              size="xs"
              color="neutral"
              variant="outline"
              @click="downloadMetadata"
            />
            <UButton :label="t('exifRemover.actions.chooseAgain')" size="xs" color="neutral" variant="ghost" @click="reset" />
          </div>
        </div>
      </div>

      <!-- Safety score -->
      <div
        class="rounded-xl p-4 flex items-center gap-4"
        :class="{
          'bg-warning/5 border border-warning/40': safetyTone === 'warn',
          'bg-orange-500/5 border border-orange-500/40': safetyTone === 'alert',
          'bg-error/5 border border-error/40': safetyTone === 'danger'
        }"
      >
        <div
          class="text-3xl font-bold tabular-nums"
          :class="{
            'text-warning': safetyTone === 'warn',
            'text-orange-500': safetyTone === 'alert',
            'text-error': safetyTone === 'danger'
          }"
        >
          {{ safetyScore }}<span class="text-base text-muted font-normal">/100</span>
        </div>
        <div class="flex-1">
          <p class="font-semibold">
            {{ t('exifRemover.report.riskDetected') }}
          </p>
          <p class="text-xs text-muted mt-1">
            {{ t('exifRemover.report.safetyScoreHint') }}
          </p>
        </div>
      </div>

      <!-- GPS section -->
      <div v-if="singleReport.summary.gps" class="border border-muted rounded-xl overflow-hidden">
        <div class="p-4 flex items-start gap-3">
          <UIcon name="i-lucide-map-pin" class="text-xl text-error mt-0.5" />
          <div class="flex-1">
            <p class="font-semibold">
              {{ t('exifRemover.report.gps.title') }}
            </p>
            <p class="text-sm text-muted mt-1 font-mono">
              {{ gpsCoordText }}
            </p>
            <p v-if="singleReport.summary.gps.altitude !== undefined" class="text-xs text-muted">
              {{ t('exifRemover.report.gps.altitude') }}: {{ singleReport.summary.gps.altitude.toFixed(1) }} m
            </p>
            <p v-if="singleReport.summary.gps.direction !== undefined" class="text-xs text-muted">
              {{ t('exifRemover.report.gps.direction') }}: {{ singleReport.summary.gps.direction.toFixed(1) }}°
            </p>
          </div>
        </div>
        <iframe
          :src="mapEmbedUrl"
          class="w-full h-64 border-t border-muted"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          :title="t('exifRemover.report.gps.mapAlt')"
        />
      </div>

      <!-- Device / Timestamp / Software list -->
      <div class="border border-muted rounded-xl divide-y divide-muted">
        <div v-if="singleReport.summary.device" class="p-3 flex items-center gap-3">
          <UIcon name="i-lucide-smartphone" class="text-lg text-muted" />
          <span class="text-sm text-muted w-28 shrink-0">{{ t('exifRemover.report.device.title') }}</span>
          <span class="text-sm font-medium">{{ singleReport.summary.device }}</span>
        </div>
        <div v-if="singleReport.summary.timestamp" class="p-3 flex items-center gap-3">
          <UIcon name="i-lucide-clock" class="text-lg text-muted" />
          <span class="text-sm text-muted w-28 shrink-0">{{ t('exifRemover.report.timestamp.title') }}</span>
          <span class="text-sm font-medium">{{ formattedTimestamp }}</span>
        </div>
        <div v-if="singleReport.summary.software" class="p-3 flex items-center gap-3">
          <UIcon name="i-lucide-wrench" class="text-lg text-muted" />
          <span class="text-sm text-muted w-28 shrink-0">{{ t('exifRemover.report.software.title') }}</span>
          <span class="text-sm font-medium">{{ singleReport.summary.software }}</span>
        </div>
      </div>

    </div>

    <!-- BATCH REPORT -->
    <div v-if="status === 'reportBatch'" class="space-y-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-semibold text-lg">
          {{ t('exifRemover.batch.title', { count: batchStats.total }) }}
        </h3>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <UButton
              :label="t('exifRemover.actions.cleanAll')"
              icon="i-lucide-eraser"
              size="xs"
              @click="runClean"
            />
            <UButton
              :label="t('exifRemover.actions.downloadMeta')"
              icon="i-lucide-file-json"
              size="xs"
              color="neutral"
              variant="outline"
              @click="downloadMetadata"
            />
            <UButton :label="t('exifRemover.actions.chooseAgain')" size="xs" color="neutral" variant="ghost" @click="reset" />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="border border-error/40 bg-error/5 rounded-lg p-3 text-center">
          <p class="text-2xl font-bold text-error">
            {{ batchStats.risky }}
          </p>
          <p class="text-xs text-muted">
            {{ t('exifRemover.batch.riskyCount') }}
          </p>
        </div>
        <div class="border border-success/40 bg-success/5 rounded-lg p-3 text-center">
          <p class="text-2xl font-bold text-success">
            {{ batchStats.clean }}
          </p>
          <p class="text-xs text-muted">
            {{ t('exifRemover.batch.cleanCount') }}
          </p>
        </div>
      </div>

      <div class="border border-muted rounded-xl divide-y divide-muted">
        <div
          v-for="item in batchReports"
          :key="item.filename"
          class="p-3 flex items-center gap-3"
        >
          <UIcon
            :name="item.hasPrivacyRisk ? 'i-lucide-shield-alert' : 'i-lucide-shield-check'"
            class="text-lg shrink-0"
            :class="item.hasPrivacyRisk ? 'text-error' : 'text-success'"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">
              {{ item.filename }}
            </p>
            <div v-if="item.hasPrivacyRisk" class="flex flex-wrap gap-1 mt-1">
              <span
                v-for="tag in riskTagsFor(item)"
                :key="tag"
                class="text-[10px] px-1.5 py-0.5 rounded bg-error/10 text-error"
              >{{ tag }}</span>
            </div>
            <span v-else class="text-xs text-success">{{ t('exifRemover.tags.clean') }}</span>
          </div>
        </div>
      </div>

    </div>

    <!-- CLEANING -->
    <div v-if="status === 'cleaning'" class="text-center py-16">
      <UIcon name="i-lucide-loader-circle" class="text-5xl text-primary animate-spin mx-auto mb-4" />
      <p class="text-lg font-medium">
        {{ t('exifRemover.status.cleaning') }}
      </p>
    </div>

    <!-- DONE -->
    <div v-if="status === 'done'" class="space-y-4">
      <div class="border border-success/40 bg-success/5 rounded-xl p-6 text-center">
        <UIcon name="i-lucide-shield-check" class="text-5xl text-success mx-auto mb-3" />
        <div class="text-3xl font-bold text-success mb-1 tabular-nums">
          100<span class="text-base text-muted font-normal">/100</span>
        </div>
        <h3 class="text-lg font-semibold">
          {{ t('exifRemover.done.title') }}
        </h3>
        <p class="text-sm text-muted mt-2">
          {{ isBatch ? t('exifRemover.done.descriptionBatch') : t('exifRemover.done.descriptionSingle') }}
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <UButton
          :label="t('exifRemover.actions.download', { filename: cleanedFilename })"
          icon="i-lucide-download"
          size="lg"
          class="flex-1 justify-center"
          @click="downloadCleaned"
        />
        <UButton
          :label="t('exifRemover.actions.verifyAgain')"
          icon="i-lucide-refresh-cw"
          size="lg"
          color="neutral"
          variant="outline"
          @click="reset"
        />
      </div>

      <p class="text-xs text-muted text-center">
        {{ t('exifRemover.done.verifyTip') }}
      </p>
    </div>

    <!-- ERROR -->
    <UAlert v-if="status === 'error'" color="error" :title="errorMessage" class="mt-4">
      <template #actions>
        <UButton :label="t('exifRemover.actions.retry')" color="error" variant="outline" size="sm" @click="reset" />
      </template>
    </UAlert>

    <!-- Ad Modal -->
    <UModal v-model:open="showAdModal">
      <template #content>
        <div class="p-6 text-center space-y-4">
          <UIcon name="i-lucide-heart" class="text-4xl text-primary mx-auto" />
          <h3 class="text-lg font-bold">{{ t('exifRemover.adModal.title') }}</h3>
          <p class="text-sm text-muted">{{ t('exifRemover.adModal.description') }}</p>
          <div class="flex justify-center gap-3 pt-2">
            <UButton :label="t('exifRemover.adModal.watch')" size="lg" @click="onAdConfirm" />
            <UButton :label="t('exifRemover.adModal.close')" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
          </div>
        </div>
      </template>
    </UModal>
    </div>

    <!-- Remaining uses hint (below card) -->
    <p v-if="status === 'idle' && remainingUses > 0" class="text-xs text-muted text-center">
      {{ t('exifRemover.adModal.remaining', { count: remainingUses }, remainingUses) }}
    </p>

  </div>
</template>
