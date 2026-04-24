# Image Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure client-side image editor at `/tools/image-editor` that chains Crop → Rotate → Flip → Resize → Compress in a single canvas pipeline with real-time preview, ad gate, and full SEO/i18n.

**Architecture:** Single Vue 3 SFC (`ImageEditor.vue`) — all image processing done via Canvas API in the browser. `vue-advanced-cropper` provides the interactive drag-crop UI. The `FREE_LIMIT` ad gate follows the ExifCleaner pattern: direct download for the first 3 uses, modal + `/download` waiting room on the 3rd use and any use thereafter.

**Tech Stack:** Nuxt 4 · Vue 3 · Canvas API · `vue-advanced-cropper` · `useCookie` · `useDownloadStore` · `useMonetagDirectLink`

**Spec:** `docs/superpowers/specs/2026-04-24-image-editor-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/components/ImageEditor.vue` | Create | Main tool component — all state, canvas pipeline, UI |
| `app/pages/tools/image-editor.vue` | Create | Page wrapper — ToolPageLayout, SEO, JSON-LD |
| `app/pages/download.vue` | Modify | Add `imageEditor` to `toolKey`, `tipCount`, `apiUrl` |
| `app/composables/useTools.ts` | Modify | Register `imageEditor` in a new `imageEditing` tool group |
| `i18n/locales/en.json` | Modify | All `imageEditor.*` and `waitingRoom.imageEditor.*` keys |
| `i18n/locales/{zh-TW,zh-CN,de,es,ja,ko,pt,ru}.json` | Modify | Translated versions of the same keys |

---

## Task 1 — Install vue-advanced-cropper

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Install the package**

```bash
cd /Users/yu-hung/Desktop/MyRepos/DNGTaMe/ClawStudio
npm install vue-advanced-cropper
```

Expected output: `added 1 package` (or similar, no errors)

- [ ] **Verify the CSS asset exists**

```bash
ls node_modules/vue-advanced-cropper/dist/style.css
```

Expected: file path printed, no "No such file" error

- [ ] **Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add vue-advanced-cropper dependency"
```

---

## Task 2 — ImageEditor.vue: scaffold, state, file validation

**Files:**
- Create: `app/components/ImageEditor.vue`

- [ ] **Create the file with script setup, all state, and validation helpers**

```vue
<script setup lang="ts">
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

type Tab = 'crop' | 'resize' | 'compress' | 'rotate' | 'flip'
type OutputFormat = 'jpg' | 'png' | 'webp'
interface CropCoords { left: number; top: number; width: number; height: number }

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
const cropperRef = ref()

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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div>ImageEditor placeholder</div>
</template>
```

- [ ] **Verify Nuxt build picks it up without errors**

```bash
npx nuxi build 2>&1 | tail -5
```

Expected: build completes, no "Cannot find module" for vue-advanced-cropper

- [ ] **Commit**

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: ImageEditor.vue scaffold with state and validation helpers"
```

---

## Task 3 — ImageEditor.vue: file loading + drop zone (idle state)

**Files:**
- Modify: `app/components/ImageEditor.vue`

- [ ] **Add file loading functions after the validation helpers in `<script setup>`**

```ts
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
  }
  img.src = url
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) loadFile(target.files[0])
  target.value = ''
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
}

// placeholder so Tasks 4–6 can reference it
function renderPreview() {}
```

- [ ] **Replace the `<template>` with the idle drop zone**

```vue
<template>
  <div>
    <!-- IDLE: drop zone -->
    <div v-if="status === 'idle'">
      <div
        class="relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors"
        :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
        @click="fileInput?.click()"
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
```

