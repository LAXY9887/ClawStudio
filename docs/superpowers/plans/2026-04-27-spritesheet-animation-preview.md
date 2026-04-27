# Spritesheet Animation Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side animation preview toggle to the existing Spritesheet Splitter tool so users can play their grid configuration as an animation before splitting.

**Architecture:** New `SpritesheetAnimator.vue` component that takes the same props as the existing `SpritesheetPreview.vue` (grid params, trim, range, frame count, skip-empty), computes the same frame coordinates, and draws frames to a single canvas via `requestAnimationFrame` at a user-controlled FPS. Toggle in the page renders either the grid overlay or the animator while sharing all parameter state. No backend involvement — uses the already-loaded `previewUrl` blob.

**Tech Stack:** Vue 3 `<script setup>`, Canvas 2D API, Nuxt UI (`UButton`, `USlider`, `UFormField`), `requestAnimationFrame`, `useI18n` for labels. No new dependencies.

**Codebase conventions to follow:**
- This project has **no unit-test runner** — verification is `pnpm lint` + `pnpm typecheck` + manual dev-server checks (memory: `推送前 Lint + TypeCheck`).
- ESLint config: `commaDangle: 'never'`, `braceStyle: '1tbs'`, no multiple statements per line, arrow params always parenthesised, no unused vars.
- Package manager: **pnpm only** (memory: `套件管理工具規範`). This plan adds **no new packages**.
- i18n: only modify **`en.json` and `zh-TW.json`** (memory: `翻譯只處理 en 和 zh-TW`). Other 7 locales are out of scope for this plan.

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `app/components/SpritesheetAnimator.vue` | **Create** | Plays grid cells as an animation on a single canvas with FPS / play / reverse controls. Reuses the same prop contract as `SpritesheetPreview.vue`. |
| `app/pages/tools/split-spritesheet.vue` | **Modify** | Adds `previewMode` ref + toggle UI; conditionally renders `<SpritesheetPreview>` vs `<SpritesheetAnimator>`. Adds 1 SEO feature item and 1 FAQ item key. |
| `i18n/locales/en.json` | **Modify** | Add `splitSpritesheet.preview.*` (toggle), `splitSpritesheet.animator.*` (controls), 1 new feature item, 1 new FAQ item. |
| `i18n/locales/zh-TW.json` | **Modify** | Same keys as en.json with Traditional Chinese values. |

**Out of scope (deliberately):**
- The other 7 locales (`zh-CN`, `ja`, `ko`, `de`, `es`, `pt`, `ru`) — user handles those separately.
- A standalone "Sprite Sheet Animator" tool page — this is a feature on the splitter, not a new tool.
- Export-as-GIF — not in this plan; can be added later if user validates demand.
- Tests — codebase has no Vitest/Jest setup; verification is lint + typecheck + manual.

---

## Component Contract: `SpritesheetAnimator.vue`

The animator's prop contract is **identical** to `SpritesheetPreview.vue` so it can drop into the same slot with the same bindings. Read [SpritesheetPreview.vue:1-25](app/components/SpritesheetPreview.vue#L1-L25) for the shared prop list.

```ts
withDefaults(defineProps<{
  src: string
  imageWidth: number
  imageHeight: number
  mode: 'grid' | 'cell'
  columns?: number
  rows?: number
  cellWidth?: number
  cellHeight?: number
  padding?: number
  columnRange?: string
  rowRange?: string
  frameCount?: number
  trimTop?: number
  trimRight?: number
  trimBottom?: number
  trimLeft?: number
  skipEmpty?: boolean   // NEW prop the existing preview doesn't take
}>(), {
  padding: 0,
  trimTop: 0,
  trimRight: 0,
  trimBottom: 0,
  trimLeft: 0,
  skipEmpty: true
})
```

`skipEmpty` is added because the animator should skip fully-transparent cells (matching server behaviour) — the existing grid overlay didn't need this.

---

### Task 1: Scaffold `SpritesheetAnimator.vue` with frame-coordinate computation

**Files:**
- Create: `app/components/SpritesheetAnimator.vue`

This task creates the component with grid math + a static "frame 0" render so we know the geometry is correct. No animation loop yet.

- [ ] **Step 1: Create the component file with prop definitions and grid math**

Create `app/components/SpritesheetAnimator.vue` with this exact content:

```vue
<script setup lang="ts">
const props = withDefaults(defineProps<{
  src: string
  imageWidth: number
  imageHeight: number
  mode: 'grid' | 'cell'
  columns?: number
  rows?: number
  cellWidth?: number
  cellHeight?: number
  padding?: number
  columnRange?: string
  rowRange?: string
  frameCount?: number
  trimTop?: number
  trimRight?: number
  trimBottom?: number
  trimLeft?: number
  skipEmpty?: boolean
}>(), {
  padding: 0,
  trimTop: 0,
  trimRight: 0,
  trimBottom: 0,
  trimLeft: 0,
  skipEmpty: true
})

interface FrameRect { sx: number, sy: number, sw: number, sh: number }

const canvasRef = ref<HTMLCanvasElement>()
const imgRef = ref<HTMLImageElement>()
const imgLoaded = ref(false)

const trimmedWidth = computed(() => props.imageWidth - (props.trimLeft || 0) - (props.trimRight || 0))
const trimmedHeight = computed(() => props.imageHeight - (props.trimTop || 0) - (props.trimBottom || 0))

const grid = computed(() => {
  const imgW = trimmedWidth.value
  const imgH = trimmedHeight.value
  if (imgW <= 0 || imgH <= 0) return null
  const pad = props.padding || 0

  let cols = 0
  let rowCount = 0
  let cw = 0
  let ch = 0

  if (props.mode === 'grid' && props.columns && props.rows) {
    cols = props.columns
    rowCount = props.rows
    cw = (imgW - (cols - 1) * pad) / cols
    ch = (imgH - (rowCount - 1) * pad) / rowCount
  } else if (props.mode === 'cell' && props.cellWidth && props.cellHeight) {
    cw = props.cellWidth
    ch = props.cellHeight
    cols = Math.floor((imgW + pad) / (cw + pad))
    rowCount = Math.floor((imgH + pad) / (ch + pad))
  }

  if (cols <= 0 || rowCount <= 0 || cw <= 0 || ch <= 0) return null
  return { cols, rows: rowCount, cellWidth: cw, cellHeight: ch }
})

function parseRange(range: string | undefined, max: number): [number, number] {
  if (!range || !range.trim()) return [0, max - 1]
  const parts = range.trim().split('-')
  if (parts.length === 1) {
    const v = parseInt(parts[0] || '')
    return isNaN(v) ? [0, max - 1] : [v, v]
  }
  const a = parseInt(parts[0] || '')
  const b = parseInt(parts[1] || '')
  return [isNaN(a) ? 0 : a, isNaN(b) ? max - 1 : b]
}

const frames = computed<FrameRect[]>(() => {
  const g = grid.value
  if (!g) return []
  const pad = props.padding || 0
  const ox = props.trimLeft || 0
  const oy = props.trimTop || 0
  const [colStart, colEnd] = parseRange(props.columnRange, g.cols)
  const [rowStart, rowEnd] = parseRange(props.rowRange, g.rows)
  const result: FrameRect[] = []
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (c < colStart || c > colEnd || r < rowStart || r > rowEnd) continue
      result.push({
        sx: ox + c * (g.cellWidth + pad),
        sy: oy + r * (g.cellHeight + pad),
        sw: g.cellWidth,
        sh: g.cellHeight
      })
    }
  }
  const max = props.frameCount && props.frameCount > 0 ? props.frameCount : result.length
  return result.slice(0, max)
})

function drawFrame(idx: number) {
  const canvas = canvasRef.value
  const img = imgRef.value
  if (!canvas || !img || !imgLoaded.value) return
  const list = frames.value
  if (list.length === 0) return
  const f = list[idx % list.length]
  if (!f) return
  canvas.width = Math.max(1, Math.round(f.sw))
  canvas.height = Math.max(1, Math.round(f.sh))
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, f.sx, f.sy, f.sw, f.sh, 0, 0, canvas.width, canvas.height)
}

function onImgLoad() {
  imgLoaded.value = true
  drawFrame(0)
}

watch(frames, () => drawFrame(0))
</script>

<template>
  <div class="relative w-full border border-muted rounded-xl overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] flex items-center justify-center min-h-64 p-4">
    <img ref="imgRef" :src="src" alt="" class="hidden" @load="onImgLoad">
    <canvas ref="canvasRef" class="max-w-full max-h-96 object-contain" />
    <p v-if="frames.length === 0" class="text-sm text-muted absolute">{{ '' }}</p>
  </div>
</template>
```

- [ ] **Step 2: Verify lint + typecheck pass**

