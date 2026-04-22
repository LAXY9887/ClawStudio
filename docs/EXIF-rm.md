# 隱私清理 (EXIF Remover) 實作指南

這份文件定義了「圖片隱私掃描器」與「EXIF 移除工具」的開發細節，旨在透過專業的隱私保護功能提升網站權重與 API 收益。

---

## 0. 檔案大小限制推算 (512MB Cloud Run RAM)

### 記憶體消耗模型

Sharp 在處理圖片時，峰值記憶體用量約為：

```
峰值 = Node.js 基本佔用 + (解碼後原始像素 × 2)
     = ~80MB + (寬 × 高 × 4 bytes × 2)
```

其中 ×2 是因為 Sharp 同時持有輸入 buffer 和輸出 buffer。

### 常見規格對照

| 設備 / 規格 | 像素數 | 原始像素大小 | 峰值記憶體 | 結論 |
|---|---|---|---|---|
| iPhone 14/13 主鏡頭 | 12MP | 49MB | ~178MB | ✅ 安全 |
| 一般消費級相機 | 24MP | 97MB | ~274MB | ✅ 安全 |
| iPhone 15 Pro 主鏡頭 | 48MP | 195MB | ~470MB | ⚠️ 接近上限 |
| Sony A7R V | 61MP | 246MB | ~572MB | ❌ OOM 風險 |

> HEIC 因 libheif 解碼需額外工作記憶體，實際峰值可能比上表再高 10–20%。

### 結論

安全像素上限：約 **40–45MP**（考慮 20% 餘裕後）。

**建議統一限制：前後端均採 30MB 上限。**

理由：
- JPEG/WebP/AVIF/HEIC 是壓縮格式，30MB HEIC 足以涵蓋 iPhone 15 Pro 48MP 照片（原生約 5–8MB）
- PNG/TIFF 是較大的格式，但 30MB 對應約 7,500×2,700 RGBA，仍在安全範圍內
- 超過 30MB 通常是 ProRAW 或專業相機原始檔，不在本工具目標客群內

---

## 1. 後端架構 (Node.js + Sharp)

### 核心技術棧

* **影像處理** : `sharp` (高性能、低記憶體佔用)
* **資訊提取** : `exifr` (支援多種格式，效能極佳)
* **HEIC EXIF 剝離** : `exiftool-vendored`（用於 HEIC 格式，見下方說明）

### 支援格式

所有端點均支援：**JPEG, PNG, WebP, AVIF, TIFF, HEIC/HEIF**

### HEIC 特殊處理說明

Sharp 可讀取 HEIC（透過 libheif），但無法在保留格式的前提下輸出 HEIC。
為了讓清理後的輸出格式和輸入一致，HEIC 須採用不同策略：

- **非 HEIC 格式**：使用 `sharp` 的 `.withMetadata(false)` 搭配重新編碼完成。
- **HEIC 格式**：使用 `exiftool-vendored` 直接從二進位層抹除 EXIF，**不進行重新編碼**，可完整保留原始壓縮品質與格式。

> 這個方式比重新編碼更專業，因為不會有任何畫質損失，是 HEIC 格式最正確的處理方式。

### 端點設計 (Endpoints)

#### **端點 1: `POST /api/v1/exif/scan` (隱私掃描)**

* **功能** : 解析上傳圖片，以 JSON 回傳所有潛在的隱私風險。
* **單檔處理**，不支援批次。
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

> **GPS 顯示策略**：不串接 Reverse Geocoding API。後端只回傳 `exifr` 原生的十進位經緯度，前端用 lat/lng 組出 OpenStreetMap 靜態地圖連結直接嵌入，零 API 依賴、零成本。地圖上的紅點定位比文字地址更直觀。

#### **端點 2: `POST /api/v1/exif/clean` (隱私移除)**

* **功能** : 抹除所有元數據並回傳清理後的圖片，**輸出格式與輸入格式一致**。
* **單檔處理**，不支援批次。
* **技術重點** :
  * 非 HEIC：使用 `sharp` 的 `.withMetadata(false)`
  * HEIC：使用 `exiftool-vendored` 直接剝離，不重新編碼
* **ICC Profile 保留**：清理前先提取 ICC Profile，清理後重新嵌入，確保色彩不偏色。

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

* **Free (測試)** : 5 次/日 (主要讓開發者測試格式相容性)。
* **Basic (初創)** : $9 USD / 1,000 次。
* **Pro (企業)** : $29 USD / 10,000 次。

### OpenAPI 規格簡化 (Swagger)

```yaml
paths:
  /clean:
    post:
      summary: Strip all EXIF metadata from an image (JPEG/PNG/WebP/AVIF/TIFF/HEIC)
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                image: { type: string, format: binary }
      responses:
        '200':
          description: Cleaned image file (same format as input)
          content:
            image/*: { schema: { type: string, format: binary } }
```

---

## 4. SEO 關鍵字策略

為了讓這個工具在 2026 年排在第一頁，建議在工具頁面嵌入以下關鍵字：

* **主詞** : `EXIF Remover`, `Metadata Cleaner`, `照片隱私清理`
* **問題導向** : `如何刪除照片拍攝地點？`, `iPhone 照片 GPS 座標移除`, `怎麼看照片的元數據？`
* **長尾詞** : `免費線上移除 EXIF 工具`, `專業級影像資訊抹除 API`, `HEIC EXIF 移除`

---

## 5. 實作檢查清單 (TODO)

* [ ] 安裝並設定 `sharp`、`exifr`、`exiftool-vendored` 後端路由。
* [ ] 實作 ICC Profile 提取 → 清理 → 重新嵌入流程（非 HEIC 格式）。
* [ ] 實作 HEIC 路徑：`exiftool-vendored` 直接剝離 EXIF，不重新編碼。
* [ ] 實作 GPS 地圖顯示：用 lat/lng 組出 OpenStreetMap 靜態地圖嵌入連結。
* [ ] 設計「移除前後」的資訊對比組件。
* [ ] 前後端統一設定 30MB 檔案大小上限。
* [ ] 部署至 Cloud Run（512MB RAM）並設定 RapidAPI Key 驗證。
