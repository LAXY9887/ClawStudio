# PNG → GIF / WebP — Output Format Toggle + UI Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Animated WebP as a second output format on the existing PNG → GIF tool, surface frame duration and output format outside the Options accordion (frequently used), and ship full SEO content covering WebP benefits — including a frontend-developer-focused article on the download waiting page.

**Architecture:** Single-page enhancement. The gif2ss API already accepts `output_format=gif|webp` + `quality` + `lossless` on `/from-frames` and `/from-spritesheet` (deployed and tested). Frontend adds a format toggle, Server proxies forward the upstream Content-Type, and i18n adds WebP-aware copy. No new tool page, no new backend, no new dependencies.

**Tech Stack:** Nuxt 4 + Nuxt UI v4 + Tailwind CSS 4 + `@nuxtjs/i18n`. Server proxies via Nitro.

**Codebase conventions to follow:**
- pnpm only (memory: `套件管理工具規範`). Never `npm install`.
- Verify with `pnpm lint` + `pnpm typecheck`. **Do NOT run `pnpm build`** — high-RAM, has crashed user's machine (memory: `推送前 Lint + TypeCheck`).
- ESLint: `commaDangle: 'never'`, `braceStyle: '1tbs'`, no multi-statement lines, single-arg arrow params parenthesised, no unused vars.
- i18n: only modify `en.json` and `zh-TW.json` (memory: `翻譯只處理 en 和 zh-TW`). Other 7 locales are out of scope; user will sync them.
- No test runner exists. Verification = lint + typecheck + manual.

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `server/api/from-frames.post.ts` | **Modify** | Forward upstream `Content-Type` (gif or webp) instead of hardcoding gif. |
| `server/api/from-spritesheet.post.ts` | **Modify** | Same as above. |
| `app/pages/tools/png-to-gif.vue` | **Modify** | Add `outputFormat` / `webpQuality` / `webpLossless` refs; surface duration + output format above Options accordion; update FormData payload, dynamic filename, JSON-LD metadata. |
| `app/pages/download.vue` | **Modify** | Bump `tipCount.toGif` from 5 to 7 (two new WebP-focused tips). |
| `app/composables/useTools.ts` | **Modify** | (No code change — only confirms label rename happens via i18n; tool key stays `toGif`.) |
| `i18n/locales/en.json` | **Modify** | Tool labels, new option strings, expanded SEO sections, new whyWebP section, new FAQ items, new feature item, 2 new waiting room tips, updated home.tools card. |
| `i18n/locales/zh-TW.json` | **Modify** | Same key set, Traditional Chinese values. |

**Out of scope:**
- Other 7 locale files (user handles).
- APNG output (API ships WebP only — APNG was scope-cut at the API level).
- Splitting into separate "PNG → WebP" tool page (chose Plan 1 — single page with toggle).
- Server-side test harness (no test runner exists in this repo).

---

## SEO Copy Reference (used across multiple tasks below)

### English copy

**`toGif.title`** (existing — replace):
```
Free Online PNG to Animated GIF / WebP Converter
```

**`toGif.subtitle`** (existing — replace):
```
Convert PNG frames or a spritesheet into an animated GIF or smaller, full-alpha WebP — free, online, no registration.
```

**Tool card (`home.tools.toGif.title` and `.description`)** — replace:
```
title:       PNG to Animated GIF / WebP
description: Convert PNG frames or a spritesheet into an animated GIF or modern WebP with smaller files and full alpha.
```

**`relatedTools.toGif`** — replace:
```
PNG → GIF / WebP
```

**Output format strings (NEW — add under `toGif`)**:
```
output:
  title: Output Format
  gif: GIF
  webp: WebP
  hint: GIF for universal compatibility · WebP for smaller files with full alpha
quality:
  label: WebP Quality
  hint: 0–100. Higher = better quality, larger file. Ignored when Lossless is on.
lossless:
  label: Lossless WebP
  hint: Pixel-perfect output. Files are larger but identical to source.
```

**Page title (frame-duration moved out of Options)** — copy to a new top-level `toGif.duration` block:
```
duration:
  label: Frame Duration (ms)
  hint: 100ms ≈ 10 FPS · 50ms ≈ 20 FPS · 200ms ≈ 5 FPS
```

**NEW SEO section `toGif.seo.whyWebP`** (paragraphs `content`, `content2`, `content3`):
- title: `Why Choose Animated WebP for the Modern Web`
- content: `Animated WebP files are typically 25–50% smaller than equivalent GIFs at the same visual quality. A 2 MB hero GIF on a marketing page becomes a 600–900 KB WebP — directly improving Largest Contentful Paint (LCP) scores and Core Web Vitals, both of which factor into Google search ranking. Smaller files also mean less mobile data usage, which matters for users on metered or slow connections.`
- content2: `WebP supports 24-bit color and full alpha transparency, eliminating two of GIF's biggest limitations. GIF tops out at 256 colors per frame and only supports binary on/off transparency — that produces visible color banding on photographic content and hard, jagged edges around transparent objects. WebP preserves the original PNG anti-aliasing, so semi-transparent shadows, soft glows, and rounded corners look clean against any background.`
- content3: `Browser support is universal in 2026. Chrome 32+, Firefox 65+, Safari 14+, and Edge 18+ all play animated WebP natively in a plain \`<img>\` tag — no JavaScript or polyfills needed. The remaining gaps are some older email clients and a handful of legacy chat platforms with stricter MIME policies. For public web pages, marketing sites, app screenshots, blog heroes, and modern messaging apps, WebP is the better default.`

**Updated `toGif.seo.whyConvert.content3`** — replace:
```
For broader reach, GIF remains the safer choice — it works in older email clients and platforms that haven't adopted WebP yet. For modern web frontends, app stores, marketing sites, and any context where file size or color fidelity matter, animated WebP is the clear winner. This tool lets you switch between the two with a single click, so you can pick the right format per use case without re-converting from scratch.
```

**Updated `toGif.seo.formatsExplained.title`** — replace:
```
Understanding PNG, GIF, and Animated WebP
```

**Updated `toGif.seo.formatsExplained.content3`** — replace:
```
Animated WebP closes both gaps GIF leaves open: it preserves 24-bit color and full alpha transparency from your PNG source, so photographs stay sharp and semi-transparent edges stay smooth. WebP files are also typically 25–50% smaller than the GIF equivalent. The trade-off is browser/platform support — animated WebP works in every modern browser but may not display in older email clients or some chat tools. Pick GIF when you need maximum reach, WebP when file size, color fidelity, or alpha quality matter.
```

**Updated `toGif.seo.howTo.step3.content`** — replace:
```
Set the frame duration in milliseconds — this controls how long each frame is displayed. The default of 100ms gives a smooth 10 FPS animation. Choose your output format: GIF for universal compatibility (older email clients, legacy platforms), or animated WebP for smaller files (~25–50% smaller) and full alpha transparency. When WebP is selected, optionally adjust the quality slider (default 80) or enable Lossless for pixel-perfect output. Set the loop count to 0 for infinite looping. For frames mode, enable filename-based sorting if your files use suffix conventions like walk_0.png, walk_1.png. For spritesheet mode, specify columns and rows (or cell pixel dimensions), and optionally set column/row ranges to extract a specific animation. If your spritesheet has extra borders, use Trim Margins to crop them before slicing.
```

**Updated `toGif.seo.howTo.step4.content`** — replace:
```
Click Convert to send your files to the server and generate the animation. Conversion typically takes a few seconds. Once complete, a live preview displays the result so you can verify the timing, frame order, and overall look. The browser plays both GIF and WebP natively in the preview. If the result isn't right, adjust your settings and convert again. When you're satisfied, click Download to save the file (the extension matches the chosen output format — `.gif` or `.webp`). Click "Convert Another" to clear everything and start fresh.
```

**NEW feature item `toGif.seo.features.items.outputFormat`**:
- title: `Two Output Formats — GIF or Animated WebP`
- content: `Choose GIF for maximum compatibility (older browsers, email clients, legacy chat platforms) or animated WebP for modern web targets where file size and visual quality matter. WebP files are typically 25–50% smaller than the equivalent GIF at the same quality, with full 24-bit color and alpha transparency. Switch between the two with a single click — no need to re-upload or re-configure.`

**NEW FAQ items**:
- `outputFormat`:
  - q: `When should I choose GIF vs Animated WebP?`
  - a: `Choose GIF when you need maximum compatibility — older email clients, legacy chat platforms, or anywhere you can't be sure the recipient's tool supports WebP. Choose animated WebP for modern web targets: marketing sites, blog posts, app screenshots, modern messaging apps, and anywhere file size or color fidelity matters. WebP files are typically 25–50% smaller and preserve full 24-bit color with alpha transparency, while GIF is limited to 256 colors and binary on/off transparency.`
