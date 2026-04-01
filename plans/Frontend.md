# 🎨 前端頁面規劃

## 1. 整體架構

| 路由 | 頁面 | 渲染模式 | 說明 |
|------|------|----------|------|
| `/` | 首頁 | SSG (`prerender: true`) | 工具列表入口 |
| `/tools/gif-to-sprite` | GIF 轉 Sprite 工具頁 | SSR（預設） | SEO + 互動操作 |

---

## 2. 共用 Layout

### 頁面結構

```
┌─────────────────────────────────────────────┐
│  Header（固定置頂）                          │
├────────┬─────────────────────┬───────────────┤
│  左側   │   主內容區          │   右側         │
│  廣告欄 │                     │   廣告欄       │
│ (sticky)│                     │  (sticky)      │
│         │                     │                │
├────────┴─────────────────────┴───────────────┤
│  Footer                                       │
└─────────────────────────────────────────────┘
```

### Header
- 左側：品牌 Logo / 站名「ClawStudio」
- 右側：導航連結（首頁、工具列表）+ 語言切換
- 固定置頂

### 左右廣告欄
- 左右各一直欄，`position: sticky` 隨視窗滾動
- 寬度固定（例如 160px）
- 小螢幕（< 1280px）自動隱藏，改為內容區內嵌橫幅
- 預留 `<div>` 空間，AdSense 就緒後直接填入

### Footer
- 版權聲明
- 條款 / 隱私連結（預留）
- 簡潔一行式

---

## 3. 多語系（i18n）

使用 `@nuxtjs/i18n` 模組，所有 UI 文本抽離至獨立語言檔。

### 檔案結構

```
i18n/
  locales/
    en.json      # English（預設）
    zh-TW.json   # 繁體中文
```

### 規則
- 元件內不寫死任何顯示文字，一律用 `$t('key')` 取值
- 語言切換按鈕放在 Header 右側
- URL 前綴策略：`/en/tools/...`、`/zh-TW/tools/...`（SEO 友善）

---

## 4. 首頁 `/`

### 內容
- 標題區：簡短 slogan（例如「Free Online Dev Tools」）
- 工具卡片列表（Grid 佈局）

### 工具卡片
- 圖示 / Icon
- 工具名稱
- 一行描述
- 點擊整張卡片導向工具頁

### 目前工具

| 工具名稱 | 路由 | 描述 |
|----------|------|------|
| GIF to Spritesheet | `/tools/gif-to-sprite` | 將 GIF 動畫轉換為 Sprite 圖或逐幀 PNG |

> 未來新增工具只需在列表中加入卡片即可。

---

## 5. 工具頁 `/tools/gif-to-sprite`