- [ ] **Commit**

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: ImageEditor drop zone and file loading"
```

---

## Task 4 — ImageEditor.vue: editing layout (left preview + right panel skeleton)

**Files:**
- Modify: `app/components/ImageEditor.vue`

- [ ] **Replace the editing placeholder in `<template>` with the two-column layout**

```vue
    <!-- EDITING state -->
    <div v-else class="border border-muted rounded-xl bg-default overflow-hidden">
      <div class="flex flex-col md:flex-row">

        <!-- LEFT: preview -->
        <div class="flex-1 flex flex-col gap-3 p-4 md:border-r border-muted min-w-0">
          <!-- Preview canvas / cropper (filled in Tasks 5–6) -->
          <div class="flex-1 bg-muted/10 rounded-lg min-h-64 flex items-center justify-center relative overflow-hidden">
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
          <div class="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-x-visible">
            <button
              v-for="tab in (['crop', 'resize', 'compress', 'rotate', 'flip'] as Tab[])"
              :key="tab"
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
          <div class="flex-1 p-3 border-t md:border-t border-muted space-y-3">
            <p class="text-xs text-muted">{{ activeTab }} controls — coming in next tasks</p>
          </div>

          <!-- Format + Download (Task 10) -->
          <div class="p-3 border-t border-muted space-y-2">
            <p class="text-xs text-muted font-medium uppercase tracking-wide">{{ t('imageEditor.format.label') }}</p>
            <div class="flex gap-1">
              <button
                v-for="fmt in (['jpg', 'png', 'webp'] as OutputFormat[])"
                :key="fmt"
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
```

- [ ] **Add the `tabIcon` helper and stub `onTabChange` and `handleDownload` in `<script setup>`**

```ts
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
  activeTab.value = tab
}

function handleDownload() {
  // implemented in Task 10
}
```

- [ ] **Verify layout renders on dev server — upload an image and confirm two-column layout appears**

```bash
npx nuxi dev
```

Open `http://localhost:3000/tools/image-editor` (page created in Task 13 — for now, add a temporary route by creating a minimal `app/pages/tools/image-editor.vue` with just `<ImageEditor />`).

- [ ] **Commit**

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: ImageEditor editing layout skeleton"
```

---

## Task 5 — ImageEditor.vue: Crop tab with vue-advanced-cropper

**Files:**
- Modify: `app/components/ImageEditor.vue`

- [ ] **Replace `onTabChange` with the crop-commit version in `<script setup>`**

```ts
function onTabChange(tab: Tab) {
  // Commit crop data when leaving Crop tab
  if (activeTab.value === 'crop' && cropperRef.value) {
    const result = cropperRef.value.getResult()
    if (result?.coordinates) {
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

const imageSrc = ref('')

watch(originalFile, (f, oldF) => {
  if (oldF) URL.revokeObjectURL(imageSrc.value)
  imageSrc.value = f ? URL.createObjectURL(f) : ''
})

onBeforeUnmount(() => { if (imageSrc.value) URL.revokeObjectURL(imageSrc.value) })
```

- [ ] **Replace the left-panel preview area with the cropper/canvas switcher**

Replace the `<div class="flex-1 bg-muted/10 ...">` block (the preview placeholder):

```vue
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
            </ClientOnly>
          </div>

          <!-- Other tabs: canvas preview -->
          <div v-else class="flex-1 bg-muted/10 rounded-lg min-h-64 flex items-center justify-center relative overflow-hidden">
            <canvas ref="previewCanvasEl" class="max-w-full max-h-80 object-contain" />
          </div>
```

- [ ] **Replace the Tab content placeholder with the Crop tab controls**

Replace `<p class="text-xs text-muted">{{ activeTab }} controls — coming in next tasks</p>` inside the tab content div:

```vue
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
              <UButton :label="t('imageEditor.crop.reset')" size="xs" color="neutral" variant="outline" class="w-full justify-center" @click="cropAspectRatio = undefined; cropCoords.value = { left: 0, top: 0, width: originalImage?.naturalWidth ?? 0, height: originalImage?.naturalHeight ?? 0 }" />
            </template>

            <!-- Other tabs placeholder -->
            <template v-else>
              <p class="text-xs text-muted">{{ activeTab }} — next tasks</p>
            </template>
```

- [ ] **Verify crop box appears when image is uploaded, switching tabs commits crop data**

Run dev server, upload image, confirm cropperjs overlay renders with drag handles.

- [ ] **Commit**

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: Crop tab with vue-advanced-cropper drag box"
```

---

## Task 6 — ImageEditor.vue: Canvas pipeline (renderPreview + buildOutputCanvas)

**Files:**
- Modify: `app/components/ImageEditor.vue`

- [ ] **Replace the stub `renderPreview()` with the real implementation in `<script setup>`**

```ts
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
  ctx.rotate(rad)
  if (flipH.value) ctx.scale(-1, 1)
  if (flipV.value) ctx.scale(1, -1)
  ctx.drawImage(img, cx, cy, cw, ch, -outW / 2, -outH / 2, outW, outH)
  ctx.restore()
}

function renderPreview() {
  const canvas = previewCanvasEl.value
  if (!canvas || !originalImage.value) return
  canvas.width = resizeWidth.value || originalImage.value.naturalWidth
  canvas.height = resizeHeight.value || originalImage.value.naturalHeight
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
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), mime, q))
}

function getOutputFilename(): string {
  const base = originalFile.value?.name.replace(/\.[^.]+$/, '') || 'edited'
  const ext = outputFormat.value === 'jpg' ? 'jpg' : outputFormat.value
  return `${base}_edited.${ext}`
}
```

- [ ] **Verify preview canvas renders correctly when switching away from Crop tab**

Upload image, drag crop box, switch to Resize tab → canvas should show cropped preview.

- [ ] **Commit**

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: canvas pipeline renderPreview and buildOutputCanvas"
```

---

## Task 7 — ImageEditor.vue: Resize tab

**Files:**
- Modify: `app/components/ImageEditor.vue`

- [ ] **Add resize helpers in `<script setup>`**

```ts
function onWidthInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value) || 0
  resizeWidth.value = v
  if (lockAspect.value && v > 0) resizeHeight.value = Math.round(v / originalAspect.value)
  renderPreview()
}

function onHeightInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value) || 0
  resizeHeight.value = v
  if (lockAspect.value && v > 0) resizeWidth.value = Math.round(v * originalAspect.value)
  renderPreview()
}