- `webpSupport`:
  - q: `Which browsers and platforms support animated WebP?`
  - a: `Every modern browser plays animated WebP natively in a plain <img> tag — Chrome 32+, Firefox 65+, Safari 14+, Edge 18+. That covers >97% of global users in 2026. Modern messaging apps including Discord, Slack (in standard workspaces), Twitter/X, and most blog platforms also display WebP correctly. The remaining gaps are some older email clients (Outlook 2019 and earlier on Windows) and a few legacy enterprise tools with strict MIME policies. For public web pages and modern chat tools, WebP is safe to use as the default.`
- `webpQuality`:
  - q: `What does the WebP quality slider control?`
  - a: `Quality (0–100, default 80) controls lossy compression. Higher values produce sharper images but larger files. 80 is the sweet spot for most use cases — visually indistinguishable from the source for most viewers, while still producing files much smaller than GIF. Below 60, compression artifacts become visible (especially on flat colors and edges). Above 90 the file size grows fast for diminishing visual returns. If you need pixel-perfect output, enable Lossless mode — the file will be larger but every pixel will exactly match the source PNG.`

**Updated `toGif.seo.faq.items.formats.a`** — replace:
```
The input must be PNG files — this applies to both modes. In frames mode, every uploaded file must be a PNG image. In spritesheet mode, the input must be a single PNG file (uploaded directly or via a public URL). The output is an animated GIF or animated WebP, selectable via the Output Format toggle. Other input formats (JPEG, WebP, BMP) are not supported — convert them to PNG first if needed.
```

**Updated `toGif.seo.api.content`** — replace:
```
Integrate PNG-to-animation conversion into your applications with the Easy GIF2Sprite API. Whether you assemble individual frames or slice a spritesheet, the API handles both workflows through two dedicated endpoints, and supports both GIF and animated WebP output via the `output_format` parameter.
```

**Updated `toGif.seo.api.features.formats`** — replace:
```
PNG input, GIF or animated WebP output (selectable via output_format parameter)
```

**NEW waiting room tips `waitingRoom.toGif.tips[5]` and `[6]`** (append to existing 5):
- tip 6: `**Building for the web?** Switch the Output Format to **Animated WebP** for files **25–50% smaller** than the equivalent GIF at the same visual quality. Modern browsers (Chrome, Firefox, Safari, Edge) all support it natively in plain \`<img>\` tags — no polyfill, no JavaScript. Smaller files mean better Core Web Vitals (LCP, INP) and lower mobile data usage.`
- tip 7: `**WebP keeps soft edges sharp.** GIF's 1-bit transparency creates hard, jagged edges around transparent objects, which is especially noticeable on logos, UI overlays, and screenshots with rounded corners. WebP preserves the original PNG anti-aliasing — semi-transparent shadows, glows, and soft edges look clean against any background colour.`

### zh-TW copy

**`toGif.title`**:
```
免費線上 PNG 轉 動畫 GIF / WebP 轉換器
```

**`toGif.subtitle`**:
```
將 PNG 幀或 Spritesheet 轉換為動畫 GIF，或檔案更小、支援完整 alpha 的 WebP — 免費、線上、無需註冊。
```

**`home.tools.toGif`**:
```
title:       PNG 轉 動畫 GIF / WebP
description: 將 PNG 幀或 Spritesheet 組合成動畫 GIF，或檔案更小、支援完整 alpha 的現代 WebP 格式。
```

**`relatedTools.toGif`**:
```
PNG → GIF / WebP
```

**Output format strings**:
```
output:
  title: 輸出格式
  gif: GIF
  webp: WebP
  hint: GIF 相容性最廣 · WebP 檔案更小、支援完整 alpha
quality:
  label: WebP 品質
  hint: 0–100。數值越高品質越好但檔案越大。Lossless 開啟時忽略此參數。
lossless:
  label: 無損 WebP
  hint: 像素級精確輸出。檔案較大但與來源完全一致。
```

**`toGif.duration`**:
```
duration:
  label: 幀延遲 (ms)
  hint: 100ms ≈ 10 FPS · 50ms ≈ 20 FPS · 200ms ≈ 5 FPS
```

**NEW `toGif.seo.whyWebP`**:
- title: `為什麼現代網頁應該用 Animated WebP`
- content: `Animated WebP 檔案在相同視覺品質下，通常比 GIF 小 25–50%。一張 2 MB 的 GIF 行銷主視覺，換成 WebP 大概只剩 600–900 KB — 直接改善 Largest Contentful Paint (LCP) 與 Core Web Vitals，這兩個指標都直接影響 Google 搜尋排名。檔案小也代表使用者在行動數據或慢速連線下消耗的流量更少。`
- content2: `WebP 支援 24-bit 全彩與完整 alpha 透明度，徹底解決 GIF 的兩大限制。GIF 每幀最多 256 色，且只支援「全透明 / 全不透明」二元透明度 — 在照片類內容上會出現色帶，在透明物件邊緣會看到鋸齒。WebP 完整保留 PNG 的 anti-aliasing，半透明陰影、柔光、圓角邊緣在任何背景色上都乾淨清晰。`
- content3: `2026 年 WebP 的瀏覽器支援已經完全普及。Chrome 32+、Firefox 65+、Safari 14+、Edge 18+ 都可以在純 \`<img>\` 標籤中直接播放 animated WebP — 不需要 JavaScript、不需要 polyfill。剩下的相容性缺口主要是舊版 email client（Outlook 2019 以前）與少數有嚴格 MIME 政策的企業工具。公開網頁、行銷網站、App 截圖、部落格 hero 動畫、現代聊天工具，WebP 都是更好的預設選擇。`

**Updated `toGif.seo.whyConvert.content3`**:
```
若要最廣的相容性，GIF 仍是較安全的選擇 — 在舊版 email client 和尚未支援 WebP 的平台上都能正常顯示。若是現代網頁前端、App 商店素材、行銷網站，或任何重視檔案大小、色彩準確度的場景，animated WebP 是明顯更佳的選擇。本工具讓你一鍵切換兩種格式，依使用情境選對格式，不需要從頭重新轉換。
```

**Updated `toGif.seo.formatsExplained.title`**:
```
理解 PNG、GIF 與 Animated WebP
```

**Updated `toGif.seo.formatsExplained.content3`**:
```
Animated WebP 同時補足了 GIF 的兩個短處：保留來源 PNG 的 24-bit 全彩與完整 alpha 透明度，照片內容銳利不失真、半透明邊緣平滑乾淨。WebP 檔案在相同品質下通常比 GIF 小 25–50%。代價是相容性 — animated WebP 在所有現代瀏覽器都正常，但在某些舊版 email client 或聊天工具可能無法顯示。需要最廣相容性選 GIF，重視檔案大小、色彩、alpha 品質選 WebP。
```

**Updated `toGif.seo.howTo.step3.content`**:
```
設定幀延遲（毫秒）控制每幀顯示時間。預設 100ms 可達到流暢的 10 FPS 動畫。選擇輸出格式：GIF 提供最廣相容性（舊 email client、傳統平台），或 animated WebP 提供更小檔案（縮小約 25–50%）和完整 alpha 透明度。選擇 WebP 時可額外調整品質滑桿（預設 80）或開啟 Lossless 取得像素級精確輸出。Loop 設為 0 可無限循環。Frames 模式可啟用「依檔名排序」讓檔案按照 walk_0.png、walk_1.png 這類後綴排序。Spritesheet 模式需指定欄列數（或單格像素尺寸），並可選擇性設定欄列範圍以擷取特定動畫。若 Spritesheet 周圍有多餘邊框，可用 Trim Margins 在切割前先裁掉。
```

**Updated `toGif.seo.howTo.step4.content`**:
```
點擊轉換，將檔案送至伺服器產生動畫。轉換通常只需幾秒。完成後會即時預覽結果，可確認時間軸、幀順序、整體效果。瀏覽器會原生播放 GIF 和 WebP 兩種格式。如果結果不滿意，調整設定後重新轉換。滿意後點擊下載儲存檔案（副檔名會自動對應輸出格式 — `.gif` 或 `.webp`）。點擊「轉換另一個」清空工作區，重新開始。
```

**NEW feature item `toGif.seo.features.items.outputFormat`**:
- title: `兩種輸出格式 — GIF 或 Animated WebP`
- content: `選擇 GIF 取得最廣相容性（舊瀏覽器、email client、傳統聊天平台），或選擇 animated WebP 用於現代網頁，重視檔案大小與視覺品質。WebP 檔案在相同品質下通常比 GIF 小 25–50%，並完整保留 24-bit 色彩與 alpha 透明度。一鍵切換 — 不需要重新上傳或重新設定。`

**NEW FAQ items**:
- `outputFormat`:
  - q: `應該選 GIF 還是 Animated WebP？`
  - a: `當需要最廣相容性時選 GIF — 舊 email client、傳統聊天平台、或不確定接收方工具是否支援 WebP 的場景。選擇 animated WebP 用於現代網頁：行銷網站、部落格、App 截圖、現代聊天工具，以及任何重視檔案大小或色彩準確度的場景。WebP 檔案在相同品質下通常比 GIF 小 25–50%，並完整保留 24-bit 色彩與 alpha 透明度，而 GIF 限制在 256 色與二元透明度。`
