# Blog Publishing Guide

## 架構概覽

這個 Blog 系統由三個核心元件組成，**不需要為每篇文章建立 Vue 頁面**：

| 檔案 | 職責 |
|------|------|
| `content/{locale}/blog/{slug}.md` | 文章本體（各語系分別存放） |
| `app/pages/blog/[slug].vue` | 全站唯一的文章動態路由，所有文章共用 |
| `app/components/BlogPostLayout.vue` | 版面外殼（breadcrumb、標題區、SEO） |

### 資料流

```
使用者訪問 /ja/blog/my-post
        ↓
[slug].vue 攔截，取得 slug = "my-post"、locale = "ja"
        ↓
queryCollection('blog').path('/ja/blog/my-post')
        ↓ 找到 → 使用日文版
        ↓ 找不到 → fallback 到 /en/blog/my-post
        ↓
<ContentRenderer> 將 markdown 渲染為 HTML
        ↓
<BlogPostLayout> 套上版面（breadcrumb / 標題 / SEO meta）
```

**fallback 機制**：每個語系的 markdown 檔案是選填的。若某語系尚未翻譯，用戶訪問時會自動顯示英文版，不會 404。

---

## Frontmatter 規格

每篇 markdown 檔案的開頭必須包含以下 frontmatter（由 `content.config.ts` 定義 schema）：

```yaml
---
title: "文章完整標題"
description: "一句話摘要，用於列表頁和 SEO"
date: "YYYY-MM-DD"
readingTime: 6          # 閱讀時間（分鐘），估算即可
tag: "tutorial"         # 只能是 tutorial | guide | news
---
```

`title` 和 `description` 直接顯示在文章頁面和列表頁，也用於 `<meta>` SEO 標籤。**請確保每個語系的翻譯版本中，frontmatter 欄位值也對應翻譯。**

---

## 發布新文章的步驟

### Step 1：建立英文 markdown（必填）

```
content/en/blog/<slug>.md
```

`slug` 即 URL 路徑，例如 `my-new-post` → `/blog/my-new-post`。

```markdown
---
title: "Post Title in English"
description: "One-sentence summary for the blog index and SEO."
date: "YYYY-MM-DD"
readingTime: 5
tag: "tutorial"
---

## Section Heading

Paragraph content here...
```

**注意事項：**
- 程式碼區塊（\`\`\`json / \`\`\`bash 等）照常使用，`<ContentRenderer>` 會正確渲染
- 圖片放在 `public/blog/<slug>/` 資料夾，路徑寫 `/blog/<slug>/image.png`
- 需要特殊尺寸或置中的圖片可以用 HTML `<img>` 標籤，但**注意這是 markdown 正文，不是 vue-i18n 字串，不受 vue-i18n 的 HTML 標籤限制**
- 內部連結寫絕對路徑（`/tools/gif-to-sprite`），框架會自動加上語系前綴

### Step 2：建立各語系翻譯（選填，建議盡早完成）

為每個目標語系建立對應的 markdown 檔案：

```
content/zh-TW/blog/<slug>.md
content/zh-CN/blog/<slug>.md
content/ja/blog/<slug>.md
content/ko/blog/<slug>.md
content/de/blog/<slug>.md
content/es/blog/<slug>.md
content/pt/blog/<slug>.md
content/ru/blog/<slug>.md
```

翻譯規則：
- **翻譯**：frontmatter 的 `title` / `description`，以及所有正文段落、標題、圖片 `alt` 屬性、連結文字
- **保留不動**：`date`、`readingTime`、`tag`、程式碼區塊內容、所有圖片路徑、所有外部 URL

### Step 3（選填）：加到首頁 What's New

如果文章值得在首頁露出，在 `app/composables/useWhatsNew.ts` 的 `ENTRIES` 陣列最前面插入（最新的排最前）：

```ts
{
  key: 'myNewPost',         // camelCase，用於 i18n key 查找
  type: 'blog',
  icon: 'i-lucide-book-open',
  to: '/blog/my-new-post',  // URL slug
  date: 'YYYY-MM-DD',
  isNew: true
}
```

同時在 `i18n/locales/en.json` 和 `zh-TW.json` 的 `home.whatsNew.items` 下加入對應 key：

```json
"myNewPost": {
  "title": "Blog: Post Title",
  "description": "One-sentence teaser for the What's New card."
}
```

再用 `/i18n-translator` 把新的 `home.whatsNew.items.<key>` 同步到其他 7 個語系。

> What's New 沒有自動過期機制。累積幾篇後，把舊的 entry 從 `ENTRIES` 移除即可；i18n key 可以留著不動。

---

## 安全邊界：`/__nuxt_content/` 是公開端點

`@nuxt/content` v3 在 build 時會在 `/__nuxt_content/blog/sql_dump.txt` 生成一份壓縮的 SQLite dump，供 client-side content querying 使用。這個端點是公開可存取的（任何人都可以 GET）。

**影響範圍**：這個 dump 包含 `content/` 目錄下**所有已發布文章的完整內容**——標題、正文、frontmatter 全部都在裡面。

**安全守則**：
- `content/` 目錄只能放**打算公開的文章**。這個目錄沒有任何存取控制。
- 不要把草稿、內部文件、含機密資訊的文章放在 `content/` 裡，即使尚未在前端顯示入口，內容仍會出現在 sql_dump 中。
- 草稿用 git 另開分支管理，或放在 `.gitignore` 的本地目錄，確認後再 commit 進 `content/`。

這是 `@nuxt/content` v3 的設計行為，無法關閉，也不需要關閉——blog 文章本來就是公開內容。只是要確保放進去的每一篇都是有意識要公開的。

---

## 重要：哪些 i18n key 不再被使用

`i18n/locales/*.json` 裡的 `blog.posts.*` 區塊（包含 `title`、`description`、`date`）是**遷移前的遺留資料**，目前的程式碼中沒有任何地方引用這些 key。文章的標題和描述完全來自 markdown frontmatter，由 `@nuxt/content` 直接讀取。

這些 key **不需要維護**，未來可以在清理 i18n 檔案時移除。

---

## Blog 列表頁的運作方式

`app/pages/blog/index.vue` 固定查詢 `content/en/blog` 底下的所有文章作為列表來源：

```ts
queryCollection('blog').path('/en/blog').all()
```

這表示：
1. **所有文章都必須有英文版**，列表頁的排序和卡片資訊（標題、描述、日期、標籤）來自英文 markdown frontmatter
2. 列表頁的卡片文字**不會跟著語系切換**（顯示英文 frontmatter 的內容）
3. 點進文章後，`[slug].vue` 會嘗試載入當前語系的版本，此時才有本地化效果

---

## 加入翻譯的建議工作流

1. 先寫好英文版 `content/en/blog/<slug>.md`
2. 請 Claude（Cowork 模式）翻譯，說明：「請翻譯這篇 blog 文章到其他 8 個語系，建立對應的 markdown 檔案」
3. Claude 會建立 `content/{lang}/blog/<slug>.md`，保留程式碼區塊和圖片路徑不動，只翻譯文字內容

---

## 驗證與 commit

```bash
pnpm lint && pnpm typecheck
```

確認通過後 commit：

```bash
git add content/ app/composables/useWhatsNew.ts i18n/locales/en.json i18n/locales/zh-TW.json
git commit -m "feat: add blog post — <title>"
```
