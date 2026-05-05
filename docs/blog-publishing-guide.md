# Blog Publishing Guide

## 發布一篇新文章需要動的檔案

| 檔案 | 動作 |
|------|------|
| `app/pages/blog/<slug>.vue` | 新增：文章內容 |
| `app/composables/useBlogPosts.ts` | 修改：加一筆 metadata |
| `i18n/locales/en.json` | 修改：加 `blog.posts.<key>.*` |
| `i18n/locales/zh-TW.json` | 修改：同上（繁中翻譯） |
| `app/composables/useWhatsNew.ts` | 選做：讓文章出現在首頁 What's New |
| `i18n/locales/en.json` + `zh-TW.json` | 選做：加 `home.whatsNew.items.<key>.*` |

---

## Step 1：寫文章頁面

建立 `app/pages/blog/<slug>.vue`。slug 即 URL 路徑，例如 `my-new-post` → `/blog/my-new-post`。

```vue
<!-- app/pages/blog/my-new-post.vue -->
<script setup lang="ts">
const localePath = useLocalePath()
</script>

<template>
  <BlogPostLayout
    title-key="blog.posts.myNewPost.title"
    description-key="blog.posts.myNewPost.description"
    date="YYYY-MM-DD"
    :reading-time="5"
  >
    <template #content>
      <!-- 文章正文，用 <section class="space-y-3"> 切段 -->
      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Section Title</h2>
        <p class="text-muted leading-relaxed">...</p>
      </section>
    </template>
  </BlogPostLayout>
</template>
```

注意事項：
- 正文直接寫在 Vue template，不走 i18n（文章太長，且 CI 會擋含 HTML 標籤的 i18n 字串）
- 內部連結一律用 `localePath`：`:to="localePath('/tools/gif-to-sprite')"`
- 外部連結加 `target="_blank"`
- i18n 的 `titleKey` / `descriptionKey` 用於 SEO（`useSeoMeta`）和 `/blog` 列表頁

---

## Step 2：加 metadata 到 useBlogPosts

在 `app/composables/useBlogPosts.ts` 的 `POSTS` 陣列最前面插入新文章（最新的排最前）：

```ts
{
  slug: 'my-new-post',
  titleKey: 'blog.posts.myNewPost.title',
  descriptionKey: 'blog.posts.myNewPost.description',
  date: 'YYYY-MM-DD',
  readingTime: 5,        // 分鐘，估算即可
  tag: 'tutorial'        // 'tutorial' | 'guide' | 'news'
}
```

---

## Step 3：加 i18n 標題與描述

在 `i18n/locales/en.json` 的 `blog.posts` 下新增：

```json
"myNewPost": {
  "title": "Post Title in English",
  "description": "One-sentence summary for the blog index and SEO.",
  "date": "YYYY-MM-DD"
}
```

在 `i18n/locales/zh-TW.json` 加相同結構的繁中翻譯。

**禁止**在 i18n 字串裡放 HTML 標籤（`<strong>` 等），CI 會 block build。

---

## Step 4（選做）：加到首頁 What's New

如果文章值得在首頁露出，在 `app/composables/useWhatsNew.ts` 的 `ENTRIES` 最前面加：

```ts
{
  key: 'myNewPost',
  type: 'blog',
  icon: 'i-lucide-book-open',
  to: '/blog/my-new-post',
  date: 'YYYY-MM-DD',
  isNew: true
}
```

同時在 `i18n/locales/en.json` 和 `zh-TW.json` 的 `home.whatsNew.items` 下加：

```json
"myNewPost": {
  "title": "Blog: Post Title",
  "description": "One-sentence teaser for the What's New card."
}
```

What's New 卡片沒有自動過期機制。累積幾篇文章後，把舊的 entry 從 `ENTRIES` 移除即可，對應的 i18n key 可留著不動。

---

## Step 5：驗證與 commit

```bash
pnpm lint && pnpm typecheck
```

確認通過後 commit：

```bash
git add app/pages/blog/my-new-post.vue \
        app/composables/useBlogPosts.ts \
        i18n/locales/en.json \
        i18n/locales/zh-TW.json
git commit -m "feat: add blog post — <title>"
```

如果有動到 `useWhatsNew.ts`，一起加進 staging。