- `webpSupport`:
  - q: `哪些瀏覽器與平台支援 Animated WebP？`
  - a: `所有現代瀏覽器都可以在純 <img> 標籤中原生播放 animated WebP — Chrome 32+、Firefox 65+、Safari 14+、Edge 18+，這涵蓋 2026 年全球 97% 以上的使用者。現代聊天平台包括 Discord、Slack（標準工作區）、Twitter/X 與大多數部落格平台都能正確顯示 WebP。剩下的缺口主要是舊版 email client（Windows 上 Outlook 2019 以前）和少數有嚴格 MIME 政策的企業工具。公開網頁與現代聊天工具上，WebP 可以放心當預設用。`
- `webpQuality`:
  - q: `WebP 品質滑桿是控制什麼？`
  - a: `品質（0–100，預設 80）控制 lossy 壓縮率。數值越高畫面越銳利但檔案越大。80 是大多數情境的甜蜜點 — 視覺上幾乎與來源無差異，但檔案大小遠小於 GIF。低於 60 會出現可見的壓縮假影（特別是在純色與邊緣處）。高於 90 後檔案大小快速增加但視覺改善不多。如果需要像素級精確輸出，啟用 Lossless 模式 — 檔案較大，但每個像素都與來源 PNG 完全一致。`

**Updated `toGif.seo.faq.items.formats.a`**:
```
輸入必須是 PNG 檔 — 兩種模式都一樣。Frames 模式下所有上傳檔案必須是 PNG。Spritesheet 模式下需要單一 PNG 檔（上傳或公開 URL 皆可）。輸出可選擇 animated GIF 或 animated WebP，透過頁面上的「輸出格式」切換。其他輸入格式（JPEG、WebP、BMP）目前不支援，需要先轉成 PNG。
```

**Updated `toGif.seo.api.content`**:
```
透過 Easy GIF2Sprite API 把 PNG 轉動畫整合到你的應用程式。無論是組合個別幀或切割 Spritesheet，API 都透過兩個端點處理，並透過 `output_format` 參數同時支援 GIF 與 animated WebP 兩種輸出。
```

**Updated `toGif.seo.api.features.formats`**:
```
PNG 輸入，GIF 或 animated WebP 輸出（透過 output_format 參數選擇）
```

**NEW waiting room tips `waitingRoom.toGif.tips[5]` and `[6]`**:
- tip 6: `**在開發網站前端嗎？** 把輸出格式切換成 **Animated WebP**，檔案在相同畫質下會比 GIF 小 **25–50%**。所有現代瀏覽器（Chrome、Firefox、Safari、Edge）都能在純 \`<img>\` 標籤中原生播放 — 不需 polyfill、不需 JavaScript。檔案更小代表更好的 Core Web Vitals 指標（LCP、INP），行動裝置流量也更省。`
- tip 7: `**WebP 讓柔邊保持乾淨。** GIF 的 1-bit 透明度會在透明物件邊緣產生硬邊鋸齒，logo、UI 疊圖、圓角截圖上特別明顯。WebP 完整保留 PNG 的 anti-aliasing — 半透明陰影、柔光、柔邊在任何背景色上都依然清晰乾淨。`

---

### Task 1: Server proxies forward upstream Content-Type

**Files:**
- Modify: `server/api/from-frames.post.ts`
- Modify: `server/api/from-spritesheet.post.ts`

The current proxies hardcode `image/gif`. With WebP output, the upstream now returns `image/webp` for `output_format=webp`. Proxies must read the upstream `Content-Type` header and forward it to the browser, otherwise the browser rejects the WebP body as a malformed GIF.

- [ ] **Step 1: Update `server/api/from-frames.post.ts`**

Replace the entire file content with:

```ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)

  const response = await $fetch.raw(`${config.gifServiceUrl}/from-frames`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: 'arrayBuffer'
  })

  const contentType = response.headers.get('content-type') || 'image/gif'
  setResponseHeader(event, 'Content-Type', contentType)
  return new Uint8Array(response._data as ArrayBuffer)
})
```

- [ ] **Step 2: Update `server/api/from-spritesheet.post.ts`**

Replace the entire file content with:

```ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)
  validateRemoteUrl(formData.get('url') as string | null)

  const response = await $fetch.raw(`${config.gifServiceUrl}/from-spritesheet`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: 'arrayBuffer'
  })

  const contentType = response.headers.get('content-type') || 'image/gif'
  setResponseHeader(event, 'Content-Type', contentType)
  return new Uint8Array(response._data as ArrayBuffer)
})
```

- [ ] **Step 3: Verify lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/api/from-frames.post.ts server/api/from-spritesheet.post.ts
git commit -m "Server proxy 轉發 gif2ss 上游 Content-Type（支援 WebP 輸出）"
```

---

### Task 2: Frontend script — output format state, payload, dynamic filename, JSON-LD

**Files:**
- Modify: `app/pages/tools/png-to-gif.vue` (`<script setup>` section only)

Adds three reactive refs (`outputFormat`, `webpQuality`, `webpLossless`), plumbs them into the FormData payload for both `/api/from-frames` and `/api/from-spritesheet`, dynamically chooses the download filename + extension based on the chosen format, and updates the JSON-LD `name`/`description`/`featureList` to mention WebP.

- [ ] **Step 1: Add output-format refs**

In `app/pages/tools/png-to-gif.vue`, find the existing block:

```ts
// Frames options
const duration = ref(100)
```

Insert immediately ABOVE that line (so the new block sits between `// File input refs` and `// Frames options`):

```ts
// Output format (shared across both modes)
const outputFormat = ref<'gif' | 'webp'>('gif')
const webpQuality = ref(80)
const webpLossless = ref(false)

const outputExtension = computed(() => outputFormat.value === 'webp' ? 'webp' : 'gif')
const outputFilename = computed(() => `animation.${outputExtension.value}`)
```

- [ ] **Step 2: Plumb output format into the FormData payload**

Find this block in the existing `convert()` function:

```ts
    if (mode.value === 'frames') {
      endpoint = '/api/from-frames'
      frameFiles.value.forEach(f => formData.append('files', f))
      formData.append('duration', String(duration.value))
      formData.append('loop', String(loop.value))
      if (fileNameOrder.value) formData.append('file_name_order', 'true')
      formData.append('resize', resizeMode.value)
      if (resizeMode.value === 'fill') formData.append('bg_fill_color', bgFillColor.value)
    } else {
```

Replace with:

```ts
    if (mode.value === 'frames') {
      endpoint = '/api/from-frames'
      frameFiles.value.forEach(f => formData.append('files', f))
      formData.append('duration', String(duration.value))
      formData.append('loop', String(loop.value))
      if (fileNameOrder.value) formData.append('file_name_order', 'true')
      formData.append('resize', resizeMode.value)
      if (resizeMode.value === 'fill') formData.append('bg_fill_color', bgFillColor.value)
      formData.append('output_format', outputFormat.value)
      if (outputFormat.value === 'webp') {
        formData.append('quality', String(webpQuality.value))
        formData.append('lossless', String(webpLossless.value))
      }
    } else {
```

Then find the trailing block of the spritesheet branch in the same `convert()` function:

```ts
      formData.append('duration', String(ssDuration.value))
      formData.append('loop', String(ssLoop.value))
    }
```

Replace with:

```ts
      formData.append('duration', String(ssDuration.value))
      formData.append('loop', String(ssLoop.value))
      formData.append('output_format', outputFormat.value)
      if (outputFormat.value === 'webp') {
        formData.append('quality', String(webpQuality.value))
        formData.append('lossless', String(webpLossless.value))
      }
    }
```

- [ ] **Step 3: Use dynamic filename for the download store**

Find this block:

```ts
    if (usageCount.value >= FREE_LIMIT) {
      useDownloadStore().setBlob(blob, 'animation.gif')
      showAdModal.value = true
    }
```

Replace with:

```ts
    if (usageCount.value >= FREE_LIMIT) {
      useDownloadStore().setBlob(blob, outputFilename.value)
      showAdModal.value = true
    }
```

- [ ] **Step 4: Use dynamic filename in `downloadResult()`**

Find:

```ts
function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = 'animation.gif'
  a.click()
  URL.revokeObjectURL(url)
}
```

Replace with:

