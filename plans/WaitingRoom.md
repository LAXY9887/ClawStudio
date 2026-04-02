# 下載緩衝頁 (Waiting Room) 規劃

## 背景

Google AdSense 規範禁止彈窗強制廣告和誘導性文字。改為「確認視窗 + 下載緩衝頁」機制，廣告自然呈現在緩衝頁中。

---

## 流程

```
使用者轉換成功（第 3 次起，免費額度已用完）
  → 彈出確認視窗（無廣告、無誘導文字）
  → 使用者點「確認」
  → 導向下載緩衝頁 /download（帶 query params）
  → 進度條倒數（例如 15 秒）
  → 倒數期間顯示廣告 + 工具介紹 + RapidAPI 引流
  → 倒數完成 → 下載按鈕 Active
  → 使用者點擊下載
  → 重置使用次數（Cookie 歸零）
  → 自動導回原工具頁
```

### 免費額度內的流程（第 1-2 次）

```
使用者轉換成功
  → 直接在工具頁顯示結果 + 下載按鈕（現有行為不變）
```

---

## 改動清單

### 1. 修改免費次數
- `FREE_LIMIT` 從 5 改為 2

### 2. 修改廣告彈窗 Modal
- 移除 Modal 內的廣告預留位置
- 保留確認視窗文字（已由使用者手動修改 i18n）
- 「確認」按鈕改為導向下載緩衝頁
- 「關閉」按鈕保留（關閉 Modal，不重置）

### 3. 建立下載緩衝頁 `/download`

**路由：** `app/pages/download.vue`

**Query Params：**
| 參數 | 說明 |
|------|------|
| `type` | `spritesheet` 或 `frames` |
| `from` | 來源工具路徑，例如 `/tools/gif-to-sprite` |

**頁面結構：**
```
┌─────────────────────────────────────┐
│  進度條（倒數 15 秒，寬度佔滿）      │
├─────────────────────────────────────┤
│  廣告區（寬度佔滿）                  │
├─────────────────────────────────────┤
│  工具介紹文字段落                     │
│  RapidAPI 引流描述 + CTA 按鈕       │
├─────────────────────────────────────┤
│  [下載按鈕] （倒數完才 Active）      │
│  點擊後觸發下載 → 重置次數 → 導回    │
└─────────────────────────────────────┘
```

### 4. 組件化設計

**`WaitingRoom.vue`（通用元件）**
- Props:
  - `countdown`: 倒數秒數（預設 15）
  - `downloadFn`: 下載觸發函數
  - `returnPath`: 下載完成後導回的路徑
- Slots:
  - `#ad`: 廣告區插槽
  - `#content`: 工具介紹 + 引流內容插槽
- 內建：進度條、下載按鈕、倒數邏輯、導回邏輯

**`app/pages/download.vue`**
- 讀取 query params
- 從 sessionStorage 取得待下載的 Blob
- 使用 `WaitingRoom` 元件，注入對應工具的內容

### 5. 修改轉換結果處理

**次數用完時（usageCount >= FREE_LIMIT）：**
- 轉換仍正常執行（不攔截轉換本身）
- 轉換完成後，將結果 Blob 存入 sessionStorage
- 彈出確認視窗
- 確認後導向 `/download?type=spritesheet&from=/tools/gif-to-sprite`

**to-frames 模式：**
- 取消自動下載
- 與 spritesheet 模式統一流程：結果存 sessionStorage → 緩衝頁下載

### 6. 下載完成後

- 觸發下載（`URL.createObjectURL` + `<a>` click）
- 重置 `usageCount` Cookie 為 0
- 延遲 1-2 秒後 `navigateTo(returnPath)` 導回工具頁

---

## i18n 新增 Key

```
waitingRoom.title: "Your file is being prepared..."
waitingRoom.ready: "Your file is ready!"
waitingRoom.download: "Download"
waitingRoom.countdown: "Please wait {seconds} seconds..."
waitingRoom.redirecting: "Redirecting back..."
waitingRoom.description: (工具介紹文字)
waitingRoom.apiPromo: (RapidAPI 引流文字)
```

---

## 待確認

- [ ] 倒數秒數（建議 15 秒，可調整）
- [ ] sessionStorage 的 Blob 大小上限（大檔案可能有問題，備案：用全域 ref 暫存）
