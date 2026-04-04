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
}>(), {
  padding: 0
})

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const imgRef = ref<HTMLImageElement>()

// Calculate grid dimensions
const grid = computed(() => {
  const imgW = props.imageWidth
  const imgH = props.imageHeight
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

function draw() {
  const canvas = canvasRef.value
  const img = imgRef.value
  const g = grid.value
  if (!canvas || !img) return

  const dw = img.clientWidth
  const dh = img.clientHeight
  if (dw <= 0 || dh <= 0) return

  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, dw, dh)

  // No grid to draw
  if (!g) return

  const scale = dw / props.imageWidth
  const pad = (props.padding || 0) * scale
  const cw = g.cellWidth * scale
  const ch = g.cellHeight * scale

  const [colStart, colEnd] = parseRange(props.columnRange, g.cols)
  const [rowStart, rowEnd] = parseRange(props.rowRange, g.rows)
  const maxFrames = props.frameCount || g.cols * g.rows

  let frameIdx = 0

  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const x = c * (cw + pad)
      const y = r * (ch + pad)
      const inRange = c >= colStart && c <= colEnd && r >= rowStart && r <= rowEnd

      if (!inRange) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fillRect(x, y, cw, ch)
      }

      if (inRange) {
        frameIdx++
        if (frameIdx > maxFrames) {
          ctx.fillStyle = 'rgba(128, 128, 128, 0.5)'
          ctx.fillRect(x, y, cw, ch)
        } else {
          const fontSize = Math.max(10, Math.min(cw * 0.25, 16))
          ctx.font = `bold ${fontSize}px sans-serif`
          const label = String(frameIdx)
          const metrics = ctx.measureText(label)
          const lp = 3
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
          ctx.fillRect(x, y, metrics.width + lp * 2, fontSize + lp * 2)
          ctx.fillStyle = '#FFFFFF'
          ctx.fillText(label, x + lp, y + fontSize + lp)
        }
      }
    }
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)'
  ctx.lineWidth = 1.5

  for (let c = 0; c <= g.cols; c++) {
    ctx.beginPath()
    ctx.moveTo(c * (cw + pad), 0)
    ctx.lineTo(c * (cw + pad), dh)
    ctx.stroke()
    if (c > 0 && c < g.cols && pad > 1) {
      ctx.beginPath()
      ctx.moveTo(c * (cw + pad) - pad, 0)
      ctx.lineTo(c * (cw + pad) - pad, dh)
      ctx.stroke()
    }
  }

  for (let r = 0; r <= g.rows; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * (ch + pad))
    ctx.lineTo(dw, r * (ch + pad))
    ctx.stroke()
    if (r > 0 && r < g.rows && pad > 1) {
      ctx.beginPath()
      ctx.moveTo(0, r * (ch + pad) - pad)
      ctx.lineTo(dw, r * (ch + pad) - pad)
      ctx.stroke()
    }
  }

  // Range highlight border
  if (props.columnRange || props.rowRange) {
    const rx = colStart * (cw + pad)
    const ry = rowStart * (ch + pad)
    const rw = (colEnd - colStart + 1) * (cw + pad) - pad
    const rh = (rowEnd - rowStart + 1) * (ch + pad) - pad
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'
    ctx.lineWidth = 2.5
    ctx.strokeRect(rx, ry, rw, rh)
  }
}

// Watch ALL reactive dependencies and redraw
watch(
  [
    () => props.mode, () => props.columns, () => props.rows,
    () => props.cellWidth, () => props.cellHeight, () => props.padding,
    () => props.columnRange, () => props.rowRange, () => props.frameCount,
    () => props.src
  ],
  () => nextTick(draw)
)

onMounted(() => {
  // Redraw on window resize
  window.addEventListener('resize', draw)
  onUnmounted(() => window.removeEventListener('resize', draw))
})
</script>

<template>
  <div ref="containerRef" class="relative w-full border border-muted rounded-xl overflow-hidden bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
    <img
      ref="imgRef"
      :src="src"
      alt="Spritesheet preview"
      class="w-full block"
      @load="draw"
    >
    <canvas
      ref="canvasRef"
      class="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  </div>
</template>