```ts
function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = outputFilename.value
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 5: Update JSON-LD metadata**

Find the existing `useHead` block:

```ts
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online PNG to GIF Converter',
        'description': 'Convert PNG frames or a spritesheet into an animated GIF.',
        'url': 'https://clawstudiouo.com/tools/png-to-gif',
        'applicationCategory': 'DesignApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires a modern web browser',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'USD'
        },
        'author': {
          '@type': 'Organization',
          'name': 'ClawStudiouo',
          'url': 'https://clawstudiouo.com'
        }
      })
    }
  ]
})
```

Replace with:

```ts
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online PNG to Animated GIF / WebP Converter',
        'description': 'Convert PNG frames or a spritesheet into an animated GIF or smaller, full-alpha WebP.',
        'url': 'https://clawstudiouo.com/tools/png-to-gif',
        'applicationCategory': 'DesignApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires a modern web browser',
        'featureList': [
          'PNG frames to animated GIF or WebP',
          'Spritesheet to animated GIF or WebP',
          'Adjustable frame duration',
          'WebP quality control with lossless option',
          'Grid and cell slicing modes',
          'Range and trim controls'
        ],
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'USD'
        },
        'author': {
          '@type': 'Organization',
          'name': 'ClawStudiouo',
          'url': 'https://clawstudiouo.com'
        }
      })
    }
  ]
})
```

- [ ] **Step 6: Verify lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/pages/tools/png-to-gif.vue
git commit -m "PNG→GIF：新增 outputFormat / webpQuality / webpLossless 狀態與 payload，動態檔名與 JSON-LD"
```

---

### Task 3: Frontend template — surface duration + output format above Options accordion

**Files:**
- Modify: `app/pages/tools/png-to-gif.vue` (`<template>` section only)

The user uses Frame Duration and Output Format frequently — these get pulled out of the Options accordion and placed in the always-visible area between the upload zone and the convert button. The Options accordion keeps everything else (loop, fileNameOrder, resize, bgFillColor for frames; loop, frameCount, padding, ranges, skipEmpty, trim for spritesheet).

The Output Format toggle is shared across both modes (sits above the Convert button).

- [ ] **Step 1: Add a shared "Settings" block above the Convert button (frames mode)**

In `app/pages/tools/png-to-gif.vue`, find the frames-mode Convert button block:

```vue
          <!-- Convert button -->
          <div class="flex justify-end mt-4">
            <UButton :label="t('toGif.convert')" icon="i-lucide-sparkles" :disabled="!hasInput" @click="submitConvert" />
          </div>
```

Replace with:

```vue
          <!-- Quick settings: duration + output format (frequently used) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <UFormField :label="t('toGif.duration.label')" :hint="t('toGif.duration.hint')">
              <UInput v-model.number="duration" type="number" :min="10" :max="10000" />
            </UFormField>
            <UFormField :label="t('toGif.output.title')" :hint="t('toGif.output.hint')">
              <div class="flex gap-2">
                <UButton
                  v-for="fmt in (['gif', 'webp'] as const)"
                  :key="fmt"
                  :variant="outputFormat === fmt ? 'solid' : 'outline'"
                  color="neutral"
                  size="sm"
                  @click="outputFormat = fmt"
                >
                  {{ t(`toGif.output.${fmt}`) }}
                </UButton>
              </div>
            </UFormField>
          </div>
          <div v-if="outputFormat === 'webp'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <UFormField :label="`${t('toGif.quality.label')}: ${webpQuality}`" :hint="t('toGif.quality.hint')">
              <input v-model.number="webpQuality" type="range" min="0" max="100" class="w-full" :disabled="webpLossless">
            </UFormField>
            <UFormField :label="t('toGif.lossless.label')" :hint="t('toGif.lossless.hint')">
              <USwitch v-model="webpLossless" />
            </UFormField>
          </div>

          <!-- Convert button -->
          <div class="flex justify-end mt-4">
            <UButton :label="t('toGif.convert')" icon="i-lucide-sparkles" :disabled="!hasInput" @click="submitConvert" />
          </div>
```

- [ ] **Step 2: Remove `duration` from the frames-mode Options accordion**

Find this block in the frames Options accordion:

```vue
          <!-- Frames Options -->
          <UAccordion :items="[{ label: t('toGif.framesOptions.title'), value: 'opts' }]" :default-value="['opts']" class="mt-4">
            <template #body>
              <div class="space-y-4 pt-2">
                <div class="grid grid-cols-2 gap-4">
                  <UFormField :label="t('toGif.framesOptions.duration')" :hint="t('toGif.framesOptions.durationHint')">
                    <UInput v-model.number="duration" type="number" :min="10" :max="10000" />
                  </UFormField>
                  <UFormField :label="t('toGif.framesOptions.loop')" :hint="t('toGif.framesOptions.loopHint')">
                    <UInput v-model.number="loop" type="number" :min="0" />
                  </UFormField>
                </div>
                <USwitch v-model="fileNameOrder" :label="t('toGif.framesOptions.fileNameOrder')" />
```

Replace with:

```vue
          <!-- Frames Options -->
          <UAccordion :items="[{ label: t('toGif.framesOptions.title'), value: 'opts' }]" class="mt-4">
            <template #body>
              <div class="space-y-4 pt-2">
                <UFormField :label="t('toGif.framesOptions.loop')" :hint="t('toGif.framesOptions.loopHint')">
                  <UInput v-model.number="loop" type="number" :min="0" />
                </UFormField>
                <USwitch v-model="fileNameOrder" :label="t('toGif.framesOptions.fileNameOrder')" />
```

(`:default-value="['opts']"` is also removed — the accordion now starts collapsed since the most-used controls are surfaced above.)

- [ ] **Step 3: Add the same quick settings + WebP reveal above the spritesheet-mode Convert button**

Find this block (spritesheet mode, currently has the URL field + convert button on a single row):

```vue
          <!-- URL + Convert -->
          <div class="flex gap-2 mt-4">
            <UInput v-model="pngUrl" :placeholder="t('toGif.url.placeholder')" :disabled="!!spritesheetFile" class="flex-1" @keyup.enter="submitConvert" />
            <UButton :label="t('toGif.convert')" icon="i-lucide-sparkles" :disabled="!hasInput" @click="submitConvert" />
          </div>
```

Replace with:

```vue
          <!-- URL field -->
          <div class="flex gap-2 mt-4">
            <UInput v-model="pngUrl" :placeholder="t('toGif.url.placeholder')" :disabled="!!spritesheetFile" class="flex-1" @keyup.enter="submitConvert" />
          </div>

          <!-- Quick settings: duration + output format (frequently used) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <UFormField :label="t('toGif.duration.label')" :hint="t('toGif.duration.hint')">
              <UInput v-model.number="ssDuration" type="number" :min="10" :max="10000" />
            </UFormField>
            <UFormField :label="t('toGif.output.title')" :hint="t('toGif.output.hint')">
              <div class="flex gap-2">
                <UButton
                  v-for="fmt in (['gif', 'webp'] as const)"
                  :key="fmt"
                  :variant="outputFormat === fmt ? 'solid' : 'outline'"
                  color="neutral"
                  size="sm"
                  @click="outputFormat = fmt"
                >
                  {{ t(`toGif.output.${fmt}`) }}
                </UButton>
              </div>
            </UFormField>
          </div>
          <div v-if="outputFormat === 'webp'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <UFormField :label="`${t('toGif.quality.label')}: ${webpQuality}`" :hint="t('toGif.quality.hint')">
              <input v-model.number="webpQuality" type="range" min="0" max="100" class="w-full" :disabled="webpLossless">
            </UFormField>
            <UFormField :label="t('toGif.lossless.label')" :hint="t('toGif.lossless.hint')">
              <USwitch v-model="webpLossless" />
            </UFormField>
          </div>

          <div class="flex justify-end mt-4">
            <UButton :label="t('toGif.convert')" icon="i-lucide-sparkles" :disabled="!hasInput" @click="submitConvert" />
          </div>
```

- [ ] **Step 4: Remove `duration` from the spritesheet-mode Options accordion**

Find this block in the spritesheet Options accordion:

```vue
              <div class="space-y-4 pt-2">
                <div class="grid grid-cols-2 gap-4">
                  <UFormField :label="t('toGif.spritesheetOptions.duration')" :hint="t('toGif.spritesheetOptions.durationHint')">
                    <UInput v-model.number="ssDuration" type="number" :min="10" :max="10000" />
                  </UFormField>
                  <UFormField :label="t('toGif.spritesheetOptions.loop')" :hint="t('toGif.spritesheetOptions.loopHint')">
                    <UInput v-model.number="ssLoop" type="number" :min="0" />
                  </UFormField>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <UFormField :label="t('toGif.spritesheetOptions.frameCount')" :hint="t('toGif.spritesheetOptions.frameCountHint')">
```

Replace with:

```vue
              <div class="space-y-4 pt-2">
                <UFormField :label="t('toGif.spritesheetOptions.loop')" :hint="t('toGif.spritesheetOptions.loopHint')">
                  <UInput v-model.number="ssLoop" type="number" :min="0" />
                </UFormField>
                <div class="grid grid-cols-2 gap-4">
                  <UFormField :label="t('toGif.spritesheetOptions.frameCount')" :hint="t('toGif.spritesheetOptions.frameCountHint')">
```

- [ ] **Step 5: Update result section text — preview alt + result title**

Find:

