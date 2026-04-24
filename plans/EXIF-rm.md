# 隱私清理 (EXIF Remover) 實作指南

> **規格**：Cloud Run 1GB RAM｜單次端點 50MB/張｜批次端點 20MB/張 × 最多 10 張｜批次端點僅限 Pro 計劃

這份文件定義了「圖片隱私掃描器」與「EXIF 移除工具」的開發細節，旨在透過專業的隱私保護功能提升網站權重與 API 收益。

---

## 0. 檔案大小限制推算 (1GB Cloud Run RAM)

### 記憶體消耗模型

Pillow 在處理圖片時，峰值記憶體用量約為：

```
峰值 = Python 基本佔用 + (解碼後原始像素 × 2)
     = ~60MB + (寬 × 高 × 4 bytes × 2)
```

其中 ×2 是因為 Pillow 同時持有輸入 buffer 和輸出 buffer。

### 常見規格對照

| 格式 | 50MB 檔案解碼估算 | 峰值記憶體 | 結論 |
|---|---|---|---|
| HEIC / JPEG / WebP | 受限相機像素上限 ~80MP → ~320MB | ~700MB | ✅ 安全 |
| PNG（照片，~4× 壓縮） | ~200MB | ~460MB | ✅ 安全 |
| TIFF（無壓縮） | = 12.5MP RGBA → 50MB | ~160MB | ✅ 安全 |
| PNG（高壓縮截圖，~10×） | ~500MB | ~1060MB | ⚠️ 理論邊緣，實際不存在 |

> HEIC 因 pillow-heif 解碼需額外工作記憶體，實際峰值可能比上表再高 10–20%，仍在安全範圍內。

### 結論

1GB RAM 下，50MB 限制對所有真實相片場景非常安全，峰值最多約 **700MB**，保有 **300MB+ 餘裕**。

**檔案大小限制：**

| 端點類型 | 每張上限 | 張數上限 | 理由 |
|------|---------|---------|------|
| 單次端點 | 50MB | 1 | 峰值 ~700MB，1GB 下有 300MB+ 餘裕 |
| 批次端點 | 20MB | 10 | 累積結果 + 處理峰值 < 900MB，安全通過 |

理由：
- JPEG/WebP/AVIF/HEIC 壓縮格式，20MB 足以涵蓋一般消費級相機
- 批次端點限制 20MB 是為防止累積結果撐爆記憶體（第 10 張處理時已有 9 張結果在記憶體中）
- 理論上的 PNG 壓縮炸彈（純色截圖）不在目標客群內，無需特別處理

---

## 1. 後端架構 (Python + FastAPI)

### 核心技術棧

* **Web 框架** : `FastAPI` + `uvicorn`（與其他服務統一）
* **影像處理** : `Pillow`（PIL，讀取 / 重新編碼 / ICC Profile 操作）
* **HEIC 支援** : `pillow-heif`（將 HEIC/HEIF 格式註冊進 Pillow）
* **EXIF 提取** : `piexif`（JPEG/TIFF）+ `pillow-heif` 的 metadata API（HEIC）
* **HEIC EXIF 剝離** : `pyexiftool`（Python wrapper for ExifTool，用於不重新編碼的直接剝離）

### 支援格式

所有端點均支援：**JPEG, PNG, WebP, AVIF, TIFF, HEIC/HEIF**

### HEIC 特殊處理說明

Pillow 透過 `pillow-heif` 可讀取 HEIC，但重新編碼輸出 HEIC 會有品質損失。
為了讓清理後的輸出格式和輸入一致，HEIC 須採用不同策略：

- **非 HEIC 格式**：使用 Pillow 重新編碼，儲存時不帶 EXIF（`exif=b""`）。
- **HEIC 格式**：使用 `pyexiftool` 直接從二進位層抹除 EXIF，**不進行重新編碼**，可完整保留原始壓縮品質與格式。

> 這個方式比重新編碼更專業，因為不會有任何畫質損失，是 HEIC 格式最正確的處理方式。

### 端點設計 (Endpoints)

| 端點 | 說明 | 檔案限制 | 可用計劃 |
|------|------|---------|---------|
| `POST /scan` | 單張掃描 | 50MB | Free / Basic / Pro |
| `POST /clean` | 單張清理 | 50MB | Free / Basic / Pro |
| `POST /batch/scan` | 批次掃描 | 20MB × 10 張 | **Pro only** |
| `POST /batch/clean` | 批次清理 | 20MB × 10 張 | **Pro only** |

