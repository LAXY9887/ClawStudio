# 🚀 Nuxt 3 個人門戶與 GIF 服務架構方案

## 1. 專案目標

* **引流與展示：** 建立個人品牌，展示 GCP 上的開發成果。
* **SEO 優化：** 確保工具頁面（如 GIF 轉 Sprite）能被 Google 直接搜尋。
* **低成本維運：** 利用 GCP 免費額度與 Serverless 架構，達成「無流量、無扣費」。
* **廣告變現：** 透過 AdSense 流量獲利，並實作次數限制邏輯。

---

## 2. 技術棧選擇 (Tech Stack)

| **類別**      | **推薦方案**                | **理由**                                                |
| ------------------- | --------------------------------- | ------------------------------------------------------------- |
| **前端框架**  | **Nuxt 3**                  | 支援 SSR/SSG，SEO 友善，Vue 生態系上手快。                    |
| **UI 組件庫** | **Nuxt UI**(Tailwind-based) | 現代感強、效能極佳、高度可自定義。                            |
| **部署環境**  | **GCP Cloud Run**           | 處理 SSR 邏輯；若採靜態 SSG 則選**Firebase Hosting** 。 |
| **後端邏輯**  | **Nitro (Nuxt 內建)**       | 處理 API 轉發與計數邏輯。                                     |

---

## 3. 資料流架構：後端轉發 (Backend Proxy)

為了解決 **CORS** 問題並隱藏真實的 API 端點，我們採用伺服器對伺服器（Server-to-Server）的調用模式。

### 調用流程：

1. **Browser (User):** 點擊轉檔，發送請求至 `https://your-site.com/api/convert`。
2. **Nuxt Server (Nitro):** 接收請求，檢查 Cookie 中的使用次數。
3. **GCP Cloud Run (GIF Service):** Nuxt Server 在後端調用 GIF 轉檔服務（URL 由環境變數 `NUXT_GIF_SERVICE_URL` 設定）。
4. **Response:** GIF 服務回傳結果給 Nuxt，Nuxt 再回傳給瀏覽器。

---

## 4. 關鍵功能實作邏輯

### A. 廣告計數器 (Usage Limiter)

使用 `useCookie` 兼顧 SSR 與用戶端狀態，實現「使用 3 次後提示廣告」。

**JavaScript**

```
// 邏輯示例
const usageCount = useCookie('usage_count', { default: () => 0 });

const handleAction = () => {
  if (usageCount.value >= 3) {
    showAdModal(); // 觸發廣告彈窗或觀看提示
  } else {
    executeService(); // 執行服務
    usageCount.value++;
  }
};
```

### B. SEO 與渲染策略

* **工具介紹頁：** 採用  **SSR / SSG** ，確保 HTML 內含關鍵字（H1, Meta Tags）。
* **工具操作區：** 採用 **CSR (Client-side)** 互動，提升用戶操作流暢度。

---

## 5. GCP 部署與優化建議

* **冷啟動優化：** * 啟用 Cloud Run 的  **「Startup CPU Boost」** 。
  * 視流量情況考慮設定 `min-instances: 1`。
* **安全性：** * 使用 GCS **Signed URLs** 處理限時下載。
  * 將 API Key 存放在 GCP  **Secret Manager** 。
* **廣告佈局：** * 針對直接引流的工具頁，廣告應置於「標題下方」與「操作結束後的彈窗」。

---

## 6. 下一步行動清單 (TODO)

1. [ ] 初始化 Nuxt 3 專案並安裝 Nuxt UI。
2. [ ] 在 `server/api` 建立第一個 Proxy 轉發器測試與 GIF 服務連動。
3. [ ] 建立基本的 SEO 頁面模板。
4. [ ] 部署至 Cloud Run 並觀察冷啟動延遲。