```vue
        <div v-if="resultUrl">
          <h3 class="font-semibold text-lg mb-2">{{ t('toGif.result.title') }}</h3>
          <div class="border border-muted rounded-xl overflow-auto bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
            <img :src="resultUrl" alt="GIF preview" class="max-w-full mx-auto">
          </div>
```

Replace with:

```vue
        <div v-if="resultUrl">
          <h3 class="font-semibold text-lg mb-2">{{ t('toGif.result.title') }}</h3>
          <div class="border border-muted rounded-xl overflow-auto bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
            <img :src="resultUrl" :alt="`${outputFormat.toUpperCase()} preview`" class="max-w-full mx-auto">
          </div>
```

- [ ] **Step 6: Update the download button label key** (optional but consistent)

The existing key is `toGif.result.download` ("Download GIF"). Since output is now dynamic, we keep the key but rewrite its value in Task 4 ("Download Animation"). No template change needed here.

- [ ] **Step 7: Verify lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```
Expected: both exit 0. (i18n keys referenced in the template that don't exist yet — `toGif.duration.label`, `toGif.output.*`, `toGif.quality.*`, `toGif.lossless.*` — won't fail typecheck, they'll show as raw key strings until Task 4. That's expected.)

- [ ] **Step 8: Commit**

```bash
git add app/pages/tools/png-to-gif.vue
git commit -m "PNG→GIF：把 duration 與 output format 拉出 Options accordion，新增 WebP quality / lossless 控制"
```

---

### Task 4: i18n — UI labels (en + zh-TW)

**Files:**
- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/zh-TW.json`

Renames the tool everywhere user-facing (homepage card, related tools popover, page title/subtitle, download button label) and adds the new option strings (`output`, `quality`, `lossless`, `duration`).

#### Edit 1 — `i18n/locales/en.json`

- [ ] **Step 1: Update `home.tools.toGif`**

Find:

```json
      "toGif": {
        "title": "PNG to GIF",
        "description": "Convert PNG frames or a spritesheet into an animated GIF."
      },
```

Replace with:

```json
      "toGif": {
        "title": "PNG to Animated GIF / WebP",
        "description": "Convert PNG frames or a spritesheet into an animated GIF or modern WebP with smaller files and full alpha."
      },
```

- [ ] **Step 2: Update `relatedTools.toGif`**

Find: `"toGif": "PNG → GIF",`

Replace with: `"toGif": "PNG → GIF / WebP",`

- [ ] **Step 3: Replace `toGif.title` and `toGif.subtitle`**

Find:

```json
    "title": "Free Online PNG to GIF Converter",
    "subtitle": "Convert PNG frames or a spritesheet into an animated GIF — free, online, no registration.",
```

Replace with:

```json
    "title": "Free Online PNG to Animated GIF / WebP Converter",
    "subtitle": "Convert PNG frames or a spritesheet into an animated GIF or smaller, full-alpha WebP — free, online, no registration.",
```

- [ ] **Step 4: Add the new option blocks**

Find:

```json
    "framesUpload": {
```

Insert immediately ABOVE that line (so the new keys sit between `convert` and `framesUpload`):

```json
    "duration": {
      "label": "Frame Duration (ms)",
      "hint": "100ms ≈ 10 FPS · 50ms ≈ 20 FPS · 200ms ≈ 5 FPS"
    },
    "output": {
      "title": "Output Format",
      "gif": "GIF",
      "webp": "WebP",
      "hint": "GIF for universal compatibility · WebP for smaller files with full alpha"
    },
    "quality": {
      "label": "WebP Quality",
      "hint": "0–100. Higher = better quality, larger file. Ignored when Lossless is on."
    },
    "lossless": {
      "label": "Lossless WebP",
      "hint": "Pixel-perfect output. Files are larger but identical to source."
    },
```

(Order check: after this insertion the top-level keys under `toGif` should be `title`, `subtitle`, `mode`, `framesUpload`, `spritesheetUpload`, `convert`, `duration`, `output`, `quality`, `lossless`, `url`, `framesOptions`, `slicingMode`, `spritesheetOptions`, `status`, `result`, `adModal`, `seo`. JSON allows any object property order so this is fine; we put the new ones near the action area for human readability of the file.)

Wait — looking at the current file, `convert` comes BEFORE `url` and `url` comes BEFORE `framesOptions`. Let me re-check the actual position. In `i18n/locales/en.json` the existing order under `toGif` is `title, subtitle, mode, framesUpload, spritesheetUpload, convert, url, framesOptions, slicingMode, spritesheetOptions, status, result, adModal, seo`. Insert the new blocks immediately AFTER `url` (before `framesOptions`):

Find:

```json
    "url": {
      "placeholder": "Or paste a spritesheet PNG URL..."
    },
    "framesOptions": {
```

Replace with:

```json
    "url": {
      "placeholder": "Or paste a spritesheet PNG URL..."
    },
    "duration": {
      "label": "Frame Duration (ms)",
      "hint": "100ms ≈ 10 FPS · 50ms ≈ 20 FPS · 200ms ≈ 5 FPS"
    },
    "output": {
      "title": "Output Format",
      "gif": "GIF",
      "webp": "WebP",
      "hint": "GIF for universal compatibility · WebP for smaller files with full alpha"
    },
    "quality": {
      "label": "WebP Quality",
      "hint": "0–100. Higher = better quality, larger file. Ignored when Lossless is on."
    },
    "lossless": {
      "label": "Lossless WebP",
      "hint": "Pixel-perfect output. Files are larger but identical to source."
    },
    "framesOptions": {
```

- [ ] **Step 5: Update `result.download`**

Find: `"download": "Download GIF",`

Replace with: `"download": "Download Animation",`

- [ ] **Step 6: Update home page title for the toGif card** — already done in Step 1.

#### Edit 2 — `i18n/locales/zh-TW.json`

- [ ] **Step 7: Update `home.tools.toGif`**

Find:

```json
      "toGif": {
        "title": "PNG 轉 GIF",
        "description": "將 PNG 影格或 sprite sheet 轉為動畫 GIF。"
      },
```

Replace with:

```json
      "toGif": {
        "title": "PNG 轉 動畫 GIF / WebP",
        "description": "將 PNG 幀或 Spritesheet 組合成動畫 GIF，或檔案更小、支援完整 alpha 的現代 WebP 格式。"
      },
```

- [ ] **Step 8: Update `relatedTools.toGif` in zh-TW**

Find: `"toGif": "PNG → GIF",`

Replace with: `"toGif": "PNG → GIF / WebP",`

- [ ] **Step 9: Update `toGif.title` and `toGif.subtitle` in zh-TW**

Find the existing `toGif.title` and `toGif.subtitle` lines (use `grep -n '"title": "免費線上 PNG' i18n/locales/zh-TW.json` if needed) and replace with:

```json
    "title": "免費線上 PNG 轉 動畫 GIF / WebP 轉換器",
    "subtitle": "將 PNG 幀或 Spritesheet 轉換為動畫 GIF，或檔案更小、支援完整 alpha 的 WebP — 免費、線上、無需註冊。",
```

- [ ] **Step 10: Add the new option blocks in zh-TW**

Find:

```json
    "url": {
```

(Inside `toGif`.) Look at the value to confirm position — the existing pattern in zh-TW.json should match en.json structure. Insert the same 4 blocks (`duration`, `output`, `quality`, `lossless`) immediately AFTER the `url` block, with these zh-TW values:

```json
    "url": {
      "placeholder": "或貼上 Spritesheet PNG 的 URL..."
    },
    "duration": {
      "label": "幀延遲 (ms)",
      "hint": "100ms ≈ 10 FPS · 50ms ≈ 20 FPS · 200ms ≈ 5 FPS"
    },
    "output": {
      "title": "輸出格式",
      "gif": "GIF",
      "webp": "WebP",
      "hint": "GIF 相容性最廣 · WebP 檔案更小、支援完整 alpha"
    },
    "quality": {
      "label": "WebP 品質",
      "hint": "0–100。數值越高品質越好但檔案越大。Lossless 開啟時忽略此參數。"
    },
    "lossless": {
      "label": "無損 WebP",
      "hint": "像素級精確輸出。檔案較大但與來源完全一致。"
    },
    "framesOptions": {
```

(The `url.placeholder` line is shown for context — its value should already be `"或貼上 Spritesheet PNG 的 URL..."` or similar. If the existing zh-TW value differs, leave it; only insert the 4 new blocks.)

- [ ] **Step 11: Update `result.download` in zh-TW**

Find the existing zh-TW value for `toGif.result.download` (likely `"download": "下載 GIF",`) and replace with:

```json
"download": "下載動畫",
```

- [ ] **Step 12: Verify JSON validity + lint + typecheck**

```bash
node -e "JSON.parse(require('fs').readFileSync('i18n/locales/en.json','utf8'))" && echo en.json OK
node -e "JSON.parse(require('fs').readFileSync('i18n/locales/zh-TW.json','utf8'))" && echo zh-TW.json OK
pnpm lint && pnpm typecheck
```
All four must succeed.