參考設計：[jpg2png.com](https://jpg2png.com)，簡化為單檔操作流程。

### 頁面結構（由上至下）

#### A. 標題區
- H1：「GIF to Spritesheet」
- 副標題：簡短說明功能用途（兼 SEO 關鍵字）
- Meta Tags：title、description、og:image 等

#### B. 模式選擇
使用者可切換兩種輸出模式：

| 模式 | API 端點 | 輸出格式 | 說明 |
|------|----------|----------|------|
| **Spritesheet** | `/to-spritesheet` | PNG | 所有幀排列成一張 Sprite 圖 |
| **Frames** | `/to-frames` | ZIP | 每一幀輸出為獨立 PNG，打包成 ZIP |

- 預設選中 Spritesheet
- 使用 Tab 或 Toggle 切換

#### C. 上傳區
- 大面積拖放區（虛線邊框、icon 提示）
- **整個區域可點擊**觸發檔案選擇對話框
- 同時支援 **拖放（Drag & Drop）**
- 限制：僅接受 `.gif`，單檔
- 檔案大小上限提示：**20MB**
- 支援兩種輸入方式（與 API 一致）：
  - 本機檔案上傳（`file` 參數）
  - GIF URL 輸入框（`url` 參數，擇一）

#### D. 進階選項（可收合面板）

根據模式顯示不同選項：

**Spritesheet 模式獨有：**

| 選項 | 對應參數 | 輸入類型 | 預設值 | 說明 |
|------|----------|----------|--------|------|
| 欄數 | `columns` | 數字輸入 | 自動 | 格狀排列的欄數 |
| 間距 | `padding` | 數字輸入 | 0 | 幀與幀之間的像素間距 |

**兩種模式共用：**

| 選項 | 對應參數 | 輸入類型 | 預設值 | 說明 |
|------|----------|----------|--------|------|
| 移除背景 | `remove_bg` | Toggle | 關 | 開啟後顯示下方兩個選項 |
| 背景色 | `bg_color` | 文字輸入 / color picker | auto | `"auto"` 或 `#RRGGBB` |
| 容差值 | `tolerance` | Slider (0-255) | 30 | 色差容許範圍 |

#### E. 狀態區（上傳後顯示）
- **上傳中**：進度條 / spinner
- **轉換中**：spinner + 「轉換中...」文字
- **錯誤**：紅色提示訊息 + 重試按鈕
  - 對應 API 錯誤碼：400 / 413 / 422 / 500

#### F. 結果區（轉換完成後顯示）

**Spritesheet 模式：**
- 大尺寸 Spritesheet 圖片預覽（寬度撐滿內容區，可捲動）
- 檔案資訊（尺寸、大小）
- 「下載 Spritesheet」按鈕（主要 CTA）
- 「重新上傳」按鈕（次要）

**Frames 模式：**
- 提示文字：「已產生 ZIP 檔案，包含 N 張逐幀 PNG」
- 「下載 ZIP」按鈕（主要 CTA，直接觸發瀏覽器下載）
- 「重新上傳」按鈕（次要）

### 操作流程

```
使用者進入頁面
  → 選擇模式（Spritesheet / Frames）
  → 調整進階選項（可選）
  → 拖放或點擊上傳區選擇 GIF 檔案（或輸入 URL）
  → 顯示「轉換中...」狀態
  → 前端 POST /api/convert 或 /api/frames（FormData）
  → 後端轉發至 GCP（帶 X-Internal-Key）
  → Spritesheet 模式：收到 PNG → 顯示大圖預覽 + 下載按鈕
  → Frames 模式：收到 ZIP → 直接觸發下載
  → 使用者下載或重新上傳
```

---

## 6. API 端點

| Method | Path | 請求 | 回應 | 說明 |
|--------|------|------|------|------|
| POST | `/api/convert` | FormData (file/url + 選項) | `image/png` | 轉發至 GCP `/to-spritesheet` |
| POST | `/api/frames` | FormData (file/url + 選項) | `application/zip` | 轉發至 GCP `/to-frames` |

`/api/convert` 已實作於 `server/api/convert.post.ts`。
`/api/frames` 待建立。

---

## 7. 元件拆分

| 元件 | 用途 |
|------|------|
| `AppHeader.vue` | 共用 Header（Logo + 導航 + 語言切換） |
| `AppFooter.vue` | 共用 Footer |
| `AdSidebar.vue` | 左右側廣告直欄（sticky） |
| `ToolCard.vue` | 首頁工具卡片 |
| `FileDropZone.vue` | 拖放 + 點擊上傳區 |
| `UrlInput.vue` | GIF URL 輸入框 |
| `ModeSelector.vue` | Spritesheet / Frames 模式切換 |
| `AdvancedOptions.vue` | 進階選項面板（columns, padding, remove_bg 等） |
| `ConvertStatus.vue` | 轉換狀態顯示（loading / error） |
| `ConvertResult.vue` | Spritesheet 預覽（大圖）+ 下載按鈕 |
| `FramesResult.vue` | Frames 模式 ZIP 下載 |

---

## 8. 待確認項目

- [ ] 品牌色系 / 主題色？（目前使用 Nuxt UI 預設）
- [ ] Logo 設計？（暫用文字）
- [ ] 廣告 AdSense 帳號就緒？
- [ ] 初始支援語言？（建議先做 en + zh-TW）
- [ ] URL 輸入方式是否需要在第一版實作？（可後續加入）
