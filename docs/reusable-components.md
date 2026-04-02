# Reusable Components and Composables

This document covers every reusable component and composable in the ClawStudio project, with props, usage examples, and integration patterns.

---

## AdUnit.vue

**File:** `app/components/AdUnit.vue`

A wrapper around a Google AdSense `<ins>` tag that handles initialization and styling.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `slot` | `string` | **(required)** | The AdSense ad slot ID (numeric string, e.g. `"8882057481"`). |
| `format` | `string` | `'auto'` | Ad format. Common values: `'auto'`, `'autorelaxed'`, `'fluid'`. |
| `layout` | `string` | `''` | Ad layout. Set to `'in-article'` for content-interleaved ads. |
| `responsive` | `boolean` | `true` | Whether the ad is full-width responsive. Set to `false` for fixed-size placements. |

### Usage Examples

**Sidebar ad (auto format, responsive):**

```vue
<AdUnit slot="8882057481" />
```

**Above-footer ad (relaxed format, non-responsive):**

```vue
<AdUnit slot="1939246744" format="autorelaxed" :responsive="false" />
```

**In-article ad (between SEO content sections):**

```vue
<AdUnit slot="7383145112" format="fluid" layout="in-article" />
```

**Waiting room ad:**

```vue
<AdUnit slot="1774557803" />
```

### How It Works

On mount, the component pushes to the `window.adsbygoogle` array, which triggers the AdSense SDK to fill the `<ins>` element. The SDK itself is loaded globally in `app/app.vue` via `useHead`:

```ts
script: [
  {
    src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6385934484512467',
    async: true,
    crossorigin: 'anonymous'
  }
]
```

The component computes its inline style based on the `layout` prop:
- `layout="in-article"` -> `display:block; text-align:center;`
- All other layouts -> `display:block`

---

## WaitingRoom.vue

**File:** `app/components/WaitingRoom.vue`

A reusable countdown-to-download component used on the `/download` page. It displays a progress bar, a download button that activates after the countdown, and slots for ads and content.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `countdown` | `number` | `15` | Number of seconds for the countdown timer. |
| `returnPath` | `string` | `'/'` | Path to navigate back to after the download completes. |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `downloaded` | none | Emitted after the user clicks the download button and the file download is triggered. |

### Slots

| Slot | Purpose |
|------|---------|
| `#ad` | Ad unit placement. Rendered below the download button. |
| `#content` | Tool-specific educational content, tips, API promotion, etc. Rendered below the ad slot. |

### Internal Behavior

1. On mount, starts a 1-second interval timer counting down from `countdown` to 0.
2. The download button is disabled until `remaining` reaches 0.
3. When the user clicks download:
   - Retrieves the blob from `useDownloadStore()`.
   - Creates a temporary `<a>` element and triggers the download.
   - Sets `downloaded = true`, emits `downloaded`.
   - Resets the `usage_count` cookie to 0.
   - After a 2-second delay, clears the store and navigates to `returnPath`.

### Usage (from `app/pages/download.vue`)

```vue
<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const store = useDownloadStore()

const returnPath = computed(() => (route.query.from as string) || localePath('/'))

useSeoMeta({
  title: () => t('waitingRoom.title'),
  robots: 'noindex, nofollow'   // waiting room should not be indexed
})

onMounted(() => {
  // Redirect if no blob (user navigated directly or refreshed)
  if (!store.blob.value) {
    navigateTo(returnPath.value)
  }
})
</script>

<template>
  <WaitingRoom :countdown="15" :return-path="returnPath">
    <template #ad>
      <AdUnit slot="1774557803" />
    </template>

    <template #content>
      <div class="space-y-8">
        <!-- Tips, API promos, educational content -->
      </div>
    </template>
  </WaitingRoom>
</template>
```

### Template Layout

```
┌──────────────────────────────────────┐
│  Progress bar + countdown text       │
├──────────────────────────────────────┤
│  [Download] button (disabled until 0)│
├──────────────────────────────────────┤
│  #ad slot                            │
├──────────────────────────────────────┤
│  #content slot                       │
└──────────────────────────────────────┘
```

---

## useDownloadStore

**File:** `app/composables/useDownloadStore.ts`

A global (module-scoped) blob store that allows the tool page to pass a binary result to the download waiting room without serialization.

### Why Not sessionStorage?

Binary blobs (especially large images and ZIP files) cannot be efficiently serialized into sessionStorage. The store uses module-level `ref` values that persist across client-side navigation but are lost on full page refresh.

### API