> **計費原則**：1 張圖片 = 1 次 API call。批次 10 張 = 消耗 10 次 quota。

#### **端點 1: `POST /scan` (單張隱私掃描)**

* **功能** : 解析上傳圖片，以 JSON 回傳所有潛在的隱私風險。
* **檔案上限** : 50MB。
* **回傳範例** :

```json
{
  "hasPrivacyRisk": true,
  "summary": {
    "gps": {
      "lat": 25.0330,
      "lng": 121.5654,
      "altitude": 42.3,
      "direction": 183.5
    },
    "device": "iPhone 15 Pro",
    "software": "Adobe Photoshop 2026",
    "timestamp": "2026-04-22T16:50:00Z"
  },
  "raw": {}
}
```

> **GPS 顯示策略**：不串接 Reverse Geocoding API。後端只回傳 `piexif` 解析出的十進位經緯度，前端用 lat/lng 組出 OpenStreetMap 靜態地圖連結直接嵌入，零 API 依賴、零成本。地圖上的紅點定位比文字地址更直觀。

#### **端點 2: `POST /clean` (單張隱私移除)**

* **功能** : 抹除所有元數據並回傳清理後的圖片，**輸出格式與輸入格式一致**。
* **檔案上限** : 50MB。
* **技術重點** :
  * 非 HEIC：使用 Pillow 重新編碼，儲存時帶 `exif=b""`
  * HEIC：使用 `pyexiftool` 直接剝離，不重新編碼
* **ICC Profile 保留**：清理前先提取 ICC Profile，清理後重新嵌入，確保色彩不偏色。

#### **端點 3: `POST /batch/scan` (批次隱私掃描，Pro only)**

* **功能** : 一次上傳最多 10 張圖片，以 JSON 陣列回傳每張的掃描結果。
* **檔案上限** : 每張 20MB，最多 10 張。
* **存取控制** : 檢查 `X-RapidAPI-Subscription` header，非 Pro 計劃回傳 `403`。
* **回傳範例** :

```json
[
  {
    "filename": "photo1.jpg",
    "hasPrivacyRisk": true,
    "summary": { "gps": { "lat": 25.033, "lng": 121.565 }, "device": "iPhone 15 Pro" },
    "raw": {}
  },
  {
    "filename": "photo2.png",
    "hasPrivacyRisk": false,
    "summary": {},
    "raw": {}
  }
]
```

#### **端點 4: `POST /batch/clean` (批次隱私移除，Pro only)**

* **功能** : 一次上傳最多 10 張圖片，循序清理後打包為 ZIP 回傳。
* **檔案上限** : 每張 20MB，最多 10 張。
* **存取控制** : 檢查 `X-RapidAPI-Subscription` header，非 Pro 計劃回傳 `403`。
* **回傳** : `application/zip`，檔名為 `cleaned.zip`，內含各清理後圖片（原檔名不變）。
* **技術重點** :
  * 循序處理（非並發），每張處理完畢後立即釋放記憶體（`del image; gc.collect()`）
  * 結果暫存記憶體後打包，峰值記憶體 < 900MB

---

## 2. 前端介面 (Nuxt 3)

### 使用者流程 (User Flow)

1. **上傳區** : 拖放圖片（單檔），背景自動調用 `端點 1`。
2. **診斷面板** :
   * **紅色警告** : 若含有 GPS 資訊，顯示小地圖（Google Maps/Leaflet 靜態圖）。
   * **資訊列表** : 條列式顯示設備、時間、軟體資訊。
3. **執行清理** : 點擊「一鍵抹除隱私」按鈕，調用 `端點 2`。
4. **下載驗證** :
   * 提供下載按鈕。
   * 下方顯示提示：「*下載後可再次上傳，親自驗證清理效果。*」

### UI 設計細節

* **雷達掃描動畫** : 上傳時顯示雷達掃描波紋，增加專業感。
* **安全評分** : 處理前（紅色分數），處理後（綠色 100 分）。

---

## 3. RapidAPI 商業布局

### API 產品定位

* **名稱** : `Universal Image Privacy & EXIF Cleaner`
* **目標對象** : 社群平台開發者、電商自動化腳本、隱私防護 App。

### 方案設計 (Pricing)

| 方案 | 價格 | Quota | 可用端點 |
|------|------|-------|---------|
| **Free** | 免費 | 5 次/日 | `/scan`、`/clean` |
| **Basic** | $9 USD / 1,000 次 | 1,000 次/月 | `/scan`、`/clean` |
| **Pro** | $29 USD / 10,000 次 | 10,000 次/月 | 全部端點（含 `/batch/*`） |

