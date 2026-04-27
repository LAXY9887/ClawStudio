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

watch(() => props.src, () => {
  imgLoaded.value = false
})
</script>

<template>
  <div class="relative w-full border border-muted rounded-xl overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] flex items-center justify-center min-h-64 p-4">
    <img ref="imgRef" :src="src" alt="" class="hidden" @load="onImgLoad">
    <canvas ref="canvasRef" class="max-w-full max-h-96 object-contain" />
    <p v-if="frames.length === 0" class="text-sm text-muted absolute">{{ '' }}</p>
  </div>
</template>