Run:
```bash
pnpm lint && pnpm typecheck
```
Expected: both exit with code 0, no errors. The (unused) trailing `<p>` placeholder uses an empty string fallback which is intentional — it's wired up properly in Task 5 with i18n.

- [ ] **Step 3: Verify in dev server (manual)**

Run:
```bash
pnpm dev
```

Temporarily edit [app/pages/tools/split-spritesheet.vue:323](app/pages/tools/split-spritesheet.vue#L323) — replace `<SpritesheetPreview ... />` with `<SpritesheetAnimator ... />` (do NOT commit this change). Open the splitter page, upload a sprite sheet, set columns=4 rows=3 (or whatever fits your test image), and confirm:
- The first frame renders into the canvas.
- Changing `columns`/`rows`/`cellWidth`/`cellHeight` updates which slice is drawn.
- Setting `columnRange="1-2"` makes frame 0 jump to the first cell of column 1.

Then revert the temporary `<SpritesheetPreview>` → `<SpritesheetAnimator>` swap. The component is verified.

- [ ] **Step 4: Commit**

```bash
git add app/components/SpritesheetAnimator.vue
git commit -m "新增 SpritesheetAnimator 元件骨架（frames 計算 + 靜態幀繪製）"
```

---

### Task 2: Add play loop + FPS / play-pause / reverse controls

**Files:**
- Modify: `app/components/SpritesheetAnimator.vue` (extend the script + template)

This task wires up `requestAnimationFrame`-based playback with FPS, play/pause, reverse, and a frame counter. All control labels remain hardcoded English placeholders for now — i18n comes in Task 5.

- [ ] **Step 1: Add playback state and the rAF loop to the `<script setup>` block**

Insert this block AFTER the existing `watch(frames, () => drawFrame(0))` line and BEFORE `</script>`:

```ts
const isPlaying = ref(true)
const fps = ref(12)
const reverse = ref(false)
const currentFrame = ref(0)
const totalFrames = computed(() => frames.value.length)

let rafId = 0
let lastTick = 0

function loop(now: number) {
  if (!isPlaying.value || totalFrames.value === 0) {
    rafId = 0
    return
  }
  if (lastTick === 0) lastTick = now
  const interval = 1000 / Math.max(1, fps.value)
  if (now - lastTick >= interval) {
    lastTick = now
    const dir = reverse.value ? -1 : 1
    currentFrame.value = (currentFrame.value + dir + totalFrames.value) % totalFrames.value
    drawFrame(currentFrame.value)
  }
  rafId = requestAnimationFrame(loop)
}

function startLoop() {
  if (rafId !== 0) return
  lastTick = 0
  rafId = requestAnimationFrame(loop)
}

function stopLoop() {
  if (rafId !== 0) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) startLoop()
  else stopLoop()
}

watch(isPlaying, (v) => {
  if (v) startLoop()
  else stopLoop()
})

watch(totalFrames, (n) => {
  if (currentFrame.value >= n) currentFrame.value = 0
  drawFrame(currentFrame.value)
})

onMounted(() => {
  if (isPlaying.value) startLoop()
})

onBeforeUnmount(() => stopLoop())
```

- [ ] **Step 2: Update `onImgLoad` to start the loop after image is ready**

Replace the existing `onImgLoad` function with:

```ts
function onImgLoad() {
  imgLoaded.value = true
  drawFrame(currentFrame.value)
  if (isPlaying.value) startLoop()
}
```

- [ ] **Step 3: Replace the template with the controls UI**

Replace the entire `<template>` block with:

```vue
<template>
  <div class="space-y-2">
    <div class="relative w-full border border-muted rounded-xl overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] flex items-center justify-center min-h-64 p-4">
      <img ref="imgRef" :src="src" alt="" class="hidden" @load="onImgLoad">
      <canvas ref="canvasRef" class="max-w-full max-h-96 object-contain" />
    </div>
    <div v-if="totalFrames > 0" class="flex flex-wrap items-center gap-3">
      <UButton
        :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
        size="sm"
        color="neutral"
        variant="solid"
        @click="togglePlay"
      >
        {{ isPlaying ? 'Pause' : 'Play' }}
      </UButton>
      <UButton
        :icon="reverse ? 'i-lucide-rotate-ccw' : 'i-lucide-rotate-cw'"
        size="sm"
        color="neutral"
        variant="outline"
        @click="reverse = !reverse"
      >
        {{ reverse ? 'Reverse' : 'Forward' }}
      </UButton>
      <div class="flex items-center gap-2 flex-1 min-w-40">
        <span class="text-xs text-muted whitespace-nowrap">FPS: {{ fps }}</span>
        <input v-model.number="fps" type="range" min="1" max="60" class="flex-1">
      </div>
      <span class="text-xs text-muted font-mono">{{ currentFrame + 1 }} / {{ totalFrames }}</span>
    </div>
    <p v-else class="text-sm text-muted text-center py-2">No frames to play — set columns and rows.</p>
  </div>
</template>
```

- [ ] **Step 4: Verify lint + typecheck**

Run:
```bash
pnpm lint && pnpm typecheck
```
Expected: both pass.

- [ ] **Step 5: Verify in dev server (manual)**

Same temporary swap as Task 1 Step 3. Confirm:
- The animation plays at ~12 fps by default.
- Click Play/Pause toggles correctly.
- Dragging the FPS slider speeds up / slows down the playback.
- Reverse button flips direction.
- Frame counter increments while playing.
- Changing `columnRange` / `rowRange` / `frameCount` updates the playable frame set without breaking the loop.

Revert the temporary swap.

- [ ] **Step 6: Commit**

```bash
git add app/components/SpritesheetAnimator.vue
git commit -m "新增動畫播放迴圈與控制列（play/pause/reverse/fps）"
```

---

### Task 3: Skip-empty alpha detection

**Files:**
- Modify: `app/components/SpritesheetAnimator.vue`

Match the server's `skip_empty` behaviour: cells where every pixel has `alpha === 0` are excluded from the animation. Compute once per (src + grid + trim + padding) change and cache.

- [ ] **Step 1: Add the empty-cell sampler before the `frames` computed**

Find the `frames` computed in the script and INSERT this block immediately ABOVE it:

```ts
const emptyCells = ref<Set<string>>(new Set())

function sampleEmptyCells() {
  emptyCells.value = new Set()
  if (!props.skipEmpty) return
  const img = imgRef.value
  const g = grid.value
  if (!img || !imgLoaded.value || !g) return
  const pad = props.padding || 0
  const ox = props.trimLeft || 0
  const oy = props.trimTop || 0
  const off = document.createElement('canvas')
  off.width = Math.max(1, Math.round(g.cellWidth))
  off.height = Math.max(1, Math.round(g.cellHeight))
  const ctx = off.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      ctx.clearRect(0, 0, off.width, off.height)
      const sx = ox + c * (g.cellWidth + pad)
      const sy = oy + r * (g.cellHeight + pad)
      ctx.drawImage(img, sx, sy, g.cellWidth, g.cellHeight, 0, 0, off.width, off.height)
      const data = ctx.getImageData(0, 0, off.width, off.height).data
      let nonEmpty = false
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) {
          nonEmpty = true
          break
        }
      }
      if (!nonEmpty) emptyCells.value.add(`${c},${r}`)
    }
  }
}
```

- [ ] **Step 2: Filter empty cells out of the `frames` computed**

Replace the existing `frames` computed with:

```ts
const frames = computed<FrameRect[]>(() => {
  const g = grid.value
  if (!g) return []
  const pad = props.padding || 0
  const ox = props.trimLeft || 0
  const oy = props.trimTop || 0
  const [colStart, colEnd] = parseRange(props.columnRange, g.cols)
  const [rowStart, rowEnd] = parseRange(props.rowRange, g.rows)
  const empties = emptyCells.value
  const result: FrameRect[] = []
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (c < colStart || c > colEnd || r < rowStart || r > rowEnd) continue
      if (props.skipEmpty && empties.has(`${c},${r}`)) continue
      result.push({
        sx: ox + c * (g.cellWidth + pad),
        sy: oy + r * (g.cellHeight + pad),
        sw: g.cellWidth,
        sh: g.cellHeight
      })
    }
  }
  const max = props.frameCount && props.frameCount > 0 ? props.frameCount : result.length
  return result.slice(0, max)
})
```

- [ ] **Step 3: Trigger sampling on the right param changes**

Replace the existing `onImgLoad` with:

```ts
function onImgLoad() {
  imgLoaded.value = true
  sampleEmptyCells()
  drawFrame(currentFrame.value)
  if (isPlaying.value) startLoop()
}
```

And ADD this watcher right below the existing `watch(frames, () => drawFrame(0))` line:

```ts
watch(
  [() => props.mode, () => props.columns, () => props.rows, () => props.cellWidth, () => props.cellHeight, () => props.padding, () => props.trimTop, () => props.trimRight, () => props.trimBottom, () => props.trimLeft, () => props.skipEmpty, () => props.src],
  () => {
    if (imgLoaded.value) sampleEmptyCells()
  }
)
```

Note: `props.columnRange`, `props.rowRange`, `props.frameCount` are deliberately NOT in the watch list — they don't change which cells are empty.

- [ ] **Step 4: Verify lint + typecheck**

Run:
```bash
pnpm lint && pnpm typecheck
```

- [ ] **Step 5: Verify skip-empty in dev (manual)**

Use a sprite sheet that has trailing empty cells (e.g., a 4×3 grid where only 10 frames are filled and the last 2 are blank). Temporarily swap to the animator (as in Task 1 Step 3). Confirm:
- With skipEmpty=true (default): the animation plays only 10 frames.
- The frame counter shows `1 / 10`, not `1 / 12`.
- For a 50×50 grid sheet (large), sampling completes in under 1 second on a typical machine. If sampling lags noticeably, note it but do not optimise — defer to follow-up.

Revert the temporary swap.

- [ ] **Step 6: Commit**

```bash
git add app/components/SpritesheetAnimator.vue
git commit -m "新增 skipEmpty 用 alpha sampling 過濾全透明格子（對齊後端行為）"
```

---

### Task 4: Wire animator into the Split Spritesheet page with a mode toggle

**Files:**
- Modify: `app/pages/tools/split-spritesheet.vue`

Add a "Grid view / Animation preview" toggle directly above the existing preview area. Animator and grid overlay share the same parameter state. **Do not duplicate state** — both bind to the same refs already defined on the page.

- [ ] **Step 1: Add the `previewMode` ref**

In [app/pages/tools/split-spritesheet.vue](app/pages/tools/split-spritesheet.vue), find the `// Slicing mode` block (around line 119-120) and INSERT this above it:

```ts
const previewMode = ref<'grid' | 'animate'>('grid')
```

- [ ] **Step 2: Replace the existing preview block with toggle + conditional render**

Find this exact block in the template (currently at [app/pages/tools/split-spritesheet.vue:322-346](app/pages/tools/split-spritesheet.vue#L322-L346)):

```vue
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
    :padding="padding"
    :column-range="columnRange || undefined"
    :row-range="rowRange || undefined"
    :frame-count="frameCount"
    :trim-top="trimTop"
    :trim-right="trimRight"
    :trim-bottom="trimBottom"
    :trim-left="trimLeft"
  />
  <div class="flex items-center justify-between">
    <p class="text-sm text-muted">{{ file?.name }} · {{ formatSize(file?.size || 0) }} · {{ previewWidth }}×{{ previewHeight }}px</p>
    <UButton :label="t('splitSpritesheet.upload.changeFile')" size="xs" color="neutral" variant="ghost" @click="fileInput?.click()" />
  </div>
  <input ref="fileInput" type="file" accept=".png" class="hidden" @change="onFileSelect">
</div>
```

Replace it with:

```vue
<!-- Preview with grid overlay or animation (when file selected) -->
<div v-if="previewUrl && previewWidth > 0" class="space-y-2">
  <div class="flex gap-2">
    <UButton
      v-for="m in ['grid', 'animate'] as const"
      :key="m"
      :variant="previewMode === m ? 'solid' : 'outline'"
      :icon="m === 'grid' ? 'i-lucide-grid-3x3' : 'i-lucide-play'"
      color="neutral"
      size="sm"
      @click="previewMode = m"
    >
      {{ t(`splitSpritesheet.preview.${m}`) }}
    </UButton>
  </div>
  <SpritesheetPreview
    v-if="previewMode === 'grid'"
    :src="previewUrl"
    :image-width="previewWidth"
    :image-height="previewHeight"
    :mode="slicingMode"
    :columns="columns"
    :rows="rows"
    :cell-width="cellWidth"
    :cell-height="cellHeight"
    :padding="padding"
    :column-range="columnRange || undefined"
    :row-range="rowRange || undefined"
    :frame-count="frameCount"
    :trim-top="trimTop"
    :trim-right="trimRight"
    :trim-bottom="trimBottom"
    :trim-left="trimLeft"
  />
  <SpritesheetAnimator
    v-else
    :src="previewUrl"
    :image-width="previewWidth"
    :image-height="previewHeight"
    :mode="slicingMode"
    :columns="columns"
    :rows="rows"
    :cell-width="cellWidth"
    :cell-height="cellHeight"
    :padding="padding"
    :column-range="columnRange || undefined"
    :row-range="rowRange || undefined"
    :frame-count="frameCount"
    :trim-top="trimTop"
    :trim-right="trimRight"
    :trim-bottom="trimBottom"
    :trim-left="trimLeft"
    :skip-empty="skipEmpty"
  />
  <div class="flex items-center justify-between">
    <p class="text-sm text-muted">{{ file?.name }} · {{ formatSize(file?.size || 0) }} · {{ previewWidth }}×{{ previewHeight }}px</p>
    <UButton :label="t('splitSpritesheet.upload.changeFile')" size="xs" color="neutral" variant="ghost" @click="fileInput?.click()" />
  </div>
  <input ref="fileInput" type="file" accept=".png" class="hidden" @change="onFileSelect">
</div>
```

- [ ] **Step 3: Verify lint + typecheck**

Run:
```bash
pnpm lint && pnpm typecheck
```
Expected: both pass. The `t('splitSpritesheet.preview.${m}')` calls reference keys that won't exist until Task 5 — they'll render as the literal key string in the browser until then, which is fine for now (no compile-time check on i18n keys).

- [ ] **Step 4: Verify in dev server (manual)**

Run:
```bash
pnpm dev
```
Open the splitter page, upload a sheet, configure grid. Confirm:
- Toggle between "Grid" and "Animate" modes (labels show as `splitSpritesheet.preview.grid` etc. — that's expected pre-i18n).
- Both views share the same `columns`/`rows` and update together when you change them.
- Switching tabs while animation is playing doesn't crash; loop stops when animator unmounts (verify via DevTools Performance tab — no orphan rAF).

- [ ] **Step 5: Commit**

```bash
git add app/pages/tools/split-spritesheet.vue
git commit -m "新增預覽模式 toggle（網格 / 動畫），共用同一份切格參數"
```

---

### Task 5: i18n keys (en + zh-TW)

**Files:**
- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/zh-TW.json`

Adds the toggle labels, animator control labels, plus 1 SEO feature item and 1 FAQ entry. Do NOT modify the other 7 locales (memory: `翻譯只處理 en 和 zh-TW`).

- [ ] **Step 1: Add the new keys to `i18n/locales/en.json` under `splitSpritesheet`**

Open `i18n/locales/en.json`. Find the `"splitSpritesheet": {` block at the top-level (around line 1381). Inside it, locate the `"options": { ... }` block. Immediately AFTER the closing `}` of `options` (and BEFORE `"status": {`), INSERT:

```json
"preview": {
  "grid": "Grid view",
  "animate": "Animation preview"
},
"animator": {
  "play": "Play",
  "pause": "Pause",
  "forward": "Forward",
  "reverse": "Reverse",
  "fps": "FPS",
  "noFrames": "No frames to play — set columns and rows."
},
```

Then find `"features": { "items": { ... } }` inside `"seo"` (search the file for `"features": {` under `splitSpritesheet`). Add a new key `animationPreview` to the items object. Insert it immediately after the existing `"privacy"` item entry:

```json
"animationPreview": {
  "title": "Live Animation Preview",
  "content": "Toggle to Animation Preview to play your grid configuration as a moving sprite right in the browser. Adjust columns, rows, padding, range, or skip-empty and see the animation update instantly. Find the right parameters before splitting — no round-trip to the server."
},
```

Then find `"faq": { "items": { ... } }` (also under `seo`). Add a new FAQ entry. Insert it immediately after the existing `"gridVsCell"` entry:

```json
"animationPreview": {
  "q": "Can I preview the animation before splitting?",
  "a": "Yes. Click \"Animation preview\" above the grid view to play your spritesheet as an animation directly in the browser. The preview uses the same columns, rows, range, and skip-empty settings, so you can verify your grid configuration produces the right animation before you split. The preview runs entirely client-side — no server call, no usage count consumed."
},
```

- [ ] **Step 2: Wire the new feature + FAQ into the `seoSections` array**

In [app/pages/tools/split-spritesheet.vue](app/pages/tools/split-spritesheet.vue), find the `seoSections` array. In the `features` section's `itemKeys`, add `'splitSpritesheet.seo.features.items.animationPreview'` after the existing `splitSpritesheet.seo.features.items.privacy` entry. In the `faq` section's `itemKeys`, add `'splitSpritesheet.seo.faq.items.animationPreview'` after `splitSpritesheet.seo.faq.items.gridVsCell`.

The exact change:

```ts
// In the features section, replace the itemKeys array with:
itemKeys: [
  'splitSpritesheet.seo.features.items.gridAndCell',
  'splitSpritesheet.seo.features.items.allOutputModes',
  'splitSpritesheet.seo.features.items.metadataFormats',
  'splitSpritesheet.seo.features.items.rangeSelection',
  'splitSpritesheet.seo.features.items.trimAndPadding',
  'splitSpritesheet.seo.features.items.skipEmpty',
  'splitSpritesheet.seo.features.items.singleFile',
  'splitSpritesheet.seo.features.items.privacy',
  'splitSpritesheet.seo.features.items.animationPreview'
]

// In the faq section, replace the itemKeys array with:
itemKeys: [
  'splitSpritesheet.seo.faq.items.gridVsCell',
  'splitSpritesheet.seo.faq.items.animationPreview',
  'splitSpritesheet.seo.faq.items.rangeFormat',
  'splitSpritesheet.seo.faq.items.skipEmpty',
  'splitSpritesheet.seo.faq.items.padding',
  'splitSpritesheet.seo.faq.items.metadataFormat',
  'splitSpritesheet.seo.faq.items.outputFormats',
  'splitSpritesheet.seo.faq.items.maxSize',
  'splitSpritesheet.seo.faq.items.privacy'
]
```

- [ ] **Step 3: Replace the hardcoded English labels in `SpritesheetAnimator.vue` with i18n calls**

In [app/components/SpritesheetAnimator.vue](app/components/SpritesheetAnimator.vue), at the top of `<script setup>` (after the `defineProps` call), add:

```ts
const { t } = useI18n()
```

Then in the template, replace these hardcoded strings:

| Old | New |
|---|---|
| `{{ isPlaying ? 'Pause' : 'Play' }}` | `{{ isPlaying ? t('splitSpritesheet.animator.pause') : t('splitSpritesheet.animator.play') }}` |
| `{{ reverse ? 'Reverse' : 'Forward' }}` | `{{ reverse ? t('splitSpritesheet.animator.reverse') : t('splitSpritesheet.animator.forward') }}` |
| `<span class="text-xs text-muted whitespace-nowrap">FPS: {{ fps }}</span>` | `<span class="text-xs text-muted whitespace-nowrap">{{ t('splitSpritesheet.animator.fps') }}: {{ fps }}</span>` |
| `No frames to play — set columns and rows.` (inside the `<p>`) | `{{ t('splitSpritesheet.animator.noFrames') }}` |

- [ ] **Step 4: Mirror all 6 new keys in `i18n/locales/zh-TW.json`**

In `i18n/locales/zh-TW.json`, add the equivalent block in the same position (after `options`, before `status`):

```json
"preview": {
  "grid": "網格檢視",
  "animate": "動畫預覽"
},
"animator": {
  "play": "播放",
  "pause": "暫停",
  "forward": "正向",
  "reverse": "反向",
  "fps": "FPS",
  "noFrames": "沒有可播放的幀 — 請設定欄與列。"
},
```

And add to features.items (after `privacy`):

```json
"animationPreview": {
  "title": "即時動畫預覽",
  "content": "切換到「動畫預覽」即可在瀏覽器中直接播放你的切格設定。調整欄、列、padding、範圍或 skip-empty，動畫立即更新。先看到動畫對不對，再決定切割 — 完全不打 API。"
},
```

And add to faq.items (after `gridVsCell`):

```json
"animationPreview": {
  "q": "我可以在切割前預覽動畫嗎？",
  "a": "可以。在網格檢視上方點擊「動畫預覽」，即可在瀏覽器中直接播放 spritesheet 動畫。預覽會使用相同的欄、列、範圍和 skip-empty 設定，所以你可以在切割前確認切格設定是否正確。預覽完全在前端執行 — 不打 API、不會消耗免費次數。"
},
```

- [ ] **Step 5: Verify lint + typecheck**

Run:
```bash
pnpm lint && pnpm typecheck
```
Expected: both pass.

- [ ] **Step 6: Verify in dev server (manual)**

Switch language to English and 繁體中文 in turn. Confirm:
- Toggle buttons read "Grid view" / "Animation preview" (en) and "網格檢視" / "動畫預覽" (zh-TW).
- Animator controls render the localised labels.
- The new feature card appears in the SEO section (with title "Live Animation Preview" / "即時動畫預覽").
- The new FAQ entry appears in the FAQ accordion.

- [ ] **Step 7: Commit**

```bash
git add app/components/SpritesheetAnimator.vue app/pages/tools/split-spritesheet.vue i18n/locales/en.json i18n/locales/zh-TW.json
git commit -m "新增 splitSpritesheet 預覽/動畫器/feature/FAQ 的 i18n（en + zh-TW）"
```

---

### Task 6: Final integration check + push

**Files:** _(no code changes — just verification + commit metadata)_

- [ ] **Step 1: Full lint + typecheck**

Run:
```bash
pnpm lint && pnpm typecheck
```
Expected: both pass with no errors.

- [ ] **Step 2: Manual end-to-end check on dev server**

Run:
```bash
pnpm dev
```

Test plan (do all in one session):
1. Open `/tools/split-spritesheet` (or its localised path).
2. Upload a sprite sheet with multiple frames (e.g., a walk cycle).
3. Set grid to fit (e.g., columns=4, rows=3).
4. Confirm "Grid view" is the default and shows the overlay correctly.
5. Click "Animation preview" → animation starts playing at 12 fps.
6. Drag FPS slider to 30 → playback speeds up.
7. Click Pause → loop halts; click Play → loop resumes.
8. Click Reverse → frames play backwards.
9. Switch back to "Grid view" → no console errors, no orphan rAF in Performance tab.
10. Set `columnRange=1-2` → both views update; animator plays only the columns 1–2 frames.
11. Set `frameCount=4` → animator caps at 4 frames; counter reads `1 / 4` etc.
12. Toggle `skipEmpty` off → empty cells appear in the animation as blank frames; toggle on → they disappear.
13. Click "Split!" with the existing usage gate → backend split still works (proves we didn't break the existing flow).
14. Switch language to 繁體中文 → all new labels render correctly.

If any step fails, fix in place and re-run lint + typecheck before continuing.

- [ ] **Step 3: Push**

```bash
git push
```
Expected: push succeeds, CI runs lint + build.

- [ ] **Step 4: Note for the user**

After push, tell the user the 7 other locales (`zh-CN`, `ja`, `ko`, `de`, `es`, `pt`, `ru`) need these keys added — list the exact paths:
- `splitSpritesheet.preview.{grid,animate}`
- `splitSpritesheet.animator.{play,pause,forward,reverse,fps,noFrames}`
- `splitSpritesheet.seo.features.items.animationPreview.{title,content}`
- `splitSpritesheet.seo.faq.items.animationPreview.{q,a}`

---

## Self-Review

**Spec coverage:**
- ✅ Animation preview as a toggle on the existing splitter — Tasks 1, 2, 4
- ✅ Reuses grid math from `SpritesheetPreview.vue` — Task 1 (same `parseRange` + grid computed)
- ✅ Skip-empty matches server behaviour — Task 3
- ✅ FPS / play / pause / reverse / frame counter — Task 2
- ✅ Shared parameter state with grid overlay — Task 4 (props bind to same page refs)
- ✅ No backend dependency, no API call — design + Task 6 verification step 13
- ✅ SEO long-tail (FAQ + feature item) — Task 5
- ✅ i18n only en + zh-TW — Task 5

**Placeholder scan:** No "TBD", no "implement later", no "similar to Task N", no "add error handling" without specifics. Every code block is complete.

**Type consistency:**
- `FrameRect` defined in Task 1, used in Task 1 and Task 3. ✅
- `previewMode` ref typed as `'grid' | 'animate'` in Task 4, the toggle's v-for uses the same union. ✅
- `skipEmpty` prop on the animator (new in this plan) — matches the page's existing `skipEmpty` ref. ✅
- `fps`, `currentFrame`, `totalFrames`, `isPlaying`, `reverse` are all defined in Task 2 and only referenced after that. ✅
- The `t('splitSpritesheet.preview.${m}')` interpolation in Task 4 references keys defined in Task 5 — Task 4 explicitly notes labels render as raw key strings until Task 5 lands. ✅

**Risk acknowledged:**
- Skip-empty alpha sampling is O(width × height × cells) on each grid-param change. For huge sheets (e.g. 4096×4096 with 100 cells) it could lag the UI. Task 3 Step 5 calls this out with a 1-second guideline; if exceeded, a follow-up task would move the sampling to `requestIdleCallback` or a Web Worker — explicitly out of scope here.