> **計費說明**：批次端點按張數計費，1 張 = 1 次。批次 10 張 = 消耗 10 次 quota。此規則需在 RapidAPI 描述與 API 文件中明確標注。

### 存取控制實作

批次端點在 middleware 中讀取 `X-RapidAPI-Subscription` header：

```python
BATCH_ALLOWED_PLANS = {"PRO", "ULTRA", "MEGA"}  # RapidAPI 方案名稱

def check_batch_access(request: Request):
    plan = request.headers.get("X-RapidAPI-Subscription", "").upper()
    if plan not in BATCH_ALLOWED_PLANS:
        raise HTTPException(status_code=403, detail={
            "error": "plan_not_supported",
            "message": "Batch endpoints require a Pro plan or above."
        })
```

> 本機開發（無 RapidAPI header）時，`X-RapidAPI-Subscription` 為空，批次端點會回傳 403。可在 `.env` 加 `DEV_BYPASS_PLAN_CHECK=true` 暫時跳過，避免影響本機測試。

### OpenAPI 規格簡化 (Swagger)

```yaml
paths:
  /scan:
    post:
      summary: Scan an image for privacy risks (GPS, device, timestamp)
      requestBody:
        content:
          multipart/form-data:
            schema:
              properties:
                image: { type: string, format: binary }
      responses:
        '200': { description: JSON privacy report }

  /clean:
    post:
      summary: Strip all EXIF metadata from an image (JPEG/PNG/WebP/AVIF/TIFF/HEIC)
      requestBody:
        content:
          multipart/form-data:
            schema:
              properties:
                image: { type: string, format: binary }
      responses:
        '200':
          description: Cleaned image file (same format as input)
          content:
            image/*: { schema: { type: string, format: binary } }

  /batch/scan:
    post:
      summary: "[Pro] Scan up to 10 images for privacy risks"
      requestBody:
        content:
          multipart/form-data:
            schema:
              properties:
                images: { type: array, items: { type: string, format: binary } }
      responses:
        '200': { description: JSON array of privacy reports }
        '403': { description: Pro plan required }

  /batch/clean:
    post:
      summary: "[Pro] Strip EXIF from up to 10 images, returns ZIP"
      requestBody:
        content:
          multipart/form-data:
            schema:
              properties:
                images: { type: array, items: { type: string, format: binary } }
      responses:
        '200':
          description: ZIP file containing all cleaned images
          content:
            application/zip: { schema: { type: string, format: binary } }
        '403': { description: Pro plan required }
```

---

## 4. SEO 關鍵字策略

為了讓這個工具在 2026 年排在第一頁，建議在工具頁面嵌入以下關鍵字：

* **主詞** : `EXIF Remover`, `Metadata Cleaner`, `照片隱私清理`
* **問題導向** : `如何刪除照片拍攝地點？`, `iPhone 照片 GPS 座標移除`, `怎麼看照片的元數據？`
* **長尾詞** : `免費線上移除 EXIF 工具`, `專業級影像資訊抹除 API`, `HEIC EXIF 移除`

---

## 5. 實作檢查清單 (TODO)

**後端**
* [ ] 建立 FastAPI 專案結構，安裝 `Pillow`、`pillow-heif`、`piexif`、`pyexiftool` 並設定 auth middleware。
* [ ] 實作 `POST /scan`（單張掃描，50MB 上限）。
* [ ] 實作 `POST /clean`（單張清理，50MB 上限），含 ICC Profile 提取 → 清理 → 重新嵌入。
* [ ] 實作 HEIC 路徑：`pyexiftool` 直接剝離 EXIF，不重新編碼。
* [ ] 實作 `POST /batch/scan`（批次掃描，20MB × 10 張，Pro only）。
* [ ] 實作 `POST /batch/clean`（批次清理，20MB × 10 張，Pro only），循序處理 + `gc.collect()`，結果打包 ZIP 回傳。
* [ ] 實作 `check_batch_access` middleware，讀取 `X-RapidAPI-Subscription` 驗證計劃等級。
* [ ] `.env` 加入 `DEV_BYPASS_PLAN_CHECK` 供本機測試使用。
* [ ] 部署至 Cloud Run（1GB RAM，timeout 180s）並設定 RapidAPI Key 驗證。

**前端**
* [ ] 實作 GPS 地圖顯示：用 lat/lng 組出 OpenStreetMap 靜態地圖嵌入連結。
* [ ] 設計「移除前後」的資訊對比組件。
* [ ] 前端檔案大小驗證：單次上傳限制 50MB。