function applyPreset(pct: number) {
  const img = originalImage.value!
  resizeWidth.value = Math.round(img.naturalWidth * pct / 100)
  resizeHeight.value = Math.round(img.naturalHeight * pct / 100)
  renderPreview()
}
```

- [ ] **Add Resize tab content inside the `v-else` tab placeholder block**

```vue
            <template v-else-if="activeTab === 'resize'">
              <div class="grid grid-cols-2 gap-2">
                <UFormField :label="t('imageEditor.resize.width')">
                  <input
                    type="number" min="1"
                    :value="resizeWidth"
                    class="w-full bg-muted/10 border border-muted rounded px-2 py-1 text-sm font-mono"
                    @input="onWidthInput"
                  >
                </UFormField>
                <UFormField :label="t('imageEditor.resize.height')">
                  <input
                    type="number" min="1"
                    :value="resizeHeight"
                    class="w-full bg-muted/10 border border-muted rounded px-2 py-1 text-sm font-mono"
                    @input="onHeightInput"
                  >
                </UFormField>
              </div>
              <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input v-model="lockAspect" type="checkbox" class="rounded">
                {{ t('imageEditor.resize.lockAspect') }}
              </label>
              <div>
                <p class="text-xs text-muted mb-1">{{ t('imageEditor.resize.presets') }}</p>
                <div class="flex gap-1 flex-wrap">
                  <button v-for="pct in [25, 50, 75]" :key="pct" class="px-2 py-1 bg-muted/20 hover:bg-muted/40 rounded text-xs" @click="applyPreset(pct)">{{ pct }}%</button>
                  <button class="px-2 py-1 bg-muted/20 hover:bg-muted/40 rounded text-xs" @click="applyPreset(100)">Original</button>
                </div>
              </div>
            </template>
```

- [ ] **Verify: change width → height auto-updates (lock on), preview updates**

- [ ] **Commit**

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: Resize tab with aspect lock and presets"
```

---

## Task 8 — ImageEditor.vue: Compress tab + estimated size

**Files:**
- Modify: `app/components/ImageEditor.vue`

- [ ] **Add estimated size updater in `<script setup>`**