- [ ] **Step 13: Commit**

```bash
git add i18n/locales/en.json i18n/locales/zh-TW.json
git commit -m "i18n：PNG→GIF 重新命名為 GIF/WebP，新增 duration / output / quality / lossless 字串（en + zh-TW）"
```

---

### Task 5: i18n — Expanded SEO content (whyWebP + updated sections + new FAQ + new feature item)

**Files:**
- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/zh-TW.json`
- Modify: `app/pages/tools/png-to-gif.vue` (only the `seoSections` array)

Adds a new dedicated `whyWebP` SEO section, a new `outputFormat` feature item, three new FAQ items (`outputFormat`, `webpSupport`, `webpQuality`), and updates four existing strings (`whyConvert.content3`, `formatsExplained.title`, `formatsExplained.content3`, `howTo.step3.content`, `howTo.step4.content`, `faq.items.formats.a`, `api.content`, `api.features.formats`). All copy is the verbatim text from the "SEO Copy Reference" section at the top of this plan.

- [ ] **Step 1: Add `whyWebP` to `toGif.seo` in `i18n/locales/en.json`**

Find the existing block:

```json
      "whyConvert": {
```

Insert immediately ABOVE that line:

```json
      "whyWebP": {
        "title": "Why Choose Animated WebP for the Modern Web",
        "content": "Animated WebP files are typically 25–50% smaller than equivalent GIFs at the same visual quality. A 2 MB hero GIF on a marketing page becomes a 600–900 KB WebP — directly improving Largest Contentful Paint (LCP) scores and Core Web Vitals, both of which factor into Google search ranking. Smaller files also mean less mobile data usage, which matters for users on metered or slow connections.",
        "content2": "WebP supports 24-bit color and full alpha transparency, eliminating two of GIF's biggest limitations. GIF tops out at 256 colors per frame and only supports binary on/off transparency — that produces visible color banding on photographic content and hard, jagged edges around transparent objects. WebP preserves the original PNG anti-aliasing, so semi-transparent shadows, soft glows, and rounded corners look clean against any background.",
        "content3": "Browser support is universal in 2026. Chrome 32+, Firefox 65+, Safari 14+, and Edge 18+ all play animated WebP natively in a plain `<img>` tag — no JavaScript or polyfills needed. The remaining gaps are some older email clients and a handful of legacy chat platforms with stricter MIME policies. For public web pages, marketing sites, app screenshots, blog heroes, and modern messaging apps, WebP is the better default."
      },
```

- [ ] **Step 2: Replace `whyConvert.content3` in en.json**

Find the existing `whyConvert.content3` string (currently begins with "GIF animations are also self-contained"). Replace its value with:

```
For broader reach, GIF remains the safer choice — it works in older email clients and platforms that haven't adopted WebP yet. For modern web frontends, app stores, marketing sites, and any context where file size or color fidelity matter, animated WebP is the clear winner. This tool lets you switch between the two with a single click, so you can pick the right format per use case without re-converting from scratch.
```

- [ ] **Step 3: Replace `formatsExplained.title` and `formatsExplained.content3` in en.json**

Find `formatsExplained.title` value `"Understanding PNG vs GIF"` — replace with `"Understanding PNG, GIF, and Animated WebP"`.

Find `formatsExplained.content3` value (currently begins "Another key difference is transparency handling"). Replace with:

```
Animated WebP closes both gaps GIF leaves open: it preserves 24-bit color and full alpha transparency from your PNG source, so photographs stay sharp and semi-transparent edges stay smooth. WebP files are also typically 25–50% smaller than the GIF equivalent. The trade-off is browser/platform support — animated WebP works in every modern browser but may not display in older email clients or some chat tools. Pick GIF when you need maximum reach, WebP when file size, color fidelity, or alpha quality matter.
```

- [ ] **Step 4: Replace `howTo.step3.content` in en.json**

Replace its value with:

```
Set the frame duration in milliseconds — this controls how long each frame is displayed. The default of 100ms gives a smooth 10 FPS animation. Choose your output format: GIF for universal compatibility (older email clients, legacy platforms), or animated WebP for smaller files (~25–50% smaller) and full alpha transparency. When WebP is selected, optionally adjust the quality slider (default 80) or enable Lossless for pixel-perfect output. Set the loop count to 0 for infinite looping. For frames mode, enable filename-based sorting if your files use suffix conventions like walk_0.png, walk_1.png. For spritesheet mode, specify columns and rows (or cell pixel dimensions), and optionally set column/row ranges to extract a specific animation. If your spritesheet has extra borders, use Trim Margins to crop them before slicing.
```

- [ ] **Step 5: Replace `howTo.step4.content` in en.json**

Replace its value with:

```
Click Convert to send your files to the server and generate the animation. Conversion typically takes a few seconds. Once complete, a live preview displays the result so you can verify the timing, frame order, and overall look. The browser plays both GIF and WebP natively in the preview. If the result isn't right, adjust your settings and convert again. When you're satisfied, click Download to save the file (the extension matches the chosen output format — `.gif` or `.webp`). Click "Convert Another" to clear everything and start fresh.
```

- [ ] **Step 6: Add `outputFormat` to `features.items` in en.json**

Find the existing `privacy` entry inside `features.items` (it's the last entry in that block). After its closing `}` add a comma, then insert:

```json
"outputFormat": {
  "title": "Two Output Formats — GIF or Animated WebP",
  "content": "Choose GIF for maximum compatibility (older browsers, email clients, legacy chat platforms) or animated WebP for modern web targets where file size and visual quality matter. WebP files are typically 25–50% smaller than the equivalent GIF at the same quality, with full 24-bit color and alpha transparency. Switch between the two with a single click — no need to re-upload or re-configure."
}
```

So the resulting `items` block ends with `"privacy": { ... },` then `"outputFormat": { ... }` then closing `}` of `items`.

- [ ] **Step 7: Add three FAQ items to `faq.items` in en.json**

Find the existing `formats` entry inside `faq.items`. After it (and after its trailing comma), insert these three blocks BEFORE `maxFiles`:

```json
"outputFormat": {
  "q": "When should I choose GIF vs Animated WebP?",
  "a": "Choose GIF when you need maximum compatibility — older email clients, legacy chat platforms, or anywhere you can't be sure the recipient's tool supports WebP. Choose animated WebP for modern web targets: marketing sites, blog posts, app screenshots, modern messaging apps, and anywhere file size or color fidelity matters. WebP files are typically 25–50% smaller and preserve full 24-bit color with alpha transparency, while GIF is limited to 256 colors and binary on/off transparency."
},
"webpSupport": {
  "q": "Which browsers and platforms support animated WebP?",
  "a": "Every modern browser plays animated WebP natively in a plain <img> tag — Chrome 32+, Firefox 65+, Safari 14+, Edge 18+. That covers >97% of global users in 2026. Modern messaging apps including Discord, Slack (in standard workspaces), Twitter/X, and most blog platforms also display WebP correctly. The remaining gaps are some older email clients (Outlook 2019 and earlier on Windows) and a few legacy enterprise tools with strict MIME policies. For public web pages and modern chat tools, WebP is safe to use as the default."
},
"webpQuality": {
  "q": "What does the WebP quality slider control?",
  "a": "Quality (0–100, default 80) controls lossy compression. Higher values produce sharper images but larger files. 80 is the sweet spot for most use cases — visually indistinguishable from the source for most viewers, while still producing files much smaller than GIF. Below 60, compression artifacts become visible (especially on flat colors and edges). Above 90 the file size grows fast for diminishing visual returns. If you need pixel-perfect output, enable Lossless mode — the file will be larger but every pixel will exactly match the source PNG."
},
```

- [ ] **Step 8: Replace `faq.items.formats.a` in en.json**

Replace its value with:

```
The input must be PNG files — this applies to both modes. In frames mode, every uploaded file must be a PNG image. In spritesheet mode, the input must be a single PNG file (uploaded directly or via a public URL). The output is an animated GIF or animated WebP, selectable via the Output Format toggle. Other input formats (JPEG, WebP, BMP) are not supported — convert them to PNG first if needed.
```

- [ ] **Step 9: Replace `api.content` and `api.features.formats` in en.json**

`api.content` value:

```
Integrate PNG-to-animation conversion into your applications with the Easy GIF2Sprite API. Whether you assemble individual frames or slice a spritesheet, the API handles both workflows through two dedicated endpoints, and supports both GIF and animated WebP output via the `output_format` parameter.
```

`api.features.formats` value:

```
PNG input, GIF or animated WebP output (selectable via output_format parameter)
```

- [ ] **Step 10: Mirror everything in `i18n/locales/zh-TW.json`**

Apply the equivalent edits in zh-TW.json with the Traditional Chinese values from the "SEO Copy Reference (zh-TW copy)" section near the top of this plan:
- Insert `whyWebP` block before `whyConvert` with the zh-TW title/content/content2/content3.
- Replace `whyConvert.content3` with the zh-TW version.
- Replace `formatsExplained.title` and `formatsExplained.content3` with the zh-TW versions.
- Replace `howTo.step3.content` and `howTo.step4.content` with the zh-TW versions.
- Add `outputFormat` to `features.items` with the zh-TW title/content.
- Add three new FAQ items (`outputFormat`, `webpSupport`, `webpQuality`) after `formats`, with the zh-TW q/a strings.
- Replace `faq.items.formats.a` with the zh-TW version.
- Replace `api.content` and `api.features.formats` with the zh-TW versions.

- [ ] **Step 11: Wire the new sections into `seoSections` in `app/pages/tools/png-to-gif.vue`**

Find the existing `seoSections` array. Replace it entirely with:

```ts
const seoSections: import('~/types/seo').SeoSection[] = [
  {
    type: 'text' as const,
    titleKey: 'toGif.seo.whatIsFramesToGif.title',
    contentKeys: ['toGif.seo.whatIsFramesToGif.content', 'toGif.seo.whatIsFramesToGif.content2', 'toGif.seo.whatIsFramesToGif.content3'],
    adSlot: '3522192663'
  },
  {
    type: 'text' as const,
    titleKey: 'toGif.seo.whatIsSpritesheetToGif.title',
    contentKeys: ['toGif.seo.whatIsSpritesheetToGif.content', 'toGif.seo.whatIsSpritesheetToGif.content2', 'toGif.seo.whatIsSpritesheetToGif.content3'],
    adSlot: '6692010437'
  },
  {
    type: 'text' as const,
    titleKey: 'toGif.seo.whyWebP.title',
    contentKeys: ['toGif.seo.whyWebP.content', 'toGif.seo.whyWebP.content2', 'toGif.seo.whyWebP.content3']
  },
  {
    type: 'text' as const,
    titleKey: 'toGif.seo.whyConvert.title',
    contentKeys: ['toGif.seo.whyConvert.content', 'toGif.seo.whyConvert.content2', 'toGif.seo.whyConvert.content3'],
    adSlot: '7697241396'
  },
  {
    type: 'text' as const,
    titleKey: 'toGif.seo.formatsExplained.title',
    contentKeys: ['toGif.seo.formatsExplained.content', 'toGif.seo.formatsExplained.content2', 'toGif.seo.formatsExplained.content3'],
    adSlot: '5071078051'
  },
  {
    type: 'steps' as const,
    titleKey: 'toGif.seo.howTo.title',
    stepKeys: ['toGif.seo.howTo.step1', 'toGif.seo.howTo.step2', 'toGif.seo.howTo.step3', 'toGif.seo.howTo.step4'],
    adSlot: '8885162572'
  },
  {
    type: 'features' as const,
    titleKey: 'toGif.seo.features.title',
    itemKeys: [
      'toGif.seo.features.items.frames', 'toGif.seo.features.items.spritesheet',
      'toGif.seo.features.items.duration', 'toGif.seo.features.items.fileOrder',
      'toGif.seo.features.items.resize', 'toGif.seo.features.items.rangeSelect',
      'toGif.seo.features.items.outputFormat',
      'toGif.seo.features.items.privacy'
    ],
    adSlot: '7572080900'
  },
  {
    type: 'useCases' as const,
    titleKey: 'toGif.seo.useCases.title',
    itemKeys: [
      'toGif.seo.useCases.items.gamePreview', 'toGif.seo.useCases.items.socialMedia',
      'toGif.seo.useCases.items.documentation', 'toGif.seo.useCases.items.prototyping'
    ],
    adSlot: '1718885356'
  },
  {
    type: 'faq' as const,
    titleKey: 'toGif.seo.faq.title',
    itemKeys: [
      'toGif.seo.faq.items.formats',
      'toGif.seo.faq.items.outputFormat',
      'toGif.seo.faq.items.webpSupport',
      'toGif.seo.faq.items.webpQuality',
      'toGif.seo.faq.items.maxFiles',
      'toGif.seo.faq.items.frameOrder', 'toGif.seo.faq.items.differentSizes',
      'toGif.seo.faq.items.gridVsCell', 'toGif.seo.faq.items.transparency',
      'toGif.seo.faq.items.free', 'toGif.seo.faq.items.api'
    ],
    adSlot: '9864239738'
  }
]
```

(Changes vs. existing: inserted `whyWebP` between `whatIsSpritesheetToGif` and `whyConvert`; appended `outputFormat` to features `itemKeys`; inserted `outputFormat`, `webpSupport`, `webpQuality` after `formats` in faq `itemKeys`.)

- [ ] **Step 12: Verify JSON validity + lint + typecheck**

```bash
node -e "JSON.parse(require('fs').readFileSync('i18n/locales/en.json','utf8'))" && echo en.json OK
node -e "JSON.parse(require('fs').readFileSync('i18n/locales/zh-TW.json','utf8'))" && echo zh-TW.json OK
pnpm lint && pnpm typecheck
```
All must succeed.

- [ ] **Step 13: Commit**

```bash
git add i18n/locales/en.json i18n/locales/zh-TW.json app/pages/tools/png-to-gif.vue
git commit -m "PNG→GIF SEO 擴充：新增 whyWebP、outputFormat feature、3 個 WebP FAQ；更新 whyConvert/formats/howTo/api 文案（en + zh-TW）"
```

---

### Task 6: Waiting room — 2 new WebP-focused tips

**Files:**
- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/zh-TW.json`
- Modify: `app/pages/download.vue`