```ts
const store = useDownloadStore()
```

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `store.blob` | `Readonly<Ref<Blob \| null>>` | The stored blob, readonly. |
| `store.filename` | `Readonly<Ref<string>>` | The filename for download, readonly. |
| `store.setBlob(data, name)` | `(Blob, string) => void` | Store a blob with a filename. Call this from the tool page when the usage limit is exceeded. |
| `store.clear()` | `() => void` | Clear the stored blob and filename. Called automatically by `WaitingRoom.vue` after the download completes. |

### Implementation

```ts
// Module-level refs (shared across all callers, persist during session)
const blob = ref<Blob | null>(null)
const filename = ref('')

export function useDownloadStore() {
  function setBlob(data: Blob, name: string) {
    blob.value = data
    filename.value = name
  }

  function clear() {
    blob.value = null
    filename.value = ''
  }

  return {
    blob: readonly(blob),
    filename: readonly(filename),
    setBlob,
    clear
  }
}
```

### Usage in a Tool Page

In the `convert()` function, after a successful conversion when the free limit is exceeded:

```ts
if (usageCount.value >= FREE_LIMIT) {
  useDownloadStore().setBlob(blob, 'spritesheet.png')
  showAdModal.value = true
}
```

### Usage in WaitingRoom.vue

The `WaitingRoom` component reads from the store to trigger the download:

```ts
const store = useDownloadStore()

function download() {
  if (!store.blob.value) return
  const url = URL.createObjectURL(store.blob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = store.filename.value
  a.click()
  URL.revokeObjectURL(url)
  // ... then clear and redirect
}
```

---

## Usage Limiter Pattern

The usage limiter is **not** a separate component or composable -- it is a pattern implemented directly in each tool page. Here is the complete pattern:

### 1. Define the Cookie and Constants

```ts
const FREE_LIMIT = 3
const usageCount = useCookie<number>('usage_count', {
  default: () => 0,
  maxAge: 60 * 60 * 24   // 24 hours
})
const showAdModal = ref(false)
const remainingUses = computed(() => FREE_LIMIT - usageCount.value)
const limitExceeded = computed(() => usageCount.value >= FREE_LIMIT)
```

**Notes:**
- The cookie name `usage_count` is shared across tools (a single usage counter). If you want per-tool limits, use a unique cookie name per tool.
- `maxAge` of 86400 seconds (24 hours) means the counter resets daily.
- The cookie is also reset to 0 after a successful download in the waiting room.

### 2. Increment on Submit

```ts
function submitConvert() {
  if (!file.value) return
  usageCount.value++       // increment before converting
  convert()
}
```

### 3. Branch After Conversion

Inside `convert()`, after receiving the result:

```ts
status.value = 'done'

if (usageCount.value >= FREE_LIMIT) {
  // Store blob for waiting room
  useDownloadStore().setBlob(blob, 'output.png')
  showAdModal.value = true
} 
// else: user can download directly from the tool page
```

### 4. Show Remaining Uses Hint

```vue
<p v-if="remainingUses <= 3 && remainingUses > 0" class="text-xs text-muted text-center">
  {{ t('yourTool.adModal.remaining', { count: remainingUses }, remainingUses) }}
</p>
```

### 5. Conditional Download Button

```vue
<!-- Direct download (within free limit) -->
<UButton
  v-if="!limitExceeded"
  :label="t('yourTool.result.download')"
  icon="i-lucide-download"
  size="lg"
  @click="downloadResult"
/>

<!-- Go to waiting room (limit exceeded) -->
<UButton
  v-if="limitExceeded"
  :label="t('yourTool.adModal.watch')"
  icon="i-lucide-arrow-right"
  size="lg"
  @click="showAdModal = true"
/>
```

### 6. Ad Modal -> Waiting Room

The modal contains no ads (AdSense compliance). It is a simple confirmation with "Confirm" and "Close" buttons:

```ts
function onAdConfirm() {
  showAdModal.value = false
  const localePath = useLocalePath()
  navigateTo({
    path: localePath('/download'),
    query: {
      type: 'your-type',
      from: localePath('/tools/your-tool-slug')
    }
  })
}
```

### 7. Cookie Reset

The `WaitingRoom.vue` component resets the cookie after download:

```ts
const usageCount = useCookie<number>('usage_count', { default: () => 0 })
usageCount.value = 0
```

### Complete Flow Diagram

```
User clicks "Convert"
  -> usageCount++ (now 1, 2, or 3+)
  -> convert() runs, gets result blob
  -> if usageCount < FREE_LIMIT:
       show result + direct download button
  -> if usageCount >= FREE_LIMIT:
       store blob in useDownloadStore
       show ad modal (no ads, just confirmation text)
       user clicks "Confirm"
       -> navigate to /download?type=...&from=...
       -> WaitingRoom countdown (15s)
       -> ads + content displayed during wait
       -> download button activates
       -> user clicks download
       -> file downloads, usage_count cookie reset to 0
       -> redirect back to tool page
```