```ts
function updateEstimatedSize() {
  const canvas = previewCanvasEl.value
  if (!canvas || outputFormat.value === 'png') { estimatedSize.value = ''; return }
  canvas.toBlob(blob => { if (blob) estimatedSize.value = formatSize(blob.size) }, outputMime.value, quality.value / 100)
}

watch([quality, outputFormat], () => { renderPreview(); updateEstimatedSize() })
```

- [ ] **Add Compress tab content inside the tab placeholder block**

```vue
            <template v-else-if="activeTab === 'compress'">
              <template v-if="outputFormat !== 'png'">
                <UFormField :label="`${t('imageEditor.compress.quality')}: ${quality}`">
                  <input
                    v-model.number="quality"
                    type="range" min="1" max="100"
                    class="w-full"
                    @change="updateEstimatedSize"
                  >
                </UFormField>
                <div v-if="estimatedSize" class="flex justify-between text-xs text-muted bg-muted/10 rounded p-2">
                  <span>{{ t('imageEditor.compress.estimatedSize') }}</span>
                  <span class="font-mono text-success">~{{ estimatedSize }}</span>
                </div>
              </template>
              <p v-else class="text-xs text-muted italic leading-relaxed">{{ t('imageEditor.compress.pngHint') }}</p>
            </template>
```

- [ ] **Verify: quality slider changes estimated size readout; PNG shows hint**

- [ ] **Commit**

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: Compress tab with quality slider and estimated size"
```

---

## Task 9 — ImageEditor.vue: Rotate and Flip tabs

**Files:**
- Modify: `app/components/ImageEditor.vue`

- [ ] **Add rotate/flip helpers in `<script setup>`**

```ts
function applyRotation(deg: number) {
  rotateDegrees.value = ((rotateDegrees.value + deg) % 360 + 360) % 360
  renderPreview()
}

function setRotation(deg: number) {
  rotateDegrees.value = deg
  renderPreview()
}

function toggleFlipH() { flipH.value = !flipH.value; renderPreview() }
function toggleFlipV() { flipV.value = !flipV.value; renderPreview() }
```

- [ ] **Add Rotate and Flip tab content inside the tab placeholder block**

```vue
            <template v-else-if="activeTab === 'rotate'">
              <div class="flex gap-1">
                <UButton size="xs" :label="t('imageEditor.rotate.minus90')" color="neutral" variant="outline" class="flex-1 justify-center" @click="applyRotation(-90)" />
                <UButton size="xs" :label="t('imageEditor.rotate.plus90')" color="neutral" variant="outline" class="flex-1 justify-center" @click="applyRotation(90)" />
                <UButton size="xs" :label="t('imageEditor.rotate.deg180')" color="neutral" variant="outline" class="flex-1 justify-center" @click="applyRotation(180)" />
              </div>
              <UFormField :label="`${t('imageEditor.rotate.custom')}: ${rotateDegrees}°`">
                <input v-model.number="rotateDegrees" type="range" min="-180" max="180" class="w-full" @input="renderPreview()" >
              </UFormField>
            </template>

            <template v-else-if="activeTab === 'flip'">
              <UButton
                :label="t('imageEditor.flip.horizontal')"
                icon="i-lucide-flip-horizontal-2"
                color="neutral"
                :variant="flipH ? 'solid' : 'outline'"
                class="w-full justify-center"
                @click="toggleFlipH"
              />
              <UButton
                :label="t('imageEditor.flip.vertical')"
                icon="i-lucide-flip-vertical-2"
                color="neutral"
                :variant="flipV ? 'solid' : 'outline'"
                class="w-full justify-center"
                @click="toggleFlipV"
              />
            </template>
```

- [ ] **Verify: rotate buttons update preview; flip toggles highlight when active**

- [ ] **Commit**

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: Rotate and Flip tabs"
```

---

## Task 10 — ImageEditor.vue: Download + Ad gate + Modal

**Files:**
- Modify: `app/components/ImageEditor.vue`

- [ ] **Replace the stub `handleDownload` and add all download/ad functions**

