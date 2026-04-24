# Image Editor Tool — Design Spec

**Date:** 2026-04-24  
**Status:** Approved  
**Route:** `/tools/image-editor`  
**Component:** `app/components/ImageEditor.vue`

---

## Overview

A single-file, client-side image editing tool that chains Crop → Rotate → Flip → Resize → Compress into one seamless pipeline. All processing happens in the browser via Canvas API — no backend required.

**Target users:** Web users who need to quickly process an image (resize for social media, crop a screenshot, compress before uploading). Single file only; batch is out of scope.

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Layout | Left preview + right tool panel (Option C) |
| Crop interaction | Drag box via `vue-advanced-cropper` (Option A) |
| Feature scope | Crop · Resize · Compress · Rotate · Flip + output format |
| Processing | Pure client-side Canvas — no backend |
| File count | Single file only |

---

## UI Layout

### Desktop (md and above)

```
┌─────────────────────────────┬──────────────┐
│                             │ ✂️ Crop       │  ← active tab
│      Preview Canvas         │ ⇔ Resize      │
│   (cropperjs overlay        │ 🗜 Compress   │
│    when Crop tab active)    │ ↻ Rotate      │
│                             │ ⇄ Flip        │
│  140 × 110 px  [indicator]  ├──────────────┤
├─────────────────────────────┤ Format: JPG   │
│ filename · Original info    │ PNG  WebP     │
│                   [Change]  ├──────────────┤
└─────────────────────────────┤ ↓ Download   │
                              └──────────────┘
```

### Mobile (below md)

Preview stacked above tool panel. Tab bar changes to horizontal scrollable row.

---

## Canvas Pipeline

Operations execute in this fixed order on every render:

```
Original Image
    ↓ Crop      (sx, sy, sw, sh via cropperjs data)
    ↓ Rotate    (ctx.translate + ctx.rotate, degrees)
    ↓ Flip      (ctx.scale(-1,1) / ctx.scale(1,-1))
    ↓ Resize    (canvas width/height = target dimensions)
    ↓ Compress  (canvas.toBlob(mime, quality))
    ↓ Output Blob
```

The preview canvas re-renders on every parameter change. When in Crop tab, `vue-advanced-cropper` renders over the preview; switching away commits the crop data.

---

## Tab Controls

### ✂️ Crop
- Aspect ratio presets: Free | 1:1 | 16:9 | 4:3 | 3:2
- W/H pixel readout (updates as user drags)
- Reset Crop button (restores full image)
- Uses `vue-advanced-cropper` for drag-box interaction

### ⇔ Resize
- Width (px) + Height (px) number inputs
- Lock aspect ratio toggle (default: on)
- Quick presets: 25% · 50% · 75% · Original

### 🗜 Compress
- Quality slider 1–100 (default: 85)
- Estimated output size indicator (recalculates on change)
- PNG: quality slider hidden; shows hint: *"PNG is lossless — switch to WebP for a smaller file"*

### ↻ Rotate
- Quick buttons: −90° · +90° · 180°
- Custom angle slider: −180 to +180 (default: 0°)

### ⇄ Flip
- Flip Horizontal button (toggle)
- Flip Vertical button (toggle)
- Both can be active simultaneously

### Output Format (bottom, always visible)
- JPG · PNG · WebP toggle
- Default: same as input format (fallback to JPG)

---

## State Machine

```
idle
  └─(file uploaded)──► editing
                          ├─(tab click)──► editing (active tab changes)
                          ├─(param change)──► editing (preview re-renders)
                          └─(Download clicked)──► see Ad Gate below
```

No `converting` or `done` states — the tool stays in `editing` after download so the user can keep adjusting and re-downloading.

**Status type:** `'idle' | 'editing'`

---

## Ad Gate (FREE_LIMIT)

Consistent with other ClawStudio tools:

```
const FREE_LIMIT = 3
const downloadCount = useCookie('img_editor_count', { default: () => 0, maxAge: 86400 })
```

- Each Download click = 1 use
- At `downloadCount >= FREE_LIMIT`: show ad modal before download executes
- Modal: Watch Ad → `openDirectLink()` + reset count → download proceeds (no navigation to `/download` page — download is instant client-side)
- Cancel → modal closes, download does not happen

> Note: Unlike FormatConverter/ExifCleaner which navigate to `/download` waiting room (because the file is served from backend), this tool's download is instant client-side, so the waiting room is skipped. The ad modal still fires the direct link.

---

## Component Architecture

**New files:**
- `app/components/ImageEditor.vue` — main tool component
- `app/pages/tools/image-editor.vue` — page wrapper (ToolPageLayout + SEO)

**Dependencies to add:**
- `vue-advanced-cropper` — drag crop box UI

**i18n keys (en.json + all 8 other locales):**
```
imageEditor.title
imageEditor.subtitle
imageEditor.upload.title / limit / formats
imageEditor.tabs.crop / resize / compress / rotate / flip
imageEditor.crop.aspectRatio / reset / width / height
imageEditor.resize.width / height / lockAspect / presets.*
imageEditor.compress.quality / estimatedSize / pngHint
imageEditor.rotate.minus90 / plus90 / flip180 / custom
imageEditor.flip.horizontal / vertical
imageEditor.format.label / jpg / png / webp
imageEditor.actions.download / changeFile / reset
imageEditor.adModal.title / description / watch / close / remaining
imageEditor.seo.*  (whatIs / howTo / features / useCases / faq)
```

> `waitingRoom.imageEditor` 不需要——此工具不跳轉 `/download` 等待頁。

---

## Accepted Input Formats

`.jpg · .jpeg · .png · .webp · .avif · .gif`

HEIC excluded from v1 (no client-side decoder). GIF: accepted but animated frames collapsed to first frame.

---

## Out of Scope (v1)

- Batch processing
- HEIC input
- Undo/redo history
- Filters / color adjustments
- Text overlay
- Watermark
