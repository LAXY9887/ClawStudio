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
- `downloadCount < FREE_LIMIT`: download proceeds directly (client-side blob → `<a download>`)
- `downloadCount >= FREE_LIMIT`: show ad modal
  - **Confirm** → `openDirectLink()` + reset count + store blob in `useDownloadStore` + navigate to `/download?from=/tools/image-editor`
  - **Cancel** → modal closes, download does not happen

The `/download` waiting room serves the stored blob after the 15-second countdown, identical to FormatConverter/ExifCleaner flow. `download.vue` must be updated to recognise `imageEditor` as a `toolKey`.

---

## Component Architecture

**New files:**
- `app/components/ImageEditor.vue` — main tool component
- `app/pages/tools/image-editor.vue` — page wrapper (ToolPageLayout + SEO)

**Modified files:**
- `app/pages/download.vue` — add `imageEditor` to `toolKey` computed, `tipCount: 4`, and `apiUrl`
- `app/composables/useTools.ts` — register tool in nav/tool list
- `i18n/locales/*.json` (all 9 locales) — add all keys above

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
waitingRoom.imageEditor.tipsTitle
waitingRoom.imageEditor.tips[0..3]   ← 4 tips unique to image editing
```

---

## SEO Deliverables

### 1. Tool Page SEO Article (bottom of `/tools/image-editor`)

Rendered via `SeoSections` component inside `ToolPageLayout`. Required sections (matching existing tool page pattern):

| Section | Type | Keys |
|---------|------|------|
| What is this tool? | `text` | `imageEditor.seo.whatIs` |
| How to use (步驟) | `steps` | `imageEditor.seo.howTo.step1–4` — each `{title, content}` |
| Features | `features` | `imageEditor.seo.features.items.*` — each `{title, content}` |
| Use cases | `useCases` | `imageEditor.seo.useCases.items.*` — each `{title, content}` |
| API promo | `api` | `imageEditor.seo.api` (title / content / cta) |
| FAQ | `faq` | `imageEditor.seo.faq.items.*` — each `{title, content}` |

Suggested SEO keywords to weave in: `image resizer online`, `crop image free`, `compress image`, `image editor no upload`, `resize image without quality loss`.

### 2. Download Waiting Room Tips (`/download?from=/tools/image-editor`)

4 unique tips shown during the 15-second countdown. Topic guidance:

- **Tip 1** — WebP vs JPG: why WebP gives smaller files at same quality
- **Tip 2** — Aspect ratio tip: common ratios for social platforms (Instagram 1:1, Twitter 16:9)
- **Tip 3** — Compress tip: 80–85 quality is the sweet spot for web images
- **Tip 4** — Privacy tip: canvas pipeline strips all EXIF metadata from the output

Keys: `waitingRoom.imageEditor.tipsTitle` + `waitingRoom.imageEditor.tips[0..3]`  
All 9 locales required.

### 3. JSON-LD Structured Data

`WebApplication` schema in `<head>` of the tool page (same pattern as heic-to-jpg.vue):

```json
{
  "@type": "WebApplication",
  "name": "Free Online Image Editor — Crop, Resize & Compress",
  "url": "https://clawstudiouo.com/tools/image-editor",
  "applicationCategory": "MultimediaApplication",
  "operatingSystem": "Any"
}
```

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