```ts
function doDirectDownload(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = getOutputFilename()
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function handleDownload() {
  if (!originalImage.value) return

  if (downloadCount.value >= FREE_LIMIT) {
    showAdModal.value = true
    return
  }

  const blob = await buildOutputBlob()
  doDirectDownload(blob)
  downloadCount.value++

  if (downloadCount.value >= FREE_LIMIT) {
    useDownloadStore().setBlob(blob, getOutputFilename())
    showAdModal.value = true
  }
}

async function onAdConfirm() {
  showAdModal.value = false
  downloadCount.value = 0
  openDirectLink()
  const blob = await buildOutputBlob()
  useDownloadStore().setBlob(blob, getOutputFilename())
  navigateTo({
    path: localePath('/download'),
    query: { from: localePath('/tools/image-editor') }
  })
}
```

- [ ] **Add the Ad Modal at the bottom of `<template>` (inside the root `<div>`)**

```vue
    <!-- Ad Modal -->
    <UModal v-model:open="showAdModal">
      <template #content>
        <div class="p-6 text-center space-y-4">
          <UIcon name="i-lucide-heart" class="text-4xl text-primary mx-auto" />
          <h3 class="text-lg font-bold">{{ t('imageEditor.adModal.title') }}</h3>
          <p class="text-sm text-muted">{{ t('imageEditor.adModal.description') }}</p>
          <div class="flex justify-center gap-3 pt-2">
            <UButton :label="t('imageEditor.adModal.watch')" size="lg" @click="onAdConfirm" />
            <UButton :label="t('imageEditor.adModal.close')" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
          </div>
        </div>
      </template>
    </UModal>
```

- [ ] **Verify: first 3 downloads work directly; 4th shows modal; confirm navigates to /download**

- [ ] **Commit**

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: download ad gate and modal"
```

---

## Task 11 — ImageEditor.vue: Mobile responsive layout

**Files:**
- Modify: `app/components/ImageEditor.vue`

The layout already uses `flex-col md:flex-row` and `w-full md:w-52` from Task 4. This task ensures the tab bar is scrollable horizontally on mobile.

- [ ] **Verify the tab bar row already has `overflow-x-auto md:overflow-x-visible` (added in Task 4)**

If it does, no change needed. If not, add it:

```vue
<div class="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-x-visible">
```

- [ ] **Verify on mobile viewport: preview stacks above panel, tabs scroll horizontally without wrapping**

In browser devtools, set viewport to 375px wide. Confirm layout.

- [ ] **Commit** (only if changes were made)

```bash
git add app/components/ImageEditor.vue
git commit -m "feat: mobile responsive layout for ImageEditor"
```

---

## Task 12 — image-editor.vue: page wrapper, SEO, JSON-LD

**Files:**
- Create: `app/pages/tools/image-editor.vue`

- [ ] **Create the page file**

```vue
<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': 'Free Online Image Editor — Crop, Resize & Compress',
      'url': 'https://clawstudiouo.com/tools/image-editor',
      'applicationCategory': 'MultimediaApplication',
      'operatingSystem': 'Any',
      'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
      'featureList': ['Crop image', 'Resize image', 'Compress image', 'Rotate image', 'Flip image', 'No upload required']
    })
  }]
})

const seoSections: import('~/types/seo').SeoSection[] = [
  {
    type: 'text',
    titleKey: 'imageEditor.seo.whatIs.title',
    contentKeys: ['imageEditor.seo.whatIs.content', 'imageEditor.seo.whatIs.content2']
  },
  {
    type: 'steps',
    titleKey: 'imageEditor.seo.howTo.title',
    stepKeys: [
      'imageEditor.seo.howTo.step1',
      'imageEditor.seo.howTo.step2',
      'imageEditor.seo.howTo.step3',
      'imageEditor.seo.howTo.step4'
    ]
  },
  {
    type: 'features',
    titleKey: 'imageEditor.seo.features.title',
    itemKeys: [
      'imageEditor.seo.features.items.crop',
      'imageEditor.seo.features.items.resize',
      'imageEditor.seo.features.items.compress',
      'imageEditor.seo.features.items.rotate',
      'imageEditor.seo.features.items.privacy',
      'imageEditor.seo.features.items.format'
    ]
  },
  {
    type: 'useCases',
    titleKey: 'imageEditor.seo.useCases.title',
    itemKeys: [
      'imageEditor.seo.useCases.items.social',
      'imageEditor.seo.useCases.items.email',
      'imageEditor.seo.useCases.items.web',
      'imageEditor.seo.useCases.items.screenshot'
    ]
  },
  {
    type: 'faq',
    titleKey: 'imageEditor.seo.faq.title',
    itemKeys: [
      'imageEditor.seo.faq.items.privacy',
      'imageEditor.seo.faq.items.formats',
      'imageEditor.seo.faq.items.pngCompress',
      'imageEditor.seo.faq.items.quality'
    ]
  }
]