Adds 2 frontend-developer-focused tips to the waiting page (one on file-size + Core Web Vitals, one on alpha quality vs GIF), and bumps the toGif `tipCount` from 5 to 7.

- [ ] **Step 1: Append two tips to `waitingRoom.toGif.tips` in `i18n/locales/en.json`**

Find:

```json
    "toGif": {
      "tipsTitle": "Did You Know? PNG to GIF Tips",
      "tips": [
        "Set **Frame Duration** to control animation speed. 100ms gives a smooth 10 FPS animation, while 50ms creates a fast 20 FPS effect. Most pixel art animations look best at 80–120ms.",
        "Enable **Sort by Filename** when your frames use a naming convention like walk_0.png, walk_1.png. The tool will sort by the numeric suffix instead of upload order.",
        "If your frames have **different sizes**, choose \"Center on transparent canvas\" to automatically align them on the largest frame's dimensions without cropping.",
        "In **Spritesheet mode**, use the grid preview overlay to verify your column and row settings before converting. The red lines show exactly where the tool will slice.",
        "Use **Trim Margins** to crop extra borders around your spritesheet before slicing. Many exported spritesheets have outer padding that isn't part of the frame grid — trimming it ensures accurate cell alignment."
      ]
    },
```

Replace with:

```json
    "toGif": {
      "tipsTitle": "Did You Know? PNG to GIF / WebP Tips",
      "tips": [
        "Set **Frame Duration** to control animation speed. 100ms gives a smooth 10 FPS animation, while 50ms creates a fast 20 FPS effect. Most pixel art animations look best at 80–120ms.",
        "Enable **Sort by Filename** when your frames use a naming convention like walk_0.png, walk_1.png. The tool will sort by the numeric suffix instead of upload order.",
        "If your frames have **different sizes**, choose \"Center on transparent canvas\" to automatically align them on the largest frame's dimensions without cropping.",
        "In **Spritesheet mode**, use the grid preview overlay to verify your column and row settings before converting. The red lines show exactly where the tool will slice.",
        "Use **Trim Margins** to crop extra borders around your spritesheet before slicing. Many exported spritesheets have outer padding that isn't part of the frame grid — trimming it ensures accurate cell alignment.",
        "**Building for the web?** Switch the Output Format to **Animated WebP** for files **25–50% smaller** than the equivalent GIF at the same visual quality. Modern browsers (Chrome, Firefox, Safari, Edge) all support it natively in plain `<img>` tags — no polyfill, no JavaScript. Smaller files mean better Core Web Vitals (LCP, INP) and lower mobile data usage.",
        "**WebP keeps soft edges sharp.** GIF's 1-bit transparency creates hard, jagged edges around transparent objects, which is especially noticeable on logos, UI overlays, and screenshots with rounded corners. WebP preserves the original PNG anti-aliasing — semi-transparent shadows, glows, and soft edges look clean against any background colour."
      ]
    },
```

- [ ] **Step 2: Append two tips to `waitingRoom.toGif.tips` in `i18n/locales/zh-TW.json`**

Find the existing block (5 tips). Replace it with the same structure, adding `tipsTitle` update + 2 new tips:

```json
    "toGif": {
      "tipsTitle": "你知道嗎？PNG 轉 GIF / WebP 小技巧",
      "tips": [
        "設定 **幀延遲** 來控制動畫速度。100ms 可產生流暢的 10 FPS 動畫，50ms 則是快速的 20 FPS。大多數像素風格動畫在 80–120ms 的效果最佳。",
        "啟用 **依檔名排序** 可以讓工具依照檔名中的數字後綴排序（例如 walk_0.png、walk_1.png），而非上傳順序。",
        "如果你的各幀 **尺寸不同**，選擇「置中於透明畫布」可以自動以最大幀的尺寸對齊，不會裁切任何內容。",
        "在 **Spritesheet 模式** 下，上傳圖片後可利用格線預覽覆蓋層來確認欄數和列數設定是否正確。紅線會精確顯示工具將如何切割。",
        "使用 **裁切邊距** 可以在切割前裁掉 Spritesheet 周圍的多餘邊框。許多匯出的 Spritesheet 在網格外有額外留白，裁掉後才能確保格子對位精確。",
        "**在開發網站前端嗎？** 把輸出格式切換成 **Animated WebP**，檔案在相同畫質下會比 GIF 小 **25–50%**。所有現代瀏覽器（Chrome、Firefox、Safari、Edge）都能在純 `<img>` 標籤中原生播放 — 不需 polyfill、不需 JavaScript。檔案更小代表更好的 Core Web Vitals 指標（LCP、INP），行動裝置流量也更省。",
        "**WebP 讓柔邊保持乾淨。** GIF 的 1-bit 透明度會在透明物件邊緣產生硬邊鋸齒，logo、UI 疊圖、圓角截圖上特別明顯。WebP 完整保留 PNG 的 anti-aliasing — 半透明陰影、柔光、柔邊在任何背景色上都依然清晰乾淨。"
      ]
    },
```

- [ ] **Step 3: Bump `tipCount.toGif` from 5 to 7 in `app/pages/download.vue`**

Find:

```ts
    gifToSprite: 4, toGif: 5, pngToSpritesheet: 5, pngTrim: 4, splitSpritesheet: 5,
```

Replace with:

```ts
    gifToSprite: 4, toGif: 7, pngToSpritesheet: 5, pngTrim: 4, splitSpritesheet: 5,
```

- [ ] **Step 4: Verify JSON validity + lint + typecheck**

```bash
node -e "JSON.parse(require('fs').readFileSync('i18n/locales/en.json','utf8'))" && echo en.json OK
node -e "JSON.parse(require('fs').readFileSync('i18n/locales/zh-TW.json','utf8'))" && echo zh-TW.json OK
pnpm lint && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add i18n/locales/en.json i18n/locales/zh-TW.json app/pages/download.vue
git commit -m "等待頁新增 2 條 WebP 開發者導向 tips（en + zh-TW），tipCount 更新為 7"
```

---

### Task 7: Final integration check + push

**Files:** _(no code change — verification + push)_

- [ ] **Step 1: Full lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```
Both must exit 0.

- [ ] **Step 2: Manual end-to-end check on dev server**

```bash
pnpm dev
```

Open `/tools/png-to-gif`. Walk through:

1. **Frames mode + GIF (default)**: upload 3+ PNGs → frame duration visible above options → output format shows "GIF" selected → click Convert → preview plays → Download saves as `animation.gif`.
2. **Frames mode + WebP**: switch output toggle to "WebP" → quality slider + lossless switch appear → adjust quality to 60 → Convert → preview plays (browser renders WebP natively) → Download saves as `animation.webp` → re-upload and try `lossless=true` → quality slider should be disabled, file should be larger.
3. **Spritesheet mode + WebP**: upload a spritesheet → grid preview works → switch to WebP → Convert → result preview is webp → file extension correct.
4. **Options accordion**: confirm Frame Duration is NO LONGER inside the accordion (frames or spritesheet). Loop, fileNameOrder, resize remain in frames Options. frameCount, padding, ranges, skipEmpty, trim remain in spritesheet Options.
5. **Mode switch reset**: change tab from frames to spritesheet → outputFormat ref keeps its value (intentional — user prefers persistent choice). Frame uploads + result are cleared (existing `reset()` behaviour).
6. **3 free uses then ad gate**: trigger the ad modal flow → after ad, redirected to `/download?from=...&type=gif` (legacy `type=gif` query is harmless; download page reads `from` to identify the tool).
7. **Waiting page**: visit the waiting room → `Did You Know? PNG to GIF / WebP Tips` shows 7 tips, last 2 are the new WebP-focused ones.
8. **SEO sections**: scroll to the bottom of the tool page → confirm the new "Why Choose Animated WebP for the Modern Web" section appears between the second whatIs section and whyConvert. FAQ accordion has 3 new WebP entries near the top.
9. **Locale switch**: switch to 繁體中文 → all new strings render correctly in Chinese.

If any step fails, fix in place and re-run lint + typecheck before pushing.

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Note for the user**

After push, remind the user that the 7 other locales (`zh-CN`, `ja`, `ko`, `de`, `es`, `pt`, `ru`) need:
- `home.tools.toGif.title` / `.description` updated.
- `relatedTools.toGif` updated.
- `toGif.title` / `subtitle` updated.
- `toGif.duration.{label,hint}` / `toGif.output.{title,gif,webp,hint}` / `toGif.quality.{label,hint}` / `toGif.lossless.{label,hint}` added.
- `toGif.result.download` updated.
- `toGif.seo.whyWebP.{title,content,content2,content3}` added.
- `toGif.seo.whyConvert.content3` updated.
- `toGif.seo.formatsExplained.{title,content3}` updated.
- `toGif.seo.howTo.step3.content` and `step4.content` updated.
- `toGif.seo.features.items.outputFormat.{title,content}` added.
- `toGif.seo.faq.items.{outputFormat,webpSupport,webpQuality}` added (each with `q` + `a`).
- `toGif.seo.faq.items.formats.a` updated.
- `toGif.seo.api.content` and `api.features.formats` updated.
- `waitingRoom.toGif.tipsTitle` updated and 2 new tips appended (array length 5 → 7).

Also tell the user to mark the relevant TODO `[#6] gif2ss + 前端 — PNG → Animated GIF / WebP` as done after they confirm everything works in the browser.

---

## Self-Review

**Spec coverage:**
- ✅ Output format toggle (gif/webp) — Task 2 (state) + Task 3 (UI) + Task 1 (proxy)
- ✅ WebP quality + lossless controls — Task 2 (state) + Task 3 (UI) + Task 4 (i18n)
- ✅ Frame Duration moved out of Options — Task 3 Steps 1, 2, 3, 4
- ✅ Output Format placed outside Options — Task 3 Steps 1, 3
- ✅ Tool relabel everywhere — Task 4 + Task 2 Step 5 (JSON-LD)
- ✅ Full SEO content (page-level) — Task 5
- ✅ WebP article on waiting page (frontend-dev focused) — Task 6 (Tip 6 explicitly opens with "Building for the web?" / "在開發網站前端嗎？")
- ✅ Server proxy Content-Type forwarding — Task 1
- ✅ Dynamic filename + extension on download — Task 2 Steps 3, 4
- ✅ tipCount bump — Task 6 Step 3
- ✅ JSON-LD updated for new tool focus — Task 2 Step 5
- ✅ Only en + zh-TW touched (other 7 locales out of scope per memory) — Tasks 4, 5, 6 explicitly scope to these two

**Placeholder scan:** No "TBD", no "implement later", no "similar to Task N" without the actual code, no "add validation". Every code block is complete and verbatim-paste-ready.

**Type / API consistency:**
- `outputFormat: 'gif' | 'webp'` — defined in Task 2 Step 1, used in Task 2 Step 2 (FormData), Task 3 Steps 1, 3 (template buttons), Task 3 Step 5 (alt text). ✅
- `webpQuality: number` (0–100) — defined in Task 2 Step 1, FormData payload in Task 2 Step 2, slider in Task 3. ✅
- `webpLossless: boolean` — defined Task 2 Step 1, FormData Task 2 Step 2, switch Task 3. ✅
- `outputFilename` computed — used in `useDownloadStore().setBlob()` (Task 2 Step 3) and `downloadResult()` (Task 2 Step 4). ✅
- i18n keys referenced in template (Task 3) all defined in Task 4 (UI labels) — `toGif.duration.{label,hint}`, `toGif.output.{title,gif,webp,hint}`, `toGif.quality.{label,hint}`, `toGif.lossless.{label,hint}`. ✅
- New SEO key paths added in Task 5 match the references in `seoSections` array (Task 5 Step 11). ✅
- `tipCount.toGif` bump (Task 6 Step 3) matches array length 7 (Task 6 Steps 1, 2). ✅

**Risks acknowledged:**
- Spritesheet `ssDuration` is a SEPARATE ref from frames `duration` — they were always separate in the codebase. Task 3 binds the spritesheet quick-settings duration field to `ssDuration`, not `duration`. The shared `outputFormat` ref intentionally crosses both modes (single user choice). Confirmed correct in Task 3 Step 3.
- The result preview `<img>` already supports webp natively in modern browsers; no plugin or worker needed.
- Older browsers without WebP support would fail to render the preview, but Nuxt 4's targeted browser support already excludes those — no fallback needed for this tool's users.
