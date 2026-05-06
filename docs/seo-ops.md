# SEO 日常維運

ClawStudio 的 SEO 基礎設施：`@nuxtjs/sitemap` 自動生成 sitemap、`@nuxtjs/i18n` 管理 hreflang、`nuxt-schema-org` 注入 JSON-LD。本文件說明需要人工介入的操作情境。

---

## Sitemap

### 端點與設定

`/sitemap.xml` 由 `@nuxtjs/sitemap` v8 動態生成，回傳 HTTP 200。所有 9 個語系的 URL 包含在同一個 sitemap 中（`sitemaps: false` — 停用 sitemap index 模式，以避免 `/sitemap.xml` 被 307 重新導向）。

**排除的路徑**（`nuxt.config.ts`）：
- `/download` — 下載等待室（無實質內容）
- `/*/download` — 所有語系前綴版本

### 何時需要重新提交 sitemap

以下情況建議重新提交：

| 情境 | 行動 |
|---|---|
| 新增工具頁（`/tools/<slug>`） | 重新提交 |
| 新增部落格文章 | 重新提交 |
| 網域/URL 結構變更 | 重新提交 |
| 例行每月確認 | 不需重新提交，Google 會自動 crawl |

### 在 Google Search Console 提交 sitemap

1. 前往 [Google Search Console](https://search.google.com/search-console)
2. 選擇 `clawstudiouo.com` property
3. 左側選單 → **Sitemaps**
4. 在「Add a new sitemap」輸入框填入：`sitemap.xml`（只填路徑，不填完整 URL）
5. 點擊 **Submit**

若已提交過且需要**重新觸發 crawl**（例如大量新增頁面後）：
1. 找到已提交的 `sitemap.xml` 記錄
2. 點擊旁邊的三點選單 → **Remove**
3. 等 30 秒後重新提交（步驟同上）

> 重新提交不會清空 Google 已索引的頁面，只是告訴 Google「請優先重新 crawl 這份清單」。

### 驗證 sitemap 格式

```bash
# 本地確認回傳 200 與正確 XML
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/sitemap.xml
curl -s http://localhost:3000/sitemap.xml | head -20

# 生產環境
curl -s -o /dev/null -w "%{http_code}\n" https://clawstudiouo.com/sitemap.xml
```

---

## robots.txt

`/robots.txt` 由 `@nuxtjs/sitemap` 自動管理，內容包含 `Sitemap: https://clawstudiouo.com/sitemap.xml`，無需手動維護。

---

## hreflang

`@nuxtjs/i18n` 會在每個頁面的 `<head>` 自動注入正確的 `<link rel="alternate" hreflang="...">` 標籤，覆蓋所有 9 個語系及 `x-default`。不需要手動維護。

---

## 頁面索引狀態監控

若發現某頁面長時間未被索引，可透過 Google Search Console 手動請求索引：

1. Search Console → **URL Inspection**
2. 輸入完整 URL（例如 `https://clawstudiouo.com/tools/gif-to-sprite`）
3. 點擊 **Request Indexing**

---

## 相關設定位置

| 設定 | 位置 |
|---|---|
| sitemap exclude 路徑 | `nuxt.config.ts` → `sitemap.exclude` |
| 網站根 URL | `nuxt.config.ts` → `site.url` |
| i18n locale 清單 | `nuxt.config.ts` → `i18n.locales` |
| 每個工具頁的 JSON-LD | `app/pages/tools/<slug>.vue` 的 `useSchemaOrg()` |