useSeoMeta({
  title: () => t('imageEditor.title'),
  description: () => t('imageEditor.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="imageEditor.title"
    subtitle-key="imageEditor.subtitle"
    prefix="imageEditor"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
  >
    <template #workspace>
      <ImageEditor />
    </template>
  </ToolPageLayout>
</template>
```

- [ ] **Verify page loads at `/tools/image-editor`, title renders, SEO sections show at bottom (i18n content added in Task 14)**

- [ ] **Commit**

```bash
git add app/pages/tools/image-editor.vue
git commit -m "feat: image-editor page wrapper with SEO and JSON-LD"
```

---

## Task 13 — download.vue + useTools.ts: register imageEditor

**Files:**
- Modify: `app/pages/download.vue`
- Modify: `app/composables/useTools.ts`

- [ ] **Add imageEditor to `toolKey` in `download.vue` — insert before the final `return 'gifToSprite'` line**

```ts
  if (from.includes('image-editor')) return 'imageEditor'
```

- [ ] **Add imageEditor to `tipCount` in `download.vue`**

```ts
    imageEditor: 4,
```

- [ ] **Add imageEditor to `apiUrl` in `download.vue` — insert before the pngTools check**

```ts
  if (toolKey.value === 'imageEditor') return 'https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter'
```

- [ ] **Add a new `imageEditing` group to `GROUPS` in `useTools.ts` — insert after the `privacy` group closing brace**

```ts
  {
    key: 'imageEditing',
    icon: 'i-lucide-wand-sparkles',
    tools: [
      { key: 'imageEditor', icon: 'i-lucide-wand-sparkles', to: '/tools/image-editor' }
    ]
  },
```

- [ ] **Verify: navigate to `/download?from=/tools/image-editor` — confirms correct tips and API promo show (once i18n is added)**

- [ ] **Commit**

```bash
git add app/pages/download.vue app/composables/useTools.ts
git commit -m "feat: register imageEditor in download.vue and useTools"
```

---

## Task 14 — i18n en.json: all imageEditor keys + SEO content

**Files:**
- Modify: `i18n/locales/en.json`

- [ ] **Add the following block inside `en.json` (at the top level, after the `common` key)**

```json
"imageEditor": {
  "title": "Free Online Image Editor — Crop, Resize & Compress",
  "subtitle": "Crop, resize, compress, rotate and flip images in your browser. No uploads, no server — 100% private.",
  "upload": {
    "title": "Drop or click to upload your image",
    "limit": "Max 50 MB · JPG, PNG, WebP, AVIF, GIF",
    "formats": "Supports JPG · PNG · WebP · AVIF · GIF",
    "sizeError": "File too large. Maximum size is 50 MB.",
    "typeError": "Unsupported format. Please upload JPG, PNG, WebP, AVIF, or GIF.",
    "changeFile": "Change image"
  },
  "tabs": {
    "crop": "Crop",
    "resize": "Resize",
    "compress": "Compress",
    "rotate": "Rotate",
    "flip": "Flip"
  },
  "crop": {
    "aspectRatio": "Aspect Ratio",
    "free": "Free",
    "reset": "Reset Crop",
    "width": "W",
    "height": "H"
  },
  "resize": {
    "width": "Width (px)",
    "height": "Height (px)",
    "lockAspect": "Lock aspect ratio",
    "presets": "Quick presets"
  },
  "compress": {
    "quality": "Quality",
    "estimatedSize": "Est. output size",
    "pngHint": "PNG is lossless — switch to WebP for a smaller file"
  },
  "rotate": {
    "minus90": "−90°",
    "plus90": "+90°",
    "deg180": "180°",
    "custom": "Custom angle"
  },
  "flip": {
    "horizontal": "Flip Horizontal",
    "vertical": "Flip Vertical"
  },
  "format": {
    "label": "Output Format"
  },
  "actions": {
    "download": "Download",
    "changeFile": "Change",
    "reset": "Start over"
  },
  "adModal": {
    "title": "Enjoying the free editor?",
    "description": "You've used your 3 free downloads. Watch a short video to keep editing for free.",
    "watch": "Watch Ad",
    "close": "Not now",
    "remaining": "1 free download remaining | {count} free downloads remaining"
  },
  "seo": {
    "whatIs": {
      "title": "What is this Image Editor?",
      "content": "This free online image editor lets you crop, resize, compress, rotate, and flip images directly in your browser — no software to install, no files uploaded to any server. Everything runs on your device using the HTML5 Canvas API, so your photos stay completely private.",
      "content2": "Whether you're preparing images for social media, shrinking files before emailing, or trimming screenshots, this tool handles it all in one place with instant real-time previews."
    },
    "howTo": {
      "title": "How to Edit Your Image",
      "step1": { "title": "Upload your image", "content": "Click the upload area or drag and drop a JPG, PNG, WebP, AVIF, or GIF file (up to 50 MB). The image loads instantly in the editor — nothing is sent to a server." },
      "step2": { "title": "Choose your edits", "content": "Use the tabs on the right to crop, resize, adjust quality, rotate, or flip your image. Switch between tabs freely — the preview updates instantly with every change." },
      "step3": { "title": "Select output format", "content": "Pick JPG, PNG, or WebP from the format selector. Use WebP for the smallest file size, PNG for images with transparency, JPG for universal compatibility." },
      "step4": { "title": "Download your result", "content": "Click Download to save the edited image directly to your device. The file is generated in your browser — fast, private, and completely free." }
    },
    "features": {
      "title": "Key Features",
      "items": {
        "crop": { "title": "Interactive Crop with Aspect Ratio Lock", "content": "Drag the crop box to select exactly the region you want. Lock to common ratios — 1:1 for Instagram, 16:9 for YouTube thumbnails, 4:3 for presentations — or crop freely." },
        "resize": { "title": "Precise Resize with Aspect Ratio Preservation", "content": "Enter exact pixel dimensions or choose a quick preset (25%, 50%, 75%). The locked aspect ratio prevents stretching." },
        "compress": { "title": "Quality Compression for Smaller Files", "content": "Adjust the quality slider to balance file size and visual clarity. A setting of 80–85 is the sweet spot for web images — typically 60–70% smaller with no visible quality loss." },
        "rotate": { "title": "Rotate by Any Angle", "content": "Use quick buttons for 90°/180° rotations or the slider for a custom angle between −180° and +180°. Combine with flip for full orientation control." },
        "privacy": { "title": "100% Private — No Server Upload", "content": "Your image never leaves your device. The Canvas API processes everything locally. The output is also stripped of any EXIF metadata automatically." },
        "format": { "title": "Export as JPG, PNG, or WebP", "content": "Choose the best format for your use case. JPG for photos, PNG for images with transparency, WebP for the smallest file size at high quality." }
      }
    },
    "useCases": {
      "title": "Common Use Cases",
      "items": {
        "social": { "title": "Social Media Images", "content": "Crop to 1:1 for Instagram posts, 16:9 for Twitter/X headers, or 9:16 for Stories. Compress to stay under platform upload size limits." },
        "email": { "title": "Email Attachments", "content": "Resize large phone photos (often 4–12 MB) down to a few hundred kilobytes before attaching to emails." },
        "web": { "title": "Web & Blog Images", "content": "Export as WebP and set quality to 80–85 for images that load fast on your website without looking pixelated." },
        "screenshot": { "title": "Screenshot Trimming", "content": "Crop out browser toolbars or irrelevant content from screenshots before sharing in docs or presentations." }
      }
    },
    "faq": {
      "title": "Frequently Asked Questions",
      "items": {
        "privacy": { "title": "Is my image uploaded to a server?", "content": "No. This editor runs entirely in your browser using the HTML5 Canvas API. Your image is never uploaded anywhere — it stays on your device the whole time." },
        "formats": { "title": "What image formats are supported?", "content": "You can upload JPG, PNG, WebP, AVIF, and GIF files up to 50 MB. You can export as JPG, PNG, or WebP." },
        "pngCompress": { "title": "Why can't I compress PNG files?", "content": "PNG uses lossless compression, so there is no quality slider. To reduce file size, switch the output format to WebP — it typically achieves 25–35% smaller files than PNG at equivalent visual quality." },
        "quality": { "title": "What quality setting should I use?", "content": "For web images, 80–85 is the ideal range for JPG and WebP. Below 70 introduces visible artifacts; above 90 gives diminishing file-size returns." }
      }
    },
    "api": {
      "title": "Need to Process Images in Bulk?",
      "content": "This browser editor is perfect for individual images. For batch resizing, cropping, or converting hundreds of images programmatically, the Easy HEIC Image Converter API on RapidAPI supports automation at scale.",
      "cta": "Explore the API"
    }
  }
}
```

- [ ] **Add `waitingRoom.imageEditor` inside the `waitingRoom` key**

```json
"imageEditor": {
  "tipsTitle": "Image Editing Tips",
  "tips": [
    "**WebP vs JPG:** WebP produces files **25–35% smaller** than JPG at the same visual quality — ideal for websites and apps where load speed matters.",
    "**Social media aspect ratios:** Instagram posts → **1:1** · YouTube thumbnails → **16:9** · Instagram Stories → **9:16** · LinkedIn cover photo → **4:1**.",
    "**The compression sweet spot:** A quality setting of **80–85** removes up to 70% of file size with no visible quality difference. Going below 70 introduces noticeable artifacts.",
    "**Privacy bonus:** The Canvas API that powers this editor automatically strips all **EXIF metadata** from your output — including GPS location, device model, and timestamp."
  ]
}
```

- [ ] **Verify build has no JSON syntax errors**

```bash
node -e "require('./i18n/locales/en.json')" && echo "JSON valid"
```

Expected: `JSON valid`

- [ ] **Commit**

```bash
git add i18n/locales/en.json
git commit -m "feat: imageEditor i18n keys and SEO content (en)"
```

---

## Task 15 — i18n remaining 8 locales

**Files:**
- Modify: `i18n/locales/zh-TW.json`, `zh-CN.json`, `de.json`, `es.json`, `ja.json`, `ko.json`, `pt.json`, `ru.json`

- [ ] **Use the Translation Agent Skill (same workflow used for previous tools) to translate all `imageEditor.*` and `waitingRoom.imageEditor.*` keys from en.json into each of the 8 locales**

Reference the en.json keys added in Task 14. The translation agent should preserve the `{title, content}` object structure for SEO keys, the `**bold**` markdown in tips, and the `{count}` placeholder in `adModal.remaining`.

- [ ] **Validate each file after translation**

```bash
for f in zh-TW zh-CN de es ja ko pt ru; do
  node -e "require('./i18n/locales/$f.json')" && echo "$f: OK"
done
```

Expected: 8 lines of `OK`

- [ ] **Commit**

```bash
git add i18n/locales/
git commit -m "feat: imageEditor i18n keys — 8 additional locales"
```

---

## Task 16 — Final build verification + push

**Files:** None modified

- [ ] **Run a full production build**

```bash
npx nuxi build 2>&1 | tail -10
```

Expected: `.output/` created, no errors

- [ ] **Smoke test in dev: upload image → crop → resize → compress → download**

```bash
npx nuxi dev
```

Check:
1. `/tools/image-editor` loads with drop zone
2. Upload JPG — crop box appears
3. Drag crop, switch to Resize tab — canvas shows cropped preview
4. Change width — height auto-updates
5. Switch to Compress, move slider — estimated size updates
6. Switch to Rotate, click +90° — preview rotates
7. Format toggle JPG → WebP → PNG
8. Download 1st, 2nd time: direct download
9. Download 3rd time: direct download + ad modal appears
10. Confirm modal → navigates to `/download?from=/tools/image-editor` with correct tips

- [ ] **Push**

```bash
git push origin main
```
